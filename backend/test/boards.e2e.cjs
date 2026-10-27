const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');
const { AppModule } = require('../dist/app.module');
const { createApplication } = require('../dist/main');

test('boards API validates input and persists boards across application restarts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mini-trello-test-'));
  const previousUrl = process.env.DATABASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.DATABASE_URL = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  let app;
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const migrations = join(__dirname, '../prisma/migrations');
    for (const entry of (await readdir(migrations, { withFileTypes: true })).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const sql = await readFile(join(migrations, entry.name, 'migration.sql'), 'utf8');
      for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
    await prisma.$disconnect();
    async function start() {
      app = await NestFactory.create(AppModule, { logger: false });
      await app.listen(0, '127.0.0.1');
      return app.getUrl();
    }
    let base = await start();
    const send = (path, body) => fetch(`${base}${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.deepEqual(await (await send('/boards')).json(), []);
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 12 }, { name: 'a'.repeat(101) }, { name: null }]) {
      assert.equal((await send('/boards', body)).status, 400);
    }
    const response = await send('/boards', { name: '  Моя доска 🚀  ' });
    assert.equal(response.status, 201);
    const board = await response.json();
    assert.equal(board.name, 'Моя доска 🚀');
    assert.ok(board.id);
    assert.ok(Number.isFinite(Date.parse(board.createdAt)));
    assert.ok(Number.isFinite(Date.parse(board.updatedAt)));
    assert.deepEqual(await (await send(`/boards/${board.id}`)).json(), board);
    assert.equal((await send('/boards/missing')).status, 404);
    const maxName = await send('/boards', { name: 'a'.repeat(100) });
    assert.equal(maxName.status, 201);
    const otherBoard = await maxName.json();
    const listPath = `/boards/${board.id}/lists`;
    const otherPath = `/boards/${otherBoard.id}/lists`;
    const mutate = (path, method, body) => fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.deepEqual(await (await send(listPath)).json(), []);
    assert.equal((await send('/boards/missing/lists')).status, 404);
    assert.equal((await send('/boards/missing/lists', { name: 'Test' })).status, 404);
    for (const invalid of [{}, { name: ' ' }, { name: 10 }, { name: null }, { name: 'a'.repeat(101) }]) {
      assert.equal((await send(listPath, invalid)).status, 400);
    }
    const listResponse = await send(listPath, { name: '  Нужно сделать  ' });
    assert.equal(listResponse.status, 201);
    const firstList = await listResponse.json();
    assert.equal(firstList.name, 'Нужно сделать');
    assert.equal(firstList.position, 0);
    assert.equal(firstList.boardId, board.id);
    const secondList = await (await send(listPath, { name: 'В работе' })).json();
    assert.equal(secondList.position, 1);
    assert.deepEqual(await (await send(otherPath)).json(), []);
    assert.equal((await mutate(`${otherPath}/${firstList.id}`, 'PATCH', { name: 'Чужой список' })).status, 404);
    assert.equal((await mutate(`${otherPath}/${firstList.id}`, 'DELETE')).status, 404);
    assert.equal((await mutate(`${listPath}/missing`, 'PATCH', { name: 'Test' })).status, 404);
    assert.equal((await mutate(`${listPath}/missing`, 'DELETE')).status, 404);
    assert.equal((await mutate(`${listPath}/${firstList.id}`, 'PATCH', { name: ' ' })).status, 400);
    assert.equal((await mutate(`${listPath}/${firstList.id}`, 'PATCH', { name: 'a'.repeat(101) })).status, 400);
    const renamedResponse = await mutate(`${listPath}/${firstList.id}`, 'PATCH', { name: '  План  ' });
    assert.equal(renamedResponse.status, 200);
    const renamed = await renamedResponse.json();
    assert.equal(renamed.name, 'План');
    assert.equal(renamed.position, firstList.position);
    assert.equal((await mutate(`${listPath}/${secondList.id}`, 'DELETE')).status, 200);
    assert.equal((await mutate(`${listPath}/${secondList.id}`, 'DELETE')).status, 404);
    const remaining = await (await send(listPath)).json();
    assert.deepEqual(remaining, [renamed]);
    const thirdList = await (await send(listPath, { name: 'Готово' })).json();
    assert.ok(thirdList.position > renamed.position);
    await app.close();
    app = undefined;
    base = await start();
    assert.deepEqual(await (await send(`/boards/${board.id}`)).json(), board);
    const boards = await (await send('/boards')).json();
    assert.equal(boards.length, 2);
    assert.ok(boards.some((item) => item.id === board.id));
    assert.deepEqual(await (await send(listPath)).json(), [renamed, thirdList]);
    assert.deepEqual(await (await send(otherPath)).json(), []);
    assert.deepEqual(await (await send('/health')).json(), { status: 'ok' });
    await app.close();
    app = undefined;
    process.env.NODE_ENV = 'production';
    app = await createApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    assert.deepEqual(await (await send('/api/health')).json(), { status: 'ok' });
    assert.deepEqual(await (await send(`/api/boards/${board.id}`)).json(), board);
    assert.deepEqual(await (await send(`/api${listPath}`)).json(), [renamed, thirdList]);
    assert.equal((await send('/api/missing')).status, 404);
    for (const path of ['/', `/boards/${board.id}`]) {
      const html = await send(path);
      assert.equal(html.status, 200);
      assert.match(html.headers.get('content-type'), /text\/html/);
      assert.match(await html.text(), /<div id="app"><\/div>/);
    }
  } finally {
    if (app) await app.close();
    await prisma.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    await rm(directory, { recursive: true, force: true });
  }
});
