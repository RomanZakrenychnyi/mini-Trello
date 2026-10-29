const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile, readdir, mkdtemp, writeFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

test('SQLite and PostgreSQL keep identical models and matching migration stages', async () => {
  const root = join(__dirname, '../prisma');
  const local = await readFile(join(root, 'schema.prisma'), 'utf8');
  const hosted = await readFile(join(root, 'postgres/schema.prisma'), 'utf8');
  const models = schema => schema.slice(schema.indexOf('model Board {')).replace(/\s+/g, ' ').trim();
  assert.equal(models(local), models(hosted));
  const migrationNames = async directory => (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const stages = await migrationNames(join(root, 'migrations'));
  assert.deepEqual(stages, await migrationNames(join(root, 'postgres/migrations')));
  for (const stage of stages) {
    for (const directory of ['migrations', 'postgres/migrations']) {
      assert.ok((await readFile(join(root, directory, stage, 'migration.sql'), 'utf8')).trim(), `${directory}/${stage} must contain SQL`);
    }
  }
});

test('Prisma loads project configuration with the patched merge dependency', async () => {
  const { loadConfigFromFile } = require('@prisma/config');
  const directory = await mkdtemp(join(tmpdir(), 'mini-trello-config-'));
  try {
    await writeFile(join(directory, 'prisma.config.cjs'), "module.exports = { schema: './schema.prisma', migrations: { path: './migrations' } };\n");
    const result = await loadConfigFromFile({ configRoot: directory });
    assert.equal(result.error, undefined, 'Prisma configuration should load without errors');
    assert.equal(result.config.schema, join(directory, 'schema.prisma'));
    assert.equal(result.config.migrations.path, join(directory, 'migrations'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
