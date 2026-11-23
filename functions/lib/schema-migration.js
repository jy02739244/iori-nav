import { DB_SCHEMA, SCHEMA_VERSION, PREVIOUS_SCHEMA_VERSION } from '../constants';

let schemaReady = false;
let schemaReadyPromise = null;

export const PRIVACY_GUARD_TRIGGER_STATEMENTS = [
  `CREATE TRIGGER IF NOT EXISTS trg_privacy_category_insert
  BEFORE INSERT ON category
  WHEN COALESCE(NEW.is_private, 0) = 0
    AND NEW.parent_id IS NOT NULL
    AND NEW.parent_id != 0
    AND EXISTS (
      SELECT 1 FROM category
      WHERE id = NEW.parent_id AND COALESCE(is_private, 0) = 1
    )
  BEGIN
    SELECT RAISE(ABORT, 'privacy_guard_private_parent');
  END`,
  `CREATE TRIGGER IF NOT EXISTS trg_privacy_category_update
  BEFORE UPDATE OF is_private, parent_id ON category
  WHEN COALESCE(NEW.is_private, 0) = 0
    AND NEW.parent_id IS NOT NULL
    AND NEW.parent_id != 0
    AND EXISTS (
      SELECT 1 FROM category
      WHERE id = NEW.parent_id AND COALESCE(is_private, 0) = 1
    )
  BEGIN
    SELECT RAISE(ABORT, 'privacy_guard_private_parent');
  END`,
  `CREATE TRIGGER IF NOT EXISTS trg_privacy_site_insert
  BEFORE INSERT ON sites
  WHEN COALESCE(NEW.is_private, 0) = 0
    AND EXISTS (
      SELECT 1 FROM category
      WHERE id = NEW.catelog_id AND COALESCE(is_private, 0) = 1
    )
  BEGIN
    SELECT RAISE(ABORT, 'privacy_guard_private_category');
  END`,
  `CREATE TRIGGER IF NOT EXISTS trg_privacy_site_update
  BEFORE UPDATE OF is_private, catelog_id ON sites
  WHEN COALESCE(NEW.is_private, 0) = 0
    AND EXISTS (
      SELECT 1 FROM category
      WHERE id = NEW.catelog_id AND COALESCE(is_private, 0) = 1
    )
  BEGIN
    SELECT RAISE(ABORT, 'privacy_guard_private_category');
  END`,
];

export const PRIVACY_GUARD_REPAIR_STATEMENTS = [
  `WITH RECURSIVE private_categories(id) AS (
    SELECT id FROM category WHERE COALESCE(is_private, 0) = 1
    UNION
    SELECT c.id
    FROM category c
    INNER JOIN private_categories p ON c.parent_id = p.id
  )
  UPDATE category
  SET is_private = 1
  WHERE id IN (SELECT id FROM private_categories)
    AND COALESCE(is_private, 0) = 0`,
  `UPDATE sites
  SET is_private = 1
  WHERE COALESCE(is_private, 0) = 0
    AND EXISTS (
      SELECT 1 FROM category
      WHERE category.id = sites.catelog_id
        AND COALESCE(category.is_private, 0) = 1
    )`,
];

// 分类树防环：parent_id 指向自己的后代时直接终止事务。
//
// API 层已经用递归 CTE 拦过一次（api/categories/[id].js），这里再守一道数据库层，
// 是为了兜住导入、批量以及以后新增的写入口。环数据的代价不是报错，而是
// 「环上的分类同时从首页导航和后台列表里消失，且删不掉也搬不动」——只能进 D1 手改，
// 所以值得在数据库层再挡一次。
//
// 两条触发器各管一条路径：
//   UPDATE —— 只监听 parent_id，避免历史环阻断普通排序和私密标记更新；
//   INSERT —— 显式指定 id 的插入（INSERT INTO category (id, ...)）同样能一步写出自环，
//             自动分配 id 时 NEW.id 为 NULL，WHEN 里显式排除，不会误伤正常插入。
// UNION（不是 UNION ALL）保证库中已有环数据时，这两条判定自身也能终止。
//
// 先 DROP 再 CREATE：CREATE TRIGGER IF NOT EXISTS 遇到同名触发器会静默跳过，
// 库里就会一直留着别人的旧定义，而迁移照常报告成功。
export const CATEGORY_CYCLE_GUARD_ERROR = 'category_cycle_guard';

