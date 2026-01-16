// functions/_middleware.js

// 辅助函数
export function normalizeSortOrder(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 9999;
}

export function isSubmissionEnabled(env) {
  // Convert to string to handle both boolean `true` from toml and string 'true' from secrets
  return String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
}

export async function isAdminAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;
  
  const match = cookie.match(/admin_session=([^;]+)/);
  if (!match) return false;
  
  const token = match[1];
  const session = await env.NAV_AUTH.get(`session_${token}`);
  
  return Boolean(session);
}

export function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DB_SCHEMA = `

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo TEXT,
  desc TEXT,
  catelog_id INTEGER NOT NULL,
  catelog_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  is_private INTEGER DEFAULT 0,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS pending_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo TEXT,
  desc TEXT,
  catelog_id INTEGER NOT NULL,
  catelog_name TEXT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catelog TEXT  NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  parent_id INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

let dbInitialized = false;

async function initializeDb(db) {
  if (dbInitialized) return;
  try {
    console.log("Initializing database...");
    const statements = DB_SCHEMA.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    const preparedStatements = statements.map(stmt => db.prepare(stmt));
    
    await db.batch(preparedStatements);
    
    dbInitialized = true;
    console.log("Database initialized successfully.");
  } catch (e) {
    console.error("Database initialization failed:", e);
    // 初始化失败时,我们只记录错误并继续,以防影响正常请求
  }
}

// 导出中间件(可选,用于添加全局逻辑)
export async function onRequest(context) {
  // 在每个请求开始时检查并初始化数据库
  if (context.env.NAV_DB) {
    await initializeDb(context.env.NAV_DB);
  }
  
  // 在这里可以添加全局中间件逻辑
  // 例如: 日志记录、CORS 头等
  return context.next();
}
