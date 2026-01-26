/**
 * HANDLERS - Berisi logic utama untuk redirect dan API endpoints
 */

/**
 * Handle redirect link - Fungsi paling penting
 * Cek User-Agent: jika Facebook bot => tampilkan OG Tags
 * Jika user biasa => redirect ke target URL
 */
export async function handleRedirect(request, env, subdomain, ctx, config) {
  try {
    // Ambil data link dari KV storage berdasarkan subdomain
    const key = `link:${subdomain}`;
    const data = await env.LINKS_DB.get(key);
    
    // Jika link tidak ditemukan
    if (!data) {
      return new Response(generateNotFoundPage(subdomain), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Parse data JSON
    const linkData = JSON.parse(data);
    
    // Deteksi User-Agent untuk bedakan Facebook Bot vs User
    const userAgent = request.headers.get('User-Agent') || '';
    const isFacebookBot = detectFacebookBot(userAgent);
    
    // Update statistik klik (jalankan di background, tidak blocking)
    // ctx.waitUntil = jalankan async tanpa tunggu hasil
    ctx.waitUntil(updateClickStats(env, key, linkData));
    
    // Jika Facebook Bot/Scraper => tampilkan halaman dengan OG Tags
    if (isFacebookBot) {
      return new Response(generateOgPage(linkData, config), {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600' // Cache 1 jam untuk OG tags
        }
      });
    }
    
    // Jika user biasa => redirect 302 ke target URL
    return Response.redirect(linkData.targetUrl, 302);
    
  } catch (error) {
    // Error handling
    console.error('Redirect error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle API requests - Create, List, Delete links
 */
export async function handleApi(request, env, pathname, config) {
  // Cek autentikasi untuk semua API endpoints
  const authResult = checkAuth(request, config);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }
  
  try {
    // Routing API endpoints
    if (pathname === '/api/create' && request.method === 'POST') {
      return await createLink(request, env, config);
    }
    
    if (pathname === '/api/list' && request.method === 'GET') {
      return await listLinks(env);
    }
    
    if (pathname.startsWith('/api/delete/') && request.method === 'DELETE') {
      const subdomain = pathname.split('/').pop();
      return await deleteLink(env, subdomain);
    }
    
    if (pathname === '/api/stats' && request.method === 'GET') {
      return await getStats(env);
    }
    
    // Endpoint tidak ditemukan
    return jsonResponse({ success: false, error: 'Not found' }, 404);
    
  } catch (error) {
    console.error('API error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Create new link - Handler untuk POST /api/create
 */
async function createLink(request, env, config) {
  // Parse body request
  const body = await request.json();
  
  // Validasi input wajib
  if (!body.title || !body.title.trim()) {
    return jsonResponse({ success: false, error: 'Judul wajib diisi' }, 400);
  }
  
  if (!body.targetUrl || !isValidUrl(body.targetUrl)) {
    return jsonResponse({ success: false, error: 'URL tujuan tidak valid' }, 400);
  }
  
  // Pilih domain (jika user pilih specific domain, atau random dari available)
  const selectedDomain = body.domain || config.domains[0];
  
  // Generate atau gunakan custom subdomain
  let subdomain = body.customCode ? sanitizeCode(body.customCode) : generateRandomCode(8);
  
  // Cek apakah subdomain sudah ada (prevent collision)
  const existing = await env.LINKS_DB.get(`link:${subdomain}`);
  if (existing) {
    return jsonResponse({ 
      success: false, 
      error: 'Kode sudah digunakan, coba yang lain' 
    }, 409);
  }
  
  // Siapkan data link
  const linkData = {
    id: generateUUID(),
    subdomain: subdomain,
    domain: selectedDomain,
    title: body.title.trim(),
    description: (body.description || '').trim(),
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl.trim(),
    clicks: 0,
    createdAt: new Date().toISOString(),
    createdBy: request.headers.get('CF-Connecting-IP') || 'unknown'
  };
  
  // Simpan ke KV storage
  await env.LINKS_DB.put(`link:${subdomain}`, JSON.stringify(linkData));
  
  // Generate full URL
  const shortUrl = `https://${subdomain}.${selectedDomain}`;
  
  // Return success response
  return jsonResponse({
    success: true,
    data: {
      ...linkData,
      shortUrl: shortUrl
    }
  });
}

/**
 * List semua links yang tersimpan
 */
async function listLinks(env) {
  // List semua keys dengan prefix 'link:'
  const list = await env.LINKS_DB.list({ prefix: 'link:' });
  const links = [];
  
  // Ambil detail setiap link
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) {
      links.push(JSON.parse(data));
    }
  }
  
  // Sort by created date (terbaru dulu)
  links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return jsonResponse({ success: true, data: links });
}

/**
 * Delete link berdasarkan subdomain
 */
async function deleteLink(env, subdomain) {
  const key = `link:${subdomain}`;
  
  // Cek apakah exists
  const exists = await env.LINKS_DB.get(key);
  if (!exists) {
    return jsonResponse({ success: false, error: 'Link tidak ditemukan' }, 404);
  }
  
  // Delete dari KV
  await env.LINKS_DB.delete(key);
  
  return jsonResponse({ success: true, message: 'Link berhasil dihapus' });
}

/**
 * Get statistics (total links, total clicks, dll)
 */
async function getStats(env) {
  const list = await env.LINKS_DB.list({ prefix: 'link:' });
  let totalClicks = 0;
  const totalLinks = list.keys.length;
  
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) {
      const link = JSON.parse(data);
      totalClicks += link.clicks || 0;
    }
  }
  
  return jsonResponse({
    success: true,
    data: { totalLinks, totalClicks }
  });
}

/**
 * Update statistik klik (background task)
 */
async function updateClickStats(env, key, linkData) {
  try {
    linkData.clicks = (linkData.clicks || 0) + 1;
    linkData.lastClicked = new Date().toISOString();
    await env.LINKS_DB.put(key, JSON.stringify(linkData));
  } catch (e) {
    console.error('Stats update error:', e);
  }
}

/**
 * Cek autentikasi berdasarkan header Authorization
 */
function checkAuth(request, config) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${config.adminKey}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    return { success: false };
  }
  return { success: true };
}

