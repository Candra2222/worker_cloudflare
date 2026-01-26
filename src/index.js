const DOMAIN = typeof DOMAIN !== 'undefined' ? DOMAIN : 'localhost';
const ADMIN_KEY = typeof ADMIN_KEY !== 'undefined' ? ADMIN_KEY : 'admin';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    if (hostname.includes('.') && !hostname.startsWith('www.') && !hostname.includes('workers.dev') && hostname !== DOMAIN) {
      const sub = hostname.split('.')[0];
      return handleRedirect(request, env, sub, ctx);
    }
    
    if (url.pathname.startsWith('/api/')) {
      const auth = request.headers.get('Authorization');
      if (auth !== 'Bearer ' + ADMIN_KEY) {
        return json({success: false, error: 'Unauthorized'}, 401);
      }
      
      if (url.pathname === '/api/create' && request.method === 'POST') {
        return handleCreate(request, env);
      }
      if (url.pathname === '/api/list') {
        return handleList(env);
      }
      if (url.pathname.startsWith('/api/delete/')) {
        return handleDelete(env, url.pathname.split('/').pop());
      }
    }
    
    return new Response(dashboardHTML(), {headers: {'Content-Type': 'text/html'}});
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
    return new Response(ogHTML(link), {headers: {'Content-Type': 'text/html'}});
  }
  return Response.redirect(link.targetUrl, 302);
}

async function handleCreate(req, env) {
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
    clicks: 0,
    createdAt: new Date().toISOString()
  };
  
  await env.LINKS_DB.put('link:' + sub, JSON.stringify(data));
  return json({success: true, data: {...data, shortUrl: 'https://' + sub + '.' + DOMAIN}});
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

function ogHTML(data) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${data.title}</title>
<meta property="og:title" content="${data.title}">
<meta property="og:description" content="${data.description}">
<meta property="og:image" content="${data.imageUrl}">
<meta http-equiv="refresh" content="2;url=${data.targetUrl}">
<style>
body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.box{background:white;padding:30px;border-radius:8px;text-align:center;max-width:400px}
img{width:100%;border-radius:4px;margin-bottom:15px}
.loader{border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px auto}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="box">
<img src="${data.imageUrl}" onerror="this.style.display='none'">
<h2>${data.title}</h2>
<p>${data.description}</p>
<div class="loader"></div>
<p>Redirecting...</p>
</div>
</body>
</html>`;
}

function dashboardHTML() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Generator</title>
<style>
body{font-family:Arial,sans-serif;background:#f0f2f5;padding:20px;max-width:600px;margin:0 auto}
.card{background:white;padding:20px;border-radius:8px;margin-bottom:15px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
input,textarea{width:100%;padding:10px;margin:5px 0;border:1px solid #ddd;border-radius:4px}
button{background:#1877f2;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;width:100%}
.result{background:#e7f3ff;padding:15px;margin-top:10px;border-radius:4px;display:none}
.link-box{background:white;padding:10px;margin:10px 0;font-family:monospace;border:1px solid #ddd;word-break:break-all}
</style>
</head>
<body>
<div class="card">
<h2>Buat Link Baru</h2>
<form onsubmit="create(event)">
<input type="text" id="title" placeholder="Judul FB" required>
<textarea id="desc" placeholder="Deskripsi"></textarea>
<input type="url" id="img" placeholder="URL Gambar">
<input type="url" id="target" placeholder="URL Tujuan" required>
<input type="text" id="code" placeholder="Kode Custom (opsional)">
<button type="submit">Generate</button>
</form>
<div id="result" class="result">
<div id="link" class="link-box"></div>
<button onclick="copy()">Copy Link</button>
</div>
</div>
<div class="card">
<h2>Link Aktif</h2>
<div id="list">Memuat...</div>
</div>
<script>
const KEY=localStorage.getItem('key')||prompt('Password:');
localStorage.setItem('key',KEY);
async function create(e){
e.preventDefault();
const res=await fetch('/api/create',{
method:'POST',
headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
body:JSON.stringify({
title:document.getElementById('title').value,
description:document.getElementById('desc').value,
imageUrl:document.getElementById('img').value,
targetUrl:document.getElementById('target').value,
customCode:document.getElementById('code').value
})
});
const data=await res.json();
if(data.success){
document.getElementById('link').innerText=data.data.shortUrl;
document.getElementById('result').style.display='block';
load();
}else{alert('Error:'+data.error);}
}
async function load(){
const res=await fetch('/api/list',{headers:{'Authorization':'Bearer '+KEY}});
const data=await res.json();
document.getElementById('list').innerHTML=data.data.map(l=>
'<div style="border:1px solid #ddd;padding:10px;margin-bottom:10px;border-radius:4px">'+
'<div style="font-weight:bold">'+l.title+'</div>'+
'<div style="font-size:12px;color:#666">'+(l.clicks||0)+' klik - '+l.subdomain+'</div>'+
'</div>'
).join('');
}
function copy(){navigator.clipboard.writeText(document.getElementById('link').innerText);alert('Copied!');}
load();
</script>
</body>
</html>`;
}
