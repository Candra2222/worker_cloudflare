/**
 * WORKER ENTRY POINT - FB Link Generator
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Config
    const DOMAIN = env.DOMAIN || 'localhost';
    const ADMIN_KEY = env.ADMIN_KEY || 'admin';
    const domains = DOMAIN.split(',').map(d => d.trim());
    
    // Cek subdomain
    const isSubdomain = hostname.includes('.') && 
                       !hostname.startsWith('www.') && 
                       !hostname.includes('workers.dev') &&
                       !domains.includes(hostname);
    
    if (isSubdomain) {
      const sub = hostname.split('.')[0];
      return handleRedirect(request, env, sub, ctx);
    }
    
    // API Routes
    if (url.pathname.startsWith('/api/')) {
      const auth = request.headers.get('Authorization');
      if (auth !== 'Bearer ' + ADMIN_KEY) {
        return json({error: 'Unauthorized'}, 401);
      }
      
      if (url.pathname === '/api/create' && request.method === 'POST') {
        return handleCreate(request, env, domains[0]);
      }
      if (url.pathname === '/api/list') {
        return handleList(env);
      }
      if (url.pathname.startsWith('/api/delete/')) {
        return handleDelete(env, url.pathname.split('/').pop());
      }
    }
    
    // Dashboard UI
    return new Response(getDashboardHTML(domains), {
      headers: {'Content-Type': 'text/html'}
    });
  }
};

async function handleRedirect(req, env, sub, ctx) {
  const data = await env.LINKS_DB.get('link:' + sub);
  if (!data) return new Response('Not found', {status: 404});
  
  const link = JSON.parse(data);
  const ua = req.headers.get('User-Agent') || '';
  const isFB = ua.includes('facebook') || ua.includes('Facebot');
  
  ctx.waitUntil(updateStats(env, sub));
  
  if (isFB) {
    return new Response(getOgHTML(link), {headers: {'Content-Type': 'text/html'}});
  }
  return Response.redirect(link.targetUrl, 302);
}

async function handleCreate(req, env, defaultDomain) {
  const body = await req.json();
  const sub = body.customCode || Math.random().toString(36).substring(2, 10);
  
  if (await env.LINKS_DB.get('link:' + sub)) {
    return json({error: 'Exists'}, 409);
  }
  
  const data = {
    subdomain: sub,
    title: body.title,
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl,
    domain: body.domain || defaultDomain,
    clicks: 0,
    createdAt: new Date().toISOString()
  };
  
  await env.LINKS_DB.put('link:' + sub, JSON.stringify(data));
  return json({success: true, data: {...data, shortUrl: 'https://' + sub + '.' + data.domain}});
}

async function handleList(env) {
  const list = await env.LINKS_DB.list({prefix: 'link:'});
  const links = [];
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) links.push(JSON.parse(data));
  }
  return json({success: true, data: links});
}

async function handleDelete(env, sub) {
  await env.LINKS_DB.delete('link:' + sub);
  return json({success: true});
}

async function updateStats(env, sub) {
  const data = await env.LINKS_DB.get('link:' + sub);
  if (data) {
    const obj = JSON.parse(data);
    obj.clicks = (obj.clicks || 0) + 1;
    await env.LINKS_DB.put('link:' + sub, JSON.stringify(obj));
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {'Content-Type': 'application/json'}
  });
}

function getOgHTML(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + data.title + '</title><meta property="og:title" content="' + data.title + '"><meta property="og:description" content="' + data.description + '"><meta property="og:image" content="' + data.imageUrl + '"><meta http-equiv="refresh" content="2;url=' + data.targetUrl + '"></head><body style="font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><div style="background:white;padding:30px;border-radius:8px;text-align:center;max-width:400px"><img src="' + data.imageUrl + '" style="width:100%;border-radius:4px;margin-bottom:15px" onerror="this.style.display=\'none\'"><h2>' + data.title + '</h2><p>' + data.description + '</p><p>Redirecting...</p></div></body></html>';
}

/**
 * DASHBOARD HTML - Versi sederhana tanpa syntax error
 */
