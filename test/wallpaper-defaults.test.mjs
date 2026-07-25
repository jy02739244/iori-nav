import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import {
  STYLE_DEFAULT_WALLPAPERS,
  getStyleDefaultWallpaper,
  resolveWallpaperUrl,
} from '../functions/lib/wallpaper-defaults.js';

test('style default wallpapers are distinct per card style', () => {
  assert.equal(typeof STYLE_DEFAULT_WALLPAPERS.style1, 'string');
  assert.equal(typeof STYLE_DEFAULT_WALLPAPERS.style2, 'string');
  assert.equal(typeof STYLE_DEFAULT_WALLPAPERS.style3, 'string');
  assert.notEqual(STYLE_DEFAULT_WALLPAPERS.style1, STYLE_DEFAULT_WALLPAPERS.style2);
  assert.notEqual(STYLE_DEFAULT_WALLPAPERS.style2, STYLE_DEFAULT_WALLPAPERS.style3);
  assert.notEqual(STYLE_DEFAULT_WALLPAPERS.style1, STYLE_DEFAULT_WALLPAPERS.style3);
});

test('resolveWallpaperUrl prefers custom wallpaper over style default', () => {
  assert.equal(resolveWallpaperUrl('https://example.com/a.jpg', 'style3'), 'https://example.com/a.jpg');
  assert.equal(resolveWallpaperUrl('', 'style2'), STYLE_DEFAULT_WALLPAPERS.style2);
  assert.equal(getStyleDefaultWallpaper('style3'), STYLE_DEFAULT_WALLPAPERS.style3);
});

test('frontend wallpaper-defaults.js stays in sync with server source', () => {
  const frontendSource = readFileSync('public/js/wallpaper-defaults.js', 'utf8');
  assert.match(frontendSource, /自动生成，请勿手改/);

  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(frontendSource, sandbox);

  const frontend = sandbox.window.IoriWallpaperDefaults || sandbox.IoriWallpaperDefaults;
  assert.ok(frontend);
  assert.equal(frontend.STYLE_DEFAULT_WALLPAPERS.style1, STYLE_DEFAULT_WALLPAPERS.style1);
  assert.equal(frontend.STYLE_DEFAULT_WALLPAPERS.style2, STYLE_DEFAULT_WALLPAPERS.style2);
  assert.equal(frontend.STYLE_DEFAULT_WALLPAPERS.style3, STYLE_DEFAULT_WALLPAPERS.style3);
  assert.equal(frontend.resolveWallpaperUrl('', 'style1'), STYLE_DEFAULT_WALLPAPERS.style1);
  assert.equal(frontend.resolveWallpaperUrl('https://example.com/x.jpg', 'style3'), 'https://example.com/x.jpg');
});
