import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { buildCardHydrationState } from '../functions/lib/card-model.js';

const searchSource = readFileSync('public/js/home-search.js', 'utf8');

function createSearchHarness(sites) {
  const cards = sites.map(site => {
    const classes = new Set(['site-card']);
    return {
      attrs: { 'data-id': String(site.id) },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      getAttribute(name) { return this.attrs[name] ?? null; },
    };
  });

  const sitesGrid = {
    querySelectorAll(selector) {
      if (selector === '.site-card') return cards;
      if (selector === '.site-card:not(.hidden)') {
        return cards.filter(card => !card.classList.contains('hidden'));
      }
      return [];
    },
  };

  const listeners = new Map();
  const input = {
    value: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent() {},
    focus() {},
  };

  const document = {
    getElementById(id) { return id === 'sitesGrid' ? sitesGrid : null; },
    querySelectorAll(selector) {
      return selector === '.search-input-target' ? [input] : [];
    },
    querySelector() { return null; },
  };

  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };

  const sandbox = {
    window: { IoriHome: {}, IORI_SITES: sites, innerWidth: 1280 },
    document,
    localStorage,
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
  };

  vm.runInNewContext(searchSource, sandbox, { filename: 'public/js/home-search.js' });
  sandbox.window.IoriHome.initSearch();

  return {
    search(keyword) {
      input.value = keyword;
      listeners.get('input').call(input);
    },
    visibleIds() {
      return cards
        .filter(card => !card.classList.contains('hidden'))
        .map(card => Number(card.getAttribute('data-id')));
    },
  };
}

test('local search filters hydrated cards by name, URL, category and description', () => {
  const { cards } = buildCardHydrationState([
    {
      id: 1,
      name: 'Tom & Jerry',
      url: 'https://example.com/?a=1&b=2',
      desc: 'Cartoon <classic>',
      catelog_id: 1,
      catelog_name: '动画',
    },
    {
      id: 2,
      name: 'Cloudflare Docs',
      url: 'https://developers.cloudflare.com',
      catelog_id: 2,
      catelog_name: '开发',
    },
  ], {});

  const harness = createSearchHarness(cards);

  harness.search('tom & jerry');
  assert.deepEqual(harness.visibleIds(), [1]);

  harness.search('a=1&b=2');
  assert.deepEqual(harness.visibleIds(), [1]);

  harness.search('动画');
  assert.deepEqual(harness.visibleIds(), [1]);

  harness.search('暂无描述');
  assert.deepEqual(harness.visibleIds(), []);

  harness.search('');
  assert.deepEqual(harness.visibleIds(), [1, 2]);
});

test('local search still accepts the legacy precomputed searchText', () => {
  const { cards } = buildCardHydrationState([
    { id: 1, name: 'New card', url: 'https://example.com' },
    { id: 2, name: 'Another card', url: 'https://example.org' },
  ], {});
  cards[1].searchText = 'legacy-token';

  const harness = createSearchHarness(cards);

  harness.search('legacy-token');
  assert.deepEqual(harness.visibleIds(), [2]);
});
