import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { buildCardHydrationState } from '../functions/lib/card-model.js';
import { renderSiteCards } from '../functions/lib/card-renderer.js';
import { renderHorizontalMenu, renderVerticalMenu } from '../functions/lib/menu-renderer.js';
import { parseSettings } from '../functions/lib/settings-parser.js';

test('renderSiteCards escapes user-controlled fields and rejects unsafe URLs', () => {
  const html = renderSiteCards([
    {
      id: 7,
      name: '<script>alert(1)</script>',
      url: 'javascript:alert(1)',
      logo: 'data:text/html,<svg>',
      desc: '"quoted" & <b>bold</b>',
      catelog_name: '<Work>',
    },
  ], parseSettings([]));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;\/b&gt;/);
  assert.match(html, /&lt;Work&gt;/);
  assert.match(html, /site-category/);
  assert.match(html, /href="#"/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /data:text\/html/);
});

test('renderSiteCards reflects layout options used by SSR cards', () => {
  const settings = parseSettings([
    { key: 'layout_hide_desc', value: 'true' },
    { key: 'layout_hide_links', value: 'true' },
    { key: 'layout_hide_category', value: 'true' },
    { key: 'layout_enable_frosted_glass', value: 'true' },
    { key: 'layout_card_style', value: 'style2' },
  ]);

  const html = renderSiteCards([
    { id: 1, name: 'Example', url: 'https://example.com', desc: 'Hidden', catelog_name: 'Hidden' },
  ], settings);

  assert.match(html, /frosted-glass-effect/);
  assert.match(html, /style-2/);
  assert.doesNotMatch(html, /Hidden/);
  assert.doesNotMatch(html, /copy-btn/);
});

test('card hydration state shares sanitization and render config', () => {
  const settings = parseSettings([
    { key: 'layout_enable_frosted_glass', value: 'true' },
    { key: 'layout_card_style', value: 'style2' },
    { key: 'layout_grid_cols', value: '5' },
  ]);

  const { config, cards } = buildCardHydrationState([
    {
      id: 7,
      name: '<script>alert(1)</script>',
      url: 'https://example.com',
      logo: 'data:text/html,<svg>',
      desc: '"quoted" & <b>bold</b>',
      catelog_id: 3,
      catelog_name: '<Work>',
    },
  ], settings);

  assert.equal(config.enableFrostedGlass, true);
  assert.equal(config.cardStyleClass, 'style-2');
  assert.equal(config.hideCopyText, true);
  assert.equal(cards[0].nameHtml, '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(cards[0].catalogHtml, '&lt;Work&gt;');
  assert.equal(cards[0].descHtml, '&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
  assert.equal(cards[0].urlHtml, 'https://example.com/');
  assert.equal(cards[0].logoUrlHtml, '');
  assert.equal(cards[0].hasValidUrl, true);
  assert.match(cards[0].searchText, /example\.com/);
});

test('card hydration state exposes mobile card config separately', () => {
  const settings = parseSettings([
    { key: 'layout_grid_cols', value: '6' },
    { key: 'layout_hide_desc', value: 'false' },
    { key: 'mobile_layout_grid_cols', value: '3' },
    { key: 'mobile_layout_hide_desc', value: 'true' },
    { key: 'mobile_layout_card_style', value: 'style2' },
  ]);

  const { config, configs } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(config.gridCols, '6');
  assert.equal(config.hideDesc, false);
  assert.equal(configs.desktop.gridCols, '6');
  assert.equal(configs.mobile.gridCols, '3');
  assert.equal(configs.mobile.hideDesc, true);
  assert.equal(configs.mobile.cardStyleClass, 'style-2');
  assert.equal(configs.mobile.hideCopyText, true);
});

test('card hydration state respects mobile style one', () => {
  const settings = parseSettings([
    { key: 'mobile_layout_card_style', value: 'style1' },
  ]);

  const { configs } = buildCardHydrationState([
    { id: 1, name: 'Example', url: 'https://example.com' },
  ], settings);

  assert.equal(configs.mobile.cardStyle, 'style1');
  assert.equal(configs.mobile.cardStyleClass, '');
});

test('narrow mobile CSS does not force style one cards into style two layout', () => {
  const css = readFileSync('public/css/style.css', 'utf8');
  const marker = '@media (max-width: 400px)';
  const start = css.indexOf(marker);
  const blockStart = start >= 0 ? css.indexOf('{', start) : -1;
  let depth = 0;
  let end = css.length;
  for (let index = blockStart; index >= 0 && index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0 && index > blockStart) {
      end = index + 1;
      break;
    }
  }
  const narrowMobileBlock = blockStart >= 0 ? css.slice(start, end) : '';

  assert.match(narrowMobileBlock, /\.site-card\.style-2 \.flex\.items-start/);
  assert.doesNotMatch(narrowMobileBlock, /\.site-card \.flex\.items-start/);
  assert.doesNotMatch(narrowMobileBlock, /\.site-card \.site-icon/);
});

test('narrow mobile compact density styles target configured card and column combinations', () => {
  const css = readFileSync('public/css/style.css', 'utf8');
  const marker = '@media (max-width: 389px)';
  const start = css.lastIndexOf(marker);
  const blockStart = start >= 0 ? css.indexOf('{', start) : -1;
  let depth = 0;
  let end = css.length;
  for (let index = blockStart; index >= 0 && index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0 && index > blockStart) {
      end = index + 1;
      break;
    }
  }
  const compactThreeColumnBlock = blockStart >= 0 ? css.slice(start, end) : '';

  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-2\.mobile-card-style1/);
  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-3\.mobile-card-style1/);
  assert.match(compactThreeColumnBlock, /#sitesGrid\.grid-cols-3\.mobile-card-style2/);
  assert.doesNotMatch(compactThreeColumnBlock, /#sitesGrid\.grid-cols-2\.mobile-card-style2/);
  assert.match(compactThreeColumnBlock, /gap: 0\.5rem/);
  assert.match(compactThreeColumnBlock, /\.site-card-content/);
  assert.match(compactThreeColumnBlock, /\.site-icon/);
  assert.match(compactThreeColumnBlock, /\.site-title/);
  assert.match(compactThreeColumnBlock, /\.site-category/);
});

test('admin mobile preview hides copy text at the same card density as the real page', () => {
  const source = readFileSync('public/js/admin-settings-preview.js', 'utf8');
  const sandbox = {
    window: {
      AdminSettings: {},
      matchMedia() {
        return { matches: false };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const shouldHideCopyText = sandbox.window.AdminSettings.preview.shouldHideCopyTextForPreview;

  assert.equal(shouldHideCopyText('mobile', '2'), false);
  assert.equal(shouldHideCopyText('mobile', '3'), true);
  assert.equal(shouldHideCopyText('desktop', '4'), false);
  assert.equal(shouldHideCopyText('desktop', '5'), true);
});

test('menu renderers escape names and encode category URLs', () => {
  const categories = [
    {
      id: 1,
      catelog: 'A & B',
      children: [
        { id: 2, catelog: '<Child>', children: [] },
      ],
    },
  ];

  const horizontal = renderHorizontalMenu(categories, '<Child>');
  const vertical = renderVerticalMenu(categories, 'A & B', false);

  assert.match(horizontal, /A &amp; B/);
  assert.match(horizontal, /%3CChild%3E/);
  assert.match(horizontal, /&lt;Child&gt;/);
  assert.match(horizontal, /data-id="2"/);
  assert.match(vertical, /A &amp; B/);
  assert.match(vertical, /nav|bg-secondary-100|text-primary-700/);
});
