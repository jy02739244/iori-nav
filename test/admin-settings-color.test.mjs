import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const defaultsSource = readFileSync(resolve('public/js/admin-settings-defaults.js'), 'utf8');
const formSource = readFileSync(resolve('public/js/admin-settings-form.js'), 'utf8');
const previewControlsSource = readFileSync(resolve('public/js/admin-settings-preview-controls.js'), 'utf8');

function createElement() {
  const classes = new Set();
  const listeners = new Map();

  return {
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    innerText: '',
    placeholder: '',
    title: '',
    dataset: {},
    children: [],
    style: {
      display: '',
      setProperty() {},
      removeProperty() {},
    },
    parentElement: { style: { display: '' } },
    classList: {
      add(...names) {
        names.forEach(name => classes.add(name));
      },
      remove(...names) {
        names.forEach(name => classes.delete(name));
      },
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : !!force;
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
    },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    removeEventListener() {},
    fire(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach(handler => handler({
        target: this,
        preventDefault() {},
        stopPropagation() {},
        ...event,
      }));
    },
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild() {},
  };
}

function createAdminSandbox() {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, createElement());
      return nodes.get(id);
    },
    getElementsByName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement,
    addEventListener() {},
    body: { classList: createElement().classList },
  };
  const sandbox = {
    window: {},
    document,
    console,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(defaultsSource, sandbox, { filename: 'public/js/admin-settings-defaults.js' });
  vm.runInNewContext(formSource, sandbox, { filename: 'public/js/admin-settings-form.js' });

  return {
    sandbox,
    admin: sandbox.window.AdminSettings,
  };
}

function setCardColorPlaceholders(refs) {
  refs.cardTitleColorInput.placeholder = '#111827';
  refs.mobileCardTitleColorInput.placeholder = '#111827';
  refs.cardDescColorInput.placeholder = '#4b5563';
  refs.mobileCardDescColorInput.placeholder = '#4b5563';
}

test('empty card colors stay empty and show the picker follow-default state', () => {
  const { admin } = createAdminSandbox();
  const refs = admin.form.getRefs();
  setCardColorPlaceholders(refs);

  admin.form.updateUIFromSettings();

  assert.equal(refs.cardTitleColorInput.value, '');
  assert.equal(refs.mobileCardTitleColorInput.value, '');
  assert.equal(refs.cardTitleColorPicker.value, '#111827');
  assert.equal(refs.mobileCardTitleColorPicker.value, '#111827');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), true);
  assert.equal(refs.mobileCardTitleColorPicker.classList.contains('color-picker-follow-default'), true);
  assert.equal(refs.cardTitleColorPicker.title, '留空时跟随默认颜色');
  assert.equal(refs.mobileCardTitleColorPicker.title, '留空时跟随默认颜色');

  const saved = admin.form.collectSettingsFromInputs();
  assert.equal(saved.card_title_color, '');
  assert.equal(saved.mobile_card_title_color, '');
});

test('explicit card colors are not treated as following the default', () => {
  const { admin } = createAdminSandbox();
  const refs = admin.form.getRefs();
  setCardColorPlaceholders(refs);

  admin.currentSettings.card_title_color = '#2563eb';
  admin.form.updateUIFromSettings();
  assert.equal(refs.cardTitleColorInput.value, '#2563eb');
  assert.equal(refs.cardTitleColorPicker.value, '#2563eb');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), false);
  assert.equal(refs.cardTitleColorPicker.title, '');

  admin.currentSettings.card_title_color = 'rgb(17, 24, 39)';
  admin.form.updateUIFromSettings();
  assert.equal(refs.cardTitleColorInput.value, 'rgb(17, 24, 39)');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), false);
  assert.equal(refs.cardTitleColorPicker.title, '');
});

test('clearing the card title color restores the follow-default picker state', () => {
  const { sandbox, admin } = createAdminSandbox();
  const refs = admin.form.getRefs();
  setCardColorPlaceholders(refs);

  admin.currentSettings.card_title_color = '#2563eb';
  admin.form.updateUIFromSettings();

  admin.previewShared = {
    getRefs: () => refs,
    getCurrentSettings: () => admin.currentSettings,
    loadFont() {},
  };
  admin.previewRender = {
    scheduleFullPreviewRender() {},
    schedulePreviewRenderForDevice() {},
    resetLivePreviewCategory() {},
  };
  admin.previewNav = {
    closePreviewCategoryMoreMenus() {},
  };
  admin.previewAnimation = {
    syncAnimationOptions() {},
    triggerPreviewAnimationForDevice() {},
  };

  vm.runInNewContext(previewControlsSource, sandbox, {
    filename: 'public/js/admin-settings-preview-controls.js',
  });
  admin.previewControls.bindPreviewEvents();

  assert.equal(refs.cardTitleColorPicker.value, '#2563eb');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), false);

  refs.cardTitleColorInput.value = '';
  refs.cardTitleColorInput.fire('input');
  assert.equal(refs.cardTitleColorPicker.value, '#111827');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), true);
  assert.equal(refs.cardTitleColorPicker.title, '留空时跟随默认颜色');

  refs.cardTitleColorInput.value = '#2563eb';
  refs.cardTitleColorInput.fire('input');
  assert.equal(refs.cardTitleColorPicker.value, '#2563eb');
  assert.equal(refs.cardTitleColorPicker.classList.contains('color-picker-follow-default'), false);
  assert.equal(refs.cardTitleColorPicker.title, '');
});
