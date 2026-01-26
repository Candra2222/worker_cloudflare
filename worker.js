// ==========================================
// KONFIGURASI - EDIT DI SINI SAJA
// ==========================================
const DOMAIN = 'domainanda.com';      // GANTI: Domain Anda
const ADMIN_KEY = 'admin123';         // GANTI: Password dashboard
const KV_NAME = 'LINKS_DB';           // GANTI: Nama KV (jika berbeda)

// ==========================================
// DASHBOARD HTML (SIMPLE STRING)
// ==========================================
const DASHBOARD_HTML = '<!DOCTYPE html>' +
'<html lang="id">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Link Generator</title>' +
'<style>' +
'*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif}' +
'body{background:#f0f2f5;padding:10px}' +
'.container{max-width:600px;margin:0 auto}' +
'.card{background:#fff;border-radius:8px;padding:15px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}' +
'h1{color:#333;font-size:20px;margin-bottom:15px;text-align:center}' +
'h2{font-size:16px;margin-bottom:10px}' +
'.form-group{margin-bottom:12px}' +
'label{display:block;margin-bottom:5px;font-size:14px;font-weight:bold;color:#555}' +
'input,textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px}' +
'textarea{height:60px}' +
'button{background:#1877f2;color:#fff;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;width:100%;font-size:16px}' +
'button:active{background:#166fe5}' +
'.result{display:none;margin-top:15px;padding:10px;background:#e7f3ff;border-left:4px solid #1877f2}' +
'.link-box{background:#fff;padding:8px;border:1px solid #ddd;margin:8px 0;font-family:monospace;font-size:13px;word-break:break-all}' +
'.copy-btn{background:#42b72a;margin-top:5px}' +
'.link-item{border:1px solid #e1e8ed;padding:10px;margin-bottom:8px;background:#fff;border-radius:4px}' +
'.badge{background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:3px;font-size:12px}' +
'.delete-btn{background:#ff4444;color:#fff;border:none;padding:4px 8px;border-radius:3px;float:right;cursor:pointer}' +
'.preview{border:1px solid #dddfe2;border-radius:4px;overflow:hidden;margin-top:10px}' +
'.preview img{width:100%;height:150px;object-fit:cover;background:#f0f2f5}' +
'.preview-content{padding:8px}' +
'.preview-domain{color:#65676b;font-size:11px}' +
'.preview-title{font-weight:bold;margin-top:4px}' +
'.preview-desc{color:#65676b;font-size:13px;margin-top:2px}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="container">' +
'<h1>FB Link Generator</h1>' +
'<div id="loginSection" class="card">' +
'<h2>Login</h2>' +
'<div class="form-group">' +
'<label>Password</label>' +
'<input type="password" id="loginKey" placeholder="Masukkan password">' +
'</div>' +
'<button onclick="login()">Login</button>' +
'</div>' +
'<div id="dashboardSection" style="display:none">' +
'<div class="card">' +
'<h2>Buat Link Baru</h2>' +
'<form id="createForm" onsubmit="createLink(event)">' +
'<div class="form-group">' +
'<label>Judul FB</label>' +
'<input type="text" id="title" required placeholder="Contoh: Diskon 50%">' +
'</div>' +
'<div class="form-group">' +
'<label>Deskripsi</label>' +
'<textarea id="description" placeholder="Deskripsi singkat"></textarea>' +
'</div>' +
'<div class="form-group">' +
'<label>URL Gambar</label>' +
'<input type="url" id="imageUrl" placeholder="https://site.com/gambar.jpg">' +
'</div>' +
'<div class="form-group">' +
'<label>URL Tujuan (Offer)</label>' +
'<input type="url" id="targetUrl" required placeholder="https://offer.com/lp">' +
'</div>' +
'<div class="form-group">' +
'<label>Kode Custom (Opsional)</label>' +
'<input type="text" id="customCode" placeholder="PROMO50">' +
'</div>' +
'<button type="submit">Generate Link</button>' +
'</form>' +
'<div id="result" class="result">' +
'<strong>Link Berhasil!</strong>' +
'<div class="link-box" id="generatedUrl"></div>' +
'<button class="copy-btn" onclick="copyLink()">Copy Link</button>' +
'<div class="preview">' +
'<img id="prevImg" src="" onerror="this.style.display=\'none\'">' +
'<div class="preview-content">' +
'<div class="preview-domain" id="prevDomain"></div>' +
'<div class="preview-title" id="prevTitle"></div>' +
'<div class="preview-desc" id="prevDesc"></div>' +
'</div>' +
'</div>' +
'</div>' +
'</div>' +
'<div class="card">' +
'<h2>Link Aktif</h2>' +
'<div id="linksList">Memuat...</div>' +
'</div>' +
'</div>' +
'</div>' +
'<script>' +
'const API_KEY = localStorage.getItem("admin_key") || "";' +
'if(API_KEY){document.getElementById("loginSection").style.display="none";document.getElementById("dashboardSection").style.display="block";loadLinks();}' +
'function login(){const key=document.getElementById("loginKey").value;localStorage.setItem("admin_key",key);location.reload();}' +
'async function createLink(e){e.preventDefault();const btn=e.target.querySelector("button");btn.innerText="Generating...";btn.disabled=true;' +
'const data={title:document.getElementById("title").value,description:document.getElementById("description").value,imageUrl:document.getElementById("imageUrl").value,targetUrl:document.getElementById("targetUrl").value,customCode:document.getElementById("customCode").value};' +
'try{const res=await fetch("/api/create",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+API_KEY},body:JSON.stringify(data)});' +
'const result=await res.json();if(result.success){document.getElementById("generatedUrl").innerText=result.data.shortUrl;document.getElementById("prevDomain").innerText=location.hostname;document.getElementById("prevTitle").innerText=result.data.title;document.getElementById("prevDesc").innerText=result.data.description;document.getElementById("prevImg").src=result.data.imageUrl;document.getElementById("result").style.display="block";document.getElementById("createForm").reset();loadLinks();}else{alert("Error: "+result.error);}}catch(err){alert("Gagal membuat link");}finally{btn.innerText="Generate Link";btn.disabled=false;}}' +
'async function loadLinks(){try{const res=await fetch("/api/list",{headers:{"Authorization":"Bearer "+API_KEY}});const data=await res.json();if(!data.success){document.getElementById("loginSection").style.display="block";document.getElementById("dashboardSection").style.display="none";return;}' +
'const container=document.getElementById("linksList");if(data.data.length===0){container.innerHTML="<p>Belum ada link</p>";return;}' +
'container.innerHTML=data.data.map(link=>"<div class=\\"link-item\\"><div style=\\"display:flex;justify-content:space-between\\"><div><div style=\\"font-weight:bold\\">"+link.title+"</div><div style=\\"font-size:12px;color:#666;margin-top:4px\\"><span class=\\"badge\\">"+(link.clicks||0)+" klik</span> "+link.subdomain+"</div></div><button class=\\"delete-btn\\" onclick=\\"deleteLink(\'"+link.subdomain+"\')\\">Hapus</button></div></div>").join("");' +
'}catch(e){document.getElementById("linksList").innerHTML="<p>Gagal memuat data</p>";}}' +
'function deleteLink(subdomain){if(!confirm("Hapus link ini?"))return;fetch("/api/delete/"+subdomain,{method:"DELETE",headers:{"Authorization":"Bearer "+API_KEY}}).then(()=>loadLinks());}' +
'function copyLink(){const url=document.getElementById("generatedUrl").innerText;navigator.clipboard.writeText(url).then(()=>alert("Link dicopy!"));}' +
'</script>' +
'</body>' +
'</html>';

