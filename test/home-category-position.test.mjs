import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { onRequest } from '../functions/index.js';

const templateHtml = readFileSync(resolve('public/index.html'), 'utf8');

function createStatement(sql, settingsRows) {
  return {
    bind() {
      return createStatement(sql, settingsRows);
    },
    async all() {
      if (sql.includes('FROM category')) {
        return {
          results: [
            { id: 1, catelog: '工具', sort_order: 1, parent_id: 0 },
          ],
        };
      }

      if (sql.includes('FROM settings')) {
        return { results: settingsRows };
      }

      if (sql.includes('FROM sites')) {
        return {
          results: [
            { id: 1, name: 'Example', url: 'https://example.com', logo: '', desc: 'Example site', catelog_id: 1, catelog_name: '工具' },
          ],
        };
      }

      return { results: [] };
    },
  };
}

async function renderHome(settingsRows = [], envOverrides = {}, requestUrl = 'https://example.com/?render-test=1') {
  const response = await onRequest({
    request: new Request(requestUrl),
    env: {
      ASSETS: {
        async fetch() {
          return new Response(templateHtml);
        },
      },
      NAV_AUTH: {
        async get() {
          return null;
        },
        async put() {},
        async delete() {},
      },
      NAV_DB: {
        prepare(sql) {
          return createStatement(sql, settingsRows);
        },
      },
      SITE_NAME: 'Unit Site',
      SITE_DESCRIPTION: 'Unit Description',
      FOOTER_TEXT: 'Unit Footer',
      ENABLE_PUBLIC_SUBMISSION: 'false',
      ...envOverrides,
    },
    waitUntil() {},
  });

  assert.equal(response.status, 200);
  return response.text();
}

