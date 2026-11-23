import { test, expect } from '@playwright/test';

/**
 * P2 重复实现收口后的端到端回归
 *
 * 这些断言必须跑在真实 wrangler + 真实 D1 上才成立：node:test 里的分类用例用的是
 * 按 SQL 文本分派的假库，验证不了递归 CTE 真的执行、真的终止。
 *
 * 后台凭据从环境变量读取，未设置时整组跳过（与 admin.spec.mjs 一致）。
 * 首次运行前先把凭据播种到 e2e 专用 state：
 *   npx wrangler kv key put admin_username xxx --binding NAV_AUTH --local --persist-to .wrangler/e2e-state
 *   npx wrangler kv key put admin_password yyy --binding NAV_AUTH --local --persist-to .wrangler/e2e-state
 */
const USER = process.env.E2E_ADMIN_USER;
const PASS = process.env.E2E_ADMIN_PASS;
const missingCreds = !USER || !PASS ? '缺少 E2E_ADMIN_USER / E2E_ADMIN_PASS，跳过需要凭据的用例' : '';

// trace 会记录 fill 参数，失败产物中可能包含管理员密码，这里不保留
test.use({ trace: 'off' });

// e2e-state 会在多次运行间保留，用运行级后缀避开「同名分类 / 重复 URL」校验
const runId = Date.now().toString(36);

let seq = 0;
function uniqueName(prefix) {
  seq += 1;
  return `${prefix}-${runId}-${seq}`;
}

// 后台页面由 functions/admin/index.js 注入 CSRF token。登录后取一次缓存下来：
// 用例中途可能已经跳到首页（首页没有这个 meta），不能每次都靠读 DOM；
// 靠读 DOM 时 token 取到空串会被中间件 403，而这种失败又不会让断言变红。
let csrfToken = '';

async function login(page) {
  await page.goto('/admin/login');
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL('**/admin'),
    page.click('button[type="submit"]'),
  ]);
  csrfToken = (await page.locator('meta[name="csrf-token"]').getAttribute('content')) || '';
  expect(csrfToken, '后台页面应当注入 CSRF token').not.toBe('');
}

/**
 * 在已登录页面里直接调 API：复用浏览器 cookie，并带上 CSRF token，
 * 走的是真实中间件校验路径，而不是绕过它。
 */
