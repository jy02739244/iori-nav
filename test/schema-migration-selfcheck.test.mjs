import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureSchemaReady, CATEGORY_CYCLE_GUARD_TRIGGER_NAMES } from '../functions/lib/schema-migration.js';
import { SCHEMA_VERSION } from '../functions/constants.js';

// 独立文件：ensureSchemaReady 在模块级缓存 schemaReady，必须在干净进程里验证。
// （node --test 每个测试文件一个进程，所以这里拿到的是未执行过迁移的状态。）

const GOOD_SQL = `CREATE TRIGGER trg_category_no_cycle_update ... RAISE(ABORT, 'category_cycle_guard') ...`;

function createEnv({ guardRows }) {
  const kvPuts = [];

  const statement = (sql) => ({
    bind: () => statement(sql),
    async run() {
      return { success: true };
    },
    async all() {
      if (sql.includes('sqlite_master')) return { results: guardRows };
      return { results: [] };
    },
    async first() {
      return null;
    },
  });

  return {
    kvPuts,
    env: {
      NAV_DB: {
        prepare: sql => statement(sql),
        async batch(statements) {
          for (const item of statements) await item.run();
          return [];
        },
      },
      NAV_AUTH: {
        async get() {
          return null; // 没有迁移标记，逐步走完整个迁移
        },
        async put(key, value) {
          kvPuts.push({ key, value });
        },
        async delete() {},
      },
    },
  };
}

async function runMigration(env) {
  const originalError = console.error;
  console.error = () => {}; // 迁移失败会打日志，这里不污染测试输出
  try {
    await ensureSchemaReady(env);
  } finally {
    console.error = originalError;
  }
}

function wroteMarker(kvPuts) {
  return kvPuts.some(({ key }) => key === `schema_migrated_${SCHEMA_VERSION}`);
}

test('触发器不存在时不得写入迁移标记（fail-closed）', async () => {
  const { env, kvPuts } = createEnv({ guardRows: [] });
  await runMigration(env);

  assert.equal(wroteMarker(kvPuts), false, '触发器缺失时不能把迁移标记为已完成');
});

test('库里有同名触发器但定义不对时同样不写标记', async () => {
  // 这是 IF NOT EXISTS 的经典陷阱：名字对、逻辑是别人的，只查名字会误判为已生效
  const stale = CATEGORY_CYCLE_GUARD_TRIGGER_NAMES.map(name => ({
    name,
    sql: `CREATE TRIGGER ${name} BEFORE UPDATE ON category BEGIN SELECT 1; END`,
  }));
  const { env, kvPuts } = createEnv({ guardRows: stale });
  await runMigration(env);

  assert.equal(wroteMarker(kvPuts), false, '定义与预期不符时不能把迁移标记为已完成');
});

test('两条触发器都在且定义正确时才写入迁移标记', async () => {
  const good = [
    { name: 'trg_category_no_cycle_update', sql: GOOD_SQL },
    { name: 'trg_category_no_cycle_insert', sql: GOOD_SQL },
  ];
  const { env, kvPuts } = createEnv({ guardRows: good });
  await runMigration(env);

  assert.deepEqual(kvPuts.map(({ key }) => key), [`schema_migrated_${SCHEMA_VERSION}`]);
});