// 两条触发器共用同一段祖先判定，只是 NEW 的来源不同（UPDATE / INSERT）。
//
// 起点直接取 NEW.parent_id 这个字面值，而不是回表查它：BEFORE INSERT 时新行还不在表里，
// 回表查会得到空集，自环就漏过去了（`INSERT INTO category (id, parent_id) VALUES (7, 7)`）。
// 用字面值作种子后，「新父节点自己就是新行」和「新父节点的祖先里包含新行」都能命中。
// INSERT 额外要求 NEW.id > 0：自动分配 id 时 BEFORE INSERT 里 NEW.id 是哨兵值 -1，
// 不能被当成真实 id 参与判断。
// 没有根或断开引用的祖先链本身有环，同样不能作为新父分类。
const cycleGuardBody = (event) => `CREATE TRIGGER trg_category_no_cycle_${event.toLowerCase()}
  BEFORE ${event === 'UPDATE' ? 'UPDATE OF parent_id' : event} ON category
  WHEN NEW.parent_id IS NOT NULL
    AND NEW.parent_id != 0
    ${event === 'INSERT' ? 'AND NEW.id > 0' : ''}
    AND EXISTS (
      WITH RECURSIVE ancestors(id) AS (
        SELECT NEW.parent_id
        UNION
        SELECT c.parent_id FROM category c
        INNER JOIN ancestors a ON c.id = a.id
        WHERE c.parent_id IS NOT NULL AND c.parent_id != 0
      )
      SELECT 1 FROM ancestors WHERE id = NEW.id
        OR NOT EXISTS (
          SELECT 1 FROM ancestors a
          LEFT JOIN category c ON c.id = a.id
          WHERE c.id IS NULL OR c.parent_id IS NULL OR c.parent_id = 0
        )
    )
  BEGIN
    SELECT RAISE(ABORT, '${CATEGORY_CYCLE_GUARD_ERROR}');
  END`;

export const CATEGORY_CYCLE_GUARD_TRIGGER_NAMES = [
  'trg_category_no_cycle_update',
  'trg_category_no_cycle_insert',
];

export const CATEGORY_CYCLE_GUARD_TRIGGER_STATEMENTS = [
  'DROP TRIGGER IF EXISTS trg_category_no_cycle_update',
  'DROP TRIGGER IF EXISTS trg_category_no_cycle_insert',
  cycleGuardBody('UPDATE'),
  cycleGuardBody('INSERT'),
];

