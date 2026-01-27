export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;

      const AVAILABLE_DOMAINS = (env.DOMAINS || env.DOMAIN || 'miuzy.web.id').split(',').map(d => d.trim());
      const ADMIN_KEY = env.ADMIN_KEY;

      if (url.pathname === '/robots.txt') {
        return new Response('User-agent: *\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: Facebot\nAllow: /', {
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      if (url.pathname === '/favicon.ico') {
        return new Response('', { status: 204 });
      }

      const rootDomain = AVAILABLE_DOMAINS.find(d => hostname.endsWith(d));
      if (rootDomain && hostname !== rootDomain && !hostname.startsWith('www.')) {
        const sub = hostname.split('.')[0];
        return await handleRedirect(request, env, sub, ctx);
      }

      if (url.pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${ADMIN_KEY}`) {
          return json({ error: 'Unauthorized' }, 401);
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

      if (url.pathname === '/' || url.pathname === '') {
        return new Response(getDashboardHTML(AVAILABLE_DOMAINS), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  }
};

async function handleRedirect(req, env, sub, ctx) {
  const dataRaw = await env.LINKS_DB.get(`link:${sub}`);
  if (!dataRaw) return new Response('Link Tidak Ditemukan', { status: 404 });

  const data = JSON.parse(dataRaw);
  const ua = req.headers.get('User-Agent') || '';
  
  const isFacebookCrawler = /facebookexternalhit|Facebot/i.test(ua);
  const isFacebookApp = /FBAN|FBAV|FB_IAB/i.test(ua);
  const isInstagramApp = /Instagram/i.test(ua);
  const isMessengerApp = /Messenger/i.test(ua);
  const isWhatsApp = /WhatsApp/i.test(ua);
  
  const isRealUser = isFacebookApp || isInstagramApp || isMessengerApp || isWhatsApp || !isFacebookCrawler;

  ctx.waitUntil(updateStats(env, sub));

  if (isFacebookCrawler && !isFacebookApp) {
    return new Response(getOgHTML(data, sub), {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  return new Response(getRedirectHTML(data.targetUrl), {
    status: 200,
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

async function handleCreate(req, env) {
  try {
    const body = await req.json();
    const sub = body.customCode ? body.customCode.toLowerCase().trim() : Math.random().toString(36).substring(2, 8);

    if (!body.targetUrl) {
      return json({ error: 'URL Tujuan wajib diisi' }, 400);
    }

    if (await env.LINKS_DB.get(`link:${sub}`)) {
      return json({ error: 'Subdomain sudah ada' }, 409);
    }

    const data = {
      subdomain: sub,
      domain: body.domain,
      title: body.title || 'Untitled',
      description: body.description || '',
      imageUrl: body.imageUrl || '',
      targetUrl: body.targetUrl,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(data));
    return json({ success: true, url: `https://${sub}.${body.domain}` });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleList(env) {
  try {
    const list = await env.LINKS_DB.list({ prefix: 'link:' });
    const links = [];
    for (const key of list.keys) {
      const val = await env.LINKS_DB.get(key.name);
      if (val) links.push(JSON.parse(val));
    }
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json({ success: true, data: links });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleDelete(env, sub) {
  try {
    await env.LINKS_DB.delete(`link:${sub}`);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function updateStats(env, sub) {
  try {
    const raw = await env.LINKS_DB.get(`link:${sub}`);
    if (raw) {
      const obj = JSON.parse(raw);
      obj.clicks = (obj.clicks || 0) + 1;
      await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(obj));
    }
  } catch (e) {
    console.error('Stats update failed:', e);
  }
}

function getRedirectHTML(url) {
  const cleanUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="refresh" content="1; url=${cleanUrl}">
    <title>Redirecting...</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
        .container{background:white;padding:25px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;max-width:380px;width:100%;animation:fadeIn 0.4s ease-out}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .spinner{width:28px;height:28px;border:3px solid #f0f2f5;border-top:3px solid #1877f2;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .dots{display:flex;justify-content:center;gap:4px;margin:10px 0 15px}
        .dot{width:5px;height:5px;background:#1877f2;border-radius:50%;animation:bounce 1.4s infinite ease-in-out both}
        .dot:nth-child(1){animation-delay:-0.32s}
        .dot:nth-child(2){animation-delay:-0.16s}
        @keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.5}40%{transform:scale(1);opacity:1}}
        h2{color:#1c1e21;margin-bottom:6px;font-size:16px;font-weight:600}
        p{color:#65676b;margin-bottom:5px;font-size:13px;line-height:1.4}
        .btn{display:inline-block;background:#1877f2;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;width:100%;margin-top:10px;transition:all 0.2s}
        .btn:active{background:#166fe5;transform:scale(0.98)}
        .url-text{font-size:11px;color:#8a8d91;word-break:break-all;margin-top:12px;padding-top:12px;border-top:1px solid #e4e6eb}
    </style>
    <script>
        window.onload = function(){
            setTimeout(function(){
                window.location.href = "${cleanUrl}";
                setTimeout(function(){
                    window.location.replace("${cleanUrl}");
                }, 50);
                if(window.top !== window.self){
                    window.top.location = "${cleanUrl}";
                }
            }, 1000);
        };
        document.addEventListener('click', function(){
            window.location.href = "${cleanUrl}";
        });
    </script>
</head>
<body>
    <div class="container" onclick="window.location.href='${cleanUrl}'">
        <div class="spinner"></div>
        <h2>Sedang membuka link...</h2>
        <p>Tunggu sebentar, Anda akan dialihkan otomatis</p>
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <a href="${cleanUrl}" class="btn">Buka Link Sekarang</a>
        <div class="url-text">${cleanUrl}</div>
    </div>
</body>
</html>`;
}

function getOgHTML(d, sub) {
  const img = d.imageUrl || 'https://via.placeholder.com/1200x630/1877f2/ffffff?text=Video ';
  const title = (d.title || '').replace(/"/g, '&quot;');
  const desc = (d.description || '').replace(/"/g, '&quot;');
  const domain = d.domain || '';
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${img}">
    <meta property="og:url" content="https://${sub}.${domain}/">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="${domain}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${img}">
</head>
<body>
    <h1>${title}</h1>
    <p>${desc}</p>
    <img src="${img}" alt="${title}" style="max-width:100%">
</body>
</html>`;
}

function getDashboardHTML(domains) {
  const options = domains.map(d => `<option value="${d}">${d}</option>`).join('');
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manager Link Pro</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#f0f2f5;padding:15px;max-width:500px;margin:0 auto}
  .card{background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin-bottom:15px}
  input,select,textarea{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px;box-sizing:border-box}
  button{background:#1877f2;color:#fff;border:none;padding:12px;border-radius:8px;width:100%;cursor:pointer;font-weight:bold}
  .link-item{padding:12px;border-bottom:1px solid #eee;display:flex;flex-direction:column;gap:5px}
  .actions{display:flex;gap:8px;margin-top:5px}
  .btn-c{background:#42b72a;flex:1}.btn-d{background:#f02849;width:70px}
  #dashboard{display:none}
</style>
</head>
<body>
  <div id="login" class="card">
    <h3 style="margin-top:0">Admin Login</h3>
    <input type="password" id="pass" placeholder="Password Admin">
    <button onclick="doLogin()">Masuk</button>
  </div>
  <div id="dashboard">
    <div class="card">
      <h3 style="margin-top:0">Buat Link Baru</h3>
      <input type="text" id="t" placeholder="Judul Postingan">
      <textarea id="desc" placeholder="Deskripsi"></textarea>
      <input type="url" id="img" placeholder="URL Gambar (Direct Link)">
      <input type="url" id="target" placeholder="URL Tujuan">
      <select id="dom">${options}</select>
      <input type="text" id="code" placeholder="Custom Subdomain (Opsional)">
      <button onclick="create()" id="btn">Generate & Salin Link</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Riwayat Link</h3>
      <div id="list">Memuat...</div>
    </div>
  </div>
<script>
  let k = localStorage.getItem('k');
  if(k) showDash();
  function doLogin(){
    k = document.getElementById('pass').value;
    localStorage.setItem('k', k);
    showDash();
  }
  function showDash(){
    document.getElementById('login').style.display='none';
    document.getElementById('dashboard').style.display='block';
    load();
  }
  async function create(){
    const b = document.getElementById('btn');
    b.innerText = 'Memproses...';
    const payload = {
      title: document.getElementById('t').value,
      description: document.getElementById('desc').value,
      imageUrl: document.getElementById('img').value,
      targetUrl: document.getElementById('target').value,
      domain: document.getElementById('dom').value,
      customCode: document.getElementById('code').value
    };
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: {'Authorization': 'Bearer '+k, 'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if(res.ok){
      const data = await res.json();
      copy(data.url);
      alert('Berhasil! Link tersalin otomatis:\\n' + data.url);
      load();
    } else {
      const err = await res.json();
      alert('Gagal: ' + (err.error || 'Password salah'));
      if(res.status === 401) { localStorage.removeItem('k'); location.reload(); }
    }
    b.innerText = 'Generate & Salin Link';
  }
  async function load(){
    const res = await fetch('/api/list', {headers: {'Authorization': 'Bearer '+k}});
    if(res.status === 401) { localStorage.removeItem('k'); location.reload(); return; }
    const d = await res.json();
    if(d.success){
      document.getElementById('list').innerHTML = d.data.map(i => \`
        <div class="link-item">
          <strong>\${i.title}</strong>
          <span style="font-size:12px;color:#1877f2">https://\${i.subdomain}.\${i.domain}</span>
          <div class="actions">
            <button class="btn-c" onclick="copy('https://\${i.subdomain}.\${i.domain}')">Salin</button>
            <button class="btn-d" onclick="del('\${i.subdomain}')">Hapus</button>
          </div>
        </div>
      \`).join('') || 'Belum ada link.';
    }
  }
  async function del(s){
    if(confirm('Hapus link ini?')){
      await fetch('/api/delete/'+s, {method:'DELETE', headers:{'Authorization':'Bearer '+k}});
      load();
    }
  }
  function copy(t){
    if(navigator.clipboard){
      navigator.clipboard.writeText(t);
    } else {
      const el = document.createElement('textarea');
      el.value = t;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  }
</script>
</body></html>`;
}

function json(d, s = 200) {
  return new Response(JSON.stringify(d), {status: s, headers: {'Content-Type': 'application/json'}});
}
