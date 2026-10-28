const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');
const { AppModule } = require('../dist/app.module');
const { createApplication } = require('../dist/main');

test('boards, lists and cards validate input, isolate data and persist across restarts', async () => {
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
    const cardsPath = `${listPath}/${firstList.id}/cards`;
    const wrongListPath = `${listPath}/${thirdList.id}/cards`;
    const wrongBoardPath = `${otherPath}/${firstList.id}/cards`;
    assert.deepEqual(await (await send(cardsPath)).json(), []);
    assert.equal((await send(`${listPath}/missing/cards`)).status, 404);
    assert.equal((await send(wrongBoardPath)).status, 404);
    assert.equal((await send(wrongBoardPath, { title: 'Чужая карточка' })).status, 404);
    for (const invalid of [{}, { title: '' }, { title: ' ' }, { title: null }, { title: 7 }, { title: 'a'.repeat(201) }, { title: 'Test', description: null }, { title: 'Test', description: 'a'.repeat(5001) }]) {
      assert.equal((await send(cardsPath, invalid)).status, 400);
    }
    const cardResponse = await send(cardsPath, { title: '  Первая задача  ', description: 'Строка 1\nСтрока 2 <script>test</script>' });
    assert.equal(cardResponse.status, 201);
    const card = await cardResponse.json();
    assert.equal(card.title, 'Первая задача');
    assert.equal(card.description, 'Строка 1\nСтрока 2 <script>test</script>');
    assert.equal(card.position, 0);
    assert.equal(card.listId, firstList.id);
    const secondCardResponse = await send(cardsPath, { title: 'a'.repeat(200), description: 'a'.repeat(5000) });
    assert.equal(secondCardResponse.status, 201);
    const secondCard = await secondCardResponse.json();
    assert.equal(secondCard.position, 1);
    assert.equal((await mutate(`${listPath}/${firstList.id}`, 'DELETE')).status, 409);
    assert.deepEqual(await (await send(wrongListPath)).json(), []);
    for (const foreignPath of [wrongListPath, wrongBoardPath]) {
      assert.equal((await mutate(`${foreignPath}/${card.id}`, 'PATCH', { title: 'Изменить чужую' })).status, 404);
      assert.equal((await mutate(`${foreignPath}/${card.id}`, 'DELETE')).status, 404);
    }
    for (const invalid of [{}, { title: ' ' }, { title: 'a'.repeat(201) }, { description: null }, { description: 'a'.repeat(5001) }]) {
      assert.equal((await mutate(`${cardsPath}/${card.id}`, 'PATCH', invalid)).status, 400);
    }
    const cleared = await (await mutate(`${cardsPath}/${card.id}`, 'PATCH', { description: '' })).json();
    assert.equal(cleared.title, card.title);
    assert.equal(cleared.description, '');
    const updatedCardResponse = await mutate(`${cardsPath}/${card.id}`, 'PATCH', { title: '  Уточнённая задача  ', description: 'Готово к работе\nВторая строка' });
    assert.equal(updatedCardResponse.status, 200);
    const updatedCard = await updatedCardResponse.json();
    assert.equal(updatedCard.title, 'Уточнённая задача');
    assert.equal(updatedCard.position, card.position);
    assert.equal((await mutate(`${cardsPath}/${secondCard.id}`, 'DELETE')).status, 200);
    assert.equal((await mutate(`${cardsPath}/${secondCard.id}`, 'DELETE')).status, 404);
    const thirdCard = await (await send(cardsPath, { title: 'Следующая задача' })).json();
    assert.equal(thirdCard.description, '');
    assert.ok(thirdCard.position > updatedCard.position);
    const movePath = `${cardsPath}/${thirdCard.id}/move`;
    for (const invalid of [{}, { targetListId: firstList.id, position: -1 }, { targetListId: firstList.id, position: 0.5 }, { targetListId: firstList.id, position: '0' }, { targetListId: firstList.id, position: 99 }]) {
      assert.equal((await mutate(movePath, 'PATCH', invalid)).status, 400);
    }
    const foreignList = await (await send(otherPath, { name: 'Чужая' })).json();
    assert.equal((await mutate(movePath, 'PATCH', { targetListId: foreignList.id, position: 0 })).status, 404);
    assert.equal((await mutate(`${wrongBoardPath}/${thirdCard.id}/move`, 'PATCH', { targetListId: firstList.id, position: 0 })).status, 404);
    const movedUp = await mutate(movePath, 'PATCH', { targetListId: firstList.id, position: 0 });
    assert.equal(movedUp.status, 200);
    assert.deepEqual((await (await send(cardsPath)).json()).map(c => [c.id, c.position]), [[thirdCard.id, 0], [card.id, 1]]);
    assert.equal((await mutate(movePath, 'PATCH', { targetListId: thirdList.id, position: 0 })).status, 200);
    assert.deepEqual((await (await send(wrongListPath)).json()).map(c => [c.id, c.position]), [[thirdCard.id, 0]]);
    assert.equal((await mutate(movePath, 'PATCH', { targetListId: firstList.id, position: 0 })).status, 404);
    assert.equal((await mutate(`${wrongListPath}/${thirdCard.id}/move`, 'PATCH', { targetListId: firstList.id, position: 1 })).status, 200);
    assert.equal((await mutate(movePath, 'PATCH', { targetListId: firstList.id, position: 1 })).status, 200);
    const targetCard = await (await send(wrongListPath, { title: 'В целевом списке' })).json();
    assert.equal((await mutate(`${cardsPath}/${card.id}/move`, 'PATCH', { targetListId: thirdList.id, position: 1 })).status, 200);
    const targetCards = await (await send(wrongListPath)).json();
    assert.deepEqual(targetCards.map(c => [c.id, c.position]), [[targetCard.id, 0], [card.id, 1]]);
    assert.equal(targetCards[1].description, updatedCard.description);
    assert.equal((await mutate(`${wrongListPath}/${card.id}/move`, 'PATCH', { targetListId: firstList.id, position: 0 })).status, 200);
    assert.equal((await mutate(`${wrongListPath}/${targetCard.id}`, 'DELETE')).status, 200);
    // Keep the expected records current after ordering updates their timestamps.
    Object.assign(updatedCard, (await (await send(cardsPath)).json())[0]);
    Object.assign(thirdCard, (await (await send(cardsPath)).json())[1]);
    await mutate(`${otherPath}/${foreignList.id}`, 'DELETE');
    await app.close();
    app = undefined;
    base = await start();
    assert.deepEqual(await (await send(`/boards/${board.id}`)).json(), board);
    const boards = await (await send('/boards')).json();
    assert.equal(boards.length, 2);
    assert.ok(boards.some((item) => item.id === board.id));
    assert.deepEqual(await (await send(listPath)).json(), [renamed, thirdList]);
    assert.deepEqual(await (await send(otherPath)).json(), []);
    assert.deepEqual(await (await send(cardsPath)).json(), [updatedCard, thirdCard]);
    assert.equal((await mutate(`${listPath}/${firstList.id}`, 'DELETE')).status, 409);
    const disposableList = await (await send(listPath, { name: 'Проверка удаления после карточки' })).json();
    const disposablePath = `${listPath}/${disposableList.id}/cards`;
    const disposableCard = await (await send(disposablePath, { title: 'Временная' })).json();
    assert.equal((await mutate(`${listPath}/${disposableList.id}`, 'DELETE')).status, 409);
    assert.equal((await mutate(`${disposablePath}/${disposableCard.id}`, 'DELETE')).status, 200);
    assert.equal((await mutate(`${listPath}/${disposableList.id}`, 'DELETE')).status, 200);
    assert.deepEqual(await (await send('/health')).json(), { status: 'ok' });
    for (const invalid of [{}, { name: null }, { name: 7 }, { name: ' ' }, { name: 'a'.repeat(101) }]) {
      assert.equal((await mutate(`/boards/${board.id}`, 'PATCH', invalid)).status, 400);
    }
    assert.equal((await mutate('/boards/missing', 'PATCH', { name: 'Название' })).status, 404);
    assert.equal((await send('/boards/missing/deletion-preview')).status, 404);
    assert.equal((await mutate('/boards/missing', 'DELETE')).status, 404);
    const renameBoard = await mutate(`/boards/${board.id}`, 'PATCH', { name: '  Новый план  ' });
    assert.equal(renameBoard.status, 200);
    Object.assign(board, await renameBoard.json());
    assert.equal(board.name, 'Новый план');
    assert.equal((await (await send('/boards')).json()).find(item => item.id === board.id).name, 'Новый план');
    assert.deepEqual(await (await send(`/boards/${board.id}/deletion-preview`)).json(), { lists: 2, cards: 2 });
    const emptyBoard = await (await send('/boards', { name: 'Пустая для удаления' })).json();
    assert.deepEqual(await (await send(`/boards/${emptyBoard.id}/deletion-preview`)).json(), { lists: 0, cards: 0 });
    assert.equal((await mutate(`/boards/${emptyBoard.id}`, 'DELETE')).status, 200);
    const doomed = await (await send('/boards', { name: 'Удаляемая с содержимым' })).json();
    const doomedLists = [];
    for (const name of ['Первая', 'Вторая']) {
      const list = await (await send(`/boards/${doomed.id}/lists`, { name })).json();
      doomedLists.push(list.id);
      await send(`/boards/${doomed.id}/lists/${list.id}/cards`, { title: 'Вложенная карточка' });
    }
    assert.deepEqual(await (await send(`/boards/${doomed.id}/deletion-preview`)).json(), { lists: 2, cards: 2 });
    const deleteBoard = await mutate(`/boards/${doomed.id}`, 'DELETE');
    assert.equal(deleteBoard.status, 200);
    assert.deepEqual(await deleteBoard.json(), { id: doomed.id });
    assert.equal((await mutate(`/boards/${doomed.id}`, 'DELETE')).status, 404);
    assert.equal((await send(`/boards/${doomed.id}`)).status, 404);
    assert.equal(await prisma.boardList.count({ where: { boardId: doomed.id } }), 0);
    assert.equal(await prisma.card.count({ where: { listId: { in: doomedLists } } }), 0);
    assert.deepEqual(await (await send(cardsPath)).json(), [updatedCard, thirdCard]);
    assert.deepEqual(await (await send(`/boards/${otherBoard.id}`)).json(), otherBoard);
    await app.close();
    app = undefined;
    process.env.NODE_ENV = 'production';
    app = await createApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    assert.deepEqual(await (await send('/api/health')).json(), { status: 'ok' });
    assert.deepEqual(await (await send(`/api/boards/${board.id}`)).json(), board);
    assert.equal((await send(`/api/boards/${doomed.id}`)).status, 404);
    assert.deepEqual(await (await send(`/api${listPath}`)).json(), [renamed, thirdList]);
    assert.deepEqual(await (await send(`/api${cardsPath}`)).json(), [updatedCard, thirdCard]);
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
