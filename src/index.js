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
        if (url.pathname === '/api/recent-clicks') {
          return handleRecentClicks(env, url.searchParams.get('sub'));
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

// SETTINGAN LINK OFFER (Diselaraskan dengan link Anda)
const OFFER_LINKS = {
  'GACOR': 'https://fdeddg.hubss.one/p/yCTUy',
  'DENNY': 'https://fdeddg.trfsm.com/p/dJbbK',
  'RONGGOLAWE': 'https://fdeddg.hubss.one/p/7vKE6',
  'PENTOLKOREK': 'https://fdeddg.trfsm.com/p/zyPld',
  'KLOWOR': 'https://fdeddg.hubss.one/p/A8Se6',
  'DENNOK': 'https://fdeddg.hubss.one/p/ylgz0',
  'CUSTOM': null
};

const DEFAULT_TITLES = [
  "HI! I'M ANGEL - ON LIVE SHOWS!",
  "HI! I'M MONA - ON LIVE SHOWS!",
  "HI! I'M LUNA - ON LIVE SHOWS!",
  "HI! I'M MONICA - ON LIVE SHOWS!",
  "HI! I'M JESSICA - ON LIVE SHOWS!"
];

const DEFAULT_DESCS = [
  "673.829 Online Members",
  "671.817 Online Members",
  "473.829 Online Members",
  "573.729 Online Members",
  "483.829 Online Members"
];

const DEFAULT_IMAGES = [
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEia5EZN81KImOLwCf4Maw9Rx93SMzi-Y1sl4FlymVs-p7A7fzpnnwzV3PPTRw95HtjanyPfOC7wGpR7PWlJbeLoK1fmtI5Siziuo1SMQJDqnwd7BZhjbHDuErzJIXkaXqw6Mp8WRohL9fyh93oJhDEgPbpV0ErLx6V5mA15iSO1gWlduuNVAOwxo7Ev455P/s1600/1000273276.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg8Dww4NmXkBhQklIJkpCwUwSGlpEwRlO_v9xk2Sif9c0IqxCkx9_2Bh2Trg-Ghidlqty_ZxX_jvdVsyQGNp7fGaek0EzoQ-i1_DMglfA9ATJzhn2yfmWbOD9HItFSPAgq24eM6KMRLxwNNxeLaLuo4N8VDwUurVtBBYhmAw5Lhi7K_MhE2fKzWxiMqNuXv/s1600/1000281899.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgLmLDHXtTQrS45ZtnxZdnkIcWi1JJR1sJeC2OnzAO2V9zH1h7gaiAvNpkiaQIk1kwulp84CqoKfEDxnV3cnGHSFBgSrLoL6__uvdsiH392xvwxdFQIiws2OL1E2dCR_4Csa4iVdnNInHkrBmo-i-U8CGaI9mYrMDndq1fWogmCCUQGS4p-yFlA253eOfmY/s16000/1000278957.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhY2U1nNExdEb1EmswodAdiZqFJvBi-j5qmXYihXFcnIUndSXE3u4zxS6yuKvKFCL6Y2dh0hdqk3Oc0oZZ1tg5pYWMzcRoaIlT3NVw0pZ7fldLwJCdE5mfn8UNtwDTnksPulL9NK3yG5cp7HYdKjmB8rdyv7kAt-B5Jrlu3P5o0xUbwIC8TDOXWpyKjimZN/s1600/1000277246.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgVt6Bj8uzv9tZc5AChsYKNjcPzFOtR8yM5WUrG3hseYZl_RrEyU_6MOsu2CtaUuKrQ7WkPvfGIGvzGxQurpR7P5rKo1aAEwsn6zXl1t-jZf4Uz0jeTdsVr_c3L5pvMNukqOTfMLaw9yVw62_fzDUs9bSIQmvQ39OmLEp0k6H-nJS_HLp48-5CA1QYRdU6Y/s1600/1000271008.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh_X109SK-QhlSOb1NiSyRSnY54QJNX0WKy0UsOtgMA-sYsqzk6qhC9D3WHovVRF3uK_cIMA-J1K8hWmc__ZUG_gihjOYjwBg54bZVNlDKWiNtfbTpEOvSj-Nd2_aRX_fYaiFdsZBNZdlehyo14bgl-Dxgk9qNDepHwfwNFidERYyAAjsWhWMY5_PyASPSP/s1600/1000270623.jpg"
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function handleRedirect(req, env, sub, ctx) {
  const dataRaw = await env.LINKS_DB.get(`link:${sub}`);
  if (!dataRaw) return new Response('Link Tidak Ditemukan', { status: 404 });

  const data = JSON.parse(dataRaw);
  const ua = req.headers.get('User-Agent') || '';
  const country = req.headers.get('CF-IPCountry') || 'UN';
  
  const isFacebookCrawler = /facebookexternalhit|Facebot/i.test(ua);
  const isFacebookApp = /FBAN|FBAV|FB_IAB/i.test(ua);
  const isInstagramApp = /Instagram/i.test(ua);
  const isMessengerApp = /Messenger/i.test(ua);
  const isWhatsApp = /WhatsApp/i.test(ua);
  
  const isRealUser = isFacebookApp || isInstagramApp || isMessengerApp || isWhatsApp || !isFacebookCrawler;

  ctx.waitUntil(updateStats(env, sub, country, data.offerId));

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

  return new Response(getRedirectHTML(data.targetUrl, sub, env), {
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
    
    const offerId = body.offerId || 'CUSTOM';
    
    let targetUrl = body.targetUrl;
    if (offerId !== 'CUSTOM' && OFFER_LINKS[offerId]) {
      targetUrl = OFFER_LINKS[offerId];
    }
    
    if (!targetUrl) {
      return json({ error: 'URL Tujuan wajib diisi (atau pilih Offer ID yang valid)' }, 400);
    }

    if (await env.LINKS_DB.get(`link:${sub}`)) {
      return json({ error: 'Subdomain sudah ada' }, 409);
    }

    const title = body.title?.trim() || getRandom(DEFAULT_TITLES);
    const description = body.description?.trim() || getRandom(DEFAULT_DESCS);
    const imageUrl = body.imageUrl?.trim() || getRandom(DEFAULT_IMAGES);

    const data = {
      subdomain: sub,
      domain: body.domain,
      title: title,
      description: description,
      imageUrl: imageUrl,
      targetUrl: targetUrl,
      offerId: offerId,
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
    await env.LINKS_DB.delete(`clicks:${sub}`);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleRecentClicks(env, sub) {
  try {
    const recent = await env.LINKS_DB.get(`clicks:${sub}`);
    return json({ success: true, data: recent ? JSON.parse(recent) : [] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function updateStats(env, sub, country, offerId) {
  try {
    const raw = await env.LINKS_DB.get(`link:${sub}`);
    if (raw) {
      const obj = JSON.parse(raw);
      obj.clicks = (obj.clicks || 0) + 1;
      await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(obj));
    }
    
    const recentRaw = await env.LINKS_DB.get(`clicks:${sub}`);
    let recent = recentRaw ? JSON.parse(recentRaw) : [];
    recent.push({
      country: country,
      offerId: offerId || 'UNKNOWN',
      time: Date.now()
    });
    recent = recent.filter(c => Date.now() - c.time < 300000).slice(-20);
    await env.LINKS_DB.put(`clicks:${sub}`, JSON.stringify(recent));
  } catch (e) {
    console.error('Stats update failed:', e);
  }
}

function getRedirectHTML(url, sub, env) {
  const cleanUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="refresh" content="1; url=${cleanUrl}">
    <title>Loading...</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;overflow:hidden;position:relative}
        .loader{display:flex;flex-direction:column;align-items:center;gap:10px;z-index:10}
        .spinner{width:20px;height:20px;border:2px solid #e4e6eb;border-top:2px solid #1877f2;border-radius:50%;animation:spin 0.8s linear infinite}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .dots{display:flex;gap:4px;height:4px;align-items:center}
        .dot{width:4px;height:4px;background:#1877f2;border-radius:50%;animation:bounce 1.4s infinite ease-in-out both;opacity:0.6}
        .dot:nth-child(1){animation-delay:-0.32s}
        .dot:nth-child(2){animation-delay:-0.16s}
        @keyframes bounce{0%,80%,100%{transform:scale(0.6)}40%{transform:scale(1)}}
        p{color:#65676b;font-size:14px;font-weight:500;letter-spacing:0.5px;margin-top:4px}
        
        .floating-tracker{position:fixed;bottom:10px;right:10px;width:140px;height:100%;pointer-events:none;z-index:5;overflow:hidden}
        .track-item{position:absolute;right:0;font-size:10px;background:rgba(24,119,242,0.85);color:white;padding:3px 8px;border-radius:12px;white-space:nowrap;opacity:0;animation:floatUp 4s ease-out forwards;display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);backdrop-filter:blur(4px)}
        .track-item .flag{font-size:12px}
        @keyframes floatUp{
            0%{transform:translateY(0) translateX(0);opacity:0}
            10%{transform:translateY(-20px) translateX(-5px);opacity:0.9}
            90%{transform:translateY(-80vh) translateX(-15px);opacity:0.6}
            100%{transform:translateY(-100vh) translateX(-20px);opacity:0}
        }
    </style>
    <script>
        setTimeout(function(){
            window.location.href = "${cleanUrl}";
        }, 1000);
        document.addEventListener('click', function(){
            window.location.href = "${cleanUrl}";
        });
        
        async function loadRecentClicks(){
            try{
                const res = await fetch('/api/recent-clicks?sub=${sub}');
                const data = await res.json();
                if(data.success && data.data.length > 0){
                    const container = document.createElement('div');
                    container.className = 'floating-tracker';
                    document.body.appendChild(container);
                    
                    data.data.slice(-5).reverse().forEach((click, idx) => {
                        setTimeout(() => {
                            const item = document.createElement('div');
                            item.className = 'track-item';
                            item.style.animationDelay = (idx * 0.5) + 's';
                            item.innerHTML = '<span class="flag">🌍</span> ' + (click.offerId || 'LINK') + ' • ' + click.country;
                            item.style.bottom = '10px';
                            container.appendChild(item);
                            setTimeout(() => item.remove(), 4000);
                        }, idx * 800);
                    });
                }
            }catch(e){}
        }
        loadRecentClicks();
    </script>
</head>
<body>
    <div class="loader" onclick="window.location.href='${cleanUrl}'">
        <div class="spinner"></div>
        <div class="dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <p>Loading...</p>
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
  
  // DHAPUS SEMUA ICON DARI OPTIONS - TINGGAL NAMA SAJA
  const offerOptions = Object.keys(OFFER_LINKS)
    .filter(k => k !== 'CUSTOM')
    .map(k => {
      return `<option value="${k}">${k}</option>`;
    }).join('');
  
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
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
  .logout-btn{background:#f02849;width:auto;padding:8px 16px;font-size:12px;width:80px}
  .copyright{text-align:center;color:#8a8d91;font-size:11px;margin-top:20px;padding-top:15px;border-top:1px solid #e4e6eb}
  .offer-badge{display:inline-block;background:#1877f2;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-right:5px}
  .offer-select{background:#f0f2f5;font-weight:600;color:#1877f2;border:2px solid #1877f2}
  .url-display{background:#e7f3ff;padding:10px;border-radius:6px;font-size:12px;color:#1877f2;word-break:break-all;margin:8px 0;border-left:3px solid #1877f2}
  .hidden{display:none}
</style>
</head>
<body>
  <div id="login" class="card">
    <h3 style="margin-top:0">Admin Login</h3>
    <input type="password" id="pass" placeholder="Password Admin">
    <button onclick="doLogin()">Masuk</button>
  </div>
  <div id="dashboard">
    <div class="header">
      <h3 style="margin:0">Dashboard</h3>
      <button class="logout-btn" onclick="doLogout()">Logout</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Buat Link Baru</h3>
      
      <label style="font-size:12px;color:#65676b;font-weight:600">Pilih Offer ID:</label>
      <select id="offerId" class="offer-select" onchange="handleOfferChange()">
        ${offerOptions}
        <option value="CUSTOM">CUSTOM (Input Manual)</option>
      </select>
      
      <div id="urlDisplay" class="url-display" style="display:none">
        <strong>Link Target:</strong><br>
        <span id="targetUrlText">-</span>
      </div>
      
      <input type="url" id="target" class="hidden" placeholder="URL Tujuan (Untuk mode CUSTOM)">
      
      <input type="text" id="t" placeholder="Judul Postingan (Auto Random jika kosong)">
      <textarea id="desc" placeholder="Deskripsi (Auto Random jika kosong)"></textarea>
      <input type="url" id="img" placeholder="URL Gambar (Auto Random jika kosong)">
      
      <select id="dom">${options}</select>
      <input type="text" id="code" placeholder="Custom Subdomain (Opsional)">
      <button onclick="create()" id="btn">Generate & Salin Link</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Riwayat Link</h3>
      <div id="list">Memuat...</div>
    </div>
    <div class="copyright">Tools by Sesepuh © 2025</div>
  </div>
<script>
  // SYNC DENGAN BACKEND OFFER_LINKS
  const OFFER_URLS = {
    'GACOR': 'https://fdeddg.hubss.one/p/yCTUy',
    'DENNY': 'https://fdeddg.trfsm.com/p/dJbbK',
    'RONGGOLAWE': 'https://fdeddg.hubss.one/p/7vKE6',
    'PENTOLKOREK': 'https://fdeddg.trfsm.com/p/zyPld',
    'KLOWOR': 'https://fdeddg.hubss.one/p/A8Se6',
    'DENNOK': 'https://fdeddg.hubss.one/p/ylgz0',
    'CUSTOM': ''
  };
  
  let k = localStorage.getItem('k');
  if(k) showDash();
  
  function doLogin(){
    k = document.getElementById('pass').value;
    localStorage.setItem('k', k);
    showDash();
  }
  function doLogout(){
    localStorage.removeItem('k');
    location.reload();
  }
  function showDash(){
    document.getElementById('login').style.display='none';
    document.getElementById('dashboard').style.display='block';
    handleOfferChange();
    load();
  }
  
  function handleOfferChange(){
    const offerId = document.getElementById('offerId').value;
    const urlDisplay = document.getElementById('urlDisplay');
    const targetInput = document.getElementById('target');
    const targetText = document.getElementById('targetUrlText');
    
    if(offerId === 'CUSTOM'){
      urlDisplay.style.display = 'none';
      targetInput.className = '';
      targetInput.required = true;
    } else {
      targetInput.className = 'hidden';
      targetInput.required = false;
      urlDisplay.style.display = 'block';
      targetText.textContent = OFFER_URLS[offerId] || '-';
    }
  }
  
  async function create(){
    const b = document.getElementById('btn');
    b.innerText = 'Memproses...';
    
    const offerId = document.getElementById('offerId').value;
    let targetUrl = '';
    
    if(offerId === 'CUSTOM'){
      targetUrl = document.getElementById('target').value;
      if(!targetUrl){
        alert('URL Tujuan wajib diisi untuk mode CUSTOM');
        b.innerText = 'Generate & Salin Link';
        return;
      }
    }
    
    const payload = {
      title: document.getElementById('t').value,
      description: document.getElementById('desc').value,
      imageUrl: document.getElementById('img').value,
      targetUrl: targetUrl,
      domain: document.getElementById('dom').value,
      customCode: document.getElementById('code').value,
      offerId: offerId
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
      document.getElementById('t').value='';
      document.getElementById('desc').value='';
      document.getElementById('img').value='';
      document.getElementById('target').value='';
      document.getElementById('code').value='';
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
      // DHAPUS ICON 🎯 DAN 👁 DARI DISPLAY
      document.getElementById('list').innerHTML = d.data.map(i => \`
        <div class="link-item">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <span class="offer-badge">\${i.offerId || 'LINK'}</span>
            <strong>\${i.title}</strong>
          </div>
          <span style="font-size:12px;color:#1877f2">https://\${i.subdomain}.\${i.domain}</span>
          <div style="font-size:10px;color:#8a8d91;margin-top:2px">
            \${i.offerId} • \${i.clicks || 0} klik
          </div>
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