async function api(page, { method = 'GET', path, body }) {
  const result = await page.evaluate(async ({ method, path, body, csrf }) => {
    const token = csrf || document.querySelector('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON 响应：下面把前 200 字带回去便于排错 */ }
    return { status: response.status, json, text: json === null ? text.slice(0, 200) : '' };
  }, { method, path, body, csrf: csrfToken });

  expect(result.status, `${method} ${path} 返回 ${result.status}: ${result.text || JSON.stringify(result.json)}`).toBeLessThan(500);
  return result;
}

async function findCategory(page, catelog, parentId) {
  const { json } = await api(page, { path: '/api/categories?pageSize=10000' });
  const match = (json?.data || []).find(item => item.catelog === catelog && Number(item.parent_id || 0) === Number(parentId));
  expect(match, `未找到分类 ${catelog}`).toBeTruthy();
  return match;
}

async function createCategory(page, catelog, parentId = 0) {
  const { status, json } = await api(page, {
    method: 'POST',
    path: '/api/categories/create',
    body: { catelog, parent_id: parentId, sort_order: 100 },
  });
  expect(status, JSON.stringify(json)).toBe(201);
  return findCategory(page, catelog, parentId);
}

test.describe('隐私传播与设置回归', () => {
  test('分类设为私密后，整棵子树的分类与书签都转为私密', async ({ page, browser, baseURL }) => {
    test.skip(Boolean(missingCreds), missingCreds);
    await login(page);

    const rootName = uniqueName('根');
    const childName = uniqueName('子');
    const grandName = uniqueName('孙');

    const root = await createCategory(page, rootName);
    const child = await createCategory(page, childName, root.id);
    const grand = await createCategory(page, grandName, child.id);

    // 三层各挂一个书签：只查最深层会漏掉「只标了当前节点那层」的实现，
    // 也漏掉「根分类自身忘了置位」的情况。
    const rootSiteName = uniqueName('根站');
    const childSiteName = uniqueName('子站');
    const grandSiteName = uniqueName('孙站');
    for (const [name, catelogId] of [[rootSiteName, root.id], [childSiteName, child.id], [grandSiteName, grand.id]]) {
      const { status, json } = await api(page, {
        method: 'POST',
        path: '/api/config',
        body: { name, url: `https://${uniqueName('site')}.example`, catelogId, sort_order: 100 },
      });
      expect(status, JSON.stringify(json)).toBe(201);
    }

    // 正向对照：一棵完全无关的公开分类，它下面的书签在整条链路跑完后必须仍然可见。
    // 没有这个对照组，下面「匿名看到空数组」的断言可能是接口整体失效造成的假绿。
    const publicCategory = await createCategory(page, uniqueName('公开'));
    const publicSiteName = uniqueName('公开站');
    const publicSite = await api(page, {
      method: 'POST',
      path: '/api/config',
      body: { name: publicSiteName, url: `https://${uniqueName('public')}.example`, catelogId: publicCategory.id, sort_order: 100 },
    });
    expect(publicSite.status, JSON.stringify(publicSite.json)).toBe(201);

    // 把根分类置为私密：递归 CTE 应当把子、孙分类及其书签一并置位
    const put = await api(page, {
      method: 'PUT',
      path: `/api/categories/${root.id}`,
      body: { catelog: rootName, sort_order: 100, parent_id: 0, is_private: true },
    });
    expect(put.status).toBe(200);

    const { json: categories } = await api(page, { path: '/api/categories?pageSize=10000' });
    const byId = new Map((categories.data || []).map(item => [Number(item.id), item]));
    for (const category of [root, child, grand]) {
      expect(byId.get(Number(category.id))?.is_private, `分类 ${category.catelog} 未置私密`).toBe(1);
    }
    expect(byId.get(Number(publicCategory.id))?.is_private, '公开分类不应被牵连').toBe(0);

    // 逐层验证书签（根 / 子 / 孙）：只查最深层会漏掉「只标了当前节点那层」的实现
    for (const [label, categoryId] of [['根', root.id], ['子', child.id], ['孙', grand.id]]) {
      const { json: sites } = await api(page, { path: `/api/config?catalogId=${categoryId}` });
      expect(sites.data.length, `${label}分类下应有 1 个书签`).toBe(1);
      expect(sites.data[0].is_private, `${label}分类下的书签未置私密`).toBe(1);
    }

    // 匿名视角：私密子树下的书签必须完全不可见。
    // baseURL 显式传入，不依赖 newContext 从 use 配置继承——这条断言是隐私边界的
    // 唯一证据，不能建立在隐式行为上（相对 URL 万一解析失败会抛错而不是静默通过）。
    const anonymous = await browser.newContext({ baseURL });
    try {
      for (const [label, categoryId] of [['根', root.id], ['子', child.id], ['孙', grand.id]]) {
        const res = await anonymous.request.get(`/api/config?catalogId=${categoryId}`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.data, `匿名请求不应看到${label}分类下的书签`).toEqual([]);
      }

      // 反向对照：私密子树之外的公开站点，匿名必须仍然看得到。
      // 少了这一条，「匿名看到空数组」也可能是查询整体失效造成的假绿。
      const publicRes = await anonymous.request.get(`/api/config?catalogId=${publicCategory.id}`);
      expect(publicRes.status()).toBe(200);
      const publicBody = await publicRes.json();
      expect(publicBody.data.length, '公开分类下的书签应当仍可匿名访问').toBe(1);
      expect(publicBody.data[0]?.name).toBe(publicSiteName);
    } finally {
      await anonymous.close();
    }
  });

  test('遗留值 above_description 仍被归一成 top 并渲染顶部导航', async ({ page }) => {
    test.skip(Boolean(missingCreds), missingCreds);
    await login(page);

    const before = await api(page, { path: '/api/settings' });
    const previous = before.json?.data?.home_category_position;
    const beforeLayout = await api(page, { path: '/api/public-config' });
    expect(beforeLayout.status).toBe(200);

    // 还原值必须按写入接口的归一化规则算一遍再断言：库里若还躺着遗留值
    // above_description，原样写回去会被 /api/settings 归一成 top，
    // 直接拿 previous 做期望值会在 finally 里误报失败，且设置实际停在 top。
    //
    // 原始位置缺失时，从公开配置读取有效值，兼容旧式 vertical → left 回填。
    // 未知原始值无法可靠还原，必须在写入前拒绝，避免悄悄改掉测试初始状态。
    const RESTORE_POSITIONS = ['below_search', 'above_search', 'left', 'top'];
    const previousIsMissing = previous == null;
    const previousIsKnown = previous === 'above_description' || RESTORE_POSITIONS.includes(previous);
    expect(
      previousIsMissing || previousIsKnown,
      `/api/settings 返回了无法还原的 home_category_position：${JSON.stringify(previous)}`,
    ).toBe(true);

    const restoreValue = beforeLayout.json?.home_category_position;
    expect(RESTORE_POSITIONS).toContain(restoreValue);

    try {
      // 写入接口应当把遗留值归一成 top（normalizeSettingValueForStorage）
      const saved = await api(page, {
        method: 'POST',
        path: '/api/settings',
        body: { home_category_position: 'above_description' },
      });
      expect(saved.status).toBe(200);

      const after = await api(page, { path: '/api/settings' });
      expect(after.json?.data?.home_category_position).toBe('top');

      // SSR 侧不再自行归一（P2 删掉的那段），这里验证删掉后仍按 top 渲染
      const home = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(home.status()).toBe(200);
      const html = await home.text();
      expect(html).toContain('category-nav-top-wrap');
    } finally {
      // 还原必须真的生效：这一步在 goto('/') 之后执行，页面已经没有 csrf meta，
      // 所以只能靠登录时缓存下来的 token。状态校验放在这里，避免「自以为还原了」。
      const restored = await api(page, {
        method: 'POST',
        path: '/api/settings',
        body: { home_category_position: restoreValue },
      });
      expect(restored.status, '设置必须还原，否则会污染后续用例与本地数据').toBe(200);
      const afterRestore = await api(page, { path: '/api/settings' });
      expect(afterRestore.json?.data?.home_category_position).toBe(restoreValue);
      const restoredLayout = await api(page, { path: '/api/public-config' });
      expect(restoredLayout.status).toBe(200);
      expect(restoredLayout.json?.home_category_position).toBe(beforeLayout.json.home_category_position);
      expect(restoredLayout.json?.layout_menu_layout).toBe(beforeLayout.json.layout_menu_layout);
    }
  });

  test('非法 sort_order 写入后归一为 9999', async ({ page }) => {
    test.skip(Boolean(missingCreds), missingCreds);
    await login(page);

    const catelog = uniqueName('排序');
    const category = await createCategory(page, catelog);

    const siteName = uniqueName('排序站点');
    const created = await api(page, {
      method: 'POST',
      path: '/api/config',
      body: { name: siteName, url: `https://${uniqueName('sort')}.example`, catelogId: category.id, sort_order: 'abc' },
    });
    expect(created.status).toBe(201);

    const { json } = await api(page, { path: `/api/config?keyword=${encodeURIComponent(siteName)}` });
    expect(json.data.length).toBe(1);
    expect(json.data[0].sort_order).toBe(9999);
  });

  test('21 层链上成环的移动被拒绝，且立即返回', async ({ page }) => {
    test.skip(Boolean(missingCreds), missingCreds);
    await login(page);

    // 造一条 21 层的链：旧实现「最多向上查 20 层」，第 21 层之外的环会漏过去
    const chain = [];
    let parentId = 0;
    for (let i = 1; i <= 21; i++) {
      const category = await createCategory(page, uniqueName(`链${i}`), parentId);
      chain.push(category);
      parentId = category.id;
    }

    const root = chain[0];
    const deepest = chain[chain.length - 1];

    const started = Date.now();
    const put = await api(page, {
      method: 'PUT',
      path: `/api/categories/${root.id}`,
      body: { catelog: root.catelog, sort_order: 100, parent_id: deepest.id, is_private: false },
    });
    const elapsed = Date.now() - started;

    expect(put.status, JSON.stringify(put.json)).toBe(400);
    expect(put.json?.message).toMatch(/循环引用/);
    expect(elapsed, '应当立即拒绝，而不是依赖遍历预算后放行').toBeLessThan(5000);

    // 被拒之后环没有建成：根分类仍挂在 0 下面
    const { json } = await api(page, { path: '/api/categories?pageSize=10000' });
    const after = (json.data || []).find(item => Number(item.id) === Number(root.id));
    expect(Number(after?.parent_id)).toBe(0);
  });
});