// ==========================================
// WORKER MAIN
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;
    
    // Cek subdomain
    const isSubdomain = hostname.includes('.') && !hostname.startsWith('www.') && !hostname.includes('workers.dev') && hostname !== DOMAIN;
    
    if (isSubdomain) {
      const subdomain = hostname.split('.')[0];
      return handleRedirect(request, env, subdomain, ctx);
    }
    
    // API Routes
    if (path.startsWith('/api/')) {
      const auth = request.headers.get('Authorization');
      if (auth !== 'Bearer ' + ADMIN_KEY) {
        return jsonResponse({success: false, error: 'Unauthorized'}, 401);
      }
      
      if (path === '/api/create' && request.method === 'POST') {
        return handleCreate(request, env);
      }
      
      if (path === '/api/list' && request.method === 'GET') {
        return handleList(env);
      }
      
      if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        const subdomain = path.split('/').pop();
        return handleDelete(env, subdomain);
      }
    }
    
    // Dashboard
    if (path === '/' || path === '/dashboard') {
      return new Response(DASHBOARD_HTML, {
        headers: {'Content-Type': 'text/html; charset=utf-8'}
      });
    }
    
    return new Response('Not Found', {status: 404});
  }
};

// ==========================================
// FUNCTIONS
// ==========================================
async function handleRedirect(request, env, subdomain, ctx) {
  try {
    const data = await env[KV_NAME].get('link:' + subdomain);
    
    if (!data) {
      return new Response('<h1>Link not found</h1>', {
        status: 404,
        headers: {'Content-Type': 'text/html'}
      });
    }
    
    const linkData = JSON.parse(data);
    const ua = request.headers.get('User-Agent') || '';
    const isFB = /facebookexternalhit|Facebot|WhatsApp|MetaInspector/i.test(ua);
    
    // Update stats (background)
    ctx.waitUntil(updateStats(env, subdomain));
    
    if (isFB) {
      return new Response(generateOgHtml(linkData), {
        headers: {'Content-Type': 'text/html; charset=utf-8'}
      });
    }
    
    return Response.redirect(linkData.targetUrl, 302);
    
  } catch (e) {
    return new Response('Error: ' + e.message, {status: 500});
  }
}

