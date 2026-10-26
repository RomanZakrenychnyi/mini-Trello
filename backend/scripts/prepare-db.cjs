const { closeSync, openSync } = require('node:fs');
const { join } = require('node:path');

// Prisma 6 on Windows needs an existing SQLite file for migrate deploy.
// Append mode creates the file without truncating an existing database.
closeSync(openSync(join(__dirname, '../prisma/dev.db'), 'a'));