function getDashboardHTML(domains) {
  const domainOptions = domains.map(d => '<option value="' + d + '">' + d + '</option>').join('');
  
  return '<!DOCTYPE html>' +
'<html lang="id">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Link Generator</title>' +
'<style>' +
'body{font-family:Arial,sans-serif;background:#f0f2f5;padding:20px;max-width:600px;margin:0 auto}' +
'.card{background:white;padding:20px;border-radius:8px;margin-bottom:15px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}' +
'h1{color:#1877f2;text-align:center}' +
'input,textarea,select{width:100%;padding:10px;margin:5px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}' +
'textarea{height:80px}' +
'button{background:#1877f2;color:white;border:none;padding:12px;border-radius:4px;cursor:pointer;width:100%;font-size:16px}' +
'button:hover{background:#166fe5}' +
'.result{display:none;background:#e7f3ff;padding:15px;margin-top:10px;border-radius:4px;border-left:4px solid #1877f2}' +
'.link-box{background:white;padding:10px;border:1px solid #ddd;margin:10px 0;font-family:monospace;word-break:break-all}' +
'.link-item{border:1px solid #ddd;padding:10px;margin-bottom:10px;border-radius:4px;background:white}' +
'.badge{background:#e3f2fd;color:#1976d2;padding:2px 8px;border-radius:4px;font-size:12px}' +
'.delete-btn{background:#ff4444;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;float:right}' +
'.login-box{max-width:400px;margin:100px auto}' +
'#dashboard{display:none}' +
'</style>' +
'</head>' +
'<body>' +

// Login Section
'<div id="login" class="card login-box">' +
'<h2>Login Dashboard</h2>' +
'<p style="color:#666;text-align:center">Masukkan password untuk melanjutkan</p>' +
'<input type="password" id="pwd" placeholder="Password">' +
'<button onclick="doLogin()">Login</button>' +
'<p id="err" style="color:red;display:none;text-align:center;margin-top:10px">Password salah!</p>' +
'</div>' +

// Dashboard Section
'<div id="dashboard">' +
'<h1>FB Link Generator</h1>' +

// Form Card
'<div class="card">' +
'<h3>Buat Link Baru</h3>' +

(domains.length > 1 ? 
'<label>Pilih Domain</label><select id="domain">' + domainOptions + '</select>' : 
'<input type="hidden" id="domain" value="' + domains[0] + '">') +

'<label>Judul FB</label>' +
'<input type="text" id="title" placeholder="Contoh: Diskon 50%">' +

'<label>Deskripsi</label>' +
'<textarea id="desc" placeholder="Deskripsi singkat..."></textarea>' +

'<label>URL Gambar</label>' +
'<input type="url" id="img" placeholder="https://site.com/img.jpg">' +

'<label>URL Tujuan</label>' +
'<input type="url" id="target" placeholder="https://offer.com/lp">' +

'<label>Kode Custom (Opsional)</label>' +
'<input type="text" id="code" placeholder="PROMO50">' +

'<button onclick="createLink()">Generate Link</button>' +

// Result
'<div id="res" class="result">' +
'<strong style="color:#1877f2">Link Berhasil!</strong>' +
'<div id="link" class="link-box"></div>' +
'<button onclick="copyLink()" style="background:#42b72a;margin-top:5px">Copy Link</button>' +
'</div>' +
'</div>' +

// List Card
'<div class="card">' +
'<h3>Link Aktif</h3>' +
'<div id="list">Memuat...</div>' +
'</div>' +

'</div>' +

// JavaScript - Sangat sederhana, tidak pakai template string atau backtick
'<script>' +
// Check login status
'var key=localStorage.getItem("k");' +
'if(key){' +
'  document.getElementById("login").style.display="none";' +
'  document.getElementById("dashboard").style.display="block";' +
'  loadList();' +
'}' +

// Login function
'function doLogin(){' +
'  var p=document.getElementById("pwd").value;' +
'  localStorage.setItem("k",p);' +
'  location.reload();' +
'}' +

// Create link
'function createLink(){' +
'  var btn=document.querySelector("button");' +
'  btn.innerText="Generating...";' +
'  var body={};' +
'  body.title=document.getElementById("title").value;' +
'  body.description=document.getElementById("desc").value;' +
'  body.imageUrl=document.getElementById("img").value;' +
'  body.targetUrl=document.getElementById("target").value;' +
'  body.customCode=document.getElementById("code").value;' +
'  body.domain=document.getElementById("domain").value;' +
'  ' +
'  fetch("/api/create",{' +
'    method:"POST",' +
'    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},' +
'    body:JSON.stringify(body)' +
'  })' +
'  .then(function(r){return r.json();})' +
'  .then(function(d){' +
'    if(d.success){' +
'      document.getElementById("link").innerText=d.data.shortUrl;' +
'      document.getElementById("res").style.display="block";' +
'      loadList();' +
'      document.getElementById("title").value="";' +
'      document.getElementById("desc").value="";' +
'      document.getElementById("img").value="";' +
'      document.getElementById("target").value="";' +
'      document.getElementById("code").value="";' +
'    }else{' +
'      alert("Error: "+d.error);' +
'    }' +
'    btn.innerText="Generate Link";' +
'  });' +
'}' +

// Copy link
'function copyLink(){' +
'  var url=document.getElementById("link").innerText;' +
'  navigator.clipboard.writeText(url).then(function(){alert("Link dicopy!");});' +
'}' +

// Load list
'function loadList(){' +
'  fetch("/api/list",{headers:{"Authorization":"Bearer "+key}})' +
'  .then(function(r){return r.json();})' +
'  .then(function(d){' +
'    var html="";' +
'    if(d.data.length==0){' +
'      html="<p>Belum ada link</p>";' +
'    }else{' +
'      for(var i=0;i<d.data.length;i++){' +
'        var l=d.data[i];' +
'        html+=\'<div class="link-item">\';' +
'        html+=\'<div style="font-weight:bold">\'+l.title+\'</div>\';' +
'        html+=\'<div style="font-size:12px;color:#666;margin-top:5px">\';' +
'        html+=\'<span class="badge">\'+(l.clicks||0)+\' klik</span> \';' +
'        html+=l.subdomain;' +
'        html+=\' <button class="delete-btn" onclick="del(\\\'\'+l.subdomain+\'\\\')">Hapus</button>\';' +
'        html+=\'</div>\';' +
'        html+=\'</div>\';' +
'      }' +
'    }' +
'    document.getElementById("list").innerHTML=html;' +
'  });' +
'}' +

// Delete
'function del(sub){' +
'  if(!confirm("Hapus link ini?"))return;' +
'  fetch("/api/delete/"+sub,{method:"DELETE",headers:{"Authorization":"Bearer "+key}})' +
'  .then(function(){loadList();});' +
'}' +
'</script>' +

'</body>' +
'</html>';
}
