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

async function renderHome(settingsRows = [], envOverrides = {}) {
  const response = await onRequest({
    request: new Request('https://example.com/?render-test=1'),
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

test('home page does not render the retired GitHub shortcut icon', async () => {
  const html = await renderHome();

  assert.equal(html.includes('title="GitHub"'), false);
  assert.equal(html.includes('hideGithubSwitch'), false);
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
