const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', '.wrangler', 'node_modules']);

function collectJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, files);
    } else if (entry.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.mjs'))) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  const files = collectJsFiles(ROOT_DIR).sort();
  const failed = [];

  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      failed.push({ file, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
    }
  }

  if (failed.length > 0) {
    console.error(`Syntax check failed for ${failed.length} file(s):`);
    for (const item of failed) {
      console.error(`\n${path.relative(ROOT_DIR, item.file)}`);
      if (item.output) console.error(item.output);
    }
    process.exit(1);
  }

  console.log(`Syntax check passed (${files.length} files).`);
}

main();
