
// 数据库 Schema 版本 - 修改此值会触发迁移
export const SCHEMA_VERSION = 'v4';

// 数据库表结构定义
export const DB_SCHEMA = `
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

CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id);
CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order);
`;

// 字体映射表
export const FONT_MAP = {
  // System Fonts (无需引入)
  'sans-serif': null,
  'serif': null,
  'monospace': null,
  "'Microsoft YaHei', sans-serif": null,
  "'SimSun', serif": null,
  "'PingFang SC', sans-serif": null,
  "'Segoe UI', sans-serif": null,
  
  // Web Fonts (fonts.loli.net)
  "'Noto Sans SC', sans-serif": "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
  "'Noto Serif SC', serif": "https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
  "'Ma Shan Zheng', cursive": "https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap", // 书法
  "'ZCOOL KuaiLe', cursive": "https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap", // 快乐体
  "'Long Cang', cursive": "https://fonts.loli.net/css2?family=Long+Cang&display=swap", // 草书
  "'Roboto', sans-serif": "https://fonts.loli.net/css2?family=Roboto:wght@300;400;500;700&display=swap",
  "'Open Sans', sans-serif": "https://fonts.loli.net/css2?family=Open+Sans:wght@400;600;700&display=swap",
  "'Lato', sans-serif": "https://fonts.loli.net/css2?family=Lato:wght@400;700&display=swap",
  "'Montserrat', sans-serif": "https://fonts.loli.net/css2?family=Montserrat:wght@400;700&display=swap"
};
