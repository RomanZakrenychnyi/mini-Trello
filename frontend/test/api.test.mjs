import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { request, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('API client handles cold starts, failed writes and invalid responses without retrying', async t => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return new AbortController().signal; });
  let calls = 0;
  let nextResponse;
  let networkError = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, '/api/boards');
    assert.ok(options.signal instanceof AbortSignal);
    if (networkError) throw new TypeError('fetch failed');
    return nextResponse;
  });

  nextResponse = new Response(JSON.stringify([{ id: 'board' }]));
  assert.deepEqual(await request('/boards'), [{ id: 'board' }]);
  assert.equal(timeouts.at(-1), 90000);
  nextResponse = new Response(JSON.stringify({ id: 'created' }));
  assert.deepEqual(await request('/boards', { method: 'POST', body: '{}' }), { id: 'created' });
  assert.equal(timeouts.at(-1), 30000);
  nextResponse = new Response(JSON.stringify({ message: 'Доска не найдена' }), { status: 404 });
  await assert.rejects(request('/boards'), error => error instanceof ApiError && error.status === 404 && error.message === 'Доска не найдена');
  nextResponse = new Response('<html>Bad gateway</html>', { status: 502 });
  await assert.rejects(request('/boards'), error => error instanceof ApiError && error.status === 502);
  nextResponse = new Response('<html>Unexpected proxy page</html>');
  await assert.rejects(request('/boards'), /некорректный ответ/);
  networkError = true;
  await assert.rejects(request('/boards'), /повторите загрузку/);
  const beforeWrite = calls;
  await assert.rejects(request('/boards', { method: 'POST', body: '{}' }), /могло сохраниться/);
  assert.equal(calls, beforeWrite + 1, 'failed writes must not be retried automatically');
});
