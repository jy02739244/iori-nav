import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/[[path]].js';

test('API catch-all answers HEAD with 405 instead of falling back to HTML', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/settings', { method: 'HEAD' }),
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, POST, PUT, PATCH, DELETE');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.body, null);
});

test('API catch-all answers unknown API paths with JSON 404', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/unknown'),
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { code: 404, message: 'Not Found' });
});
