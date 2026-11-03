import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
const LOGIN_FILE = 'functions/admin/login.js';
const CSS_FILE = 'public/css/login.css';
const ORIGINAL_CSS = 'body { color: purple; }\n';
const hash = content => crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
const originalUrl = `/css/login.css?v=${hash(ORIGINAL_CSS)}`;
const originalLogin = `const maxAttempts = 5;\nconst title = 'login';\nconst css = '${originalUrl}';\n`;

function createRepo(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iori-staged-versions-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const write = (file, content) => {
    const fullPath = path.join(rootDir, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  };
  for (const file of ['.husky/pre-commit', '.husky/post-commit', 'scripts/update-versions.js', 'scripts/update-staged-versions.js']) {
    write(file, fs.readFileSync(path.join(ROOT_DIR, file)));
    if (file.startsWith('.husky/')) fs.chmodSync(path.join(rootDir, file), 0o755);
  }
  write(LOGIN_FILE, originalLogin);
  write(CSS_FILE, ORIGINAL_CSS);
  write('public/css/style.css', ORIGINAL_CSS);
  write('public/css/admin-layout.css', ORIGINAL_CSS);
  write('public/index.html', `<link href="/css/style.css?v=${hash(ORIGINAL_CSS)}">\n`);
  write('public/admin/index.html', `<link href="/css/admin-layout.css?v=${hash(ORIGINAL_CSS)}">\n`);
  write('notes.txt', 'original\n');

  const git = (...args) => execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  git('init', '-q');
  git('config', 'core.hooksPath', '.husky');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', '初始测试数据');

  return {
    rootDir,
    write,
    git,
    read: file => fs.readFileSync(path.join(rootDir, file), 'utf8'),
    staged: file => git('show', `:${file}`),
    hook: env => execFileSync('sh', ['.husky/pre-commit'], {
      cwd: rootDir,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  };
}

test('unrelated commits do not stage working-tree login logic or CSS', t => {
  const repo = createRepo(t);
  const workingLogin = originalLogin.replace('maxAttempts = 5', 'maxAttempts = 6');
  repo.write(LOGIN_FILE, workingLogin);
  repo.write(CSS_FILE, 'body { color: orange; }\n');
  repo.write('notes.txt', 'staged note\n');
  repo.git('add', 'notes.txt');

  repo.hook();

  assert.equal(repo.git('diff', '--cached', '--name-only').trim(), 'notes.txt');
  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  assert.equal(repo.read(LOGIN_FILE), workingLogin);
});

test('version hashes use staged CSS and preserve unstaged login logic', t => {
  const repo = createRepo(t);
  const stagedCss = 'body { color: green; }\n';
  const workingCss = 'body { color: orange; }\n';
  const workingLogin = originalLogin.replace('maxAttempts = 5', 'maxAttempts = 6');
  const newUrl = `/css/login.css?v=${hash(stagedCss)}`;
  repo.write(CSS_FILE, stagedCss);
  repo.git('add', CSS_FILE);
  repo.write(CSS_FILE, workingCss);
  repo.write(LOGIN_FILE, workingLogin);

  repo.hook();

  assert.equal(repo.staged(LOGIN_FILE), originalLogin.replace(originalUrl, newUrl));
  assert.equal(repo.read(LOGIN_FILE), workingLogin.replace(originalUrl, newUrl));
  assert.equal(repo.staged(CSS_FILE), stagedCss);
  assert.equal(repo.read(CSS_FILE), workingCss);
});

test('partially staged login changes remain separate from working-tree changes', t => {
  const repo = createRepo(t);
  const stagedLogin = originalLogin.replace('maxAttempts = 5', 'maxAttempts = 6');
  const workingLogin = stagedLogin.replace("title = 'login'", "title = 'unfinished'");
  const stagedCss = 'body { color: green; }\n';
  const newUrl = `/css/login.css?v=${hash(stagedCss)}`;
  repo.write(LOGIN_FILE, stagedLogin);
  repo.write(CSS_FILE, stagedCss);
  repo.git('add', LOGIN_FILE, CSS_FILE);
  repo.write(LOGIN_FILE, workingLogin);

  repo.hook();

  assert.equal(repo.staged(LOGIN_FILE), stagedLogin.replace(originalUrl, newUrl));
  assert.equal(repo.read(LOGIN_FILE), workingLogin.replace(originalUrl, newUrl));
});

test('home and admin template edits are not staged alongside version updates', t => {
  const repo = createRepo(t);
  const newCss = 'body { color: green; }\n';
  const templates = [
    ['public/index.html', 'public/css/style.css'],
    ['public/admin/index.html', 'public/css/admin-layout.css'],
  ];
  const originals = new Map(templates.map(([file]) => [file, repo.read(file)]));
  for (const [file, asset] of templates) {
    repo.write(file, originals.get(file) + '<p>unfinished template edit</p>\n');
    repo.write(asset, newCss);
    repo.git('add', asset);
  }

  repo.hook();

  for (const [file] of templates) {
    const updated = originals.get(file).replace(hash(ORIGINAL_CSS), hash(newCss));
    assert.equal(repo.staged(file), updated);
    assert.equal(repo.read(file), updated + '<p>unfinished template edit</p>\n');
  }
});

test('work-tree resource references edited by the user are preserved', t => {
  const repo = createRepo(t);
  const stagedCss = 'body { color: green; }\n';
  // 此 URL 以原 URL 开头，确保同步不会误替换用户版本号的前缀。
  const workingLogin = originalLogin.replace(originalUrl, originalUrl + 'custom');
  repo.write(CSS_FILE, stagedCss);
  repo.git('add', CSS_FILE);
  repo.write(LOGIN_FILE, workingLogin);

  repo.hook();

  assert.equal(repo.read(LOGIN_FILE), workingLogin);
  assert.equal(repo.staged(LOGIN_FILE), originalLogin.replace(originalUrl, `/css/login.css?v=${hash(stagedCss)}`));
});

test('staged deletions are not re-added and work-tree deletions are not restored', t => {
  const repo = createRepo(t);
  repo.git('rm', LOGIN_FILE);
  repo.write(CSS_FILE, 'body { color: green; }\n');
  repo.git('add', CSS_FILE);
  repo.hook();
  assert.equal(repo.git('diff', '--cached', '--diff-filter=D', '--name-only').trim(), LOGIN_FILE);
  assert.equal(fs.existsSync(path.join(repo.rootDir, LOGIN_FILE)), false);

  repo.git('reset', '--', LOGIN_FILE);
  repo.hook();
  assert.equal(fs.existsSync(path.join(repo.rootDir, LOGIN_FILE)), false);
  assert.match(repo.staged(LOGIN_FILE), new RegExp(hash('body { color: green; }\n')));
});

test('hooks honor an alternate Git index without updating the main index', t => {
  const repo = createRepo(t);
  const indexPath = path.join(repo.rootDir, '.git', 'partial-commit-index');
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  execFileSync('git', ['read-tree', 'HEAD'], { cwd: repo.rootDir, env });
  const newCss = 'body { color: green; }\n';
  repo.write(CSS_FILE, newCss);
  execFileSync('git', ['add', CSS_FILE], { cwd: repo.rootDir, env });

  repo.hook({ GIT_INDEX_FILE: indexPath });

  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  const stagedLogin = execFileSync('git', ['show', `:${LOGIN_FILE}`], { cwd: repo.rootDir, env, encoding: 'utf8' });
  assert.equal(stagedLogin, originalLogin.replace(originalUrl, `/css/login.css?v=${hash(newCss)}`));
});

test('normal version updates still use working-tree assets and leave the index alone', t => {
  const repo = createRepo(t);
  const newCss = 'body { color: orange; }\n';
  repo.write(CSS_FILE, newCss);

  execFileSync(process.execPath, ['scripts/update-versions.js'], {
    cwd: repo.rootDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  assert.equal(repo.read(LOGIN_FILE), originalLogin.replace(originalUrl, `/css/login.css?v=${hash(newCss)}`));
});

test('real partial CSS commits leave the final index and work tree clean', t => {
  const repo = createRepo(t);
  const newCss = 'body { color: green; }\n';
  const updatedLogin = originalLogin.replace(originalUrl, `/css/login.css?v=${hash(newCss)}`);
  repo.write(CSS_FILE, newCss);

  repo.git('commit', '--only', '-qm', '更新登录样式', '--', CSS_FILE);

  assert.equal(repo.git('show', `HEAD:${LOGIN_FILE}`), updatedLogin);
  assert.equal(repo.staged(LOGIN_FILE), updatedLogin);
  assert.equal(repo.read(LOGIN_FILE), updatedLogin);
  assert.equal(repo.git('status', '--porcelain'), '');

  const amendedCss = 'body { color: blue; }\n';
  repo.write(CSS_FILE, amendedCss);
  repo.git('commit', '--amend', '--only', '--no-edit', '--', CSS_FILE);
  assert.equal(repo.staged(LOGIN_FILE), originalLogin.replace(originalUrl, `/css/login.css?v=${hash(amendedCss)}`));
  assert.equal(repo.git('status', '--porcelain'), '');
});

test('real partial commits preserve other staged and unstaged business changes', t => {
  const repo = createRepo(t);
  const stagedLogin = originalLogin.replace('maxAttempts = 5', 'maxAttempts = 6');
  const workingLogin = stagedLogin.replace("title = 'login'", "title = 'unfinished'");
  const newCss = 'body { color: green; }\n';
  const newUrl = `/css/login.css?v=${hash(newCss)}`;
  repo.write(LOGIN_FILE, stagedLogin);
  repo.write('notes.txt', 'pending note\n');
  repo.git('add', LOGIN_FILE, 'notes.txt');
  repo.write(LOGIN_FILE, workingLogin);
  repo.write(CSS_FILE, newCss);

  repo.git('commit', '--only', '-qm', '只提交登录样式', '--', CSS_FILE);

  assert.equal(repo.git('show', `HEAD:${LOGIN_FILE}`), originalLogin.replace(originalUrl, newUrl));
  assert.equal(repo.staged(LOGIN_FILE), stagedLogin.replace(originalUrl, newUrl));
  assert.equal(repo.read(LOGIN_FILE), workingLogin.replace(originalUrl, newUrl));
  assert.equal(repo.git('show', 'HEAD:notes.txt'), 'original\n');
  assert.equal(repo.staged('notes.txt'), 'pending note\n');
  // 实际暂存修改仍只有业务逻辑，版本号没有反向修改。
  const stagedChanges = repo.git('diff', '--cached', '--unified=0', '--', LOGIN_FILE);
  assert.equal(stagedChanges.includes('/css/login.css?v='), false);
});

test('post-commit does not update unrelated pending asset references', t => {
  const repo = createRepo(t);
  const pendingCss = 'body { color: orange; }\n';
  repo.write(CSS_FILE, pendingCss);
  repo.git('add', CSS_FILE);
  repo.write('notes.txt', 'committed note\n');

  repo.git('commit', '--only', '-qm', '只提交备注', '--', 'notes.txt');

  assert.equal(repo.git('show', `HEAD:${CSS_FILE}`), ORIGINAL_CSS);
  assert.equal(repo.staged(CSS_FILE), pendingCss);
  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  assert.equal(repo.read(LOGIN_FILE), originalLogin);
  assert.equal(repo.git('diff', '--cached', '--name-only').trim(), CSS_FILE);
});

test('real partial commits with a custom index reconcile that index only', t => {
  const repo = createRepo(t);
  const env = { ...process.env, GIT_INDEX_FILE: path.join(repo.rootDir, '.git', 'custom-index') };
  execFileSync('git', ['read-tree', 'HEAD'], { cwd: repo.rootDir, env });
  const newCss = 'body { color: green; }\n';
  repo.write(CSS_FILE, newCss);

  execFileSync('git', ['commit', '--only', '-qm', '独立索引部分提交', '--', CSS_FILE], {
    cwd: repo.rootDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const customLogin = execFileSync('git', ['show', `:${LOGIN_FILE}`], { cwd: repo.rootDir, env, encoding: 'utf8' });
  assert.equal(customLogin, originalLogin.replace(originalUrl, `/css/login.css?v=${hash(newCss)}`));
  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  assert.equal(repo.staged(CSS_FILE), ORIGINAL_CSS);
});

test('post-commit tolerates deleted templates and does not regenerate skipped commits', t => {
  const repo = createRepo(t);
  const newCss = 'body { color: green; }\n';
  repo.write(CSS_FILE, newCss);
  repo.git('commit', '--no-verify', '--only', '-qm', '跳过版本生成', '--', CSS_FILE);
  assert.equal(repo.staged(LOGIN_FILE), originalLogin);
  assert.equal(repo.read(LOGIN_FILE), originalLogin);
  assert.equal(repo.git('status', '--porcelain'), '');

  repo.git('rm', LOGIN_FILE);
  repo.git('commit', '-qm', '删除登录模板');
  execFileSync(process.execPath, ['scripts/update-versions.js', '--post-commit'], {
    cwd: repo.rootDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.equal(fs.existsSync(path.join(repo.rootDir, LOGIN_FILE)), false);
  assert.equal(repo.git('status', '--porcelain'), '');
});
