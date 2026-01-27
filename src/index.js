export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      
      // Config
      const DOMAIN = env.DOMAIN || 'miuzy.web.id';
      const ADMIN_KEY = env.ADMIN_KEY || 'admin';
      
      console.log('Access:', hostname, url.pathname);
      
      // Cek apakah ini subdomain (bukan domain utama)
      const isSubdomain = hostname.includes('.') && 
                         hostname !== DOMAIN && 
                         !hostname.startsWith('www.') &&
                         hostname.endsWith('.' + DOMAIN);
      
      // Jika subdomain, handle redirect
      if (isSubdomain) {
        const sub = hostname.split('.')[0];
        console.log('Subdomain detected:', sub);
        return await handleRedirect(request, env, sub, ctx);
      }
      
      // API Routes untuk dashboard
      if (url.pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== 'Bearer ' + ADMIN_KEY) {
          return json({error: 'Unauthorized'}, 401);
        }
        
        if (url.pathname === '/api/create' && request.method === 'POST') {
          return handleCreate(request, env, DOMAIN);
        }
        if (url.pathname === '/api/list') {
          return handleList(env);
        }
        if (url.pathname.startsWith('/api/delete/')) {
          return handleDelete(env, url.pathname.split('/').pop());
        }
      }
      
      // Dashboard UI
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(getDashboardHTML(DOMAIN), {
          headers: {'Content-Type': 'text/html'}
        });
      }
      
      return new Response('Not Found', {status: 404});
      
    } catch (err) {
      console.error('Worker Error:', err);
      return new Response('Error: ' + err.message, {status: 500});
    }
  }
};

