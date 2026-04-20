import { DB_SCHEMA, SCHEMA_VERSION, PREVIOUS_SCHEMA_VERSION } from '../constants';

let schemaReady = false;
let schemaReadyPromise = null;

async function runBaseSchema(db) {
  const statements = DB_SCHEMA.split(';')
    .map(stmt => stmt.trim())
    .filter(Boolean)
    .map(stmt => db.prepare(stmt));

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

async function runIncrementalMigrations(env) {
  await env.NAV_DB.batch([
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_private_sort ON sites(is_private, sort_order)'),
    env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_catelog_name ON sites(catelog_name)')
  ]);

  const [sitesColumns, categoryColumns, pendingColumns] = await Promise.all([
    env.NAV_DB.prepare('PRAGMA table_info(sites)').all(),
    env.NAV_DB.prepare('PRAGMA table_info(category)').all(),
    env.NAV_DB.prepare('PRAGMA table_info(pending_sites)').all(),
  ]);
  const sitesCols = new Set((sitesColumns.results || []).map(column => column.name));
  const categoryCols = new Set((categoryColumns.results || []).map(column => column.name));
  const pendingCols = new Set((pendingColumns.results || []).map(column => column.name));

  const alterStatements = [];
  const sitesMissingCatalogName = !sitesCols.has('catelog_name');
  const pendingMissingCatalogName = !pendingCols.has('catelog_name');

  if (!sitesCols.has('is_private')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0'));
  }
  if (sitesMissingCatalogName) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE sites ADD COLUMN catelog_name TEXT'));
  }
  if (pendingMissingCatalogName) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE pending_sites ADD COLUMN catelog_name TEXT'));
  }
  if (!categoryCols.has('is_private')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE category ADD COLUMN is_private INTEGER DEFAULT 0'));
  }
  if (!categoryCols.has('parent_id')) {
    alterStatements.push(env.NAV_DB.prepare('ALTER TABLE category ADD COLUMN parent_id INTEGER DEFAULT 0'));
  }

  for (const statement of alterStatements) {
    try {
      await statement.run();
    } catch (error) {
      console.warn('Schema alter skipped:', error.message);
    }
  }

  if (sitesMissingCatalogName) {
    await env.NAV_DB.prepare(`
      UPDATE sites
      SET catelog_name = (
        SELECT catelog FROM category WHERE category.id = sites.catelog_id
      )
      WHERE catelog_name IS NULL
    `).run();
  }

  if (pendingMissingCatalogName) {
    await env.NAV_DB.prepare(`
      UPDATE pending_sites
      SET catelog_name = (
        SELECT catelog FROM category WHERE category.id = pending_sites.catelog_id
      )
      WHERE catelog_name IS NULL
    `).run();
  }
}

export async function ensureSchemaReady(env) {
  if (!env || !env.NAV_DB) return;
  if (schemaReady) return;
  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    const kv = env.NAV_AUTH;

    if (kv) {
      try {
        const migrated = await kv.get(`schema_migrated_${SCHEMA_VERSION}`);
        if (migrated) {
          schemaReady = true;
          return;
        }
      } catch (error) {
        console.warn('Schema version check failed:', error);
      }
    }

    try {
      await runBaseSchema(env.NAV_DB);
      await runIncrementalMigrations(env);

      if (kv) {
        await kv.put(`schema_migrated_${SCHEMA_VERSION}`, 'true');

        if (PREVIOUS_SCHEMA_VERSION && PREVIOUS_SCHEMA_VERSION !== SCHEMA_VERSION) {
          try {
            await kv.delete(`schema_migrated_${PREVIOUS_SCHEMA_VERSION}`);
          } catch (cleanupError) {
            console.warn('Previous schema marker cleanup failed:', cleanupError);
          }
        }
      }

      schemaReady = true;
    } catch (error) {
      console.error('Schema migration failed:', error);
    }
  })().finally(() => {
    schemaReadyPromise = null;
  });

  await schemaReadyPromise;
}
