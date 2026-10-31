import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIVACY_GUARD_REPAIR_STATEMENTS,
  PRIVACY_GUARD_TRIGGER_STATEMENTS,
} from '../functions/lib/schema-migration.js';

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // Older Node.js versions do not expose node:sqlite.
}

function createSchema() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE category (
      id INTEGER PRIMARY KEY,
      catelog TEXT NOT NULL,
      parent_id INTEGER DEFAULT 0,
      is_private INTEGER DEFAULT 0
    );
    CREATE TABLE sites (
      id INTEGER PRIMARY KEY,
      catelog_id INTEGER NOT NULL,
      is_private INTEGER DEFAULT 0
    );
  `);
  return db;
}

function createDatabase() {
  const db = createSchema();
  db.exec(`
    INSERT INTO category (id, catelog, parent_id, is_private) VALUES
      (1, 'public-root', 0, 0),
      (2, 'private-root', 0, 1),
      (3, 'private-child', 2, 1);
  `);
  PRIVACY_GUARD_TRIGGER_STATEMENTS.forEach(sql => db.exec(sql));
  return db;
}

test('privacy migration repairs existing violations before enabling triggers', { skip: !DatabaseSync }, () => {
  const db = createSchema();
  try {
    db.exec(`
      INSERT INTO category (id, catelog, parent_id, is_private) VALUES
        (1, 'public-root', 0, 0),
        (2, 'private-root', 0, 1),
        (3, 'public-child-of-private', 2, 0),
        (4, 'public-grandchild', 3, 0);
      INSERT INTO sites (id, catelog_id, is_private) VALUES
        (1, 2, 0),
        (2, 3, 0),
        (3, 1, 0);
    `);

    PRIVACY_GUARD_REPAIR_STATEMENTS.forEach(sql => db.exec(sql));
    PRIVACY_GUARD_TRIGGER_STATEMENTS.forEach(sql => db.exec(sql));

    const categories = db.prepare('SELECT id, is_private FROM category ORDER BY id').all();
    const sites = db.prepare('SELECT id, is_private FROM sites ORDER BY id').all();
    assert.deepEqual(categories.map(row => row.is_private), [0, 1, 1, 1]);
    assert.deepEqual(sites.map(row => row.is_private), [1, 1, 0]);
    assert.throws(
      () => db.exec('UPDATE sites SET is_private = 0 WHERE id = 1'),
      /privacy_guard_private_category/
    );
  } finally {
    db.close();
  }
});

test('privacy triggers reject public categories under private parents', { skip: !DatabaseSync }, () => {
  const db = createDatabase();
  try {
    assert.throws(
      () => db.exec("UPDATE category SET is_private = 0 WHERE id = 3"),
      /privacy_guard_private_parent/
    );
    assert.throws(
      () => db.exec("INSERT INTO category (catelog, parent_id, is_private) VALUES ('invalid', 2, 0)"),
      /privacy_guard_private_parent/
    );

    db.exec("UPDATE category SET is_private = 0 WHERE id = 2");
    db.exec("UPDATE category SET is_private = 0 WHERE id = 3");
    assert.equal(db.prepare('SELECT is_private FROM category WHERE id = 3').get().is_private, 0);
  } finally {
    db.close();
  }
});

test('privacy triggers reject public sites in private categories', { skip: !DatabaseSync }, () => {
  const db = createDatabase();
  try {
    assert.throws(
      () => db.exec("INSERT INTO sites (catelog_id, is_private) VALUES (2, 0)"),
      /privacy_guard_private_category/
    );

    db.exec("INSERT INTO sites (id, catelog_id, is_private) VALUES (1, 1, 0)");
    assert.throws(
      () => db.exec("UPDATE sites SET catelog_id = 2 WHERE id = 1"),
      /privacy_guard_private_category/
    );

    db.exec("UPDATE category SET is_private = 0 WHERE id = 2");
    db.exec("UPDATE sites SET catelog_id = 2 WHERE id = 1");
    assert.equal(db.prepare('SELECT catelog_id FROM sites WHERE id = 1').get().catelog_id, 2);
  } finally {
    db.close();
  }
});
