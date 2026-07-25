import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFaviconUrl,
  escapeHTML,
  escapeLikePattern,
  getUrlMatchCandidates,
  getStyleStr,
  normalizeUrlForStorage,
  parsePagination,
  sanitizeStyleColor,
  sanitizeStyleSize,
  sanitizeUrl,
} from '../functions/lib/utils.js';

test('escapeHTML escapes all HTML-sensitive characters', () => {
  assert.equal(
    escapeHTML(`<img src=x onerror="alert('x')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
  );
});

test('sanitizeUrl only allows absolute http and https URLs', () => {
  assert.equal(sanitizeUrl(' https://example.com/a b '), 'https://example.com/a%20b');
  assert.equal(sanitizeUrl('http://example.com'), 'http://example.com/');
  assert.equal(sanitizeUrl('/relative/path'), '');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('data:text/html,<svg>'), '');
});

test('bookmark URL normalization keeps only root URLs slashless', () => {
  assert.equal(normalizeUrlForStorage('https://example.com/'), 'https://example.com');
  assert.equal(normalizeUrlForStorage('https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlForStorage('https://example.com/?q=1#top'), 'https://example.com?q=1#top');
  assert.equal(normalizeUrlForStorage('https://user:pass@example.com/'), 'https://user:pass@example.com');
  assert.equal(normalizeUrlForStorage('https://example.com/docs/'), 'https://example.com/docs/');
  assert.equal(normalizeUrlForStorage('javascript:alert(1)'), '');
  assert.deepEqual(getUrlMatchCandidates('https://example.com/'), [
    'https://example.com',
    'https://example.com/',
  ]);
  assert.deepEqual(getUrlMatchCandidates('https://example.com/?q=1'), [
    'https://example.com?q=1',
    'https://example.com/?q=1',
  ]);
  assert.deepEqual(getUrlMatchCandidates('https://user:pass@example.com/'), [
    'https://user:pass@example.com',
    'https://user:pass@example.com/',
  ]);
});

test('escapeLikePattern escapes SQLite LIKE wildcard characters', () => {
  assert.equal(escapeLikePattern('100%_done\\ok'), '100\\%\\_done\\\\ok');
});

test('buildFaviconUrl preserves explicit logos and derives favicon URLs for sites', () => {
  assert.equal(
    buildFaviconUrl('https://example.com/docs', 'https://cdn.example.com/logo.png', 'https://icons.test/?url='),
    'https://cdn.example.com/logo.png'
  );
  assert.equal(
    buildFaviconUrl('https://example.com/docs', '', 'https://icons.test/?url='),
    'https://icons.test/?url=example.com'
  );
  assert.equal(
    buildFaviconUrl('https://example.com?q=1#top', '', 'https://icons.test/?url='),
    'https://icons.test/?url=example.com'
  );
  assert.equal(buildFaviconUrl('javascript:alert(1)', '', 'https://icons.test/?url='), null);
});

test('getStyleStr only emits whitelisted fonts', () => {
  assert.equal(
    getStyleStr('18', '#123456', "'Noto Sans SC', sans-serif"),
    'style="font-size: 18px;color: #123456 !important;font-family: \'Noto Sans SC\', sans-serif !important;"'
  );
  assert.equal(
    getStyleStr('', '', 'Comic Sans MS'),
    ''
  );
});

test('style sanitizers reject CSS injection values', () => {
  assert.equal(sanitizeStyleSize('16'), '16');
  assert.equal(sanitizeStyleSize('9999'), '');
  assert.equal(sanitizeStyleColor('#abcdef'), '#abcdef');
  assert.equal(sanitizeStyleColor('transparent'), 'transparent');
  assert.equal(sanitizeStyleColor('currentColor'), 'currentColor');
  assert.equal(sanitizeStyleColor('rgb(12, 34, 56)'), 'rgb(12, 34, 56)');
  assert.equal(sanitizeStyleColor('red; background:url(javascript:alert(1))'), '');
  assert.equal(sanitizeStyleColor('var(--card-color)'), '');
  assert.equal(getStyleStr('16;display:block', '#fff;position:fixed', 'Comic Sans MS'), '');
});

test('parsePagination falls back for invalid values and caps page size', () => {
  const params = new URLSearchParams('page=abc&pageSize=9999');
  assert.deepEqual(parsePagination(params, { maxPageSize: 200 }), {
    page: 1,
    pageSize: 200,
    offset: 0,
  });

  const negativeParams = new URLSearchParams('page=-3&pageSize=-1');
  assert.deepEqual(parsePagination(negativeParams), {
    page: 1,
    pageSize: 10,
    offset: 0,
  });
});
