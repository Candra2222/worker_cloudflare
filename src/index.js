export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;

      // --- KONFIGURASI ---
      const DOMAIN = env.DOMAIN || 'miuzy.web.id'; // Ganti atau set di Env Vars
      const ADMIN_KEY = env.ADMIN_KEY || 'admin';  // Password dashboard

      // --- LOGIKA SUBDOMAIN ---
      // Cek apakah akses via subdomain (contoh: promo.miuzy.web.id)
      const isSubdomain = hostname.includes('.') && 
                          hostname !== DOMAIN && 
                          !hostname.startsWith('www.') &&
                          hostname.endsWith('.' + DOMAIN);

      if (isSubdomain) {
        const sub = hostname.split('.')[0];
        return await handleRedirect(request, env, sub, ctx);
      }

      // --- API ROUTES (BACKEND) ---
      if (url.pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== 'Bearer ' + ADMIN_KEY) {
          return json({ error: 'Unauthorized' }, 401);
        }

        if (url.pathname === '/api/create' && request.method === 'POST') {
          return handleCreate(request, env, DOMAIN);
        }
        if (url.pathname === '/api/list') {
          return handleList(env, DOMAIN);
        }
        if (url.pathname.startsWith('/api/delete/')) {
          const subToDelete = url.pathname.split('/').pop();
          return handleDelete(env, subToDelete);
        }
      }

      // --- DASHBOARD UI (FRONTEND) ---
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(getDashboardHTML(DOMAIN), {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return new Response('Not Found', { status: 404 });

    } catch (err) {
      return new Response('Internal Error: ' + err.message, { status: 500 });
    }
  }
};

// --- HANDLER UTAMA REDIRECT ---
async function handleRedirect(req, env, sub, ctx) {
  try {
    const dataRaw = await env.LINKS_DB.get('link:' + sub);
    
    if (!dataRaw) {
      return new Response('Link expired or not found.', { status: 404 });
    }

    const data = JSON.parse(dataRaw);
    const ua = req.headers.get('User-Agent') || '';
    
    // Deteksi Bot/Crawler Facebook (Case Insensitive & Lengkap)
    // Penting: Bot hanya butuh melihat Meta Tag, User butuh Redirect.
    const isBot = /facebook|facebot|facebookexternalhit|fb_iab|fban|messenger|twitterbot|whatsapp/i.test(ua);

    // Update statistik klik (jalan di background)
    ctx.waitUntil(updateStats(env, sub));

    if (isBot) {
      // JIKA BOT: Tampilkan Meta Tags saja agar gambar/judul muncul di FB
      return new Response(getOgHTML(data), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600' // Cache 1 jam di sisi FB
        }
      });
    }

    // JIKA MANUSIA: Tampilkan halaman loading kecil lalu redirect
    return new Response(getRedirectHTML(data.targetUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    return new Response('Error handling redirect', { status: 500 });
  }
}

// --- FUNGSI API ---

async function handleCreate(req, env, domain) {
  const body = await req.json();
  // Gunakan custom code jika ada, jika tidak generate random string 6 karakter
  const sub = body.customCode ? 
              body.customCode.toLowerCase().replace(/[^a-z0-9-]/g, '') : 
              Math.random().toString(36).substring(2, 8);

  if (await env.LINKS_DB.get('link:' + sub)) {
    return json({ error: 'Kode subdomain sudah digunakan/ada.' }, 409);
  }

  const data = {
    subdomain: sub,
    title: body.title || 'Untitled',
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  await env.LINKS_DB.put('link:' + sub, JSON.stringify(data));
  
  return json({ 
    success: true, 
    data: { 
      ...data, 
      shortUrl: `https://${sub}.${domain}` 
    } 
  });
}

async function handleList(env, domain) {
  // Listing data dari KV
  const list = await env.LINKS_DB.list({ prefix: 'link:' });
  const links = [];
  
  for (const key of list.keys) {
    const val = await env.LINKS_DB.get(key.name);
    if (val) {
      const parsed = JSON.parse(val);
      // Inject full URL untuk frontend
      parsed.fullUrl = `https://${parsed.subdomain}.${domain}`;
      links.push(parsed);
    }
  }
  
  // Sort by created date (newest first) - opsional
  links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return json({ success: true, data: links });
}

async function handleDelete(env, sub) {
  await env.LINKS_DB.delete('link:' + sub);
  return json({ success: true });
}

async function updateStats(env, sub) {
  try {
    const raw = await env.LINKS_DB.get('link:' + sub);
    if (raw) {
      const obj = JSON.parse(raw);
      obj.clicks = (obj.clicks || 0) + 1;
      await env.LINKS_DB.put('link:' + sub, JSON.stringify(obj));
    }
  } catch (e) {
    console.error('Stats Error:', e);
  }
}

// --- HELPER HTML GENERATORS ---

// 1. HTML untuk BOT (Hanya Meta Data)
function getOgHTML(data) {
  // Pastikan URL gambar valid
  let img = data.imageUrl;
  if (!img || img === '') {
    // Gambar transparan 1x1 pixel jika kosong, atau placeholder
    img = 'https://via.placeholder.com/1200x630/cccccc/ffffff?text=No+Image';
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.title)}</title>
  
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(data.title)}">
  <meta property="og:description" content="${escapeHtml(data.description)}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(data.title)}">
  <meta name="twitter:description" content="${escapeHtml(data.description)}">
  <meta name="twitter:image" content="${img}">
