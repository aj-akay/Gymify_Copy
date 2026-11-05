import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../src/database.js';

test('database migrations and seeded records persist across restarts without overwrites', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gymify-test-'));
  const path = join(directory, 'gymify.sqlite');

  try {
    const firstDatabase = openDatabase(path);
    firstDatabase.prepare('UPDATE gyms SET name = ? WHERE id = ?').run('Updated sample name', 'forge-fitness');
    firstDatabase.close();

    const reopenedDatabase = openDatabase(path);
    assert.equal(
      reopenedDatabase.prepare('SELECT name FROM gyms WHERE id = ?').get('forge-fitness').name,
      'Updated sample name',
    );
    assert.equal(reopenedDatabase.prepare('SELECT COUNT(*) AS count FROM gyms').get().count, 6);
    reopenedDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
