import { test, expect } from '@playwright/test';

/**
 * 首页 SSR 冒烟测试
 *
 * 覆盖 node:test 结构上测不到的部分：
 * 真实渲染结果、静态资源可达性、浏览器端 JS 是否报错。
 */
test.describe('首页 SSR', () => {
  /** @type {string[]} */
  let consoleErrors;
  /** @type {string[]} */
  let pageErrors;

  test.beforeEach(async ({ page, baseURL }) => {
    consoleErrors = [];
    pageErrors = [];
    const origin = new URL(baseURL).origin;

    // 一言是外部服务，默认固定返回，避免网络波动影响用例；失败场景在各自用例里覆盖
    await page.route(/v1\.hitokoto\.cn/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hitokoto: '测试一言', uuid: 'test-uuid' }),
    }));

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      // 书签站会引用大量第三方 favicon，跨域资源被 CORP 拦截属于正常噪音，
      // 只关心本站自身脚本抛出的错误。
      const src = msg.location()?.url ?? '';
      if (src) {
        try {
          if (new URL(src, baseURL).origin !== origin) return;
        } catch {
          // 无法解析的来源按本站处理，避免漏掉错误
        }
      }
      consoleErrors.push(`${msg.text()} @ ${src || '(inline)'}`);
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
  });

  test('模板占位符全部被替换', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    const html = await page.content();
    // SSR 未替换的 {{KEY}} 会原样出现在页面上
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  test('渲染出书签网格且页脚有文案', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 本地 D1 可能是空库：有书签时渲染卡片，无书签时渲染空状态，两者都说明 SSR 正常
    const grid = page.locator('#sitesGrid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('.site-card-content');
    const emptyState = grid.locator('.col-span-full');
    expect(await cards.count() + await emptyState.count()).toBeGreaterThan(0);

    // 页脚文案可由 home_footer_text 设置或 FOOTER_TEXT 环境变量覆盖，只校验结构
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/©\s*\d{4}/);
    expect((await footer.innerText()).replace(/©\s*\d{4}/, '').trim().length).toBeGreaterThan(0);
  });

  test('样式表正常加载（防止静态资源服务挂掉）', async ({ page, baseURL }) => {
    const cssResponses = [];
    const cssOrigin = new URL(baseURL).origin;
    page.on('response', (res) => {
      const url = new URL(res.url());
      // 只校验本站 /css/ 资源；设置里的第三方字体样式表不受本地服务影响
      if (url.origin === cssOrigin && url.pathname.startsWith('/css/')) {
        cssResponses.push(res);
      }
    });

    // 用 domcontentloaded 而不是 load：页面会加载大量第三方字体和 favicon，
    // 等 load 会因为外部资源慢而超时；CSS 属于渲染阻塞资源，此时已经加载完毕。
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(cssResponses.length).toBeGreaterThan(0);
    for (const res of cssResponses) {
      expect(res.status(), `CSS 请求失败: ${res.url()}`).toBe(200);
    }

    // 关键：Tailwind 生效后网格才有可见布局宽度（空库同样适用）
    const box = await page.locator('#sitesGrid').boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
  });

  test('浏览器端无 JS 错误', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // 给内联脚本和 hydration 留出执行时间
    await page.waitForTimeout(800);

    expect(pageErrors, `未捕获异常: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `console.error: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('一言请求失败时隐藏，页面其他内容不受影响', async ({ page }) => {
    // 本地配置可能已经隐藏一言或统计行，启动脚本前恢复容器，再验证请求成功与失败两条路径。
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const parent = document.getElementById('hitokoto-parent');
        parent?.classList.remove('hidden');
        parent?.parentElement?.classList.remove('hidden');
        parent?.closest('.home-stats-row')?.classList.remove('hidden');
      }, { capture: true });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const hitokotoParent = page.locator('#hitokoto-parent');
    // 先确认成功请求正常显示，避免后续隐藏断言被配置或脚本初始化失败掩盖。
    await expect(hitokotoParent).toBeVisible();
    await expect(page.locator('#hitokoto_text')).toHaveText('测试一言');

    await page.unroute(/v1\.hitokoto\.cn/);
    await page.route(/v1\.hitokoto\.cn/, (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(hitokotoParent).toBeHidden();
    await expect(page.locator('#sitesGrid')).toBeVisible();
  });

  test('统计标题隐藏时，一言失败后整行一起隐藏', async ({ page }) => {
    // 模拟 home_hide_stats 开启：标题隐藏后行内只剩一言，恢复一言容器再让请求失败
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const parent = document.getElementById('hitokoto-parent');
        parent?.classList.remove('hidden');
        parent?.parentElement?.classList.remove('hidden');
        parent?.closest('.home-stats-row')?.classList.remove('hidden');
        document.querySelector('[data-role="list-heading"]')?.classList.add('hidden');
      }, { capture: true });
    });

    await page.unroute(/v1\.hitokoto\.cn/);
    await page.route(/v1\.hitokoto\.cn/, (route) => route.abort());

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#hitokoto-parent')).toBeHidden();
    // 行内已无可见内容：整行应为 display:none，而不是高度塌陷后仍留下 my-8 的间距
    const rowDisplay = await page.locator('.home-stats-row').evaluate((el) => getComputedStyle(el).display);
    expect(rowDisplay).toBe('none');
    await expect(page.locator('#sitesGrid')).toBeVisible();
  });
});
