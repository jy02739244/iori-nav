/**
 * 按 git 提交记录自动更新 README 更新日志
 *
 * 用法:
 *   node scripts/update-changelog.js
 *   node scripts/update-changelog.js --max-days=20 --max-len=50
 *
 * 默认行为（增量模式）:
 * - 读取 README 中已有日志的最新日期
 * - 只追加该日期之后的日志
 * - 若 README 尚无日志，则初始化最近 N 天（--max-days）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(ROOT_DIR, 'README.md');

const START_MARKER = '<!-- changelog:start -->';
const END_MARKER = '<!-- changelog:end -->';

function getArg(name, defaultValue) {
  const prefix = `${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : defaultValue;
}

const MAX_DAYS = Math.max(1, parseInt(getArg('--max-days', '20'), 10) || 20);
const MAX_LEN = Math.max(10, parseInt(getArg('--max-len', '50'), 10) || 50);

const CATEGORY_RULES = [
  {
    id: 'security',
    emoji: '🛡️',
    summary: '优化登录会话与安全防护',
    secondary: '加强登录安全',
    patterns: [/登录|会话|cookie|auth|鉴权|暴力破解|rate\s*limit|安全|session/i],
  },
  {
    id: 'perf',
    emoji: '⚡',
    summary: '优化缓存策略并提升加载性能',
    secondary: '提升页面性能',
    patterns: [/缓存|cache|性能|perf|加载|预加载|并行|初始化/i],
  },
  {
    id: 'wallpaper',
    emoji: '🖼️',
    summary: '优化壁纸功能与加载体验',
    secondary: '完善壁纸能力',
    patterns: [/壁纸|wallpaper|bing|360|背景|background/i],
  },
  {
    id: 'ui',
    emoji: '🎨',
    summary: '优化卡片样式与后台界面体验',
    secondary: '优化界面交互',
    patterns: [/卡片|样式|style|ui|字体|预览|布局|动画|后台界面/i],
  },
  {
    id: 'data',
    emoji: '📦',
    summary: '增强导入导出与批量管理能力',
    secondary: '完善数据管理',
    patterns: [/导入|导出|import|export|批量|bookmark|书签/i],
  },
  {
    id: 'category',
    emoji: '📂',
    summary: '增强分类结构与私密数据支持',
    secondary: '增强分类能力',
    patterns: [/分类|category|私密|is_private|multi-level|多级/i],
  },
  {
    id: 'docs',
    emoji: '🧰',
    summary: '更新文档与部署使用说明',
    secondary: '补充文档说明',
    patterns: [/readme|docs|文档/i],
  },
  {
    id: 'fix',
    emoji: '🐞',
    summary: '修复若干问题并提升稳定性',
    secondary: '修复多项问题',
    patterns: [/fix|bug|修复|错误|异常|syntax/i],
  },
];

function normalizeSubject(subject) {
  return String(subject)
    .replace(/^\s*(feat|fix|docs|style|refactor|perf|chore|build|test)(\([^)]+\))?:\s*/i, '')
    .replace(/^\s*\d+[.)、]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  if (maxLen <= 3) return text.slice(0, maxLen);
  return `${text.slice(0, maxLen - 3)}...`;
}

function isIgnorableSubject(subject) {
  return /^(merge\s+pull\s+request|merge\s+branch)\b/i.test(subject);
}

function extractDateFromLine(line) {
  const match = line.match(/\*\*(\d{4}-\d{2}-\d{2})\*\*/);
  return match ? match[1] : null;
}

