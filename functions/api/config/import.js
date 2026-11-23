// functions/api/config/import.js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';
import { getUrlMatchCandidates, normalizeUrlForStorage } from '../../lib/utils';
import {
    normalizeBookmarkDesc,
    normalizeBookmarkLogo,
    normalizeBookmarkName,
    normalizeBookmarkUrl,
    normalizeCategoryName,
    IMPORT_BODY_MAX_BYTES,
    IMPORT_BODY_MAX_MB,
    validateImportSizes,
} from '../../lib/validators';
import { buildPrivateDescendantStatements } from '../../lib/privacy-guard';

function getImportIdKey(value) {
    return String(value ?? '');
}

function getImportParentIdKey(value) {
    const key = getImportIdKey(value);
    return key === '' ? '0' : key;
}

const ROOT_IMPORT_CATEGORY_NAME = '默认';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  // 导入会分多次 db.batch()/run() 提交，属于多事务写入：中途失败时数据库已部分变更。
  // 打脏标记统一放在 finally 里执行一次，原因有两点：
  //   1. KV 对同一个 key 限制每秒一次写入，超频的后续写入可能被静默丢弃，
  //      因此同一请求内不能对同一个 dirty key 写两次；
  //   2. finally 能同时覆盖成功、抛错和参数校验早返回三种出口。
  // 这里的标志表示「数据库可能已变更」，在每次写库前置位，好让中途失败也能被标记。
  let dbMayHaveChanged = false;

  try {
    // 限制请求体大小
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > IMPORT_BODY_MAX_BYTES) {
      return errorResponse(`请求体过大，最大允许 ${IMPORT_BODY_MAX_MB}MB`, 413);
    }

    const jsonData = await request.json();
    let categoriesToImport = [];
    let sitesToImport = [];
    let isNewFormat = false;
    // 获取 override 参数，默认 false
    const override = !!jsonData.override;

    // Detect import format
    // Handle the wrapper payload if it exists (due to frontend change passing { ...data, override })
    let payload = jsonData;
    if (jsonData.category && jsonData.sites && (jsonData.override !== undefined || Object.keys(jsonData).length > 2)) {
         // It's the new payload wrapper
         payload = jsonData;
    } else if (jsonData.category && jsonData.sites) {
        // Direct export format
        payload = jsonData;
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.category) && Array.isArray(payload.sites)) {
      categoriesToImport = payload.category;
      sitesToImport = payload.sites;
      isNewFormat = true;
    } else if (Array.isArray(jsonData)) { // Legacy format support (raw array)
      sitesToImport = jsonData;
    } else {
      return errorResponse('Invalid JSON format. Expected { "category": [...], "sites": [...] } or an array of sites.', 400);
    }

    const importSizeCheck = validateImportSizes(categoriesToImport, sitesToImport);
    if (!importSizeCheck.ok) {
      return errorResponse(importSizeCheck.message, 400);
    }

    if (sitesToImport.length === 0 && categoriesToImport.length === 0) {
      return jsonResponse({ code: 200, message: 'Import successful, but no sites were found to import.' });
    }

    const db = env.NAV_DB;
    // Cloudflare D1 限制单条语句变量数为 100。
    // 在导入过程中的 SELECT ... WHERE IN (...) 查询中，
    // 将分块大小设为 50 以确保绝对安全且不影响效率。
    const BATCH_SIZE = 50;

    // --- Category Processing ---
    const oldCatIdToNewCatIdMap = new Map(); // Maps JSON ID -> DB ID
    const privateCategoryIdsToPropagate = new Set();
    const normalizedImportCategoryNames = new Map();
    let categoryNameToIdMap = new Map(); // For legacy format mapping
    
    // 1. Fetch all existing categories from DB
    const { results: existingDbCategoriesRaw } = await db.prepare('SELECT id, catelog, parent_id, is_private FROM category').all();
    const existingDbCategories = existingDbCategoriesRaw || [];
    
    // Helper to find existing category by name and parent_id
    const findExistingCategory = (name, parentId) => {
        const normalizedParentId = (parentId === null || parentId === undefined) ? 0 : parseInt(parentId, 10);
        return existingDbCategories.find(c => {
            const dbParentId = (c.parent_id === null || c.parent_id === undefined) ? 0 : parseInt(c.parent_id, 10);
            return c.catelog === name && dbParentId === normalizedParentId;
        });
    };

    if (isNewFormat) {
        // Validate all categories first
        for (const cat of categoriesToImport) {
            const categoryNameResult = normalizeCategoryName(cat.catelog);
            if (!categoryNameResult.ok) {
                return errorResponse(`导入失败：${categoryNameResult.message}`, 400);
            }
            normalizedImportCategoryNames.set(cat, categoryNameResult.value);
        }

        // Sort categories to ensure parents are processed before children (Topological Sort)
        let sortedCats = [];
        let remaining = [...categoriesToImport];
        let processedJsonIds = new Set(['0']);
        
        let lastRemainingCount = -1;
        while(remaining.length > 0) {
            if (remaining.length === lastRemainingCount) {
                sortedCats.push(...remaining);
                break;
            }
            lastRemainingCount = remaining.length;
            
            const [ready, notReady] = remaining.reduce((acc, cat) => {
                const pid = getImportParentIdKey(cat.parent_id);
                if (processedJsonIds.has(pid)) {
                    acc[0].push(cat);
                } else {
                    acc[1].push(cat);
                }
                return acc;
            }, [[], []]);
            
            ready.sort((a, b) => (a.id || 0) - (b.id || 0));
            ready.forEach(cat => processedJsonIds.add(getImportIdKey(cat.id)));
            sortedCats.push(...ready);
            remaining = notReady;
        }
        categoriesToImport = sortedCats;

        for (const cat of categoriesToImport) {
            const catName = normalizedImportCategoryNames.get(cat);
            const jsonParentIdKey = getImportParentIdKey(cat.parent_id);
            const importedIsPrivate = cat.is_private ? 1 : 0; // Import privacy setting
            
            let dbParentId = 0;
            if (jsonParentIdKey !== '0') {
                if (oldCatIdToNewCatIdMap.has(jsonParentIdKey)) {
                    dbParentId = oldCatIdToNewCatIdMap.get(jsonParentIdKey);
                } else {
                    dbParentId = 0;
                }
            }

            const parentCategory = dbParentId
                ? existingDbCategories.find(c => String(c.id) === String(dbParentId))
                : null;
            const isPrivate = parentCategory?.is_private === 1 ? 1 : importedIsPrivate;
            const existing = findExistingCategory(catName, dbParentId);
            
            if (existing) {
                if (isPrivate === 1 && existing.is_private !== 1) {
                    existing.is_private = 1;
                    privateCategoryIdsToPropagate.add(existing.id);
                }
                oldCatIdToNewCatIdMap.set(getImportIdKey(cat.id), existing.id);
            } else {
                const sortOrder = normalizeSortOrder(cat.sort_order);
                dbMayHaveChanged = true;
                const result = await db.prepare('INSERT INTO category (catelog, sort_order, parent_id, is_private) VALUES (?, ?, ?, ?)')
                                       .bind(catName, sortOrder, dbParentId, isPrivate)
                                       .run();
                let newId = result.meta.last_row_id;
                
                const newCatObj = { id: newId, catelog: catName, parent_id: dbParentId, is_private: isPrivate };
                existingDbCategories.push(newCatObj);
                
                oldCatIdToNewCatIdMap.set(getImportIdKey(cat.id), newId);
            }
        }

        if (privateCategoryIdsToPropagate.size > 0) {
            const privateStatements = [];
            privateCategoryIdsToPropagate.forEach(categoryId => {
                privateStatements.push(...buildPrivateDescendantStatements(db, categoryId));
            });
            dbMayHaveChanged = true;
            await db.batch(privateStatements);
        }

        const hasRootSites = sitesToImport.some(site => getImportIdKey(site.catelog_id) === '0');
        if (hasRootSites) {
            const rootCategoryNameResult = normalizeCategoryName(ROOT_IMPORT_CATEGORY_NAME);
            if (!rootCategoryNameResult.ok) {
                return errorResponse(`导入失败：${rootCategoryNameResult.message}`, 400);
            }

            const rootCategoryName = rootCategoryNameResult.value;
            const existingRootCategory = findExistingCategory(rootCategoryName, 0);

            if (existingRootCategory) {
                oldCatIdToNewCatIdMap.set('0', existingRootCategory.id);
            } else {
                dbMayHaveChanged = true;
                const result = await db.prepare('INSERT INTO category (catelog, sort_order, parent_id, is_private) VALUES (?, ?, ?, ?)')
                    .bind(rootCategoryName, 9999, 0, 0)
                    .run();
                const newRootCategoryId = result.meta.last_row_id;
                existingDbCategories.push({
                    id: newRootCategoryId,
                    catelog: rootCategoryName,
                    parent_id: 0,
                    is_private: 0,
                });
                oldCatIdToNewCatIdMap.set('0', newRootCategoryId);
            }
        }
    } else {
        if (existingDbCategories) {
             existingDbCategories.forEach(c => categoryNameToIdMap.set(c.catelog, c.id));
        }
        const defaultCategory = 'Default';
        const categoryNames = [...new Set(sitesToImport.map(item => {
            const categoryNameResult = normalizeCategoryName(item.catelog || defaultCategory);
            return categoryNameResult.ok ? categoryNameResult.value : '';
        }))].filter(name => name);
        const newCategoryNames = categoryNames.filter(name => !categoryNameToIdMap.has(name));

        if (newCategoryNames.length > 0) {
            // Legacy import doesn't have is_private info, defaults to 0
            const insertStmts = newCategoryNames.map(name => db.prepare('INSERT INTO category (catelog, is_private) VALUES (?, 0)').bind(name));
            dbMayHaveChanged = true;
            await db.batch(insertStmts);
            
            for (let i = 0; i < newCategoryNames.length; i += BATCH_SIZE) {
                const chunk = newCategoryNames.slice(i, i + BATCH_SIZE);
                const placeholders = chunk.map(() => '?').join(',');
                const { results: newCategories } = await db.prepare(`SELECT id, catelog, is_private FROM category WHERE catelog IN (${placeholders})`).bind(...chunk).all();
                if (newCategories) {
                    newCategories.forEach(c => {
                        categoryNameToIdMap.set(c.catelog, c.id);
                        existingDbCategories.push(c); // Update local cache
                    });
                }
            }
        }
    }

    // --- Site Processing ---
    const siteUrls = [...new Set(sitesToImport.flatMap(item => {
        const urlResult = normalizeBookmarkUrl(item.url);
        return urlResult.ok ? getUrlMatchCandidates(urlResult.value) : [];
    }))];
    const existingSiteUrlMap = new Map();
    if (siteUrls.length > 0) {
        for (let i = 0; i < siteUrls.length; i += BATCH_SIZE) {
            const chunk = siteUrls.slice(i, i + BATCH_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const { results: existingSites } = await db.prepare(`SELECT url FROM sites WHERE url IN (${placeholders})`).bind(...chunk).all();
            if (existingSites) {
                existingSites.forEach(site => {
                    const dbUrl = (site.url || '').trim();
                    if (dbUrl) existingSiteUrlMap.set(dbUrl, dbUrl);
                    getUrlMatchCandidates(dbUrl).forEach(candidate => existingSiteUrlMap.set(candidate, dbUrl));
                });
            }
        }
    }

    const batchStmts = [];
    let itemsAdded = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    const iconAPI = env.ICON_API || 'https://faviconsnap.com/api/favicon?url=';
    const processedUrls = new Set();

    for (const site of sitesToImport) {
        const nameResult = normalizeBookmarkName(site.name);
        const urlResult = normalizeBookmarkUrl(site.url);
        const logoResult = normalizeBookmarkLogo(site.logo);
        const descResult = normalizeBookmarkDesc(site.desc, { nullIfEmpty: true });

        if (!nameResult.ok || !urlResult.ok || !logoResult.ok || !descResult.ok) {
            itemsSkipped++;
            continue;
        }

        const rawUrl = urlResult.value;
        const sanitizedUrl = normalizeUrlForStorage(rawUrl);
        const dedupKey = sanitizedUrl.endsWith('/') ? sanitizedUrl.slice(0, -1) : sanitizedUrl;
        const sanitizedName = nameResult.value;

        if (!sanitizedUrl) {
            itemsSkipped++;
            continue;
        }
        if (processedUrls.has(dedupKey)) {
            itemsSkipped++;
            continue;
        }
        if (isNewFormat && (site.catelog_id === undefined || site.catelog_id === null)) {
            itemsSkipped++;
            continue;
        }

        const existingDbUrl = getUrlMatchCandidates(rawUrl)
            .map(candidate => existingSiteUrlMap.get(candidate))
            .find(Boolean) || null;
        const exists = Boolean(existingDbUrl);
        if (exists && !override) {
            itemsSkipped++;
            continue;
        }

        let newCatId;
        let catNameForDb; 
        let catIsPrivate = 0;

        if (isNewFormat) {
            newCatId = oldCatIdToNewCatIdMap.get(getImportIdKey(site.catelog_id));
            const catObj = existingDbCategories.find(c => String(c.id) === String(newCatId));
            if (catObj) {
                catNameForDb = catObj.catelog;
                catIsPrivate = catObj.is_private || 0;
            }
        } else {
            const catNameResult = normalizeCategoryName(site.catelog || 'Default');
            if (!catNameResult.ok) {
                itemsSkipped++;
                continue;
            }
            const catName = catNameResult.value;
            newCatId = categoryNameToIdMap.get(catName);
            catNameForDb = catName;
            const catObj = existingDbCategories.find(c => c.id === newCatId);
             if (catObj) {
                catIsPrivate = catObj.is_private || 0;
            }
        }

        if (!newCatId) {
            itemsSkipped++;
            continue;
        }

        let sanitizedLogo = logoResult.value;
        if ((!sanitizedLogo || sanitizedLogo.startsWith('data:image')) && sanitizedUrl.startsWith('http')) {
            const domain = sanitizedUrl.replace(/^https?:\/\//, '').split('/')[0];
            sanitizedLogo = `${iconAPI}${domain}`;
        }
        if (!sanitizedLogo) sanitizedLogo = null;

        const sanitizedDesc = descResult.value;
        const sortOrderValue = normalizeSortOrder(site.sort_order);
        // 覆盖更新时，若导入数据未提供排序值，则保留已有书签的排序值
        const sortOrderUpdate = (site.sort_order === undefined || site.sort_order === null)
            ? null
            : sortOrderValue;
        
        // Handle Privacy Logic
        let finalIsPrivate = site.is_private ? 1 : 0;
        // Force private if category is private
        if (catIsPrivate === 1) {
            finalIsPrivate = 1;
        }

        if (exists && override) {
            processedUrls.add(dedupKey);
            // Update
            batchStmts.push(
                db.prepare('UPDATE sites SET name=?, logo=?, desc=?, catelog_id=?, catelog_name=?, sort_order=COALESCE(?, sort_order), is_private=?, update_time=CURRENT_TIMESTAMP WHERE url=?')
                  .bind(sanitizedName, sanitizedLogo, sanitizedDesc, newCatId, catNameForDb, sortOrderUpdate, finalIsPrivate, existingDbUrl)
            );
            itemsUpdated++;
        } else {
            processedUrls.add(dedupKey);
            // Insert
            batchStmts.push(
                db.prepare('INSERT INTO sites (name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                  .bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, newCatId, catNameForDb, sortOrderValue, finalIsPrivate)
            );
            itemsAdded++;
        }
    }

    if (batchStmts.length > 0) {
        // Execute in batches to respect D1 limits
        dbMayHaveChanged = true;
        for (let i = 0; i < batchStmts.length; i += BATCH_SIZE) {
            const chunk = batchStmts.slice(i, i + BATCH_SIZE);
            await db.batch(chunk);
        }
    }

    let msg = `导入完成。`;
    if (itemsAdded > 0) msg += ` 新增 ${itemsAdded} 个`;
    if (itemsUpdated > 0) msg += ` 更新 ${itemsUpdated} 个`;
    if (itemsSkipped > 0) msg += ` 跳过 ${itemsSkipped} 个`;

    return jsonResponse({
        code: 201,
        message: msg
    }, 201);

  } catch (error) {
    return errorResponse(`Failed to import config: ${error.message}`, 500);
  } finally {
    // 成功、抛错、早返回三种出口共用这一次打标：
    // 失败时数据库可能已部分变更，成功时要让写入期间读到中间态的首页渲染失效。
    // markHomeCacheDirty 内部已吞掉异常，不会掩盖原始错误或影响响应。
    if (dbMayHaveChanged) {
      await markHomeCacheDirty(env, 'all');
    }
  }
}
