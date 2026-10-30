import { test, expect } from '@playwright/test';

/**
 * 后台管理冒烟测试
 *
 * 凭据从环境变量读取，避免把管理员密码写进仓库：
 *   E2E_ADMIN_USER=xxx E2E_ADMIN_PASS=yyy npm run test:e2e
 * 未设置时自动跳过，不影响 CI 里的其他用例。
 */
const USER = process.env.E2E_ADMIN_USER;
const PASS = process.env.E2E_ADMIN_PASS;

// trace 会记录 fill 参数，失败产物中可能包含管理员密码，后台用例不保留 trace。
test.use({ trace: 'off' });

async function submitLogin(page, password) {
  await page.goto('/admin/login');
  await page.fill('#username', USER);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

async function logout(page) {
  await page.click('.logout-btn');
  await expect(page).toHaveURL(/\/admin\/login/);
}

test.describe('后台管理', () => {
  test('未登录访问 /admin 会跳转到登录页', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
  });

  test('密码错误时停留在登录页并给出提示', async ({ page }) => {
    test.skip(!USER || !PASS, '缺少 E2E_ADMIN_USER / E2E_ADMIN_PASS，跳过需要凭据的用例');

    // 先用正确凭据登录一次，服务端会在登录成功时清空 IP 失败计数，
    // 避免反复运行本用例累积到 5 次触发本地 10 分钟锁定
    await submitLogin(page, PASS);
    await expect(page).toHaveURL(/\/admin$/);
    await logout(page);

    await submitLogin(page, 'definitely-wrong-password');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('.error-message')).toContainText('账号或密码错误');
  });

  test('正确凭据可登录，并能正常退出', async ({ page }) => {
    test.skip(!USER || !PASS, '缺少 E2E_ADMIN_USER / E2E_ADMIN_PASS，跳过需要凭据的用例');

    await submitLogin(page, PASS);

    // 登录成功应跳转到后台首页
    await expect(page).toHaveURL(/\/admin$/);
    // 后台关键操作入口存在，说明页面真正渲染出来了
    await expect(page.locator('#addBookmarkBtn')).toBeVisible();

    // 退出后回到登录页
    await logout(page);
  });
});