async function handleCreate(request, env) {
  try {
    const body = await request.json();
    
    if (!body.title || !body.targetUrl) {
      return jsonResponse({error: 'Title dan Target URL wajib diisi'}, 400);
    }
    
    const subdomain = body.customCode || generateCode(8);
    
    // Cek exists
    const exists = await env[KV_NAME].get('link:' + subdomain);
    if (exists) {
      return jsonResponse({error: 'Kode sudah digunakan'}, 409);
    }
    
    const linkData = {
      subdomain,
      title: body.title,
      description: body.description || '',
      imageUrl: body.imageUrl || '',
      targetUrl: body.targetUrl,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    
    await env[KV_NAME].put('link:' + subdomain, JSON.stringify(linkData));
    
    const shortUrl = 'https://' + subdomain + '.' + DOMAIN;
    
    return jsonResponse({
      success: true,
      data: Object.assign({}, linkData, {shortUrl})
    });
    
  } catch (e) {
    return jsonResponse({error: e.message}, 500);
  }
}

async function handleList(env) {
  try {
    const list = await env[KV_NAME].list({prefix: 'link:'});
    const links = [];
    
    for (const key of list.keys) {
      const data = await env[KV_NAME].get(key.name);
      if (data) links.push(JSON.parse(data));
    }
    
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return jsonResponse({success: true, data: links});
    
  } catch (e) {
    return jsonResponse({error: e.message}, 500);
  }
}

async function handleDelete(env, subdomain) {
  await env[KV_NAME].delete('link:' + subdomain);
  return jsonResponse({success: true});
}

function generateOgHtml(data) {
  const currentUrl = 'https://' + data.subdomain + '.' + DOMAIN;
  
  return '<!DOCTYPE html>' +
  '<html>' +
  '<head>' +
  '<meta charset="UTF-8">' +
  '<title>' + escapeHtml(data.title) + '</title>' +
  '<meta property="og:type" content="website">' +
  '<meta property="og:url" content="' + currentUrl + '">' +
  '<meta property="og:title" content="' + escapeHtml(data.title) + '">' +
  '<meta property="og:description" content="' + escapeHtml(data.description) + '">' +
  '<meta property="og:image" content="' + data.imageUrl + '">' +
  '<meta property="og:image:width" content="1200">' +
  '<meta property="og:image:height" content="630">' +
  '<meta http-equiv="refresh" content="3;url=' + data.targetUrl + '">' +
  '<style>' +
  'body{font-family:Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}' +
  '.box{background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;max-width:400px}' +
  'img{max-width:100%;border-radius:4px;margin-bottom:15px}' +
  'h2{margin:0 0 10px}' +
  'p{color:#666;margin-bottom:20px}' +
  '.loader{border:4px solid #f3f3f3;border-top:4px solid #1877f2;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 15px}' +
  '@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}' +
  'a{color:#1877f2}' +
  '</style>' +
  '</head>' +
  '<body>' +
  '<div class="box">' +
  '<img src="' + data.imageUrl + '" onerror="this.style.display=\'none\'">' +
  '<h2>' + escapeHtml(data.title) + '</h2>' +
  '<p>' + escapeHtml(data.description) + '</p>' +
  '<div class="loader"></div>' +
  '<p>Redirecting...</p>' +
  '<p><a href="' + data.targetUrl + '">Click if not automatic</a></p>' +
  '</div>' +
  '</body>' +
  '</html>';
}

function generateCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function updateStats(env, subdomain) {
  try {
    const key = 'link:' + subdomain;
    const data = await env[KV_NAME].get(key);
    if (data) {
      const obj = JSON.parse(data);
      obj.clicks = (obj.clicks || 0) + 1;
      obj.lastClick = new Date().toISOString();
      await env[KV_NAME].put(key, JSON.stringify(obj));
    }
  } catch(e) {}
}