async function handleRedirect(req, env, sub, ctx) {
  try {
    const data = await env.LINKS_DB.get('link:' + sub);
    
    if (!data) {
      return new Response('<h1>Link tidak ditemukan</h1><p>Subdomain: ' + sub + '</p>', {
        status: 404,
        headers: {'Content-Type': 'text/html'}
      });
    }
    
    const link = JSON.parse(data);
    const ua = req.headers.get('User-Agent') || '';
    
    // Deteksi Facebook Crawler (lebih lengkap dan case-insensitive)
    const isFB = /facebook|facebot|facebookexternalhit|fb_iab|fban|messenger/i.test(ua);
    
    // Update stats (async)
    ctx.waitUntil(updateStats(env, sub));
    
    if (isFB) {
      // Return HTML dengan OG Tags lengkap untuk Facebook
      return new Response(getOgHTML(link, req.url), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // Redirect untuk user biasa dengan delay 1 detik
    return new Response(getRedirectHTML(link.targetUrl), {
      headers: {'Content-Type': 'text/html; charset=utf-8'}
    });
    
  } catch (err) {
    return new Response('Error: ' + err.message, {status: 500});
  }
}

// HTML khusus untuk redirect dengan delay
function getRedirectHTML(targetUrl) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="1;url=${targetUrl}">
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .box {
      background: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1877f2;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    a {
      color: #1877f2;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>Redirecting...</h2>
    <p>Anda akan dialihkan dalam 1 detik</p>
    <p><a href="${targetUrl}">Klik di sini jika tidak otomatis dialihkan</a></p>
  </div>
</body>
</html>`;
}

// HTML untuk Facebook dengan OG tags yang lebih lengkap
function getOgHTML(data, requestUrl) {
  let imageUrl = data.imageUrl || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = 'https://' + imageUrl;
  }
  
  // Pastikan imageUrl valid untuk Facebook
  if (!imageUrl || imageUrl === 'https://') {
    imageUrl = 'https://via.placeholder.com/1200x630/1877f2/ffffff?text=Link+Share';
  }
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${requestUrl}">
  <meta property="og:title" content="${escapeHtml(data.title)}">
  <meta property="og:description" content="${escapeHtml(data.description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(data.title)}">
  <meta property="og:site_name" content="Link Share">
  <meta property="og:locale" content="id_ID">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${requestUrl}">
  <meta name="twitter:title" content="${escapeHtml(data.title)}">
  <meta name="twitter:description" content="${escapeHtml(data.description)}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(data.title)}">
  
  <!-- Basic Meta -->
  <meta name="description" content="${escapeHtml(data.description)}">
  <meta name="theme-color" content="#1877f2">
  
  <!-- Redirect untuk user biasa (fallback) -->
  <meta http-equiv="refresh" content="2;url=${data.targetUrl}">
  
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .box {
      background: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .box img {
      max-width: 100%;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .box h2 {
      color: #1d2129;
      margin: 0 0 10px;
    }
    .box p {
      color: #606770;
      margin: 0 0 15px;
    }
    .box a {
      color: #1877f2;
      text-decoration: none;
      font-weight: bold;
      display: inline-block;
      padding: 10px 20px;
      background: #e7f3ff;
      border-radius: 4px;
    }
    .box a:hover {
      background: #dbe7f2;
    }
  </style>
</head>
<body>
  <div class="box">
    <img src="${imageUrl}" alt="${escapeHtml(data.title)}" onerror="this.style.display='none'">
    <h2>${escapeHtml(data.title)}</h2>
    <p>${escapeHtml(data.description)}</p>
    <a href="${data.targetUrl}">Klik untuk melanjutkan →</a>
  </div>
</body>
</html>`;
}

async function handleCreate(req, env, domain) {
  const body = await req.json();
  const sub = body.customCode || Math.random().toString(36).substring(2, 10);
  
  if (await env.LINKS_DB.get('link:' + sub)) {
    return json({error: 'Code already exists'}, 409);
  }
  
  const data = {
    subdomain: sub,
    title: body.title,
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl,
    clicks: 0,
    createdAt: new Date().toISOString()
  };
  
  await env.LINKS_DB.put('link:' + sub, JSON.stringify(data));
  return json({success: true, data: {...data, shortUrl: 'https://' + sub + '.' + domain}});
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
  try {
    const data = await env.LINKS_DB.get('link:' + sub);
    if (data) {
      const obj = JSON.parse(data);
      obj.clicks = (obj.clicks || 0) + 1;
      await env.LINKS_DB.put('link:' + sub, JSON.stringify(obj));
    }
  } catch (e) {
    console.error('Stats update error:', e);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {'Content-Type': 'application/json'}
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDashboardHTML(domain) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Generator - ${domain}</title>
<style>
body{font-family:Arial,sans-serif;background:#f0f2f5;padding:20px;max-width:800px;margin:0 auto}
.card{background:white;padding:20px;border-radius:8px;margin-bottom:15px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
h1{color:#1877f2;text-align:center}
input,textarea,select{width:100%;padding:10px;margin:5px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}
textarea{height:80px}
button{background:#1877f2;color:white;border:none;padding:12px;border-radius:4px;cursor:pointer;width:100%;font-size:16px}
button:hover{background:#166fe5}
.result{display:none;background:#e7f3ff;padding:15px;margin-top:10px;border-radius:4px;border-left:4px solid #1877f2}
.link-box{background:white;padding:10px;border:1px solid #ddd;margin:10px 0;font-family:monospace;word-break:break-all}
.link-item{border:1px solid #ddd;padding:10px;margin-bottom:10px;border-radius:4px;background:white}
.badge{background:#e3f2fd;color:#1976d2;padding:2px 8px;border-radius:4px;font-size:12px}
.delete-btn{background:#ff4444;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;float:right}
.login-box{max-width:400px;margin:100px auto}
#dashboard{display:none}
.fb-preview-container{margin-top:20px;padding:15px;background:#f5f6f7;border-radius:8px;border:1px solid #dddfe2}
.fb-preview-header{font-size:12px;color:#606770;margin-bottom:8px;font-weight:600;text-transform:uppercase}
.fb-preview-card{background:white;border:1px solid #dadde1;max-width:500px}
.fb-preview-image{width:100%;height:261px;background:#f0f2f5;background-size:cover;background-position:center;border-bottom:1px solid #dadde1;display:flex;align-items:center;justify-content:center;color:#65676b}
.fb-preview-content{padding:10px 12px}
.fb-preview-domain{font-size:12px;color:#606770;text-transform:uppercase}
.fb-preview-title{font-size:16px;color:#1d2129;font-weight:600;margin-bottom:3px}
.fb-preview-desc{font-size:14px;color:#606770;margin-top:4px}
.preview-label{display:block;margin-bottom:5px;color:#444;font-weight:600;font-size:14px}
.helper-text{font-size:12px;color:#666;margin-top:2px;margin-bottom:8px}
</style>
</head>
<body>

<div id="login" class="card login-box">
<h2>Login Dashboard</h2>
<p style="color:#666;text-align:center">Masukkan password</p>
<input type="password" id="pwd" placeholder="Password">
<button onclick="doLogin()">Login</button>
</div>

<div id="dashboard">
<h1>FB Link Generator</h1>

<div class="card">
<h3>Buat Link Baru</h3>

<label class="preview-label">Judul FB</label>
<input type="text" id="title" placeholder="Contoh: Diskon 50%" oninput="updatePreview()">
<div class="helper-text">Maksimal 60-80 karakter</div>

<label class="preview-label">Deskripsi</label>
<textarea id="desc" placeholder="Deskripsi singkat..." oninput="updatePreview()"></textarea>

<label class="preview-label">URL Gambar</label>
<input type="url" id="img" placeholder="https://site.com/img.jpg" oninput="updatePreview()">
<div class="helper-text">Ukuran ideal: 1200 x 630 pixel</div>

<label class="preview-label">URL Tujuan</label>
<input type="url" id="target" placeholder="https://offer.com/lp">

<label class="preview-label">Kode Custom (Opsional)</label>
<input type="text" id="code" placeholder="PROMO50">

<div class="fb-preview-container">
<div class="fb-preview-header">Preview Facebook</div>
<div class="fb-preview-card">
<div id="preview-image" class="fb-preview-image">Preview Gambar</div>
<div class="fb-preview-content">
<div id="preview-domain" class="fb-preview-domain">${domain}</div>
<div id="preview-title" class="fb-preview-title">Judul akan muncul di sini...</div>
<div id="preview-desc" class="fb-preview-desc">Deskripsi akan muncul di sini...</div>
</div>
</div>
</div>

<button onclick="createLink()" style="margin-top:20px">Generate Link</button>

<div id="res" class="result">
<strong style="color:#1877f2">Link Berhasil!</strong>
<div id="link" class="link-box"></div>
<button onclick="copyLink()" style="background:#42b72a;margin-top:5px">Copy Link</button>
</div>
</div>

<div class="card">
<h3>Link Aktif</h3>
<div id="list">Memuat...</div>
</div>

</div>

<script>
var key=localStorage.getItem("k");
if(key){
  document.getElementById("login").style.display="none";
  document.getElementById("dashboard").style.display="block";
  loadList();
  updatePreview();
}

function doLogin(){
  var p=document.getElementById("pwd").value;
  localStorage.setItem("k",p);
  location.reload();
}

function updatePreview(){
  var title=document.getElementById("title").value||"Judul akan muncul di sini...";
  var desc=document.getElementById("desc").value||"Deskripsi akan muncul di sini...";
  var img=document.getElementById("img").value;
  
  document.getElementById("preview-title").innerText=title;
  document.getElementById("preview-desc").innerText=desc;
  
  var imgDiv=document.getElementById("preview-image");
  if(img){
    imgDiv.style.backgroundImage="url("+img+")";
    imgDiv.innerText="";
  }else{
    imgDiv.style.backgroundImage="";
    imgDiv.innerText="Preview Gambar (1200x630)";
  }
}

function createLink(){
  var btn=document.querySelector("button");
  btn.innerText="Generating...";
  var body={};
  body.title=document.getElementById("title").value;
  body.description=document.getElementById("desc").value;
  body.imageUrl=document.getElementById("img").value;
  body.targetUrl=document.getElementById("target").value;
  body.customCode=document.getElementById("code").value;
  
  fetch("/api/create",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify(body)
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.success){
      document.getElementById("link").innerText=d.data.shortUrl;
      document.getElementById("res").style.display="block";
      loadList();
      document.getElementById("title").value="";
      document.getElementById("desc").value="";
      document.getElementById("img").value="";
      document.getElementById("target").value="";
      document.getElementById("code").value="";
      updatePreview();
    }else{
      alert("Error: "+d.error);
    }
    btn.innerText="Generate Link";
  });
}

function copyLink(){
  var url=document.getElementById("link").innerText;
  navigator.clipboard.writeText(url).then(function(){alert("Link dicopy!");});
}

function loadList(){
  fetch("/api/list",{headers:{"Authorization":"Bearer "+key}})
  .then(function(r){return r.json();})
  .then(function(d){
    var html="";
    if(d.data.length==0){
      html="<p>Belum ada link</p>";
    }else{
      for(var i=0;i<d.data.length;i++){
        var l=d.data[i];
        html+='<div class="link-item">';
        html+='<div style="font-weight:bold">'+l.title+'</div>';
        html+='<div style="font-size:12px;color:#666;margin-top:5px">';
        html+='<span class="badge">'+(l.clicks||0)+' klik</span> ';
        html+=l.subdomain;
        html+=' <button class="delete-btn" onclick="del(\\''+l.subdomain+'\\')">Hapus</button>';
        html+='</div>';
        html+='</div>';
      }
    }
    document.getElementById("list").innerHTML=html;
  });
}

function del(sub){
  if(!confirm("Hapus link ini?"))return;
  fetch("/api/delete/"+sub,{method:"DELETE",headers:{"Authorization":"Bearer "+key}})
  .then(function(){loadList();});
}
</script>

</body>
</html>`;
             }
