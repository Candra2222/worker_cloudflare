export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      
      // Config
      const DOMAIN = env.DOMAIN || 'miuzy.web.id';
      const ADMIN_KEY = env.ADMIN_KEY || 'admin';
      
      // 1. Handle API Routes (Admin)
      // Kita cek path API dulu sebelum cek subdomain untuk keamanan
      if (url.pathname.startsWith('/api/')) {
        // Cek Auth
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
        return new Response('API Not Found', {status: 404});
      }

      // 2. Dashboard UI (Jika akses domain utama)
      // Cek apakah hostname SAMA PERSIS dengan DOMAIN atau www.DOMAIN
      if (hostname === DOMAIN || hostname === 'www.' + DOMAIN) {
        if (url.pathname === '/' || url.pathname === '') {
          return new Response(getDashboardHTML(DOMAIN), {
            headers: {'Content-Type': 'text/html'}
          });
        }
        return new Response('Not Found', {status: 404});
      }

      // 3. Handle Subdomain Redirect (User & Bot)
      // Logika: Jika hostname berakhiran domain kita, tapi bukan domain itu sendiri
      let sub = '';
      if (hostname.endsWith('.' + DOMAIN)) {
        // Ambil bagian depan sebelum domain
        sub = hostname.replace('.' + DOMAIN, '');
        // Hapus www. jika ada di subdomain (misal www.promo.miuzy.web.id)
        if (sub.startsWith('www.')) sub = sub.substring(4);
      }

      if (sub && sub !== '') {
        return await handleRedirect(request, env, sub, ctx);
      }
      
      return new Response('Invalid Request', {status: 400});
      
    } catch (err) {
      console.error('Worker Error:', err);
      return new Response('Error: ' + err.message, {status: 500});
    }
  }
};

async function handleRedirect(req, env, sub, ctx) {
  try {
    const dataRaw = await env.LINKS_DB.get('link:' + sub);
    
    if (!dataRaw) {
      return new Response(`
        <html><head><title>404</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px">
          <h1>Link Tidak Ditemukan</h1>
          <p>Subdomain <b>${sub}</b> belum terdaftar.</p>
        </body></html>`, {
        status: 404,
        headers: {'Content-Type': 'text/html'}
      });
    }
    
    const link = JSON.parse(dataRaw);
    
    // Update stats (jalankan di background)
    ctx.waitUntil(updateStats(env, sub));
    
    // KUNCI PERBAIKAN:
    // Kita selalu return HTML. 
    // - Bot FB akan baca Meta Tags.
    // - Browser User akan baca Script & Style (untuk animasi & delay).
    return new Response(getUniversalHTML(link, req.url), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Cache control penting agar FB mau refresh gambar jika diedit
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    });
    
  } catch (err) {
    return new Response('Redirect Error: ' + err.message, {status: 500});
  }
}

