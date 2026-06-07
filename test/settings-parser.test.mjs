import test from 'node:test';
import assert from 'node:assert/strict';

import { getSettingsKeys, normalizeSettingValueForStorage, parseSettings } from '../functions/lib/settings-parser.js';

test('parseSettings applies documented defaults', () => {
  const settings = parseSettings([]);

  assert.equal(settings.layout_grid_cols, '4');
  assert.equal(settings.layout_menu_layout, 'horizontal');
  assert.equal(settings.home_category_position, 'below_search');
  assert.equal(settings.home_category_flow, 'single_line');
  assert.equal(settings.layout_card_animation, 'radial');
  assert.equal(settings.layout_hide_desc, false);
});

test('parseSettings converts stored boolean strings consistently', () => {
  const settings = parseSettings([
    { key: 'layout_hide_desc', value: 'true' },
    { key: 'layout_hide_links', value: 'false' },
    { key: 'home_hide_admin', value: 'true' },
    { key: 'layout_grid_cols', value: '6' },
    { key: 'layout_card_animation', value: 'flipIn' },
  ]);

  assert.equal(settings.layout_hide_desc, true);
  assert.equal(settings.layout_hide_links, false);
  assert.equal(settings.home_hide_admin, true);
  assert.equal(settings.layout_grid_cols, '6');
  assert.equal(settings.layout_card_animation, 'flipIn');
});

test('parseSettings maps legacy category layout settings to category position', () => {
  const verticalSettings = parseSettings([
    { key: 'layout_menu_layout', value: 'vertical' },
  ]);
  const topSettings = parseSettings([
    { key: 'home_category_position', value: 'above_description' },
  ]);

  assert.equal(verticalSettings.home_category_position, 'left');
  assert.equal(verticalSettings.layout_menu_layout, 'vertical');
  assert.equal(topSettings.home_category_position, 'top');
  assert.equal(topSettings.layout_menu_layout, 'horizontal');
});

test('getSettingsKeys matches parseable setting fields', () => {
  const keys = getSettingsKeys();

  assert.ok(keys.includes('layout_custom_wallpaper'));
  assert.ok(keys.includes('home_default_category'));
  assert.ok(keys.includes('home_footer_text'));
  assert.ok(keys.includes('layout_card_animation'));
  assert.ok(keys.includes('card_desc_color'));
  assert.equal(new Set(keys).size, keys.length);
});

test('normalizeSettingValueForStorage validates style and enum settings', () => {
  assert.deepEqual(normalizeSettingValueForStorage('home_title_size', '36'), { ok: true, value: '36' });
  assert.deepEqual(normalizeSettingValueForStorage('home_title_color', '#ffffff'), { ok: true, value: '#ffffff' });
  assert.deepEqual(normalizeSettingValueForStorage('card_desc_color', 'undefined'), { ok: true, value: '' });
  assert.deepEqual(normalizeSettingValueForStorage('card_desc_color', 'null'), { ok: true, value: '' });
  assert.equal(normalizeSettingValueForStorage('home_title_color', '#fff;position:fixed').ok, false);
  assert.equal(normalizeSettingValueForStorage('layout_grid_cols', '9').ok, false);
  assert.deepEqual(normalizeSettingValueForStorage('layout_card_animation', 'radial'), { ok: true, value: 'radial' });
  assert.deepEqual(normalizeSettingValueForStorage('layout_card_animation', 'random'), { ok: true, value: 'random' });
  assert.equal(normalizeSettingValueForStorage('layout_card_animation', 'bounceIn').ok, false);
  assert.deepEqual(normalizeSettingValueForStorage('home_category_position', 'above_description'), { ok: true, value: 'top' });
  assert.deepEqual(normalizeSettingValueForStorage('home_category_position', 'above_search'), { ok: true, value: 'above_search' });
  assert.deepEqual(normalizeSettingValueForStorage('home_category_position', 'left'), { ok: true, value: 'left' });
  assert.deepEqual(normalizeSettingValueForStorage('home_category_position', 'top'), { ok: true, value: 'top' });
  assert.equal(normalizeSettingValueForStorage('home_category_position', 'right').ok, false);
  assert.deepEqual(normalizeSettingValueForStorage('home_category_flow', 'multi_line'), { ok: true, value: 'multi_line' });
  assert.deepEqual(normalizeSettingValueForStorage('home_footer_text', '自定义页脚'), { ok: true, value: '自定义页脚' });
  assert.equal(normalizeSettingValueForStorage('home_category_flow', 'wrap').ok, false);
  assert.equal(normalizeSettingValueForStorage('layout_custom_wallpaper', 'javascript:alert(1)').ok, false);
});
