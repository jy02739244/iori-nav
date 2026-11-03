/**
 * 仅修改暂存区中的资源版本号，不将工作区的其他修改加入提交。
 * 资源内容也从暂存区读取，兼容 CSS/JS 与模板的部分暂存。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function updateStagedVersions(rootDir, templates, { isPostCommit = false } = {}) {
  const git = (args, input) => execFileSync('git', args, {
    cwd: rootDir,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  const stagedFiles = new Map();
  const blobs = new Map();
  const committedAssetChanges = new Map();

  if (isPostCommit) {
    // post-commit 中 Git 已恢复 GIT_INDEX_FILE，可修正最终索引。
    // 只处理本次提交确实改动过的引用，避免影响其他待提交的资源。
    const changedFiles = new Set(git(['diff-tree', '--root', '--no-commit-id', '--name-only', '--no-renames', '--diff-filter=ACMT', '-r', '-z', 'HEAD']).toString('utf8').split('\0'));
    for (const [file, assets] of Object.entries(templates)) {
      if (!changedFiles.has(file)) continue;
      const committedContent = git(['show', `HEAD:${file}`]).toString('utf8');
      let previousContent = '';
      try {
        previousContent = git(['show', `HEAD^:${file}`]).toString('utf8');
      } catch (error) {
        // 首次提交或新增模板没有父版本。
        if (error.status !== 128) throw error;
      }
      committedAssetChanges.set(file, new Set(assets
        .filter(({ pattern }) => committedContent.match(pattern)?.[0] !== previousContent.match(pattern)?.[0])
        .map(asset => asset.file)));
    }
    if (!committedAssetChanges.size) return;
  }

  for (const entry of git(['ls-files', '--stage', '-z']).toString('utf8').split('\0')) {
    if (!entry) continue;
    const [, mode, objectId, stage, file] = entry.match(/^(\d{6}) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/);
    if (stage !== '0') throw new Error('请先解决合并冲突，再更新资源版本号');
    if (mode === '100644' || mode === '100755') stagedFiles.set(file, { mode, objectId });
  }

  const readBlob = objectId => {
    if (!blobs.has(objectId)) blobs.set(objectId, git(['cat-file', 'blob', objectId]));
    return blobs.get(objectId);
  };
  const updates = [];

  for (const [file, assets] of Object.entries(templates)) {
    if (isPostCommit && !committedAssetChanges.has(file)) continue;
    const stagedFile = stagedFiles.get(file);
    if (!stagedFile) continue;
    let content = readBlob(stagedFile.objectId).toString('utf8');
    const replacements = [];

    for (const asset of assets) {
      if (isPostCommit && !committedAssetChanges.get(file).has(asset.file)) continue;
      const stagedAsset = stagedFiles.get(asset.file);
      if (!stagedAsset) continue;
      const oldUrl = content.match(asset.pattern)?.[0];
      if (!oldUrl) continue;
      const hash = crypto.createHash('md5').update(readBlob(stagedAsset.objectId)).digest('hex').slice(0, 8);
      const newUrl = `${asset.file.replace(/^public/, '')}?v=${hash}`;
      if (oldUrl === newUrl) continue;
      content = content.replace(asset.pattern, newUrl);
      replacements.push({ oldUrl, newUrl, pattern: asset.pattern });
    }

    if (!replacements.length) continue;
    const objectId = git(['hash-object', '-w', '--stdin'], content).toString('utf8').trim();
    updates.push({ file, mode: stagedFile.mode, objectId, replacements });
  }

  if (!updates.length) return;
  // 一次更新全部模板；同时支持 Git 在部分提交时提供的 GIT_INDEX_FILE。
  const indexInfo = updates.map(({ file, mode, objectId }) => `${mode} ${objectId}\t${file}\0`).join('');
  git(['update-index', '-z', '--index-info'], indexInfo);

  for (const { file, replacements } of updates) {
    const fullPath = path.join(rootDir, file);
    let content;
    try {
      // 不恢复工作区删除的文件，也不跟随用户创建的符号链接。
      if (!fs.lstatSync(fullPath).isFile()) continue;
      content = fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    let updatedContent = content;
    for (const { oldUrl, newUrl, pattern } of replacements) {
      // 只同步仍与原暂存版本一致的引用，保留用户自行修改的引用。
      updatedContent = updatedContent.replace(pattern, url => url === oldUrl ? newUrl : url);
    }
    if (content !== updatedContent) fs.writeFileSync(fullPath, updatedContent, 'utf8');
  }
  console.log(`已更新 ${updates.length} 个模板的暂存资源版本号`);
}

module.exports = { updateStagedVersions };