async function runBaseSchema(db) {
  const statements = DB_SCHEMA.split(';')
    .map(stmt => stmt.trim())
    .filter(Boolean)
    .map(stmt => db.prepare(stmt));

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

async function runIncrementalMigrations(env) {
  await env.NAV_DB.batch([
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_private_sort ON sites(is_private, sort_order)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_catelog_name ON sites(catelog_name)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_url ON sites(url)')
  ]);

  const [sitesColumns, categoryColumns, pendingColumns] = await Promise.all([
    env.NAV_DB.prepare('PRAGMA table_info(sites)').all(),
    env.NAV_DB.prepare('PRAGMA table_info(category)').all(),
    env.NAV_DB.prepare('PRAGMA table_info(pending_sites)').all(),
  ]);
  const sitesCols = new Set((sitesColumns.results || []).map(column => column.name));
  const categoryCols = new Set((categoryColumns.results || []).map(column => column.name));
  const pendingCols = new Set((pendingColumns.results || []).map(column => column.name));

  const alterStatements = [];
  const sitesMissingCatalogName = !sitesCols.has('catelog_name');
  const pendingMissingCatalogName = !pendingCols.has('catelog_name');

  if (!sitesCols.has('is_private')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0'));
  }
  if (sitesMissingCatalogName) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE sites ADD COLUMN catelog_name TEXT'));
  }
  if (pendingMissingCatalogName) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE pending_sites ADD COLUMN catelog_name TEXT'));
  }
  if (!categoryCols.has('is_private')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE category ADD COLUMN is_private INTEGER DEFAULT 0'));
  }
  if (!categoryCols.has('parent_id')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE category ADD COLUMN parent_id INTEGER DEFAULT 0'));
  }

  for (const statement of alterStatements) {
    try {
      await statement.run();
    } catch (error) {
      console.warn('Schema alter skipped:', error.message);
    }
  }

  if (sitesMissingCatalogName) {
    await env.NAV_DB.prepare(`
      UPDATE sites
      SET catelog_name = (
        SELECT catelog FROM category WHERE category.id = sites.catelog_id
      )
      WHERE catelog_name IS NULL
    `).run();
  }

  if (pendingMissingCatalogName) {
    await env.NAV_DB.prepare(`
      UPDATE pending_sites
      SET catelog_name = (
        SELECT catelog FROM category WHERE category.id = pending_sites.catelog_id
      )
      WHERE catelog_name IS NULL
    `).run();
  }

  await env.NAV_DB.batch(
    [
      ...PRIVACY_GUARD_REPAIR_STATEMENTS,
      ...PRIVACY_GUARD_TRIGGER_STATEMENTS,
      ...CATEGORY_CYCLE_GUARD_TRIGGER_STATEMENTS,
    ]
      .map(sql => env.NAV_DB.prepare(sql))
  );

  // 迁移自检：守卫触发器必须真的在库里，而且必须是「我们这一份」定义。
  // 只校验触发器名字不够——库里若躺着同名但逻辑不同的旧定义，光看名字同样会误判为已生效。
  // 这里检查两条触发器的定义文本都带守卫标记；不满足就抛错，让迁移标记写不进去
  // （下次请求重试），而不是接受一个「看起来迁移过了」的假象。
  const cycleGuards = await env.NAV_DB
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN ('trg_category_no_cycle_update', 'trg_category_no_cycle_insert')")
    .all();
  const guardRows = cycleGuards?.results || [];
  const guardNames = new Set(guardRows.map(row => row.name));
  const guardDefinitionOk = guardRows.length === CATEGORY_CYCLE_GUARD_TRIGGER_NAMES.length
    && CATEGORY_CYCLE_GUARD_TRIGGER_NAMES.every(name => guardNames.has(name))
    && guardRows.every(row => String(row.sql || '').includes(CATEGORY_CYCLE_GUARD_ERROR));
  if (!guardDefinitionOk) {
    throw new Error('category cycle guard triggers missing or stale after migration');
  }
}

export async function ensureSchemaReady(env) {
  if (!env || !env.NAV_DB) return;
  if (schemaReady) return;
  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    const kv = env.NAV_AUTH;

    if (kv) {
      try {
        const migrated = await kv.get(`schema_migrated_${SCHEMA_VERSION}`);
        if (migrated) {
          schemaReady = true;
          return;
        }
      } catch (error) {
        console.warn('Schema version check failed:', error);
      }
    }

    try {
      await runBaseSchema(env.NAV_DB);
      await runIncrementalMigrations(env);

      if (kv) {
        await kv.put(`schema_migrated_${SCHEMA_VERSION}`, 'true');

        if (PREVIOUS_SCHEMA_VERSION && PREVIOUS_SCHEMA_VERSION !== SCHEMA_VERSION) {
          try {
            await kv.delete(`schema_migrated_${PREVIOUS_SCHEMA_VERSION}`);
          } catch (cleanupError) {
            console.warn('Previous schema marker cleanup failed:', cleanupError);
          }
        }
      }

      schemaReady = true;
    } catch (error) {
      console.error('Schema migration failed:', error);
    }
  })().finally(() => {
    schemaReadyPromise = null;
  });

  await schemaReadyPromise;
}