function getUniversalHTML(data, requestUrl) {
  // Pastikan URL gambar absolute (https://...)
  let imageUrl = data.imageUrl || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = 'https://' + imageUrl;
  }
  
  const safeTitle = escapeHtml(data.title);
  const safeDesc = escapeHtml(data.description);
  const targetUrl = data.targetUrl;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${requestUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${imageUrl}">

  <meta http-equiv="refresh" content="2;url=${targetUrl}">

  <style>
    body {
      background-color: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      color: #333;
    }
    .loader {
      border: 5px solid #e3e3e3;
      border-top: 5px solid #1877f2; /* Warna Biru FB */
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    .text {
      font-size: 16px;
      color: #65676b;
      font-weight: 500;
    }
    /* Hidden image preloader untuk memancing crawler */
    .preload-img { 
      position: absolute; 
      opacity: 0; 
      width: 1px; 
      height: 1px; 
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <div class="loader"></div>
  <div class="text">Memuat halaman...</div>

  <img src="${imageUrl}" class="preload-img" alt="preview">

  <script>
    setTimeout(function() {
      // Menggunakan replace agar user tidak bisa tekan Back button (looping)
      window.location.replace("${targetUrl}");
    }, 1000); // Delay 1000ms = 1 detik
  </script>

</body>
</html>`;
}

// --- FUNGSI API & DATABASE (Sama seperti sebelumnya) ---

async function handleCreate(req, env, domain) {
  const body = await req.json();
  const sub = body.customCode || Math.random().toString(36).substring(2, 8);
  
  if (await env.LINKS_DB.get('link:' + sub)) {
    return json({error: 'Code already exists'}, 409);
  }
  
  const data = {
    subdomain: sub,
    title: body.title || 'Untitled',
    description: body.description || 'Klik untuk melihat',
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
  // Urutkan dari yang terbaru
  links.reverse(); 
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
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
body{font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;background:#f0f2f5;padding:20px;max-width:800px;margin:0 auto;color:#333}
.card{background:white;padding:20px;border-radius:8px;margin-bottom:15px;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
h1{color:#1877f2;text-align:center;margin-bottom:30px}
input,textarea,select{width:100%;padding:12px;margin:8px 0;border:1px solid #ccd0d5;border-radius:6px;box-sizing:border-box;font-size:14px}
textarea{height:80px;resize:vertical}
button{background:#1877f2;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;width:100%;font-size:15px;font-weight:bold}
button:hover{background:#166fe5}
.result{display:none;background:#e7f3ff;padding:15px;margin-top:15px;border-radius:6px;border:1px solid #1877f2}
.link-box{background:white;padding:10px;border:1px solid #ddd;margin:10px 0;font-family:monospace;word-break:break-all}
.link-item{border:1px solid #ddd;padding:15px;margin-bottom:10px;border-radius:8px;background:white;display:flex;justify-content:space-between;align-items:center}
.badge{background:#e3f2fd;color:#1976d2;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold}
.delete-btn{background:#fa3e3e;width:auto;padding:8px 15px;font-size:13px}
.login-box{max-width:400px;margin:100px auto;text-align:center}
#dashboard{display:none}

/* FB Preview Styling */
.fb-preview-container{margin-top:20px;padding:15px;background:#f5f6f7;border-radius:8px;border:1px solid #dddfe2}
.fb-preview-header{font-size:12px;color:#606770;margin-bottom:8px;font-weight:600;text-transform:uppercase}
.fb-preview-card{background:white;border:1px solid #dadde1;max-width:500px;margin:0 auto}
.fb-preview-image{width:100%;height:261px;background:#f0f2f5;background-size:cover;background-position:center;border-bottom:1px solid #dadde1;display:flex;align-items:center;justify-content:center;color:#65676b}
.fb-preview-content{padding:10px 12px;text-align:left}
.fb-preview-domain{font-size:12px;color:#606770;text-transform:uppercase;margin-bottom:2px}
.fb-preview-title{font-size:16px;color:#1d2129;font-weight:600;margin-bottom:3px;line-height:20px}
.fb-preview-desc{font-size:14px;color:#606770;margin-top:3px;line-height:18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.preview-label{display:block;margin-top:15px;margin-bottom:2px;font-weight:600;font-size:14px}
.helper-text{font-size:12px;color:#65676b;margin-bottom:5px}
</style>
</head>
<body>

<div id="login" class="card login-box">
  <h2 style="color:#1877f2">Login Admin</h2>
  <input type="password" id="pwd" placeholder="Masukkan Password">
  <button onclick="doLogin()">Masuk Dashboard</button>
</div>

<div id="dashboard">
  <h1>FB Link Generator v2</h1>

  <div class="card">
    <h3>Buat Link Baru</h3>

    <label class="preview-label">Judul (Headline)</label>
    <input type="text" id="title" placeholder="Contoh: PROMO FLASH SALE 90%" oninput="updatePreview()">
    
    <label class="preview-label">Deskripsi</label>
    <textarea id="desc" placeholder="Keterangan singkat..." oninput="updatePreview()"></textarea>

    <label class="preview-label">URL Gambar (Harus Direct Link)</label>
    <input type="url" id="img" placeholder="https://example.com/gambar.jpg" oninput="updatePreview()">
    <div class="helper-text">Rekomendasi ukuran: 1200 x 630 px</div>

    <label class="preview-label">URL Tujuan (Redirect)</label>
    <input type="url" id="target" placeholder="https://shopee.co.id/..." required>

    <label class="preview-label">Subdomain Custom (Opsional)</label>
    <input type="text" id="code" placeholder="diskon-spesial">

    <div class="fb-preview-container">
      <div class="fb-preview-header">Preview Tampilan Facebook</div>
      <div class="fb-preview-card">
        <div id="preview-image" class="fb-preview-image">No Image</div>
        <div class="fb-preview-content">
          <div id="preview-domain" class="fb-preview-domain">${domain}</div>
          <div id="preview-title" class="fb-preview-title">Judul Link Anda</div>
          <div id="preview-desc" class="fb-preview-desc">Deskripsi link anda akan muncul di sini...</div>
        </div>
      </div>
    </div>

    <button onclick="createLink()" style="margin-top:20px">GENERATE LINK</button>

    <div id="res" class="result">
      <strong style="color:#1877f2;display:block;margin-bottom:5px">Link Berhasil Dibuat!</strong>
      <div id="link" class="link-box"></div>
      <button onclick="copyLink()" style="background:#42b72a;margin-top:5px">Copy Link</button>
    </div>
  </div>

  <div class="card">
    <h3>Daftar Link Aktif</h3>
    <div id="list">Memuat data...</div>
  </div>

</div>

<script>
var key=localStorage.getItem("k");
if(key){
  checkAuth();
}

function checkAuth(){
  document.getElementById("login").style.display="none";
  document.getElementById("dashboard").style.display="block";
  loadList();
  updatePreview();
}

function doLogin(){
  var p=document.getElementById("pwd").value;
  if(!p) return alert("Password kosong");
  localStorage.setItem("k",p);
  key=p;
  checkAuth();
}

function updatePreview(){
  var title=document.getElementById("title").value||"Judul Link Anda";
  var desc=document.getElementById("desc").value||"Deskripsi link anda akan muncul di sini...";
  var img=document.getElementById("img").value;
  
  document.getElementById("preview-title").innerText=title;
  document.getElementById("preview-desc").innerText=desc;
  
  var imgDiv=document.getElementById("preview-image");
  if(img){
    imgDiv.style.backgroundImage="url('"+img+"')";
    imgDiv.innerText="";
  }else{
    imgDiv.style.backgroundImage="";
    imgDiv.innerText="No Image";
  }
}

function createLink(){
  var tUrl = document.getElementById("target").value;
  if(!tUrl){ alert("URL Tujuan wajib diisi!"); return; }

  var btn=document.querySelector("button");
  var oriText = btn.innerText;
  btn.innerText="Memproses...";
  btn.disabled = true;

  var body={};
  body.title=document.getElementById("title").value;
  body.description=document.getElementById("desc").value;
  body.imageUrl=document.getElementById("img").value;
  body.targetUrl=tUrl;
  body.customCode=document.getElementById("code").value;
  
  fetch("/api/create",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify(body)
  })
  .then(function(r){return r.json();})
  .then(function(d){
    btn.innerText=oriText;
    btn.disabled=false;
    
    if(d.success){
      document.getElementById("link").innerText=d.data.shortUrl;
      document.getElementById("res").style.display="block";
      loadList();
      // Reset form optionals
      document.getElementById("code").value="";
      window.scrollTo(0, document.body.scrollHeight);
    }else{
      if(d.error === "Unauthorized") {
        alert("Password Salah! Silakan login ulang.");
        localStorage.removeItem("k");
        location.reload();
      } else {
        alert("Gagal: "+d.error);
      }
    }
  })
  .catch(function(e){
    btn.innerText=oriText;
    btn.disabled=false;
    alert("Error jaringan");
  });
}

function copyLink(){
  var url=document.getElementById("link").innerText;
  navigator.clipboard.writeText(url).then(function(){
    var b=event.target; b.innerText="Tersalin!";
    setTimeout(function(){b.innerText="Copy Link"},2000);
  });
}

function loadList(){
  fetch("/api/list",{headers:{"Authorization":"Bearer "+key}})
  .then(function(r){return r.json();})
  .then(function(d){
    if(!d.success) return;
    var html="";
    if(d.data.length==0){
      html="<p style='text-align:center;color:#777'>Belum ada link.</p>";
    }else{
      for(var i=0;i<d.data.length;i++){
        var l=d.data[i];
        html+='<div class="link-item">';
        html+='<div style="flex-grow:1">';
        html+='<div style="font-weight:bold;color:#1877f2;font-size:16px">'+l.subdomain+'</div>';
        html+='<div style="font-size:13px;color:#333;margin:4px 0">'+(l.title||'No Title')+'</div>';
        html+='</div>';
        html+='<div style="text-align:right">';
        html+='<span class="badge">'+(l.clicks||0)+' Klik</span><br>';
        html+='<button class="delete-btn" onclick="del(\''+l.subdomain+'\')">Hapus</button>';
        html+='</div>';
        html+='</div>';
      }
    }
    document.getElementById("list").innerHTML=html;
  });
}

function del(sub){
  if(!confirm("Hapus "+sub+"?"))return;
  fetch("/api/delete/"+sub,{method:"DELETE",headers:{"Authorization":"Bearer "+key}})
  .then(function(){loadList();});
}
</script>

</body>
</html>`;
}
