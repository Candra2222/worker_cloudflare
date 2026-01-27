export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;

      // Mengambil config dari environment variabel di wrangler.toml
      const AVAILABLE_DOMAINS = (env.DOMAINS || env.DOMAIN || 'miuzy.web.id').split(',').map(d => d.trim());
      const ADMIN_KEY = env.ADMIN_KEY;

      // --- 1. ROUTE ROBOTS.TXT (Penting agar Facebook tidak memblokir) ---
      if (url.pathname === '/robots.txt') {
        return new Response('User-agent: *\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: Facebot\nAllow: /', {
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // --- 1b. ROUTE FAVICON (Hindari error log yang tidak perlu) ---
      if (url.pathname === '/favicon.ico') {
        return new Response('', { status: 204 });
      }

      // --- 2. LOGIKA REDIRECT SUBDOMAIN (Akses Link) ---
      const rootDomain = AVAILABLE_DOMAINS.find(d => hostname.endsWith(d));
      if (rootDomain && hostname !== rootDomain && !hostname.startsWith('www.')) {
        const sub = hostname.split('.')[0];
        return await handleRedirect(request, env, sub, ctx);
      }

      // --- 3. API ROUTES (Dashboard) ---
      if (url.pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${ADMIN_KEY}`) {
          return json({ error: 'Unauthorized - Masukkan Password Baru' }, 401);
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
  
  // PERBAIKAN: Bedakan antara Facebook Crawler vs Facebook App Browser
  // facebookexternalhit = Crawler untuk preview (kasih OG HTML)
  // FBAN/FBAV/Messenger/Instagram = In-App Browser (kasih Redirect dengan fallback)
  const isFacebookCrawler = /facebookexternalhit|facebot/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|WhatsApp|Twitter|LinkedIn/i.test(ua);
  const isOtherBot = /bot|crawler|spider/i.test(ua) && !isInAppBrowser;

  ctx.waitUntil(updateStats(env, sub));

  // Hanya beri OG HTML jika benar-benar crawler (bukan in-app browser)
  if (isFacebookCrawler || isOtherBot) {
    return new Response(getOgHTML(data, sub), {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
        'Vary': 'User-Agent'
      }
    });
  }

  // Untuk user nyata (termasuk Facebook/Instagram In-App Browser), kasih redirect dengan fallback
  return new Response(getRedirectHTML(data.targetUrl), {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer-when-downgrade'
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

// --- TEMPLATES ---

function getRedirectHTML(url) {
  // PERBAIKAN: Tambahkan fallback link dan multiple redirect methods untuk Facebook In-App Browser
  const cleanUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0;url=${cleanUrl}">
    <title>Redirecting...</title>
    <script>
        // Multiple redirect methods untuk kompatibilitas Facebook Browser
        window.location.href = "${cleanUrl}";
        setTimeout(function() {
            window.location.replace("${cleanUrl}");
        }, 100);
    </script>
    <style>
        body{font-family:Arial,sans-serif;text-align:center;padding:50px 20px;background:#f0f2f5}
        .container{max-width:400px;margin:0 auto;background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}
        .btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#1877f2;color:white;text-decoration:none;border-radius:6px;font-weight:bold}
        .loading{color:#666;margin:20px 0}
    </style>
</head>
<body>
    <div class="container">
        <div class="loading">Sedang mengalihkan...</div>
        <p>Jika tidak dialihkan otomatis, klik tombol di bawah:</p>
        <a href="${cleanUrl}" class="btn">Lanjutkan ke Link</a>
        <p style="font-size:12px;color:#999;margin-top:20px;word-break:break-all">${cleanUrl}</p>
    </div>
</body>
</html>`;
}

function getOgHTML(d, sub) {
  const img = d.imageUrl || 'https://via.placeholder.com/1200x630/1877f2/ffffff?text=Video';
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
      alert('Gagal: ' + (err.error || 'Password salah atau subdomain sudah ada'));
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