function getLatestDateFromLines(lines) {
  let latest = null;
  for (const line of lines) {
    const date = extractDateFromLine(line);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function dedupeChangelogLines(lines) {
  const seenDates = new Set();
  const unique = [];

  for (const line of lines) {
    const date = extractDateFromLine(line);
    if (date) {
      if (seenDates.has(date)) continue;
      seenDates.add(date);
      unique.push(line);
      continue;
    }

    unique.push(line);
  }

  return unique;
}

function scoreCategories(subjects) {
  const scores = new Map();
  for (const rule of CATEGORY_RULES) scores.set(rule.id, 0);

  for (const subject of subjects) {
    for (const rule of CATEGORY_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(subject))) {
        scores.set(rule.id, scores.get(rule.id) + 1);
      }
    }
  }

  return CATEGORY_RULES
    .map((rule) => ({ rule, score: scores.get(rule.id) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function summarizeDay(subjects) {
  const cleaned = subjects
    .map(normalizeSubject)
    .filter(Boolean)
    .filter((subject) => !isIgnorableSubject(subject));

  if (!cleaned.length) {
    return { emoji: '🔧', text: '仓库同步与维护' };
  }

  const ranked = scoreCategories(cleaned);

  if (!ranked.length) {
    const fallback = cleaned[0] || '常规维护与细节优化';
    return { emoji: '🔧', text: truncateText(fallback, MAX_LEN) };
  }

  const primary = ranked[0].rule;
  let text = primary.summary;

  if (ranked.length > 1 && ranked[1].score >= 2) {
    text = `${primary.summary}，并${ranked[1].rule.secondary}`;
  }

  return {
    emoji: primary.emoji,
    text: truncateText(text, MAX_LEN),
  };
}

function getGitLogByDate() {
  const cmd = 'git log --date=short --pretty=format:%ad%x09%s';
  const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8' });
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);

  const grouped = new Map();
  for (const line of lines) {
    const tabIndex = line.indexOf('\t');
    if (tabIndex === -1) continue;

    const date = line.slice(0, tabIndex).trim();
    const subject = line.slice(tabIndex + 1).trim();
    if (!date || !subject) continue;

    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(subject);
  }

  return Array.from(grouped.entries());
}

function buildChangelogLines(groupedLogs) {
  return groupedLogs.map(([date, subjects]) => {
    const { emoji, text } = summarizeDay(subjects);
    return `- ${emoji} **${date}**：${text}`;
  });
}

function extractExistingChangelogLines(content) {
  if (content.includes(START_MARKER) && content.includes(END_MARKER)) {
    const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`, 'm');
    const match = content.match(pattern);
    if (!match) return [];

    return match[0]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '));
  }

  const sectionPattern = /## 📋 更新日志\s*\n([\s\S]*?)\n---/m;
  const sectionMatch = content.match(sectionPattern);
  if (!sectionMatch) return [];

  return sectionMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

function updateReadme(changelogLines) {
  let content = fs.readFileSync(README_PATH, 'utf8');
  const block = `${START_MARKER}\n${changelogLines.join('\n')}\n${END_MARKER}`;

  if (content.includes(START_MARKER) && content.includes(END_MARKER)) {
    const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`, 'm');
    content = content.replace(pattern, block);
  } else {
    const sectionPattern = /(## 📋 更新日志\s*\n\s*)([\s\S]*?)(\n---)/m;
    if (!sectionPattern.test(content)) {
      throw new Error('README 中未找到「## 📋 更新日志」区块');
    }
    content = content.replace(sectionPattern, `$1${block}\n$3`);
  }

  fs.writeFileSync(README_PATH, content, 'utf8');
}

function main() {
  const readmeContent = fs.readFileSync(README_PATH, 'utf8');
  const existingLines = extractExistingChangelogLines(readmeContent);
  const latestExistingDate = getLatestDateFromLines(existingLines);

  const groupedLogs = getGitLogByDate();
  const logsToAdd = latestExistingDate
    ? groupedLogs.filter(([date]) => date > latestExistingDate)
    : groupedLogs.slice(0, MAX_DAYS);

  const newLines = buildChangelogLines(logsToAdd);

  if (!newLines.length) {
    if (latestExistingDate) {
      console.log(`无新增日志（当前最新日期：${latestExistingDate}）。`);
    } else {
      console.log('未读取到 git 提交记录，跳过更新。');
    }
    return;
  }

  const mergedLines = dedupeChangelogLines([...newLines, ...existingLines]);
  updateReadme(mergedLines);
  console.log(`已新增 ${newLines.length} 个日期，README 更新日志已同步。`);
}

main();