/**
 * Deteksi Facebook Bot berdasarkan User-Agent
 */
function detectFacebookBot(userAgent) {
  const bots = [
    'facebookexternalhit',
    'Facebot',
    'WhatsApp',
    'MetaInspector',
    'LinkedInBot',
    'TwitterBot',
    'TelegramBot'
  ];
  
  const ua = userAgent.toLowerCase();
  return bots.some(bot => ua.includes(bot.toLowerCase()));
}

/**
 * Generate HTML untuk Facebook OG Tags (Open Graph)
 */
function generateOgPage(data, config) {
  const currentUrl = `https://${data.subdomain}.${data.domain}`;
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.title)}</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${currentUrl}">
<meta property="og:title" content="${escapeHtml(data.title)}">
<meta property="og:description" content="${escapeHtml(data.description)}">
<meta property="og:image" content="${data.imageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${escapeHtml(data.domain)}">
<meta http-equiv="refresh" content="3;url=${data.targetUrl}">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:500px;width:100%;overflow:hidden}
.image-container{width:100%;height:300px;background:#f0f2f5;position:relative}
.image-container img{width:100%;height:100%;object-fit:cover}
.content{padding:30px;text-align:center}
h1{color:#1c1e21;font-size:24px;margin-bottom:12px;line-height:1.3}
p{color:#65676b;font-size:16px;line-height:1.5;margin-bottom:24px}
.loader{width:50px;height:50px;border:4px solid #f3f3f3;border-top:4px solid #1877f2;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.redirect-text{color:#999;font-size:14px;margin-bottom:16px}
.btn{display:inline-block;background:#1877f2;color:white;padding:12px 30px;border-radius:25px;text-decoration:none;font-weight:600;transition:transform 0.2s}
.btn:hover{transform:translateY(-2px)}
</style>
</head>
<body>
<div class="container">
<div class="image-container">
<img src="${data.imageUrl}" alt="Preview" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:18px\'>Preview Image</div>'">
</div>
<div class="content">
<h1>${escapeHtml(data.title)}</h1>
<p>${escapeHtml(data.description)}</p>
<div class="loader"></div>
<p class="redirect-text">Mengalihkan ke halaman penawaran...</p>
<a href="${data.targetUrl}" class="btn">Klik jika tidak otomatis</a>
</div>
</div>
</body>
</html>`;
}

/**
 * Generate 404 page jika link tidak ditemukan
 */
function generateNotFoundPage(subdomain) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Link Not Found</title>
<style>
body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{background:white;padding:40px;border-radius:8px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.1)}
h1{color:#ff4444;font-size:48px;margin:0}
p{color:#666;margin:20px 0}
.code{font-family:monospace;background:#f0f0f0;padding:5px 10px;border-radius:4px}
</style>
</head>
<body>
<div class="box">
<h1>404</h1>
<p>Link dengan kode <span class="code">${subdomain}</span> tidak ditemukan</p>
<p>Link mungkin sudah dihapus atau belum dibuat</p>
</div>
</body>
</html>`;
}

/**
 * Helper: Validasi URL format
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Helper: Sanitize custom code (hanya alphanumeric dan dash)
 */
function sanitizeCode(code) {
  return code.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 20);
}

/**
 * Helper: Generate random code
 */
function generateRandomCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Helper: Generate UUID sederhana
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Helper: Escape HTML untuk prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper: JSON response wrapper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
