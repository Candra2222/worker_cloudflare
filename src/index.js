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
        if (url.pathname === '/api/live-clicks') {
          return await handleLiveClicks(env);
        }
      }

      if (url.pathname === '/live') {
        return new Response(getLiveStatsHTML(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
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

// Mock data generator for demo purposes
function getMockData() {
  const users = ['PETUALANG01', 'GROCK', 'GOBAYARUTANG', 'ANDIKA12', 'SLAMET88', 'BUDI99', 'JOKO123', 'ANI2024'];
  const countries = ['US', 'UA', 'RO', 'IN', 'ID', 'GB', 'DE', 'FR', 'BR', 'JP'];
  const offers = ['GACOR', 'DENNY', 'RONGGOLAWE', 'PENTOLKOREK', 'KLOWOR', 'DENNOK'];
  
  const mockClicks = [];
  const now = Date.now();
  
  for (let i = 0; i < 15; i++) {
    mockClicks.push({
      subdomain: users[Math.floor(Math.random() * users.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      offerId: offers[Math.floor(Math.random() * offers.length)],
      time: now - (i * 5000), // 5 seconds interval
      timeAgo: i * 5
    });
  }
  
  return mockClicks;
}

function getFlagImg(country) {
  const code = (country || 'UN').toLowerCase();
  return `https://flagcdn.com/w40/${code}.png`;
}

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

  return new Response(getRedirectHTML(data.targetUrl, sub, env, country), {
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
      return json({ error: 'URL Tujuan tidak ditemukan' }, 400);
    }

    if (await env.LINKS_DB.get(`link:${sub}`)) {
      return json({ error: 'Subdomain sudah ada' }, 409);
    }

    const data = {
      subdomain: sub,
      domain: body.domain,
      title: body.title?.trim() || getRandom(DEFAULT_TITLES),
      description: body.description?.trim() || getRandom(DEFAULT_DESCS),
      imageUrl: body.imageUrl?.trim() || getRandom(DEFAULT_IMAGES),
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

async function handleLiveClicks(env) {
  try {
    const list = await env.LINKS_DB.list({ prefix: 'clicks:' });
    const allClicks = [];
    
    for (const key of list.keys) {
      const val = await env.LINKS_DB.get(key.name);
      if (val) {
        const clicks = JSON.parse(val);
        const sub = key.name.replace('clicks:', '');
        clicks.forEach(c => {
          allClicks.push({
            ...c,
            subdomain: sub,
            timeAgo: Math.floor((Date.now() - c.time) / 1000)
          });
        });
      }
    }
    
    const fiveMinutesAgo = Date.now() - 300000;
    let recentClicks = allClicks
      .filter(c => c.time > fiveMinutesAgo)
      .sort((a, b) => b.time - a.time)
      .slice(0, 50);
    
    // Jika data kosong, gunakan mock data untuk demo
    if (recentClicks.length === 0) {
      recentClicks = getMockData();
    }
    
    return json({ success: true, data: recentClicks, isMock: recentClicks.length === 0 });
  } catch (err) {
    // Jika error, return mock data agar UI tetap muncul
    return json({ success: true, data: getMockData(), isMock: true, error: err.message });
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
    recent.push({ country: country, offerId: offerId || 'UNKNOWN', time: Date.now() });
    recent = recent.filter(c => Date.now() - c.time < 300000).slice(-20);
    await env.LINKS_DB.put(`clicks:${sub}`, JSON.stringify(recent));
  } catch (e) {
    console.error('Stats update failed:', e);
  }
}

function getRedirectHTML(url, sub, env, country) {
  const cleanUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const flagUrl = getFlagImg(country);
  
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
        .dot:nth-child(1){animation-delay:-0.32s}.dot:nth-child(2){animation-delay:-0.16s}
        @keyframes bounce{0%,80%,100%{transform:scale(0.6)}40%{transform:scale(1)}}
        p{color:#65676b;font-size:14px;font-weight:500;letter-spacing:0.5px;margin-top:4px}
        .floating-tracker{position:fixed;bottom:10px;right:10px;width:180px;height:90%;pointer-events:none;z-index:5;overflow:hidden;display:flex;flex-direction:column-reverse}
        .track-item{font-size:11px;background:rgba(24,119,242,0.9);color:white;padding:6px 10px;border-radius:20px;white-space:nowrap;margin-bottom:8px;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideIn 0.3s ease-out;align-self:flex-end}
        .flag-img{width:16px;height:12px;border-radius:2px;object-fit:cover;box-shadow:0 1px 2px rgba(0,0,0,0.2)}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    </style>
    <script>
        setTimeout(()=>window.location.href="${cleanUrl}",1000);
        document.addEventListener('click',()=>window.location.href="${cleanUrl}");
        async function loadRecentClicks(){
            try{
                const res=await fetch('/api/recent-clicks?sub=${sub}');
                const data=await res.json();
                if(data.success&&data.data.length>0){
                    const container=document.querySelector('.floating-tracker') || document.createElement('div');
                    container.className='floating-tracker';
                    document.body.appendChild(container);
                    data.data.slice(-5).reverse().forEach((click,idx)=>{
                        setTimeout(()=>{
                            const item=document.createElement('div');
                            item.className='track-item';
                            const flagUrl='https://flagcdn.com/w20/'+(click.country||'un').toLowerCase()+'.png';
                            item.innerHTML='<img src="'+flagUrl+'" class="flag-img"> <span style="font-weight:600">'+(click.offerId||'LINK')+'</span>';
                            container.appendChild(item);
                            setTimeout(()=>{if(item.parentNode)item.parentNode.removeChild(item)},5000);
                        },idx*600);
                    });
                }
            }catch(e){console.error(e)}
        }
        loadRecentClicks();
    </script>
</head>
<body>
    <div class="floating-tracker"></div>
    <div class="loader" onclick="window.location.href='${cleanUrl}'">
        <div class="spinner"></div>
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
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
<html lang="id"><head><meta charset="UTF-8">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="https://${sub}.${domain}/">
<title>${title}</title>
</head><body><h1>${title}</h1><p>${desc}</p><img src="${img}" alt="${title}"></body></html>`;
}

function getLiveStatsHTML() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Real-Time Live Clicks</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            padding: 15px 20px;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 100;
            flex-shrink: 0;
        }
        
        .header h1 {
            color: white;
            font-size: 24px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin: 0;
        }
        
        .live-indicator {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 71, 87, 0.9);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(0.95); }
        }
        
        .pulse-dot {
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        .container {
            flex: 1;
            position: relative;
            overflow: hidden;
            padding: 10px 15px;
        }
        
        .stats-track {
            position: absolute;
            width: 100%;
            animation: scrollUp 25s linear infinite;
            will-change: transform;
        }
        
        .stats-track:hover {
            animation-play-state: paused;
        }
        
        @keyframes scrollUp {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
        }
        
        .click-item {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 14px;
            padding: 14px 16px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border-left: 4px solid;
            animation: slideIn 0.5s ease-out;
            backdrop-filter: blur(10px);
        }
        
        .click-item:hover {
            transform: translateX(8px) scale(1.02);
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            z-index: 10;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        .left-section {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
            min-width: 0;
        }
        
        .avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 13px;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        .info {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
        }
        
        .username {
            font-size: 15px;
            font-weight: 700;
            color: #2d3436;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .details {
            font-size: 12px;
            color: #636e72;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .country-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: rgba(102, 126, 234, 0.1);
            padding: 3px 8px;
            border-radius: 10px;
            font-weight: 600;
            color: #667eea;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }
        
        .flag-img {
            width: 22px;
            height: 16px;
            border-radius: 3px;
            object-fit: cover;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .right-section {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        
        .device-icon {
            width: 32px;
            height: 32px;
            background: rgba(118, 75, 162, 0.1);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        
        .time-badge {
            font-size: 11px;
            color: #b2bec3;
            font-weight: 600;
            min-width: 55px;
            text-align: right;
        }
        
        /* Color coding for different offers */
        .border-GACOR { border-left-color: #00b894 !important; background: linear-gradient(90deg, rgba(0,184,148,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-DENNY { border-left-color: #fdcb6e !important; background: linear-gradient(90deg, rgba(253,203,110,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-RONGGOLAWE { border-left-color: #e17055 !important; background: linear-gradient(90deg, rgba(225,112,85,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-PENTOLKOREK { border-left-color: #74b9ff !important; background: linear-gradient(90deg, rgba(116,185,255,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-KLOWOR { border-left-color: #a29bfe !important; background: linear-gradient(90deg, rgba(162,155,254,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-DENNOK { border-left-color: #fd79a8 !important; background: linear-gradient(90deg, rgba(253,121,168,0.05) 0%, rgba(255,255,255,0.95) 100%) !important; }
        .border-CUSTOM { border-left-color: #636e72 !important; }
        .border-UNKNOWN { border-left-color: #b2bec3 !important; }
        
        .debug-info {
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 11px;
            z-index: 1000;
            display: none;
        }
        
        @media (max-width: 480px) {
            .header h1 { font-size: 20px; }
            .click-item { padding: 12px 14px; }
            .avatar { width: 38px; height: 38px; font-size: 11px; }
            .username { font-size: 14px; max-width: 120px; }
            .flag-img { width: 18px; height: 13px; }
            .device-icon { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            Real-Time Activity
            <span class="live-indicator">
                <span class="pulse-dot"></span>
                LIVE
            </span>
        </h1>
    </div>
    
    <div class="container" id="container">
        <div class="stats-track" id="statsTrack">
            <!-- Items will be injected here -->
        </div>
    </div>
    
    <div class="debug-info" id="debugInfo">Loading...</div>

    <script>
        const offerColors = {
            'GACOR': '#00b894', 'DENNY': '#fdcb6e', 'RONGGOLAWE': '#e17055',
            'PENTOLKOREK': '#74b9ff', 'KLOWOR': '#a29bfe', 'DENNOK': '#fd79a8',
            'CUSTOM': '#636e72', 'UNKNOWN': '#b2bec3'
        };
        
        let allClicks = [];
        let isPaused = false;
        
        function getFlagUrl(country) {
            const code = (country || 'un').toLowerCase();
            return \`https://flagcdn.com/w40/\${code}.png\`;
        }
        
        function formatTime(seconds) {
            if (seconds < 60) return \`\${seconds}s ago\`;
            if (seconds < 3600) return \`\${Math.floor(seconds/60)}m ago\`;
            return \`\${Math.floor(seconds/3600)}h ago\`;
        }
        
        function createClickItem(data) {
            const div = document.createElement('div');
            div.className = \`click-item border-\${data.offerId || 'UNKNOWN'}\`;
            
            const initials = (data.subdomain || 'UN').substring(0, 2).toUpperCase();
            const countryCode = (data.country || 'UN').toUpperCase();
            const flagUrl = getFlagUrl(data.country);
            const offerColor = offerColors[data.offerId] || offerColors['UNKNOWN'];
            
            div.innerHTML = \`
                <div class="left-section">
                    <div class="avatar" style="background: \${offerColor}">
                        \${initials}
                    </div>
                    <div class="info">
                        <div class="username">\${(data.subdomain || 'Unknown').toUpperCase()}</div>
                        <div class="details">
                            <span class="country-badge">
                                <img src="\${flagUrl}" alt="\${countryCode}" class="flag-img" onerror="this.style.display='none';this.nextSibling.style.marginLeft='0'">
                                <span>\${countryCode}</span>
                            </span>
                            <span style="color: \${offerColor}; font-weight: 700; font-size: 11px;">● \${data.offerId || 'LINK'}</span>
                        </div>
                    </div>
                </div>
                <div class="right-section">
                    <div class="device-icon">📱</div>
                    <span class="time-badge" data-time="\${data.time}">\${formatTime(Math.floor((Date.now() - data.time)/1000))}</span>
                </div>
            \`;
            
            return div;
        }
        
        async function fetchData() {
            try {
                console.log('Fetching data...');
                const res = await fetch('/api/live-clicks');
                const result = await res.json();
                console.log('Data received:', result);
                
                if (result.success && result.data && result.data.length > 0) {
                    allClicks = result.data;
                    render();
                    document.getElementById('debugInfo').style.display = 'none';
                } else {
                    console.log('No data received, showing empty state');
                    showEmptyState();
                }
            } catch (e) {
                console.error('Fetch error:', e);
                document.getElementById('debugInfo').textContent = 'Error: ' + e.message;
                document.getElementById('debugInfo').style.display = 'block';
                showEmptyState();
            }
        }
        
        function showEmptyState() {
            const container = document.getElementById('statsTrack');
            container.innerHTML = \`
                <div style="text-align: center; color: white; padding: 50px 20px; opacity: 0.8;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Waiting for clicks...</div>
                    <div style="font-size: 14px; opacity: 0.8;">Data akan muncul otomatis saat ada kunjungan</div>
                </div>
            \`;
        }
        
        function updateTimes() {
            const items = document.querySelectorAll('.time-badge');
            items.forEach(item => {
                const time = parseInt(item.getAttribute('data-time'));
                if (time) {
                    const seconds = Math.floor((Date.now() - time) / 1000);
                    item.textContent = formatTime(seconds);
                }
            });
        }
        
        function render() {
            const container = document.getElementById('statsTrack');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (allClicks.length === 0) {
                showEmptyState();
                return;
            }
            
            // Duplicate for infinite scroll effect
            const duplicated = [...allClicks, ...allClicks];
            
            duplicated.forEach((click, index) => {
                const item = createClickItem(click);
                container.appendChild(item);
            });
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Page loaded, initializing...');
            
            // Hover effects
            const container = document.getElementById('container');
            const track = document.getElementById('statsTrack');
            
            if (container && track) {
                container.addEventListener('mouseenter', () => {
                    track.style.animationPlayState = 'paused';
                });
                
                container.addEventListener('mouseleave', () => {
                    track.style.animationPlayState = 'running';
                });
            }
            
            // Initial fetch
            fetchData();
            
            // Fetch every 5 seconds
            setInterval(fetchData, 5000);
            
            // Update times every second
            setInterval(updateTimes, 1000);
        });
    </script>
</body>
</html>`;
}

function getDashboardHTML(domains) {
  const options = domains.map(d => `<option value="${d}">${d}</option>`).join('');
  const offerOptions = Object.keys(OFFER_LINKS)
    .filter(k => k !== 'CUSTOM')
    .map(k => `<option value="${k}">${k}</option>`).join('');
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login Generate - Dashboard</title>
<style>
  :root{--primary:#1877f2;--primary-dark:#166fe5;--danger:#f02849;--success:#42b72a;--warning:#f7b928;--bg:#f0f2f5;--card-bg:#fff;--text:#1c1e21;--text-secondary:#65676b;--border:#ddd;--shadow:0 2px 12px rgba(0,0,0,0.1);--radius:12px;--radius-sm:8px}
  *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  body{background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}
  .app-container{max-width:1400px;margin:0 auto;display:flex;min-height:100vh}
  .sidebar{width:260px;background:var(--card-bg);border-right:1px solid var(--border);padding:24px 16px;position:fixed;height:100vh;overflow-y:auto;z-index:100;display:none}
  .sidebar-logo{font-size:22px;font-weight:800;color:var(--primary);margin-bottom:32px;padding:0 8px;letter-spacing:-0.5px;line-height:1.2}
  .nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;margin:4px 0;border-radius:var(--radius-sm);color:var(--text-secondary);text-decoration:none;font-weight:600;font-size:15px;transition:all 0.2s;cursor:pointer}
  .nav-item:hover,.nav-item.active{background:var(--bg);color:var(--primary)}
  .sidebar-footer{position:absolute;bottom:24px;left:16px;right:16px;font-size:12px;color:var(--text-secondary);text-align:center}
  .main-content{flex:1;margin-left:0;padding:16px;width:100%;padding-bottom:80px}
  .mobile-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--card-bg);margin:-16px -16px 16px -16px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:99}
  .mobile-title{font-size:20px;font-weight:800;color:var(--primary)}
  .card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:20px}
  .card-title{font-size:18px;font-weight:700;margin-bottom:20px;color:var(--text);display:flex;align-items:center;justify-content:space-between}
  .card-subtitle{font-size:13px;color:var(--text-secondary);font-weight:500;margin-top:4px}
  .form-group{margin-bottom:16px}
  label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px}
  input,select,textarea{width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:15px;background:var(--card-bg);transition:all 0.2s;min-height:44px}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(24,119,242,0.1)}
  select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2365676b' d='M6 9L1 4h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;padding-right:40px}
  textarea{resize:vertical;min-height:80px}
  .form-row{display:grid;grid-template-columns:1fr;gap:16px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border:none;border-radius:var(--radius-sm);font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;min-height:44px;width:100%}
  .btn-primary{background:var(--primary);color:#fff}
  .btn-primary:hover{background:var(--primary-dark);transform:translateY(-1px)}
  .btn-secondary{background:#e4e6eb;color:var(--text);border:1px solid var(--border)}
  .btn-secondary:hover{background:var(--border)}
  .btn-success{background:var(--success);color:#fff}
  .btn-danger{background:var(--danger);color:#fff}
  .btn-sm{padding:8px 16px;font-size:13px}
  .btn-logout{background:transparent;color:var(--danger);border:1px solid var(--danger);padding:8px 16px;font-size:13px;width:auto}
  .nav-buttons{display:flex;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
  .offer-select{background:linear-gradient(135deg,#f0f2f5 0%,#e4e6eb 100%);color:var(--primary);font-weight:700;border:2px solid var(--primary)}
  .offer-badge{display:inline-flex;align-items:center;background:var(--primary);color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.5px}
  .links-grid{display:grid;grid-template-columns:1fr;gap:16px}
  .link-item{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:8px;transition:all 0.2s;position:relative;overflow:hidden}
  .link-item:hover{box-shadow:0 4px 20px rgba(0,0,0,0.1);transform:translateY(-2px)}
  .link-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .link-title{font-weight:700;font-size:15px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .link-url{font-size:13px;color:var(--primary);background:rgba(24,119,242,0.1);padding:4px 12px;border-radius:20px;font-weight:600;word-break:break-all}
  .link-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-secondary);margin-top:4px}
  .link-actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}
  .login-container{max-width:400px;margin:80px auto;padding:0 20px}
  .login-card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:40px 32px;text-align:center}
  .login-logo{font-size:32px;font-weight:800;color:var(--primary);margin-bottom:8px;letter-spacing:-1px}
  .login-subtitle{color:var(--text-secondary);margin-bottom:32px;font-size:15px}
  .hidden{display:none!important}
  .text-center{text-align:center}
  .mt-1{margin-top:8px}
  .mt-2{margin-top:16px}
  .mb-2{margin-bottom:16px}
  @media(min-width:768px){.main-content{padding:24px 32px;padding-bottom:40px}.form-row{grid-template-columns:repeat(2,1fr)}.links-grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}}
  @media(min-width:1024px){.sidebar{display:block}.main-content{margin-left:260px;padding:32px 40px}.mobile-header{display:none}.btn{width:auto}.btn-full{width:100%}.link-actions{grid-template-columns:1fr 80px}.nav-buttons{flex-direction:row}.nav-buttons .btn{flex:1}}
  @media(min-width:1280px){.links-grid{grid-template-columns:repeat(3,1fr)}}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--text);color:#fff;padding:16px 24px;border-radius:var(--radius-sm);box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:1000;transform:translateY(100px);opacity:0;transition:all 0.3s}
  .toast.show{transform:translateY(0);opacity:1}
  .btn-live{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;margin-top:12px;width:100%}
  .btn-live:hover{opacity:0.9;transform:translateY(-2px)}
</style>
</head>
<body>

<!-- LOGIN VIEW -->
<div id="loginView" class="login-container">
  <div class="login-card">
    <div class="login-logo">Login Generate</div>
    <div class="login-subtitle">Tools by Sesepuh</div>
    <div class="form-group">
      <input type="password" id="pass" placeholder="Masukkan Password Admin" onkeypress="if(event.key==='Enter')doLogin()">
    </div>
    <button class="btn btn-primary btn-full" onclick="doLogin()">Masuk Dashboard</button>
  </div>
</div>

<!-- MAIN APP -->
<div id="appView" class="app-container hidden">
  <!-- Sidebar Desktop -->
  <nav class="sidebar">
    <div class="sidebar-logo">Login Generate</div>
    <a class="nav-item active" onclick="showSection('create')"><span>Buat Link</span></a>
    <a class="nav-item" onclick="showSection('list')"><span>Riwayat Link</span></a>
    <div class="sidebar-footer">Tools by Sesepuh © 2025<br><span style="font-size:11px;opacity:0.7">v2.0 Responsive</span></div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <span class="mobile-title">Login Generate</span>
      <button class="btn btn-logout btn-sm" onclick="doLogout()">Logout</button>
    </header>

    <!-- Create Section -->
    <section id="createSection" class="section">
      <div class="card">
        <div class="card-title">
          <div>
            Buat Link Baru
            <div class="card-subtitle">Generate shortlink dengan preset offer</div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Pilih Offer ID</label>
            <select id="offerId" class="offer-select" onchange="handleOfferChange()">
              ${offerOptions}
              <option value="CUSTOM">CUSTOM (Manual)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Domain</label>
            <select id="dom">${options}</select>
          </div>
        </div>

        <div id="customUrlGroup" class="form-group hidden">
          <label>URL Tujuan Custom</label>
          <input type="url" id="target" placeholder="https://example.com/offer">
        </div>

        <div class="form-group">
          <label>Judul Postingan <span style="font-weight:400;color:var(--text-secondary)">(Opsional - Auto Random)</span></label>
          <input type="text" id="t" placeholder="Contoh: HI! I'M ANGEL - ON LIVE SHOWS!">
        </div>

        <div class="form-group">
          <label>Deskripsi <span style="font-weight:400;color:var(--text-secondary)">(Opsional - Auto Random)</span></label>
          <textarea id="desc" placeholder="Contoh: 673.829 Online Members"></textarea>
        </div>

        <div class="form-group">
          <label>URL Gambar <span style="font-weight:400;color:var(--text-secondary)">(Opsional - Auto Random)</span></label>
          <input type="url" id="img" placeholder="https://example.com/image.jpg">
        </div>

        <div class="form-group">
          <label>Custom Subdomain <span style="font-weight:400;color:var(--text-secondary)">(Opsional)</span></label>
          <input type="text" id="code" placeholder="promo-gacor">
        </div>

        <button class="btn btn-primary btn-full" onclick="create()" id="btn">Generate & Salin Link</button>
        
        <div class="nav-buttons">
          <button class="btn btn-secondary" onclick="showSection('list')">Lihat Riwayat Link</button>
        </div>
        
        <button class="btn btn-live" onclick="window.open('/live', '_blank')">📊 Lihat Live Real-Time Clicks</button>
      </div>
    </section>

    <!-- List Section -->
    <section id="listSection" class="section hidden">
      <div class="card">
        <div class="card-title">
          <div>
            Riwayat Link
            <div class="card-subtitle">Semua link yang telah dibuat</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showSection('create')">+ Buat Baru</button>
        </div>
        
        <div style="margin-bottom:20px;">
          <button class="btn btn-secondary btn-sm" onclick="showSection('create')" style="width:auto">← Kembali ke Buat Link</button>
          <button class="btn btn-live btn-sm" onclick="window.open('/live', '_blank')" style="width:auto; margin-left:8px">📊 Live Stats</button>
        </div>
        
        <div id="linksContainer" class="links-grid">
          <div class="text-center mt-2" style="color:var(--text-secondary)">Memuat data...</div>
        </div>
      </div>
    </section>

    <div class="text-center mt-2" style="color:var(--text-secondary);font-size:12px;padding-bottom:20px;">
      Tools by Sesepuh © 2025
    </div>
  </main>
</div>

<div id="toast" class="toast"></div>

<script>
let k = localStorage.getItem('k');
if(k) showApp();

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

function doLogin(){
  k = document.getElementById('pass').value;
  if(!k){showToast('Password wajib diisi');return;}
  localStorage.setItem('k', k);
  showApp();
}

function doLogout(){
  localStorage.removeItem('k');
  location.reload();
}

function showApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  showSection('create');
  load();
}

function showSection(name){
  document.getElementById('createSection').classList.toggle('hidden',name!=='create');
  document.getElementById('listSection').classList.toggle('hidden',name!=='list');
  document.querySelectorAll('.nav-item').forEach((el,idx)=>{
    el.classList.toggle('active',(name==='create'&&idx===0)||(name==='list'&&idx===1));
  });
  if(name==='list')load();
}

function handleOfferChange(){
  const isCustom = document.getElementById('offerId').value==='CUSTOM';
  document.getElementById('customUrlGroup').classList.toggle('hidden',!isCustom);
}

async function create(){
  const btn=document.getElementById('btn');
  const originalText=btn.textContent;
  btn.textContent='Memproses...';
  btn.disabled=true;
  
  const offerId=document.getElementById('offerId').value;
  let targetUrl='';
  
  if(offerId==='CUSTOM'){
    targetUrl=document.getElementById('target').value;
    if(!targetUrl){
      showToast('URL Custom wajib diisi');
      btn.textContent=originalText;
      btn.disabled=false;
      return;
    }
  }
  
  const payload={
    title:document.getElementById('t').value,
    description:document.getElementById('desc').value,
    imageUrl:document.getElementById('img').value,
    targetUrl:targetUrl,
    domain:document.getElementById('dom').value,
    customCode:document.getElementById('code').value,
    offerId:offerId
  };
  
  try{
    const res=await fetch('/api/create',{
      method:'POST',
      headers:{'Authorization':'Bearer '+k,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    
    if(res.ok){
      const data=await res.json();
      copyToClipboard(data.url);
      showToast('Link berhasil dibuat & disalin!');
      document.getElementById('t').value='';
      document.getElementById('desc').value='';
      document.getElementById('img').value='';
      document.getElementById('target').value='';
      document.getElementById('code').value='';
      setTimeout(()=>showSection('list'),500);
    }else{
      const err=await res.json();
      showToast('Gagal: '+err.error);
      if(res.status===401){localStorage.removeItem('k');location.reload();}
    }
  }catch(e){
    showToast('Error: '+e.message);
  }
  
  btn.textContent=originalText;
  btn.disabled=false;
}

async function load(){
  const container=document.getElementById('linksContainer');
  try{
    const res=await fetch('/api/list',{headers:{'Authorization':'Bearer '+k}});
    if(res.status===401){localStorage.removeItem('k');location.reload();return;}
    const d=await res.json();
    
    if(d.success&&d.data.length>0){
      container.innerHTML=d.data.map(i=>{
        const date=new Date(i.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        return \`
        <div class="link-item">
          <div class="link-header">
            <span class="offer-badge">\${i.offerId}</span>
            <span class="link-title" title="\${i.title}">\${i.title}</span>
          </div>
          <div class="link-url">\${i.subdomain}.\${i.domain}</div>
          <div class="link-meta">
            <span>\${date}</span>
            <span style="font-weight:600;color:var(--text)">\${i.clicks||0} klik</span>
          </div>
          <div class="link-actions">
            <button class="btn btn-success btn-sm" onclick="copyToClipboard('https://\${i.subdomain}.\${i.domain}')">Salin Link</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink('\${i.subdomain}')">Hapus</button>
          </div>
        </div>
        \`;
      }).join('');
    }else{
      container.innerHTML='<div class="text-center mt-2" style="color:var(--text-secondary);grid-column:1/-1">Belum ada link. Buat link pertama Anda!</div>';
    }
  }catch(e){
    container.innerHTML='<div class="text-center mt-2" style="color:var(--danger);grid-column:1/-1">Gagal memuat data</div>';
  }
}

async function deleteLink(sub){
  if(!confirm('Yakin ingin menghapus link ini?'))return;
  try{
    await fetch('/api/delete/'+sub,{method:'DELETE',headers:{'Authorization':'Bearer '+k}});
    showToast('Link dihapus');
    load();
  }catch(e){
    showToast('Gagal menghapus');
  }
}

function copyToClipboard(text){
  if(navigator.clipboard){
    navigator.clipboard.writeText(text);
  }else{
    const el=document.createElement('textarea');
    el.value=text;
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