test('home renders floating submission button only when public submission is enabled', async () => {
  const disabledHtml = await renderHome();
  const enabledHtml = await renderHome([], { ENABLE_PUBLIC_SUBMISSION: 'true' });

  assert.match(disabledHtml, /id="addSiteBtnFloating" class="!hidden fixed bottom-24/);
  assert.match(enabledHtml, /id="addSiteBtnFloating" class=" fixed bottom-24/);
  assert.equal(enabledHtml.includes('addSiteBtnHorizontal'), false);
});

test('home category navigation defaults below the search box', async () => {
  const html = await renderHome();
  const searchIndex = html.indexOf('id="headerSearchInput"');
  const navIndex = html.indexOf('id="horizontalCategoryNav"');

  assert.ok(searchIndex > -1);
  assert.ok(navIndex > -1);
  assert.ok(searchIndex < navIndex);
  assert.equal(html.includes('justify-center'), true);
  assert.equal(html.includes('horizontal-category-nav-shell is-top'), false);
  assert.equal(html.includes('id="horizontalMoreWrapper"'), true);
});

test('home category links use IDs and SSR accepts category ID query', async () => {
  const html = await renderHome([], {}, 'https://example.com/?catalog=1');

  assert.match(html, /href="\?catalog=1"/);
  assert.match(html, /data-active="工具"/);
  assert.match(html, /工具 · 1 个书签/);
  assert.doesNotMatch(html, /href="\?catalog=%E5%B7%A5%E5%85%B7"/);
});

test('home category query ignores category names', async () => {
  const html = await renderHome([], {}, 'https://example.com/?catalog=%E5%B7%A5%E5%85%B7');

  assert.match(html, /data-active=""/);
  assert.match(html, /全部收藏 · 1 个书签/);
});

test('home page does not render the retired GitHub shortcut icon', async () => {
  const html = await renderHome();

  assert.equal(html.includes('title="GitHub"'), false);
  assert.equal(html.includes('hideGithubSwitch'), false);
});

test('home uses style default wallpaper when custom wallpaper is empty', async () => {
  const style1Html = await renderHome([
    { key: 'layout_card_style', value: 'style1' },
  ]);
  const style2Html = await renderHome([
    { key: 'layout_card_style', value: 'style2' },
  ]);
  const style3Html = await renderHome([
    { key: 'layout_card_style', value: 'style3' },
  ]);
  const customHtml = await renderHome([
    { key: 'layout_card_style', value: 'style3' },
    { key: 'layout_custom_wallpaper', value: 'https://example.com/custom-bg.jpg' },
  ]);

  assert.match(style1Html, /src="https:\/\/img\.peapix\.com\/dc6e559cacb14f9c83b46d5a7f189bab_1920\.jpg"/);
  assert.match(style2Html, /src="https:\/\/img\.peapix\.com\/1f4688b7a0d64bda9c508f9498b04f49_1920\.jpg"/);
  assert.match(style3Html, /src="https:\/\/main\.ssss\.nyc\.mn\/background\.webp"/);
  assert.match(style3Html, /custom-wallpaper/);
  assert.match(customHtml, /src="https:\/\/example\.com\/custom-bg\.jpg"/);
  assert.doesNotMatch(customHtml, /main\.ssss\.nyc\.mn\/background\.webp/);
});

test('home footer text can be configured from settings', async () => {
  const defaultHtml = await renderHome();
  const configuredHtml = await renderHome([
    { key: 'home_footer_text', value: 'Custom Footer' },
  ]);
  const year = new Date().getFullYear();

  assert.equal(defaultHtml.includes(`© ${year} Unit Footer`), true);
  assert.equal(configuredHtml.includes(`© ${year} Custom Footer`), true);
  assert.equal(configuredHtml.includes(`© ${year} Unit Footer`), false);
});

test('home grid uses configured mobile card columns', async () => {
  const oneColHtml = await renderHome([
    { key: 'mobile_layout_grid_cols', value: '1' },
  ]);
  const threeColHtml = await renderHome([
    { key: 'mobile_layout_grid_cols', value: '3' },
  ]);

  assert.match(oneColHtml, /id="sitesGrid" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 mobile-card-style2/);
  assert.match(threeColHtml, /id="sitesGrid" class="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 mobile-card-style2/);
});

test('home grid marks the configured mobile card style', async () => {
  const styleOneHtml = await renderHome([
    { key: 'mobile_layout_card_style', value: 'style1' },
  ]);

  assert.match(styleOneHtml, /id="sitesGrid" class="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 mobile-card-style1/);
});

test('home grid marks style three independently for desktop and mobile', async () => {
  const html = await renderHome([
    { key: 'layout_card_style', value: 'style3' },
    { key: 'mobile_layout_card_style', value: 'style3' },
  ]);

  assert.match(html, /id="sitesGrid" class="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 mobile-card-style3 desktop-card-style3/);
  assert.match(html, /class="site-card[^"\n]*style-3/);
  assert.match(html, /desktop-page-style3 mobile-page-style3/);
  assert.match(html, /class="home-search-shell/);
});

test('style three with category on top marks body class for compact top nav', async () => {
  const html = await renderHome([
    { key: 'layout_card_style', value: 'style3' },
    { key: 'home_category_position', value: 'top' },
  ]);

  assert.match(html, /category-pos-top/);
  assert.match(html, /category-nav-top-wrap/);
  assert.match(html, /desktop-page-style3/);
});

test('style three keeps the standard search engine set and order', async () => {
  const html = await renderHome([
    { key: 'layout_card_style', value: 'style3' },
    { key: 'home_search_engine_enabled', value: 'true' },
  ]);

  const localIndex = html.indexOf('data-engine="local"');
  const googleIndex = html.indexOf('data-engine="google"');
  const baiduIndex = html.indexOf('data-engine="baidu"');
  const githubIndex = html.indexOf('data-engine="github"');

  assert.ok(localIndex > -1);
  assert.ok(localIndex < googleIndex);
  assert.ok(googleIndex < baiduIndex);
  assert.ok(baiduIndex < githubIndex);
  assert.match(html, /data-engine="local"><span>站内<\/span>/);
  assert.match(html, /data-engine="google"><span>Google<\/span>/);
  assert.match(html, /data-engine="baidu"><span>Baidu<\/span>/);
  assert.match(html, /data-engine="github"><span>Github<\/span>/);
  assert.doesNotMatch(html, /data-engine="bing"/);
});

test('external search inherits desktop and mobile bookmark title colors', async () => {
  const html = await renderHome([
    { key: 'card_title_color', value: '#123456' },
    { key: 'mobile_card_title_color', value: 'rgba(240, 240, 240, 0.9)' },
  ]);

  assert.match(html, /@media \(min-width: 768px\) \{ body \{ --desktop-card-title-color: #123456; \} \}/);
  assert.match(html, /@media \(max-width: 767px\) \{ body \{ --mobile-card-title-color: rgba\(240, 240, 240, 0\.9\); \} \}/);
  assert.doesNotMatch(html, /--desktop-card-title-(?:font|size)/);
});

test('home card radius and frosted blur preserve zero values', async () => {
  const html = await renderHome([
    { key: 'layout_card_border_radius', value: '0' },
    { key: 'mobile_layout_card_border_radius', value: '0' },
    { key: 'layout_frosted_glass_intensity', value: '0' },
    { key: 'mobile_layout_frosted_glass_intensity', value: '0' },
  ]);

  assert.match(html, /--card-radius: 0px; --frosted-glass-blur: 0px;/);
  assert.match(html, /@media \(max-width: 767px\) \{ :root \{ --card-radius: 0px; --frosted-glass-blur: 0px; \} \}/);
});

test('home category navigation can render at the top', async () => {
  const html = await renderHome([
    { key: 'home_category_position', value: 'top' },
  ]);
  const navIndex = html.indexOf('id="horizontalCategoryNav"');
  const bodyDescriptionIndex = html.lastIndexOf('Unit Description');

  assert.ok(navIndex > -1);
  assert.ok(bodyDescriptionIndex > -1);
  assert.ok(navIndex < bodyDescriptionIndex);
  assert.equal(html.includes('horizontal-category-nav-shell is-top'), true);
});

test('home category navigation can render above the search box', async () => {
  const html = await renderHome([
    { key: 'home_category_position', value: 'above_search' },
  ]);
  const descriptionIndex = html.lastIndexOf('Unit Description');
  const navIndex = html.indexOf('id="horizontalCategoryNav"');
  const searchIndex = html.indexOf('id="headerSearchInput"');

  assert.ok(descriptionIndex > -1);
  assert.ok(navIndex > -1);
  assert.ok(searchIndex > -1);
  assert.ok(descriptionIndex < navIndex);
  assert.ok(navIndex < searchIndex);
  assert.equal(html.includes('horizontal-category-nav-shell is-top'), false);
});


test('home category navigation can render multiple rows without more button', async () => {
  const html = await renderHome([
    { key: 'home_category_flow', value: 'multi_line' },
  ]);

  assert.equal(html.includes('id="horizontalCategoryNav"'), true);
  assert.equal(html.includes('overflow-visible'), true);
  assert.equal(html.includes('justify-start'), true);
  assert.equal(html.includes('id="horizontalMoreWrapper"'), false);
  assert.equal(html.includes('id="horizontalMoreBtn"'), false);
  assert.equal(html.includes('max-height: 60px'), false);
});

test('home category navigation can render in the left sidebar', async () => {
  const html = await renderHome([
    { key: 'home_category_position', value: 'left' },
  ]);

  assert.equal(html.includes('id="horizontalCategoryNav"'), false);
  assert.equal(html.includes('lg:ml-64'), true);
  assert.equal(html.includes('min-[550px]:hidden'), false);
});
