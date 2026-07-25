/**
 * 备用随机 SVG 图标 - 优化设计
 */
export const fallbackSVGIcons = [
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient1)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#7209b7" />
         <stop offset="100%" stop-color="#4cc9f0" />
       </linearGradient>
     </defs>
     <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
   </svg>`,
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient2)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#4361ee" />
         <stop offset="100%" stop-color="#4cc9f0" />
       </linearGradient>
     </defs>
     <circle cx="12" cy="12" r="10"/>
     <path d="M12 7v5l3.5 3.5 1.42-1.42L14 11.58V7h-2z" fill="#fff"/>
   </svg>`,
  `<svg width="80" height="80" viewBox="0 0 24 24" fill="url(#gradient3)" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#7209b7" />
         <stop offset="100%" stop-color="#4361ee" />
       </linearGradient>
     </defs>
     <path d="M12 .587l3.668 7.431L24 9.172l-6 5.843 1.416 8.252L12 19.771l-7.416 3.496L6 15.015 0 9.172l8.332-1.154z"/>
   </svg>`,
];

function getRandomSVG() {
  return fallbackSVGIcons[Math.floor(Math.random() * fallbackSVGIcons.length)];
}

/**
 * 渲染单个网站卡片（优化版）
 */
function renderSiteCard(site) {
  const logoHTML = site.logo
    ? `<img src="${site.logo}" alt="${site.name}"/>`
    : getRandomSVG();

  return `
    <div class="channel-card" data-id="${site.id}">
      <div class="channel-number">${site.id}</div>
      <h3 class="channel-title">${site.name || '未命名'}</h3>
      <span class="channel-tag">${site.catelog}</span>
      <div class="logo-wrapper">${logoHTML}</div>
      <p class="channel-desc">${site.desc || '暂无描述'}</p>
      <a href="${site.url}" target="_blank" class="channel-link">${site.url}</a>
      <button class="copy-btn" data-url="${site.url}" title="复制链接">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <div class="copy-success">已复制!</div>
    </div>
  `;
}

  
  /**
   * 处理 API 请求
   */
  const api = {
    async handleRequest(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname.replace('/api', ''); // 去掉 "/api" 前缀
        const method = request.method;
        const id = url.pathname.split('/').pop(); // 获取最后一个路径段，作为 id (例如 /api/config/1)
        try {
            if (path === '/config') {
                switch (method) {
                    case 'GET':
                        return await this.getConfig(request, env, ctx, url);
                    case 'POST':
                        return await this.createConfig(request, env, ctx);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
            if (path === '/config/submit' && method === 'POST') {
              return await this.submitConfig(request, env, ctx);
           }
            if (path === `/config/${id}` && /^\d+$/.test(id)) {
                switch (method) {
                    case 'PUT':
                        return await this.updateConfig(request, env, ctx, id);
                    case 'DELETE':
                        return await this.deleteConfig(request, env, ctx, id);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
            if (path === `/pending/${id}` && /^\d+$/.test(id)) {
                switch (method) {
                    case 'PUT':
                        return await this.approvePendingConfig(request, env, ctx, id);
                    case 'DELETE':
                        return await this.rejectPendingConfig(request, env, ctx, id);
                    default:
                        return this.errorResponse('Method Not Allowed', 405)
                }
            }
            if (path === '/config/import' && method === 'POST') {
                return await this.importConfig(request, env, ctx);
            }
            if (path === '/config/export' && method === 'GET') {
                return await this.exportConfig(request, env, ctx);
            }
            if (path === '/pending' && method === 'GET') {
              return await this.getPendingConfig(request, env, ctx, url);
            }
            return this.errorResponse('Not Found', 404);
        } catch (error) {
            return this.errorResponse(`Internal Server Error: ${error.message}`, 500);
        }
    },
      async getConfig(request, env, ctx, url) {
              const catalog = url.searchParams.get('catalog');
              const page = parseInt(url.searchParams.get('page') || '1', 10);
              const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
              const keyword = url.searchParams.get('keyword');
              const offset = (page - 1) * pageSize;
              try {
                  let query = `SELECT * FROM sites ORDER BY create_time DESC LIMIT ? OFFSET ?`;
                  let countQuery = `SELECT COUNT(*) as total FROM sites`;
                  let queryBindParams = [pageSize, offset];
                  let countQueryParams = [];
  
                  if (catalog) {
                      query = `SELECT * FROM sites WHERE catelog = ? ORDER BY create_time DESC LIMIT ? OFFSET ?`;
                      countQuery = `SELECT COUNT(*) as total FROM sites WHERE catelog = ?`
                      queryBindParams = [catalog, pageSize, offset];
                      countQueryParams = [catalog];
                  }
  
                  if (keyword) {
                      const likeKeyword = `%${keyword}%`;
                      query = `SELECT * FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ? ORDER BY create_time DESC LIMIT ? OFFSET ?`;
                      countQuery = `SELECT COUNT(*) as total FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ?`;
                      queryBindParams = [likeKeyword, likeKeyword, likeKeyword, pageSize, offset];
                      countQueryParams = [likeKeyword, likeKeyword, likeKeyword];
  
                      if (catalog) {
                          query = `SELECT * FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?) ORDER BY create_time DESC LIMIT ? OFFSET ?`;
                          countQuery = `SELECT COUNT(*) as total FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?)`;
                          queryBindParams = [catalog, likeKeyword, likeKeyword, likeKeyword, pageSize, offset];
                          countQueryParams = [catalog, likeKeyword, likeKeyword, likeKeyword];
                      }
                  }
  
                  const { results } = await env.NAV_DB.prepare(query).bind(...queryBindParams).all();
                  const countResult = await env.NAV_DB.prepare(countQuery).bind(...countQueryParams).first();
                  const total = countResult ? countResult.total : 0;
  
                return new Response(
                  JSON.stringify({
                      code: 200,
                      data: results,
                      total,
                      page,
                      pageSize
                  }),
                  { headers: { 'Content-Type': 'application/json' } }
              );
              
              } catch (e) {
                  return this.errorResponse(`Failed to fetch config data: ${e.message}`, 500)
              }
          },
        async getPendingConfig(request, env, ctx, url) {
            const page = parseInt(url.searchParams.get('page') || '1', 10);
            const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
            const offset = (page - 1) * pageSize;
            try {
                const { results } = await env.NAV_DB.prepare(`
                        SELECT * FROM pending_sites ORDER BY create_time DESC LIMIT ? OFFSET ?
                    `).bind(pageSize, offset).all();
                  const countResult = await env.NAV_DB.prepare(`
                      SELECT COUNT(*) as total FROM pending_sites
                      `).first();
                const total = countResult ? countResult.total : 0;
                  return new Response(
                      JSON.stringify({
                        code: 200,
                        data: results,
                          total,
                        page,
                        pageSize
                      }),
                      {headers: {'Content-Type': 'application/json'}}
                  );
            } catch (e) {
                return this.errorResponse(`Failed to fetch pending config data: ${e.message}`, 500);
            }
        },
        async approvePendingConfig(request, env, ctx, id) {
            try {
                const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
                if(results.length === 0) {
                    return this.errorResponse('Pending config not found', 404);
                }
                 const config = results[0];
                await env.NAV_DB.prepare(`
                    INSERT INTO sites (name, url, logo, desc, catelog)
                    VALUES (?, ?, ?, ?, ?)
              `).bind(config.name, config.url, config.logo, config.desc, config.catelog).run();
                await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
  
                 return new Response(JSON.stringify({
                    code: 200,
                    message: 'Pending config approved successfully'
                }),{
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            }catch(e) {
                return this.errorResponse(`Failed to approve pending config : ${e.message}`, 500);
            }
        },
        async rejectPendingConfig(request, env, ctx, id) {
            try{
                await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({
                    code: 200,
                    message: 'Pending config rejected successfully',
                }), {headers: {'Content-Type': 'application/json'}});
            } catch(e) {
                return this.errorResponse(`Failed to reject pending config: ${e.message}`, 500);
            }
        },
      async submitConfig(request, env, ctx) {
          try{
              const config = await request.json();
              const { name, url, logo, desc, catelog } = config;
  
              if (!name || !url || !catelog ) {
                  return this.errorResponse('Name, URL and Catelog are required', 400);
              }
              await env.NAV_DB.prepare(`
                  INSERT INTO pending_sites (name, url, logo, desc, catelog)
                  VALUES (?, ?, ?, ?, ?)
            `).bind(name, url, logo, desc, catelog).run();
  
            return new Response(JSON.stringify({
              code: 201,
              message: 'Config submitted successfully, waiting for admin approve',
            }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            })
          } catch(e) {
              return this.errorResponse(`Failed to submit config : ${e.message}`, 500);
          }
      },
      
    async createConfig(request, env, ctx) {
          try{
              const config = await request.json();
              const { name, url, logo, desc, catelog } = config;
  
              if (!name || !url || !catelog ) {
                  return this.errorResponse('Name, URL and Catelog are required', 400);
              }
              const insert = await env.NAV_DB.prepare(`
                    INSERT INTO sites (name, url, logo, desc, catelog)
                    VALUES (?, ?, ?, ?, ?)
              `).bind(name, url, logo, desc, catelog).run();
  
            return new Response(JSON.stringify({
              code: 201,
              message: 'Config created successfully',
              insert
            }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            })
          } catch(e) {
              return this.errorResponse(`Failed to create config : ${e.message}`, 500);
          }
      },
  
      async updateConfig(request, env, ctx, id) {
          try {
              const config = await request.json();
              const { name, url, logo, desc, catelog } = config;
  
            const update = await env.NAV_DB.prepare(`
                UPDATE sites
                SET name = ?, url = ?, logo = ?, desc = ?, catelog = ?, update_time = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(name, url, logo, desc, catelog, id).run();
            return new Response(JSON.stringify({
                code: 200,
                message: 'Config updated successfully',
                update
            }), { headers: { 'Content-Type': 'application/json' }});
          } catch (e) {
              return this.errorResponse(`Failed to update config: ${e.message}`, 500);
          }
      },
  
      async deleteConfig(request, env, ctx, id) {
          try{
              const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
              return new Response(JSON.stringify({
                  code: 200,
                  message: 'Config deleted successfully',
                  del
              }), {headers: {'Content-Type': 'application/json'}});
          } catch(e) {
            return this.errorResponse(`Failed to delete config: ${e.message}`, 500);
          }
      },
      async importConfig(request, env, ctx) {
        try {
          const jsonData = await request.json();
  
          if (!Array.isArray(jsonData)) {
            return this.errorResponse('Invalid JSON data. Must be an array of site configurations.', 400);
          }
  
          const insertStatements = jsonData.map(item =>
                env.NAV_DB.prepare(`
                        INSERT INTO sites (name, url, logo, desc, catelog)
                        VALUES (?, ?, ?, ?, ?)
                  `).bind(item.name, item.url, item.logo, item.desc, item.catelog)
            )
  
          // 使用 Promise.all 来并行执行所有插入操作
          await Promise.all(insertStatements.map(stmt => stmt.run()));
  
          return new Response(JSON.stringify({
              code: 201,
              message: 'Config imported successfully'
          }), {
              status: 201,
              headers: {'Content-Type': 'application/json'}
          });
        } catch (error) {
          return this.errorResponse(`Failed to import config : ${error.message}`, 500);
        }
      },
  
      async exportConfig(request, env, ctx) {
        try{
          const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY create_time DESC').all();
          return new Response(JSON.stringify({
              code: 200,
              data: results
          }),{
              headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="config.json"'
              }
          });
        } catch(e) {
          return this.errorResponse(`Failed to export config: ${e.message}`, 500)
        }
      },
       errorResponse(message, status) {
          return new Response(JSON.stringify({code: status, message: message}), {
              status: status,
              headers: { 'Content-Type': 'application/json' },
          });
      }
    };
  
  
  /**
   * 处理后台管理页面请求
   */
  const admin = {
  async handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/admin') {
      const params = url.searchParams;
      const name = params.get('name');
      const password = params.get('password');

          // 从KV中获取凭据
    const storedUsername = await env.NAV_AUTH.get("admin_username");
    const storedPassword = await env.NAV_AUTH.get("admin_password");

    if (name === storedUsername && password === storedPassword) {
      return this.renderAdminPage();
    } else if (name || password) {
      return new Response('未授权访问', {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } else {
      return this.renderLoginPage();
    }
    }
    
    if (url.pathname.startsWith('/static')) {
      return this.handleStatic(request, env, ctx);
    }
    
    return new Response('页面不存在', {status: 404});
  },
     async handleStatic(request, env, ctx) {
        const url = new URL(request.url);
        const filePath = url.pathname.replace('/static/', '');
  
        let contentType = 'text/plain';
        if (filePath.endsWith('.css')) {
           contentType = 'text/css';
        } else if (filePath.endsWith('.js')) {
           contentType = 'application/javascript';
        }
  
        try {
            const fileContent = await this.getFileContent(filePath)
            return new Response(fileContent, {
              headers: { 'Content-Type': contentType }
            });
        } catch (e) {
           return new Response('Not Found', {status: 404});
        }
  
      },
    async getFileContent(filePath) {
        const fileContents = {
           'admin.html': `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>书签管理页面</title>
      <link rel="stylesheet" href="/static/admin.css">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="container">
          <h1></h1>
      
          <div class="import-export">
            <input type="file" id="importFile" accept=".json" style="display:none;">
            <button id="importBtn">导入</button>
            <button id="exportBtn">导出</button>
          </div>
      
          <div class="add-new">
            <input type="text" id="addName" placeholder="Name">
            <input type="text" id="addUrl" placeholder="URL">
            <input type="text" id="addLogo" placeholder="Logo(optional)">
             <input type="text" id="addDesc" placeholder="Description(optional)">
            <input type="text" id="addCatelog" placeholder="Catelog">
            <button id="addBtn">添加</button>
          </div>
          <div id="message" style="display: none;padding:1rem;border-radius: 0.5rem;margin-bottom: 1rem;"></div>
         <div class="tab-wrapper">
              <div class="tab-buttons">
                 <button class="tab-button active" data-tab="config">书签列表</button>
                 <button class="tab-button" data-tab="pending">待审核列表</button>
              </div>
               <div id="config" class="tab-content active">
                    <div class="table-wrapper">
                        <table id="configTable">
                            <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Name</th>
                                  <th>URL</th>
                                  <th>Logo</th>
                                  <th>Description</th>
                                  <th>Catelog</th>
                                  <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="configTableBody">
                              <!-- data render by js -->
                            </tbody>
                        </table>
                        <div class="pagination">
                              <button id="prevPage" disabled>上一页</button>
                              <span id="currentPage">1</span>/<span id="totalPages">1</span>
                              <button id="nextPage" disabled>下一页</button>
                        </div>
                   </div>
                </div>
               <div id="pending" class="tab-content">
                 <div class="table-wrapper">
                   <table id="pendingTable">
                      <thead>
                        <tr>
                            <th>ID</th>
                             <th>Name</th>
                             <th>URL</th>
                            <th>Logo</th>
                            <th>Description</th>
                            <th>Catelog</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody id="pendingTableBody">
                       <!-- data render by js -->
                        </tbody>
                    </table>
                     <div class="pagination">
                      <button id="pendingPrevPage" disabled>上一页</button>
                       <span id="pendingCurrentPage">1</span>/<span id="pendingTotalPages">1</span>
                      <button id="pendingNextPage" disabled>下一页</button>
                    </div>
                 </div>
               </div>
            </div>
      </div>
      <script src="/static/admin.js"></script>
    </body>
    </html>`,
            'admin.css': `body {
        font-family: 'Noto Sans SC', sans-serif;
        margin: 0;
        padding: 20px;
        background-color: #f8f9fa; /* 更柔和的背景色 */
        color: #212529; /* 深色文字 */
    }
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5); /* 半透明背景 */
    }
    .modal-content {
        background-color: #fff; /* 模态框背景白色 */
        margin: 10% auto;
        padding: 20px;
        border: 1px solid #dee2e6; /* 边框 */
        width: 60%;
        border-radius: 8px;
        position: relative;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1); /* 阴影效果 */
    }
    .modal-close {
        color: #6c757d; /* 关闭按钮颜色 */
        position: absolute;
        right: 10px;
        top: 0;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s;
    }
    
    .modal-close:hover,
    .modal-close:focus {
        color: #343a40; /* 悬停时颜色加深 */
        text-decoration: none;
        cursor: pointer;
    }
    .modal-content form {
        display: flex;
        flex-direction: column;
    }
    
    .modal-content form label {
        margin-bottom: 5px;
        font-weight: 500; /* 字重 */
        color: #495057; /* 标签颜色 */
    }
    .modal-content form input {
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #ced4da; /* 输入框边框 */
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }
    .modal-content form input:focus {
        border-color: #80bdff; /* 焦点边框颜色 */
        box-shadow:0 0 0 0.2rem rgba(0,123,255,.25);
    }
    .modal-content form input:focus {
        border-color: #80bdff; /* 焦点边框颜色 */
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    .modal-content button[type='submit'] {
        margin-top: 10px;
        background-color: #007bff; /* 提交按钮颜色 */
        color: #fff;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: background-color 0.3s;
    }
    
    .modal-content button[type='submit']:hover {
        background-color: #0056b3; /* 悬停时颜色加深 */
    }
    .container {
        max-width: 1200px;
        margin: 20px auto;
        background-color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    h1 {
        text-align: center;
        margin-bottom: 20px;
        color: #343a40;
    }
    .tab-wrapper {
        margin-top: 20px;
    }
    .tab-buttons {
        display: flex;
        margin-bottom: 10px;
    }
    .tab-button {
        background-color: #e9ecef;
        border: 1px solid #dee2e6;
        padding: 10px 15px;
        border-radius: 4px 4px 0 0;
        cursor: pointer;
        color: #495057; /* tab按钮文字颜色 */
        transition: background-color 0.2s, color 0.2s;
    }
    .tab-button.active {
        background-color: #fff;
        border-bottom: 1px solid #fff;
        color: #212529; /* 选中tab颜色 */
    }
    .tab-button:hover {
        background-color: #f0f0f0;
    }
    .tab-content {
        display: none;
        border: 1px solid #dee2e6;
        padding: 10px;
        border-top: none;
    }
    .tab-content.active {
        display: block;
    }
    
    .import-export {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        justify-content: flex-end;
    }
    
    .add-new {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
    }
    .add-new > input {
        flex: 1;
    }
    input[type="text"] {
        padding: 10px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        margin-bottom: 5px;
         transition: border-color 0.2s;
    }
    input[type="text"]:focus {
        border-color: #80bdff; /* 焦点边框颜色 */
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    button {
        background-color: #6c63ff; /* 主色调 */
        color: #fff;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: background-color 0.3s;
    }
    button:hover {
        background-color: #534dc4;
    }
    
    .table-wrapper {
        overflow-x: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    th, td {
        border: 1px solid #dee2e6;
        padding: 10px;
        text-align: left;
        color: #495057; /* 表格文字颜色 */
    }
    th {
        background-color: #f2f2f2;
        font-weight: 600;
    }
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    
    .actions {
        display: flex;
        gap: 5px;
    }
    .actions button {
        padding: 5px 8px;
        font-size: 0.8rem;
    }
    .edit-btn {
        background-color: #17a2b8; /* 编辑按钮颜色 */
    }
    
    .del-btn {
        background-color: #dc3545; /* 删除按钮颜色 */
    }
    .pagination {
        text-align: center;
        margin-top: 20px;
    }
    .pagination button {
        margin: 0 5px;
        background-color: #e9ecef; /* 分页按钮颜色 */
        color: #495057;
        border: 1px solid #ced4da;
    }
    .pagination button:hover {
        background-color: #dee2e6;
    }
    
    .success {
        background-color: #28a745;
        color: #fff;
    }
    .error {
        background-color: #dc3545;
        color: #fff;
    }
      `,
          'admin.js': `
          const configTableBody = document.getElementById('configTableBody');
          const prevPageBtn = document.getElementById('prevPage');
          const nextPageBtn = document.getElementById('nextPage');
          const currentPageSpan = document.getElementById('currentPage');
          const totalPagesSpan = document.getElementById('totalPages');
          
          const pendingTableBody = document.getElementById('pendingTableBody');
            const pendingPrevPageBtn = document.getElementById('pendingPrevPage');
            const pendingNextPageBtn = document.getElementById('pendingNextPage');
            const pendingCurrentPageSpan = document.getElementById('pendingCurrentPage');
            const pendingTotalPagesSpan = document.getElementById('pendingTotalPages');
          
          const messageDiv = document.getElementById('message');
          
          const addBtn = document.getElementById('addBtn');
          const addName = document.getElementById('addName');
          const addUrl = document.getElementById('addUrl');
          const addLogo = document.getElementById('addLogo');
          const addDesc = document.getElementById('addDesc');
          const addCatelog = document.getElementById('addCatelog');
          
          const importBtn = document.getElementById('importBtn');
          const importFile = document.getElementById('importFile');
          const exportBtn = document.getElementById('exportBtn');
          
           const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
          
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(b => b.classList.remove('active'));
                 button.classList.add('active');
                tabContents.forEach(content => {
                   content.classList.remove('active');
                    if(content.id === tab) {
                       content.classList.add('active');
                     }
                  })
              });
            });
          
          
          // 添加搜索框
          const searchInput = document.createElement('input');
          searchInput.type = 'text';
          searchInput.placeholder = '搜索书签(名称，URL，分类)';
          searchInput.id = 'searchInput';
          searchInput.style.marginBottom = '10px';
          document.querySelector('.add-new').parentNode.insertBefore(searchInput, document.querySelector('.add-new'));
          
          
          let currentPage = 1;
          let pageSize = 10;
          let totalItems = 0;
          let allConfigs = []; // 保存所有配置数据
          let currentSearchKeyword = ''; // 保存当前搜索关键词
          
          let pendingCurrentPage = 1;
            let pendingPageSize = 10;
            let pendingTotalItems = 0;
            let allPendingConfigs = []; // 保存所有待审核配置数据
          
          // 创建编辑模态框
          const editModal = document.createElement('div');
          editModal.className = 'modal';
          editModal.style.display = 'none';
          editModal.innerHTML = \`
            <div class="modal-content">
              <span class="modal-close">×</span>
              <h2>编辑站点</h2>
              <form id="editForm">
                <input type="hidden" id="editId">
                <label for="editName">名称:</label>
                <input type="text" id="editName" required><br>
                <label for="editUrl">URL:</label>
                <input type="text" id="editUrl" required><br>
                <label for="editLogo">Logo(可选):</label>
                <input type="text" id="editLogo"><br>
                <label for="editDesc">描述(可选):</label>
                <input type="text" id="editDesc"><br>
                <label for="editCatelog">分类:</label>
                <input type="text" id="editCatelog" required><br>
                <button type="submit">保存</button>
              </form>
            </div>
          \`;
          document.body.appendChild(editModal);
          
          const modalClose = editModal.querySelector('.modal-close');
          modalClose.addEventListener('click', () => {
            editModal.style.display = 'none';
          });
          
          const editForm = document.getElementById('editForm');
          editForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const name = document.getElementById('editName').value;
            const url = document.getElementById('editUrl').value;
            const logo = document.getElementById('editLogo').value;
            const desc = document.getElementById('editDesc').value;
            const catelog = document.getElementById('editCatelog').value;
          
            fetch(\`/api/config/\${id}\`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name,
                url,
                logo,
                desc,
                catelog
              })
            }).then(res => res.json())
              .then(data => {
                if (data.code === 200) {
                  showMessage('修改成功', 'success');
                  fetchConfigs();
                  editModal.style.display = 'none'; // 关闭弹窗
                } else {
                  showMessage(data.message, 'error');
                }
              }).catch(err => {
                showMessage('网络错误', 'error');
              })
          });
          
          
          function fetchConfigs(page = currentPage, keyword = currentSearchKeyword) {
              let url = \`/api/config?page=\${page}&pageSize=\${pageSize}\`;
              if(keyword) {
                  url = \`/api/config?page=\${page}&pageSize=\${pageSize}&keyword=\${keyword}\`
              }
              fetch(url)
                  .then(res => res.json())
                  .then(data => {
                      if (data.code === 200) {
                          totalItems = data.total;
                          currentPage = data.page;
                                                 totalPagesSpan.innerText = Math.ceil(totalItems / pageSize);
                          currentPageSpan.innerText = currentPage;
                          allConfigs = data.data; // 保存所有数据
                          renderConfig(allConfigs);
                          updatePaginationButtons();
                      } else {
                          showMessage(data.message, 'error');
                      }
                  }).catch(err => {
                  showMessage('网络错误', 'error');
              })
          }
          function renderConfig(configs) {
          configTableBody.innerHTML = '';
           if (configs.length === 0) {
                configTableBody.innerHTML = '<tr><td colspan="7">没有配置数据</td></tr>';
                return
            }
          configs.forEach(config => {
              const row = document.createElement('tr');
               row.innerHTML = \`
                 <td>\${config.id}</td>
                  <td>\${config.name}</td>
                  <td><a href="\${config.url}" target="_blank">\${config.url}</a></td>
                  <td>\${config.logo ? \`<img src="\${config.logo}" style="width:30px;" />\` : 'N/A'}</td>
                  <td>\${config.desc || 'N/A'}</td>
                  <td>\${config.catelog}</td>
                  <td class="actions">
                    <button class="edit-btn" data-id="\${config.id}">编辑</button>
                    <button class="del-btn" data-id="\${config.id}">删除</button>
                  </td>
               \`;
              configTableBody.appendChild(row);
          });
            bindActionEvents();
          }
          
          function bindActionEvents() {
           document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.dataset.id;
                    handleEdit(id);
                })
           });
          
          document.querySelectorAll('.del-btn').forEach(btn => {
               btn.addEventListener('click', function() {
                  const id = this.dataset.id;
                   handleDelete(id)
               })
          })
          }
          
          function handleEdit(id) {
               const row = document.querySelector(\`#configTableBody tr:nth-child(\${Array.from(configTableBody.children).findIndex(tr => tr.querySelector('.edit-btn[data-id="'+ id +'"]')) + 1})\`);
            if (!row) return showMessage('找不到数据','error');
            const name = row.querySelector('td:nth-child(2)').innerText;
            const url = row.querySelector('td:nth-child(3) a').innerText;
            const logo = row.querySelector('td:nth-child(4) img')?.src || '';
            const desc = row.querySelector('td:nth-child(5)').innerText === 'N/A' ? '' : row.querySelector('td:nth-child(5)').innerText;
            const catelog = row.querySelector('td:nth-child(6)').innerText;
          
          
            // 填充表单数据
            document.getElementById('editId').value = id;
            document.getElementById('editName').value = name;
            document.getElementById('editUrl').value = url;
            document.getElementById('editLogo').value = logo;
            document.getElementById('editDesc').value = desc;
            document.getElementById('editCatelog').value = catelog;
            editModal.style.display = 'block';
          }
          function handleDelete(id) {
            if(!confirm('确认删除？')) return;
             fetch(\`/api/config/\${id}\`, {
                  method: 'DELETE'
              }).then(res => res.json())
                 .then(data => {
                     if (data.code === 200) {
                         showMessage('删除成功', 'success');
                         fetchConfigs();
                     } else {
                         showMessage(data.message, 'error');
                     }
                 }).catch(err => {
                      showMessage('网络错误', 'error');
                 })
          }
          function showMessage(message, type) {
            messageDiv.innerText = message;
            messageDiv.className = type;
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
          }
          
          function updatePaginationButtons() {
            prevPageBtn.disabled = currentPage === 1;
             nextPageBtn.disabled = currentPage >= Math.ceil(totalItems/pageSize)
          }
          
          prevPageBtn.addEventListener('click', () => {
          if(currentPage > 1) {
              fetchConfigs(currentPage -1);
          }
          });
          nextPageBtn.addEventListener('click', () => {
            if (currentPage < Math.ceil(totalItems/pageSize)) {
              fetchConfigs(currentPage + 1);
            }
          });
          
          addBtn.addEventListener('click', () => {
            const name = addName.value;
            const url = addUrl.value;
            const logo = addLogo.value;
            const desc = addDesc.value;
             const catelog = addCatelog.value;
            if(!name ||    !url || !catelog) {
              showMessage('名称,URL,分类 必填', 'error');
              return;
          }
          fetch('/api/config', {        method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
             name,
             url,
             logo,
             desc,
              catelog
          })
          }).then(res => res.json())
          .then(data => {
             if(data.code === 201) {
                 showMessage('添加成功', 'success');
                addName.value = '';
                addUrl.value = '';
                addLogo.value = '';
                addDesc.value = '';
                 addCatelog.value = '';
                 fetchConfigs();
             }else {
                showMessage(data.message, 'error');
             }
          }).catch(err => {
            showMessage('网络错误', 'error');
          })
          });
          
          importBtn.addEventListener('click', () => {
          importFile.click();
          });
          importFile.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
           const reader = new FileReader();
          reader.onload = function(event) {
             try {
                 const jsonData = JSON.parse(event.target.result);
                   fetch('/api/config/import', {
                       method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                       body: JSON.stringify(jsonData)
                  }).then(res => res.json())
                     .then(data => {
                          if(data.code === 201) {
                             showMessage('导入成功', 'success');
                              fetchConfigs();
                          } else {
                             showMessage(data.message, 'error');
                          }
                     }).catch(err => {
                           showMessage('网络错误', 'error');
                  })
          
             } catch (error) {
                   showMessage('JSON格式不正确', 'error');
             }
          }
           reader.readAsText(file);
          }
          })
          exportBtn.addEventListener('click', () => {
          fetch('/api/config/export')
          .then(res => res.blob())
          .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'config.json';
          document.body.appendChild(a);
          a.click();
           window.URL.revokeObjectURL(url);
           document.body.removeChild(a);
          }).catch(err => {
          showMessage('网络错误', 'error');
          })
          })
          
          // 搜索功能
          searchInput.addEventListener('input', () => {
              currentSearchKeyword = searchInput.value.trim();
              currentPage = 1; // 搜索时重置为第一页
              fetchConfigs(currentPage,currentSearchKeyword);
          });
          
          
          function fetchPendingConfigs(page = pendingCurrentPage) {
                  fetch(\`/api/pending?page=\${page}&pageSize=\${pendingPageSize}\`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.code === 200) {
                               pendingTotalItems = data.total;
                               pendingCurrentPage = data.page;
                               pendingTotalPagesSpan.innerText = Math.ceil(pendingTotalItems/ pendingPageSize);
                                pendingCurrentPageSpan.innerText = pendingCurrentPage;
                               allPendingConfigs = data.data;
                                 renderPendingConfig(allPendingConfigs);
                                updatePendingPaginationButtons();
                        } else {
                            showMessage(data.message, 'error');
                        }
                      }).catch(err => {
                      showMessage('网络错误', 'error');
                   })
          }
          
            function renderPendingConfig(configs) {
                  pendingTableBody.innerHTML = '';
                  if(configs.length === 0) {
                      pendingTableBody.innerHTML = '<tr><td colspan="7">没有待审核数据</td></tr>';
                      return
                  }
                configs.forEach(config => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                      <td>\${config.id}</td>
                       <td>\${config.name}</td>
                       <td><a href="\${config.url}" target="_blank">\${config.url}</a></td>
                       <td>\${config.logo ? \`<img src="\${config.logo}" style="width:30px;" />\` : 'N/A'}</td>
                       <td>\${config.desc || 'N/A'}</td>
                       <td>\${config.catelog}</td>
                        <td class="actions">
                            <button class="approve-btn" data-id="\${config.id}">批准</button>
                          <button class="reject-btn" data-id="\${config.id}">拒绝</button>
                        </td>
                      \`;
                    pendingTableBody.appendChild(row);
                });
                bindPendingActionEvents();
            }
           function bindPendingActionEvents() {
               document.querySelectorAll('.approve-btn').forEach(btn => {
                   btn.addEventListener('click', function() {
                       const id = this.dataset.id;
                       handleApprove(id);
                   })
               });
              document.querySelectorAll('.reject-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                         const id = this.dataset.id;
                         handleReject(id);
                     })
              })
           }
          
          function handleApprove(id) {
             if (!confirm('确定批准吗？')) return;
             fetch(\`/api/pending/\${id}\`, {
                   method: 'PUT',
                 }).then(res => res.json())
               .then(data => {
                    if (data.code === 200) {
                        showMessage('批准成功', 'success');
                        fetchPendingConfigs();
                         fetchConfigs();
                    } else {
                         showMessage(data.message, 'error')
                     }
                }).catch(err => {
                      showMessage('网络错误', 'error');
                  })
          }
           function handleReject(id) {
               if (!confirm('确定拒绝吗？')) return;
              fetch(\`/api/pending/\${id}\`, {
                     method: 'DELETE'
                }).then(res => res.json())
                   .then(data => {
                     if(data.code === 200) {
                         showMessage('拒绝成功', 'success');
                        fetchPendingConfigs();
                    } else {
                       showMessage(data.message, 'error');
                   }
                  }).catch(err => {
                        showMessage('网络错误', 'error');
                })
           }
          function updatePendingPaginationButtons() {
              pendingPrevPageBtn.disabled = pendingCurrentPage === 1;
               pendingNextPageBtn.disabled = pendingCurrentPage >= Math.ceil(pendingTotalItems/ pendingPageSize)
           }
          
           pendingPrevPageBtn.addEventListener('click', () => {
               if (pendingCurrentPage > 1) {
                   fetchPendingConfigs(pendingCurrentPage - 1);
               }
           });
            pendingNextPageBtn.addEventListener('click', () => {
               if (pendingCurrentPage < Math.ceil(pendingTotalItems/pendingPageSize)) {
                   fetchPendingConfigs(pendingCurrentPage + 1)
               }
            });
          
          fetchConfigs();
          fetchPendingConfigs();
          `
    }
    return fileContents[filePath]
    },
  
    async renderAdminPage() {
    const html = await this.getFileContent('admin.html');
    return new Response(html, {
        headers: {'Content-Type': 'text/html; charset=utf-8'}
    });
    },
  
    async renderLoginPage() {
      const html = `<!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>管理员登录</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Noto Sans SC', sans-serif;
            background-color: #f8f9fa;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .login-container {
            background-color: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 360px;
          }
          .login-title {
            font-size: 1.5rem;
            text-align: center;
            margin-bottom: 1.5rem;
            color: #333;
          }
          .form-group {
            margin-bottom: 1rem;
          }
          label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #555;
          }
          input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
            transition: border-color 0.2s;
          }
          input:focus {
            border-color: #7209b7;
            outline: none;
            box-shadow: 0 0 0 2px rgba(114, 9, 183, 0.2);
          }
          button {
            width: 100%;
            padding: 0.75rem;
            background-color: #7209b7;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          button:hover {
            background-color: #5a067c;
          }
          .error-message {
            color: #dc3545;
            font-size: 0.875rem;
            margin-top: 0.5rem;
            display: none;
          }
          .back-link {
            display: block;
            text-align: center;
            margin-top: 1rem;
            color: #7209b7;
            text-decoration: none;
            font-size: 0.875rem;
          }
          .back-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h1 class="login-title">管理员登录</h1>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">用户名</label>
              <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
              <label for="password">密码</label>
              <input type="password" id="password" name="password" required>
            </div>
            <div class="error-message" id="errorMessage">用户名或密码错误</div>
            <button type="submit">登录</button>
          </form>
          <a href="/" class="back-link">返回首页</a>
        </div>
        
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const loginForm = document.getElementById('loginForm');
            const errorMessage = document.getElementById('errorMessage');
            
            loginForm.addEventListener('submit', function(e) {
              e.preventDefault();
              
              const username = document.getElementById('username').value;
              const password = document.getElementById('password').value;
              
              // 重定向到带有凭据的管理页面
              window.location.href = '/admin?name=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password);
            });
          });
        </script>
      </body>
      </html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  };
  
  
  /**
   * 优化后的主逻辑：处理请求，返回优化后的 HTML
   */
  async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const catalog = url.searchParams.get('catalog');

    let sites = [];
    try {
      const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY create_time').all();
      sites = results;
    } catch (e) {
      return new Response(`Failed to fetch data: ${e.message}`, { status: 500 });
    }

    if (!sites || sites.length === 0) {
      return new Response('No site configuration found.', { status: 404 });
    }

    // 获取所有分类
    const catalogs = Array.from(new Set(sites.map(s => s.catelog)));
    
    // 根据 URL 参数筛选站点
    const currentCatalog = catalog || catalogs[0];
    const currentSites = catalog ? sites.filter(s => s.catelog === currentCatalog) : sites;

    // 优化后的 HTML
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>拾光集 - 精品网址导航</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet"/>
      <link rel="icon" href="https://www.wangwangit.com/images/head/a.webp" type="image/webp"/>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: {
                  50: '#f4f1fd',
                  100: '#e9e3fb',
                  200: '#d3c7f7',
                  300: '#b0a0f0',
                  400: '#8a70e7',
                  500: '#7209b7',
                  600: '#6532cc',
                  700: '#5429ab',
                  800: '#46238d',
                  900: '#3b1f75',
                  950: '#241245',
                },
                secondary: {
                  50: '#eef4ff',
                  100: '#e0ebff',
                  200: '#c7d9ff',
                  300: '#a3beff',
                  400: '#7a9aff',
                  500: '#5a77fb',
                  600: '#4361ee',
                  700: '#2c4be0',
                  800: '#283db6',
                  900: '#253690',
                  950: '#1a265c',
                },
                accent: {
                  50: '#ecfdff',
                  100: '#d0f7fe',
                  200: '#a9eefe',
                  300: '#72e0fd',
                  400: '#33cafc',
                  500: '#4cc9f0',
                  600: '#0689cb',
                  700: '#0b6ca6',
                  800: '#115887',
                  900: '#134971',
                  950: '#0c2d48',
                },
              },
              fontFamily: {
                sans: ['Noto Sans SC', 'sans-serif'],
              },
            }
          }
        }
      </script>
      <style>
        /* 自定义滚动条 */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #d3c7f7;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #7209b7;
        }
        
        /* 卡片悬停效果 */
        .site-card {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .site-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        /* 复制成功提示动画 */
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .copy-success-animation {
          animation: fadeInOut 2s ease forwards;
        }
        
        /* 移动端侧边栏 */
        @media (max-width: 768px) {
          .mobile-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          .mobile-sidebar.open {
            transform: translateX(0);
          }
          .mobile-overlay {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .mobile-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }
        }
        
        /* 多行文本截断 */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* 侧边栏控制 */
        #sidebar-toggle {
          display: none;
        }
        
        @media (min-width: 769px) {
          #sidebar-toggle:checked ~ .sidebar {
            margin-left: -16rem;
          }
          #sidebar-toggle:checked ~ .main-content {
            margin-left: 0;
          }
        }
      </style>
    </head>
    <body class="bg-gray-50 font-sans text-gray-800">
      <!-- 侧边栏开关 -->
      <input type="checkbox" id="sidebar-toggle" class="hidden">
      
      <!-- 移动端导航按钮 -->
      <div class="fixed top-4 left-4 z-50 lg:hidden">
        <button id="sidebarToggle" class="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      <!-- 移动端遮罩层 - 只在移动端显示 -->
      <div id="mobileOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 mobile-overlay lg:hidden"></div>
      
      <!-- 桌面侧边栏开关按钮 -->
      <div class="fixed top-4 left-4 z-50 hidden lg:block">
        <label for="sidebar-toggle" class="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100 inline-block cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </label>
      </div>
      
      <!-- 侧边栏导航 -->
      <aside id="sidebar" class="sidebar fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 overflow-y-auto mobile-sidebar lg:transform-none transition-all duration-300">
        <div class="p-6">
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-bold text-primary-500">拾光集</h2>
            <button id="closeSidebar" class="p-1 rounded-full hover:bg-gray-100 lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <label for="sidebar-toggle" class="p-1 rounded-full hover:bg-gray-100 hidden lg:block cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </label>
          </div>
          
          <div class="mb-6">
            <div class="relative">
              <input id="searchInput" type="text" placeholder="搜索书签..." class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">分类导航</h3>
            <div class="space-y-1">
              <a href="?" class="flex items-center px-3 py-2 rounded-lg ${!catalog ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'} w-full">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${!catalog ? 'text-primary-500' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                全部
              </a>
              ${catalogs.map(cat => `
                <a href="?catalog=${cat}" class="flex items-center px-3 py-2 rounded-lg ${cat === currentCatalog && catalog ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'} w-full">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${cat === currentCatalog && catalog ? 'text-primary-500' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  ${cat}
                </a>
              `).join('')}
            </div>
          </div>
          
          <div class="mt-8 pt-6 border-t border-gray-200">
            <button id="addSiteBtnSidebar" class="w-full flex items-center justify-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加新书签
            </button>
            
            <a href="https://www.wangwangit.com/" target="_blank" class="mt-4 flex items-center px-4 py-2 text-gray-600 hover:text-primary-500 transition duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              访问博客
            </a>

            <a href="/admin" target="_blank" class="mt-4 flex items-center px-4 py-2 text-gray-600 hover:text-primary-500 transition duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              后台管理
            </a>
          </div>
        </div>
      </aside>
      
      <!-- 主内容区 -->
      <main class="main-content lg:ml-64 min-h-screen transition-all duration-300">
        <!-- 顶部横幅 -->
        <header class="bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 text-white py-8 px-6 md:px-10">
          <div class="max-w-5xl mx-auto">
            <div class="flex flex-col md:flex-row items-center justify-center">
              <div class="text-center">
                <h1 class="text-3xl md:text-4xl font-bold mb-2">拾光集</h1>
                <p class="text-primary-100 max-w-xl">分享优质网站，构建更美好的网络世界</p>
              </div>
            </div>
          </div>
        </header>
        
        <!-- 网站列表 -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <!-- 当前分类/搜索提示 -->
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-800">
              ${catalog ? `${currentCatalog} · ${currentSites.length} 个网站` : `全部收藏 · ${sites.length} 个网站`}
            </h2>
            <div class="text-sm text-gray-500 hidden md:block">
              <script>
                 fetch('https://v1.hitokoto.cn')
                      .then(response => response.json())
                      .then(data => {
                       const hitokoto = document.getElementById('hitokoto_text')
                      hitokoto.href = 'https://hitokoto.cn/?uuid=' + data.uuid
                      hitokoto.innerText = data.hitokoto
                      })
                      .catch(console.error)
              </script>
              <div id="hitokoto"><a href="#" target="_blank" id="hitokoto_text">疏影横斜水清浅，暗香浮动月黄昏。</a></div>
            </div>
          </div>
          
          <!-- 网站卡片网格 -->
          <div id="sitesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            ${currentSites.map(site => `
              <div class="site-card group bg-white rounded-xl shadow hover:shadow-lg overflow-hidden" data-id="${site.id}" data-name="${site.name}" data-url="${site.url}" data-catalog="${site.catelog}">
                <div class="p-5">
                  <a href="${site.url}" target="_blank" class="block">
                    <div class="flex items-start">
                      <div class="flex-shrink-0 mr-4">
                        ${site.logo 
                          ? `<img src="${site.logo}" alt="${site.name}" class="w-10 h-10 rounded-lg object-cover">`
                          : `<div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center text-white font-bold text-lg">${site.name.charAt(0)}</div>`
                        }
                      </div>
                      <div class="flex-1 min-w-0">
                        <h3 class="text-base font-medium text-gray-900 truncate">${site.name}</h3>
                        <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          ${site.catelog}
                        </span>
                      </div>
                    </div>
                    
                    <p class="mt-2 text-sm text-gray-500 line-clamp-2" title="${site.desc || '暂无描述'}">${site.desc || '暂无描述'}</p>
                  </a>
                  
                  <div class="mt-3 flex items-center justify-between">
                    <span class="text-xs text-gray-500 truncate max-w-[140px]">${site.url}</span>
                    <button class="copy-btn flex items-center px-2 py-1 bg-primary-100 text-primary-600 hover:bg-primary-200 rounded-full text-xs font-medium transition-colors" data-url="${site.url}">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      复制
                      <span class="copy-success hidden absolute -top-8 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
        
        <!-- 页脚 -->
        <footer class="bg-white py-8 px-6 mt-12 border-t border-gray-200">
          <div class="max-w-5xl mx-auto text-center">
            <p class="text-gray-500">© ${new Date().getFullYear()} 拾光集 | 愿你在此找到方向</p>
            <div class="mt-4 flex justify-center space-x-6">
              <a href="https://www.wangwangit.com/" target="_blank" class="text-gray-400 hover:text-primary-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </main>
      
      <!-- 返回顶部按钮 -->
      <button id="backToTop" class="fixed bottom-8 right-8 p-3 rounded-full bg-primary-500 text-white shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-primary-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </button>
      
      <!-- 添加网站模态框 -->
      <div id="addSiteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 opacity-0 invisible transition-all duration-300">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform translate-y-8 transition-all duration-300">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-900">添加新书签</h2>
              <button id="closeModal" class="text-gray-400 hover:text-gray-500">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form id="addSiteForm" class="space-y-4">
              <div>
                <label for="addSiteName" class="block text-sm font-medium text-gray-700">名称</label>
                <input type="text" id="addSiteName" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
              </div>
              
              <div>
                <label for="addSiteUrl" class="block text-sm font-medium text-gray-700">网址</label>
                <input type="text" id="addSiteUrl" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
              </div>
              
              <div>
                <label for="addSiteLogo" class="block text-sm font-medium text-gray-700">Logo (可选)</label>
                <input type="text" id="addSiteLogo" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
              </div>
              
              <div>
                <label for="addSiteDesc" class="block text-sm font-medium text-gray-700">描述 (可选)</label>
                <textarea id="addSiteDesc" rows="2" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"></textarea>
              </div>
              
              <div>
                <label for="addSiteCatelog" class="block text-sm font-medium text-gray-700">分类</label>
                <input type="text" id="addSiteCatelog" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" list="catalogList">
                <datalist id="catalogList">
                  ${catalogs.map(cat => `<option value="${cat}">`).join('')}
                </datalist>
              </div>
              
              <div class="flex justify-end pt-4">
                <button type="button" id="cancelAddSite" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 mr-3">
                  取消
                </button>
                <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  提交
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // 侧边栏控制
          const sidebar = document.getElementById('sidebar');
          const mobileOverlay = document.getElementById('mobileOverlay');
          const sidebarToggle = document.getElementById('sidebarToggle');
          const closeSidebar = document.getElementById('closeSidebar');
          
          function openSidebar() {
            sidebar.classList.add('open');
            mobileOverlay.classList.add('open');
            document.body.style.overflow = 'hidden';
          }
          
          function closeSidebarMenu() {
            sidebar.classList.remove('open');
            mobileOverlay.classList.remove('open');
            document.body.style.overflow = '';
          }
          
          if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
          if (closeSidebar) closeSidebar.addEventListener('click', closeSidebarMenu);
          if (mobileOverlay) mobileOverlay.addEventListener('click', closeSidebarMenu);
          
          // 复制链接功能
          document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const url = this.getAttribute('data-url');
              navigator.clipboard.writeText(url).then(() => {
                const successMsg = this.querySelector('.copy-success');
                successMsg.classList.remove('hidden');
                successMsg.classList.add('copy-success-animation');
                setTimeout(() => {
                  successMsg.classList.add('hidden');
                  successMsg.classList.remove('copy-success-animation');
                }, 2000);
              }).catch(err => {
                console.error('复制失败:', err);
                // 备用复制方法
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                  document.execCommand('copy');
                  const successMsg = this.querySelector('.copy-success');
                  successMsg.classList.remove('hidden');
                  successMsg.classList.add('copy-success-animation');
                  setTimeout(() => {
                    successMsg.classList.add('hidden');
                    successMsg.classList.remove('copy-success-animation');
                  }, 2000);
                } catch (e) {
                  console.error('备用复制也失败了:', e);
                  alert('复制失败，请手动复制');
                }
                document.body.removeChild(textarea);
              });
            });
          });
          
          // 返回顶部按钮
          const backToTop = document.getElementById('backToTop');
          
          window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
              backToTop.classList.remove('opacity-0', 'invisible');
            } else {
              backToTop.classList.add('opacity-0', 'invisible');
            }
          });
          
          if (backToTop) {
            backToTop.addEventListener('click', function() {
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
            });
          }
          
          // 添加网站模态框
          const addSiteModal = document.getElementById('addSiteModal');
          const addSiteBtnSidebar = document.getElementById('addSiteBtnSidebar');
          const closeModalBtn = document.getElementById('closeModal');
          const cancelAddSite = document.getElementById('cancelAddSite');
          const addSiteForm = document.getElementById('addSiteForm');
          
          function openModal() {
            if (addSiteModal) {
              addSiteModal.classList.remove('opacity-0', 'invisible');
              const modalContent = addSiteModal.querySelector('.max-w-md');
              if (modalContent) modalContent.classList.remove('translate-y-8');
              document.body.style.overflow = 'hidden';
            }
          }
          
          function closeModal() {
            if (addSiteModal) {
              addSiteModal.classList.add('opacity-0', 'invisible');
              const modalContent = addSiteModal.querySelector('.max-w-md');
              if (modalContent) modalContent.classList.add('translate-y-8');
              document.body.style.overflow = '';
            }
          }
          
          if (addSiteBtnSidebar) {
            addSiteBtnSidebar.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              console.log('添加书签按钮被点击');
              openModal();
            });
          } else {
            console.error('未找到添加书签按钮元素');
          }
          
          if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
              closeModal();
            });
          }
          
          if (cancelAddSite) {
            cancelAddSite.addEventListener('click', closeModal);
          }
          
          if (addSiteModal) {
            addSiteModal.addEventListener('click', function(e) {
              if (e.target === addSiteModal) {
                closeModal();
              }
            });
          }
          
          // 表单提交处理
          if (addSiteForm) {
            addSiteForm.addEventListener('submit', function(e) {
              e.preventDefault();
              
              const name = document.getElementById('addSiteName').value;
              const url = document.getElementById('addSiteUrl').value;
              const logo = document.getElementById('addSiteLogo').value;
              const desc = document.getElementById('addSiteDesc').value;
              const catelog = document.getElementById('addSiteCatelog').value;
              
              fetch('/api/config/submit', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, url, logo, desc, catelog })
              })
              .then(res => res.json())
              .then(data => {
                if (data.code === 201) {
                  // 显示成功消息
                  const successDiv = document.createElement('div');
                  successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in';
                  successDiv.textContent = '提交成功，等待管理员审核';
                  document.body.appendChild(successDiv);
                  
                  setTimeout(() => {
                    successDiv.classList.add('opacity-0');
                    setTimeout(() => {
                      if (document.body.contains(successDiv)) {
                        document.body.removeChild(successDiv);
                      }
                    }, 300);
                  }, 2500);
                  
                  closeModal();
                  addSiteForm.reset();
                } else {
                  alert(data.message || '提交失败');
                }
              })
              .catch(err => {
                console.error('网络错误:', err);
                alert('网络错误，请稍后重试');
              });
            });
          }
          
          // 搜索功能
          const searchInput = document.getElementById('searchInput');
          const sitesGrid = document.getElementById('sitesGrid');
          const siteCards = document.querySelectorAll('.site-card');
          
          if (searchInput && sitesGrid) {
            searchInput.addEventListener('input', function() {
              const keyword = this.value.toLowerCase().trim();
              
              siteCards.forEach(card => {
                const name = card.getAttribute('data-name').toLowerCase();
                const url = card.getAttribute('data-url').toLowerCase();
                const catalog = card.getAttribute('data-catalog').toLowerCase();
                
                if (name.includes(keyword) || url.includes(keyword) || catalog.includes(keyword)) {
                  card.classList.remove('hidden');
                } else {
                  card.classList.add('hidden');
                }
              });
              
              // 搜索结果提示
              const visibleCards = sitesGrid.querySelectorAll('.site-card:not(.hidden)');
              const countHeading = document.querySelector('h2');
              if (countHeading) {
                countHeading.textContent = keyword ? '搜索结果 · ' + visibleCards.length + ' 个网站' : 
                  (window.location.search.includes('catalog=') ? catalog + ' · ' + visibleCards.length + ' 个网站' : '全部收藏 · ' + visibleCards.length + ' 个网站');
              }
            });
          }
        });
      </script>
    </body>
    </html>
    `;

return new Response(html, {
  headers: { 'content-type': 'text/html; charset=utf-8' }
});
}


// 导出主模块
export default {
async fetch(request, env, ctx) {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api')) {
    return api.handleRequest(request, env, ctx);
  } else if (url.pathname === '/admin' || url.pathname.startsWith('/static')) {
    return admin.handleRequest(request, env, ctx);
  } else {
    return handleRequest(request, env, ctx);
  }
},
};
