#!/usr/bin/env node

/**
 * Reset the pre-launch database
 *
 * Usage:
 *   node reset-db.js           # delete DB file (fresh start)
 *   node reset-db.js --truncate # keep DB file, clear tables
 */

const fs = require('fs');
const path = require('path');
const sql = require('sql.js');

const dbPath = path.join(__dirname, 'prelaunch.db');

async function truncateTables() {
  try {
    if (!fs.existsSync(dbPath)) {
      console.log('No database file found. Nothing to truncate.');
      return;
    }
    const filebuffer = fs.readFileSync(dbPath);
    const SQL = await sql.default();
    const db = new SQL.Database(filebuffer);

    db.run('DELETE FROM emails;');
    db.run('DELETE FROM generations;');

    // Vacuum to reclaim space
    db.run('VACUUM;');

    // Save
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    console.log('✅ Tables truncated: emails, generations');
  } catch (err) {
    console.error('❌ Failed to truncate tables:', err.message);
    process.exit(1);
  }
}

async function deleteDbFile() {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Database file deleted. It will be recreated on server start.');
    } else {
      console.log('ℹ️ No database file found. Nothing to delete.');
    }
  } catch (err) {
    console.error('❌ Failed to delete database file:', err.message);
    process.exit(1);
  }
}

(async function main() {
  const truncate = process.argv.includes('--truncate');
  if (truncate) {
    await truncateTables();
  } else {
    await deleteDbFile();
  }
})();
