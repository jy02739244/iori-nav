// functions/api/pending/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
    
    if (results.length === 0) {
      return errorResponse('Pending config not found', 404);
    }

    const config = results[0];
    let { logo, url } = config;
    let sanitizedLogo = logo;
    const iconAPI=env.ICON_API ||'https://faviconsnap.com/api/favicon?url=';
    if(!logo && url){
      if(url.startsWith('https://') || url.startsWith('http://')){
        const domain = url.replace(/^https?:\/\//, '').split('/')[0];
        sanitizedLogo = iconAPI+domain;
      }
      
    }
    await env.NAV_DB.prepare(`
      INSERT INTO sites (name, url, logo, desc, catelog_id, sort_order)
      VALUES (?, ?, ?, ?, ?, 9999)
    `).bind(config.name, config.url, sanitizedLogo, config.desc, config.catelog_id).run();
    
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();

    return jsonResponse({
      code: 200,
      message: 'Pending config approved successfully'
    });
  } catch (e) {
    console.error('Error approving pending config:', e);
    return errorResponse(`Failed to approve pending config: ${e.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    
    return jsonResponse({
      code: 200,
      message: 'Pending config rejected successfully',
    });
  } catch (e) {
    return errorResponse(`Failed to reject pending config: ${e.message}`, 500);
  }
}