</head>
<body>
  </body>
</html>`;
}

// 2. HTML untuk USER (Halaman Loading & Redirect Script)
function getRedirectHTML(targetUrl) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memuat...</title>
  <meta http-equiv="refresh" content="2;url=${targetUrl}">
  <style>
    body {
      background-color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1877f2; /* Warna biru FB */
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 15px;
    }
    .text {
      color: #65676b;
      font-size: 14px;
      font-weight: 500;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="text">Memuat...</div>

  <script>
    // Redirect via JavaScript (lebih cepat & reliable di in-app browser)
    setTimeout(function() {
      window.location.replace("${targetUrl}");
    }, 500); // Delay 0.5 detik agar animasi terlihat sejenak
  </script>
</body>
</html>`;
}

// 3. HTML DASHBOARD
function getDashboardHTML(domain) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Manager - ${domain}</title>
<style>
  :root { --primary: #1877f2; --bg: #f0f2f5; --card: #fff; --text: #050505; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 20px; max-width: 900px; margin: 0 auto; }
  .card { background: var(--card); padding: 20px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-bottom: 20px; }
  h1, h2, h3 { color: var(--primary); margin-top: 0; }
  
  .form-group { margin-bottom: 15px; }
  label { display: block; font-weight: 600; margin-bottom: 5px; font-size: 0.9em; color: #444; }
  input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
  input:focus, textarea:focus { outline: none; border-color: var(--primary); }
  textarea { resize: vertical; height: 80px; }
  
  button { background: var(--primary); color: white; border: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; font-size: 15px; transition: 0.2s; }
  button:hover { background: #166fe5; }
  button.btn-small { width: auto; padding: 6px 12px; font-size: 13px; margin-left: 5px; }
  button.btn-danger { background: #dc3545; }
  button.btn-danger:hover { background: #bb2d3b; }
  button.btn-copy { background: #42b72a; }
  button.btn-copy:hover { background: #36a420; }

  /* Preview Box */
  .fb-preview { border: 1px solid #dadde1; border-radius: 8px; overflow: hidden; max-width: 500px; margin: 10px auto; background: #fff; }
  .fb-img { width: 100%; height: 261px; background-color: #e9ebee; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: #888; border-bottom: 1px solid #dadde1; }
  .fb-content { padding: 10px 12px; background: #f2f3f5; }
  .fb-domain { font-size: 12px; color: #606770; text-transform: uppercase; margin-bottom: 3px; }
  .fb-title { font-size: 16px; font-weight: 700; color: #1d2129; line-height: 1.2; margin-bottom: 3px; max-height: 40px; overflow: hidden; }
  .fb-desc { font-size: 14px; color: #606770; line-height: 1.3; max-height: 38px; overflow: hidden; }

  /* List Items */
  .link-item { border: 1px solid #eee; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; background: #fff; }
  .link-meta { display: flex; justify-content: space-between; align-items: center; }
  .link-title { font-weight: bold; font-size: 16px; }
  .link-url { font-family: monospace; color: var(--primary); background: #e7f3ff; padding: 4px 8px; border-radius: 4px; word-break: break-all; }
  .link-stats { font-size: 12px; color: #666; background: #eee; padding: 2px 6px; border-radius: 4px; }
  .actions { display: flex; justify-content: flex-end; gap: 5px; margin-top: 5px; }

  #login-area { max-width: 360px; margin: 80px auto; text-align: center; }
  #dashboard-area { display: none; }
</style>
</head>
<body>

  <div id="login-area" class="card">
    <h3>Login Admin</h3>
    <input type="password" id="passwordInput" placeholder="Masukkan Password Admin">
    <br><br>
    <button onclick="login()">Masuk Dashboard</button>
  </div>

  <div id="dashboard-area">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2>FB Link Generator</h2>
      <button class="btn-small btn-danger" onclick="logout()">Logout</button>
    </div>

    <div class="card">
      <h3>Buat Link Baru</h3>
      
      <div class="form-group">
        <label>Judul (Headline)</label>
        <input type="text" id="inpTitle" placeholder="Contoh: Promo Spesial Hari Ini" oninput="updatePreview()">
      </div>

      <div class="form-group">
        <label>Deskripsi Singkat</label>
        <textarea id="inpDesc" placeholder="Keterangan singkat yang muncul di bawah judul..." oninput="updatePreview()"></textarea>
      </div>

      <div class="form-group">
        <label>URL Gambar (Direct Link)</label>
        <input type="url" id="inpImg" placeholder="https://example.com/image.jpg" oninput="updatePreview()">
      </div>

      <div class="form-group">
        <label>Link Tujuan (Target URL)</label>
        <input type="url" id="inpTarget" placeholder="https://shopee.co.id/..." required>
      </div>

      <div class="form-group">
        <label>Custom Subdomain (Opsional)</label>
        <div style="display:flex;align-items:center;gap:5px;">
          <input type="text" id="inpCode" placeholder="promo-januari" style="flex:1">
          <span>.${domain}</span>
        </div>
      </div>

      <label>Preview Tampilan Facebook:</label>
      <div class="fb-preview">
        <div id="prevImg" class="fb-img">No Image</div>
        <div class="fb-content">
          <div class="fb-domain">${domain.toUpperCase()}</div>
          <div id="prevTitle" class="fb-title">Judul Link Anda</div>
          <div id="prevDesc" class="fb-desc">Deskripsi link akan muncul di area ini...</div>
        </div>
      </div>

      <br>
      <button onclick="createLink()" id="btnGen">Generate Link</button>
    </div>

    <div class="card">
      <h3>Daftar Link Tersimpan</h3>
      <button class="btn-small" onclick="loadLinks()" style="margin-bottom:15px;width:auto">Refresh List</button>
      <div id="linkListContainer">Memuat data...</div>
    </div>
  </div>

<script>
  const DOMAIN = "${domain}";
  let AUTH_KEY = localStorage.getItem('access_key');

  if (AUTH_KEY) {
    showDashboard();
  }

  function login() {
    const p = document.getElementById('passwordInput').value;
    if (p) {
      localStorage.setItem('access_key', p);
      AUTH_KEY = p;
      showDashboard();
    }
  }

  function logout() {
    localStorage.removeItem('access_key');
    location.reload();
  }

  function showDashboard() {
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('dashboard-area').style.display = 'block';
    loadLinks();
    updatePreview();
  }

  function updatePreview() {
    const t = document.getElementById('inpTitle').value || 'Judul Link Anda';
    const d = document.getElementById('inpDesc').value || 'Deskripsi link akan muncul di area ini...';
    const i = document.getElementById('inpImg').value;

    document.getElementById('prevTitle').textContent = t;
    document.getElementById('prevDesc').textContent = d;
    
    const imgDiv = document.getElementById('prevImg');
    if (i) {
      imgDiv.style.backgroundImage = 'url(' + i + ')';
      imgDiv.textContent = '';
    } else {
      imgDiv.style.backgroundImage = 'none';
      imgDiv.textContent = 'No Image';
    }
  }

  async function createLink() {
    const btn = document.getElementById('btnGen');
    btn.textContent = 'Memproses...';
    btn.disabled = true;

    const payload = {
      title: document.getElementById('inpTitle').value,
      description: document.getElementById('inpDesc').value,
      imageUrl: document.getElementById('inpImg').value,
      targetUrl: document.getElementById('inpTarget').value,
      customCode: document.getElementById('inpCode').value
    };

    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + AUTH_KEY
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        alert('Link Berhasil Dibuat!\\n' + json.data.shortUrl);
        // Reset form
        document.getElementById('inpTitle').value = '';
        document.getElementById('inpDesc').value = '';
        document.getElementById('inpImg').value = '';
        document.getElementById('inpCode').value = '';
        updatePreview();
        loadLinks();
      } else {
        alert('Gagal: ' + json.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    
    btn.textContent = 'Generate Link';
    btn.disabled = false;
  }

  async function loadLinks() {
    const cont = document.getElementById('linkListContainer');
    try {
      const res = await fetch('/api/list', {
        headers: { 'Authorization': 'Bearer ' + AUTH_KEY }
      });
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        cont.innerHTML = '<p style="text-align:center;color:#777">Belum ada link yang dibuat.</p>';
        return;
      }

      let html = '';
      json.data.forEach(item => {
        html += \`
        <div class="link-item">
          <div class="link-meta">
            <span class="link-title">\${escapeHtml(item.title)}</span>
            <span class="link-stats">\${item.clicks || 0} Klik</span>
          </div>
          <div class="link-url">\${item.fullUrl}</div>
          <div class="actions">
            <button class="btn-small btn-copy" onclick="copyText('\${item.fullUrl}')">Salin Link</button>
            <button class="btn-small btn-danger" onclick="deleteLink('\${item.subdomain}')">Hapus</button>
          </div>
        </div>
        \`;
      });
      cont.innerHTML = html;

    } catch (e) {
      cont.innerHTML = 'Gagal memuat list.';
    }
  }

  async function deleteLink(sub) {
    if (!confirm('Yakin ingin menghapus link ini?\\nData tidak bisa dikembalikan.')) return;

    try {
      await fetch('/api/delete/' + sub, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + AUTH_KEY }
      });
      loadLinks();
    } catch (e) {
      alert('Gagal menghapus');
    }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link berhasil disalin!');
    }).catch(err => {
      alert('Gagal menyalin, silakan copy manual.');
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
</script>

</body>
</html>`;
}

// Utilitas Helper
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
