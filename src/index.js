export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;

      // Konfigurasi Domain & Key dari ENV
      const AVAILABLE_DOMAINS = (env.DOMAINS || env.DOMAIN || 'miuzy.web.id').split(',').map(d => d.trim());
      const ADMIN_KEY = env.ADMIN_KEY;

      // --- 1. ROUTE ROBOTS.TXT (Penting untuk Izin Facebook) ---
      if (url.pathname === '/robots.txt') {
        return new Response('User-agent: *\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /', {
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // --- 2. LOGIKA REDIRECT SUBDOMAIN ---
      const rootDomain = AVAILABLE_DOMAINS.find(d => hostname.endsWith(d));
      if (rootDomain && hostname !== rootDomain && !hostname.startsWith('www.')) {
        const sub = hostname.split('.')[0];
        return await handleRedirect(request, env, sub, ctx);
      }

      // --- 3. API ROUTES (Dashboard) ---
      if (url.pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${ADMIN_KEY}`) {
          return json({ error: 'Unauthorized - Login Ulang Diperlukan' }, 401);
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

      // --- 4. DASHBOARD UI ---
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
  const isBot = /facebook|facebot|facebookexternalhit|fban|messenger|whatsapp|twitterbot/i.test(ua);

  ctx.waitUntil(updateStats(env, sub));

  if (isBot) {
    // Memastikan og:url menggunakan HTTPS agar sinkron dengan URL yang diambil Facebook
    return new Response(getOgHTML(data), {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // Redirect User Biasa
  return new Response(getRedirectHTML(data.targetUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function handleCreate(req, env) {
  const body = await req.json();
  const sub = body.customCode ? body.customCode.toLowerCase().trim() : Math.random().toString(36).substring(2, 8);

  if (await env.LINKS_DB.get(`link:${sub}`)) {
    return json({ error: 'Subdomain sudah dipakai' }, 409);
  }

  const data = {
    subdomain: sub,
    domain: body.domain,
    title: body.title,
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(data));
  // Kembalikan URL dengan HTTPS secara eksplisit
  return json({ success: true, url: `https://${sub}.${body.domain}` });
}

async function handleList(env) {
  const list = await env.LINKS_DB.list({ prefix: 'link:' });
  const links = [];
  for (const key of list.keys) {
    const val = await env.LINKS_DB.get(key.name);
    if (val) links.push(JSON.parse(val));
  }
  links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ success: true, data: links });
}

async function handleDelete(env, sub) {
  await env.LINKS_DB.delete(`link:${sub}`);
  return json({ success: true });
}

async function updateStats(env, sub) {
  const raw = await env.LINKS_DB.get(`link:${sub}`);
  if (raw) {
    const obj = JSON.parse(raw);
    obj.clicks = (obj.clicks || 0) + 1;
    await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(obj));
  }
}

// --- TEMPLATES (Optimasi HTTPS & Meta Tags) ---

function getRedirectHTML(url) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=${url}"><script>window.location.replace("${url}")</script></head><body><p>Redirecting...</p></body></html>`;
}

function getOgHTML(d) {
  const img = d.imageUrl || 'https://via.placeholder.com/1200x630/1877f2/ffffff?text=Preview';
  const fullUrl = `https://${d.subdomain}.${d.domain}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${d.title}</title>
    <meta property="og:type" content="article">
    <meta property="og:title" content="${d.title}">
    <meta property="og:description" content="${d.description}">
    <meta property="og:image" content="${img}">
    <meta property="og:url" content="${fullUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image"></head><body></body></html>`;
}

function getDashboardHTML(domains) {
  const options = domains.map(d => `<option value="${d}">${d}</option>`).join('');
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Manager Pro</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#f0f2f5;padding:15px;max-width:500px;margin:0 auto}
  .card{background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin-bottom:15px}
  input,select,textarea{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px;box-sizing:border-box}
  button{background:#1877f2;color:#fff;border:none;padding:12px;border-radius:8px;width:100%;cursor:pointer;font-weight:bold}
  .link-item{padding:12px;border-bottom:1px solid #eee}
  .actions{display:flex;gap:8px;margin-top:5px}
  .btn-c{background:#42b72a;flex:1}.btn-d{background:#f02849;width:70px}
  #dashboard{display:none}
</style>
</head>
<body>
  <div id="login" class="card">
    <h3 style="margin:0 0 10px">Admin Login</h3>
    <input type="password" id="pass" placeholder="Password Admin">
    <button onclick="doLogin()">Masuk</button>
  </div>

  <div id="dashboard">
    <div class="card">
      <h3 style="margin:0 0 10px">Generate Link</h3>
      <input type="text" id="t" placeholder="Judul Preview">
      <textarea id="desc" placeholder="Deskripsi Preview"></textarea>
      <input type="url" id="img" placeholder="URL Gambar">
      <input type="url" id="target" placeholder="URL Tujuan (Redirect)">
      <select id="dom">${options}</select>
      <input type="text" id="code" placeholder="Custom Subdomain">
      <button onclick="create()" id="btn">Generate & Salin</button>
    </div>
    <div class="card">
      <h3 style="margin:0 0 10px">Daftar Link</h3>
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
      alert('Berhasil! Link tersalin ke clipboard:\\n' + data.url);
      load();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
      if(res.status === 401) { localStorage.removeItem('k'); location.reload(); }
    }
    b.innerText = 'Generate & Salin';
  }

  async function load(){
    const res = await fetch('/api/list', {headers: {'Authorization': 'Bearer '+k}});
    if(res.status === 401) { localStorage.removeItem('k'); location.reload(); return; }
    const d = await res.json();
    if(d.success){
      document.getElementById('list').innerHTML = d.data.map(i => \`
        <div class="link-item">
          <strong>\${i.title}</strong><br>
          <span style="font-size:12px;color:#1877f2">https://\${i.subdomain}.\${i.domain}</span>
          <div class="actions">
            <button class="btn-c" onclick="copy('https://\${i.subdomain}.\${i.domain}')">Salin</button>
            <button class="btn-d" onclick="del('\${i.subdomain}')">Hapus</button>
          </div>
        </div>
      \`).join('') || 'Tidak ada link.';
    }
  }

  async function del(s){
    if(confirm('Hapus link?')){
      await fetch('/api/delete/'+s, {method:'DELETE', headers:{'Authorization':'Bearer '+k}});
      load();
    }
  }

  function copy(t){
    const el = document.createElement('textarea');
    el.value = t;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
</script>
</body></html>`;
}

function json(d, s = 200) {
  return new Response(JSON.stringify(d), {status: s, headers: {'Content-Type': 'application/json'}});
}
