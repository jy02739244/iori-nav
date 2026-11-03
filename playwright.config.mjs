import { defineConfig, devices } from '@playwright/test';

// 端到端测试使用独立端口，避免本机已在 8788 运行的 `npm run dev` 被误用：
// 复用旧进程会让测试跑在旧代码上，端口冲突则会直接让 webServer 启动失败。
// 端口可用 E2E_PORT 覆盖，方便同一台机器并行跑多组用例。
// 非法值（拼错、越界）回退默认端口，避免 URL 变成 http://127.0.0.1:NaN。
const parsedPort = Number.parseInt(process.env.E2E_PORT ?? '', 10);
const PORT = parsedPort > 0 && parsedPort < 65536 ? parsedPort : 8799;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// 持久化目录也独立：否则每次跑测试都会把 home_html_* 缓存、session 等写进
// 开发者本地用的 .wrangler/state，把开发数据和测试数据搅在一起。
// 并行跑多组用例时用 E2E_PERSIST_TO 指向不同目录，避免两个 wrangler 抢同一个 SQLite 文件。
const PERSIST_TO = process.env.E2E_PERSIST_TO || '.wrangler/e2e-state';

export default defineConfig({
  testDir: './e2e',
  // 端到端测试串行执行，避免多个 worker 同时打本地 wrangler
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    // 失败时保留现场，方便排查 SSR / 样式问题
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 自动拉起本地开发服务器；独立端口 + 独立持久化目录 + 不复用已有进程，
  // 确保跑的是当前代码，也不会污染开发者本地的 D1 / KV 数据
  webServer: {
    command: `npm run dev -- --port ${PORT} --persist-to ${PERSIST_TO}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
