/**
 * FB LINK GENERATOR - ENTERPRISE VERSION
 * Fitur: Admin Panel, Member Management, Dynamic Domains, Role-Based Access
 */

// ==========================================
// KONFIGURASI DAN SETUP
// ==========================================

const ADMIN_PATHS = ['/api/admin/', '/admin/'];
const MEMBER_PATHS = ['/api/member/', '/member/'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    // Inisialisasi config
    const config = {
      adminKey: env.ADMIN_KEY,
      kv: env.LINKS_DB,
      defaultDomains: env.DOMAIN ? env.DOMAIN.split(',').map(d => d.trim()) : []
    };
    
    // Cek subdomain (redirect link)
    const isSubdomain = await checkSubdomain(hostname, config);
    if (isSubdomain) {
      return handleRedirect(request, env, hostname.split('.')[0], ctx);
    }
    
    // Routing API
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, pathname, config);
    }
    
    // Routing Pages
    if (pathname === '/' || pathname === '/login') {
      return new Response(loginPage(), {headers: {'Content-Type': 'text/html'}});
    }
    if (pathname === '/admin') {
      return new Response(adminDashboard(), {headers: {'Content-Type': 'text/html'}});
    }
    if (pathname === '/member') {
      return new Response(memberDashboard(), {headers: {'Content-Type': 'text/html'}});
    }
    
    return new Response('Not Found', {status: 404});
  }
};

// ==========================================
// API HANDLERS
// ==========================================

async function handleApi(request, env, pathname, config) {
  const url = new URL(request.url);
  
  // AUTH ENDPOINTS (Public)
  if (pathname === '/api/auth/admin' && request.method === 'POST') {
    return handleAdminLogin(request, config);
  }
  if (pathname === '/api/auth/member' && request.method === 'POST') {
    return handleMemberLogin(request, env);
  }
  
  // ADMIN ONLY ENDPOINTS
  if (pathname.startsWith('/api/admin/')) {
    const auth = checkAdminAuth(request, config);
    if (!auth.success) return json({error: 'Unauthorized'}, 401);
    
    if (pathname === '/api/admin/stats') return getAdminStats(env);
    if (pathname === '/api/admin/settings') return getSettings(env);
    if (pathname === '/api/admin/settings/update' && request.method === 'POST') return updateSettings(request, env);
    if (pathname === '/api/admin/domains') return getDomains(env, config);
    if (pathname === '/api/admin/domains/add' && request.method === 'POST') return addDomain(request, env);
    if (pathname === '/api/admin/domains/remove' && request.method === 'POST') return removeDomain(request, env);
    if (pathname === '/api/admin/members') return listMembers(env);
    if (pathname === '/api/admin/members/create' && request.method === 'POST') return createMember(request, env);
    if (pathname === '/api/admin/members/delete' && request.method === 'POST') return deleteMember(request, env);
    if (pathname === '/api/admin/links') return getAllLinks(env);
  }
  
  // MEMBER ONLY ENDPOINTS
  if (pathname.startsWith('/api/member/')) {
    const auth = checkMemberAuth(request, env);
    if (!auth.success) return json({error: 'Unauthorized'}, 401);
    const username = auth.username;
    
    if (pathname === '/api/member/stats') return getMemberStats(env, username);
    if (pathname === '/api/member/links') return getMemberLinks(env, username);
    if (pathname === '/api/member/links/create' && request.method === 'POST') {
      return createMemberLink(request, env, username);
    }
    if (pathname === '/api/member/links/delete' && request.method === 'POST') {
      return deleteMemberLink(request, env, username);
    }
    if (pathname === '/api/member/domains') return getAvailableDomains(env, config);
  }
  
  return json({error: 'Not found'}, 404);
}

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

function checkAdminAuth(request, config) {
  const auth = request.headers.get('Authorization');
  if (auth === 'Bearer ' + config.adminKey) {
    return {success: true, role: 'admin'};
  }
  return {success: false};
}

async function checkMemberAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return {success: false};
  
  const token = auth.replace('Bearer ', '');
  const [username, password] = atob(token).split(':');
  
  const memberData = await env.LINKS_DB.get('user:' + username);
  if (!memberData) return {success: false};
  
  const member = JSON.parse(memberData);
  if (member.password === password && member.active !== false) {
    return {success: true, username: username, role: 'member'};
  }
  return {success: false};
}

async function handleAdminLogin(request, config) {
  const body = await request.json();
  if (body.password === config.adminKey) {
    return json({success: true, token: config.adminKey, role: 'admin'});
  }
  return json({success: false, error: 'Password salah'}, 401);
}

async function handleMemberLogin(request, env) {
  const body = await request.json();
  const {username, password} = body;
  
  const memberData = await env.LINKS_DB.get('user:' + username);
  if (!memberData) return json({success: false, error: 'User tidak ditemukan'}, 404);
  
  const member = JSON.parse(memberData);
  if (member.password !== password) {
    return json({success: false, error: 'Password salah'}, 401);
  }
  
  if (member.active === false) {
    return json({success: false, error: 'Akun tidak aktif'}, 403);
  }
  
  // Generate token (base64 username:password)
  const token = btoa(username + ':' + password);
  return json({success: true, token, username, role: 'member'});
}

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

async function getAdminStats(env) {
  const links = await env.LINKS_DB.list({prefix: 'link:'});
  const members = await env.LINKS_DB.list({prefix: 'user:'});
  
  let totalClicks = 0;
  for (const key of links.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) totalClicks += JSON.parse(data).clicks || 0;
  }
  
  return json({
    success: true,
    stats: {
      totalLinks: links.keys.length,
      totalMembers: members.keys.length,
      totalClicks: totalClicks
    }
  });
}

async function getSettings(env) {
  const settings = await env.LINKS_DB.get('settings:global');
  return json({
    success: true,
    settings: settings ? JSON.parse(settings) : {
      siteName: 'FB Link Generator',
      defaultRedirectDelay: 3,
      allowMemberRegistration: false
    }
  });
}

async function updateSettings(request, env) {
  const body = await request.json();
  await env.LINKS_DB.put('settings:global', JSON.stringify(body));
  return json({success: true, message: 'Settings updated'});
}

async function getDomains(env, config) {
  const stored = await env.LINKS_DB.get('settings:domains');
  const domains = stored ? JSON.parse(stored) : config.defaultDomains;
  return json({success: true, domains});
}

async function addDomain(request, env) {
  const body = await request.json();
  const domain = body.domain.trim();
  
  const stored = await env.LINKS_DB.get('settings:domains');
  let domains = stored ? JSON.parse(stored) : [];
  
  if (!domains.includes(domain)) {
    domains.push(domain);
    await env.LINKS_DB.put('settings:domains', JSON.stringify(domains));
  }
  return json({success: true, domains});
}

async function removeDomain(request, env) {
  const body = await request.json();
  const stored = await env.LINKS_DB.get('settings:domains');
  let domains = stored ? JSON.parse(stored) : [];
  domains = domains.filter(d => d !== body.domain);
  await env.LINKS_DB.put('settings:domains', JSON.stringify(domains));
  return json({success: true, domains});
}

async function listMembers(env) {
  const list = await env.LINKS_DB.list({prefix: 'user:'});
  const members = [];
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) {
      const member = JSON.parse(data);
      delete member.password; // Jangan expose password
      member.username = key.name.replace('user:', '');
      members.push(member);
    }
  }
  return json({success: true, members});
}

async function createMember(request, env) {
  const body = await request.json();
  const {username, password, name} = body;
  
  if (!username || !password) {
    return json({error: 'Username dan password wajib diisi'}, 400);
  }
  
  const exists = await env.LINKS_DB.get('user:' + username);
  if (exists) return json({error: 'Username sudah ada'}, 409);
  
  const memberData = {
    name: name || username,
    password: password,
    createdAt: new Date().toISOString(),
    active: true
  };
  
  await env.LINKS_DB.put('user:' + username, JSON.stringify(memberData));
  return json({success: true, message: 'Member berhasil dibuat'});
}

async function deleteMember(request, env) {
  const body = await request.json();
  await env.LINKS_DB.delete('user:' + body.username);
  
  // Hapus semua links milik member ini
  const links = await env.LINKS_DB.list({prefix: 'link:'});
  for (const key of links.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) {
      const link = JSON.parse(data);
      if (link.createdBy === body.username) {
        await env.LINKS_DB.delete(key.name);
      }
    }
  }
  
  return json({success: true});
}

async function getAllLinks(env) {
  const list = await env.LINKS_DB.list({prefix: 'link:'});
  const links = [];
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) links.push(JSON.parse(data));
  }
  links.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({success: true, links});
}

// ==========================================
// MEMBER FUNCTIONS
// ==========================================

async function getMemberStats(env, username) {
  const links = await getMemberLinksData(env, username);
  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);
  
  return json({
    success: true,
    stats: {
      totalLinks: links.length,
      totalClicks: totalClicks
    }
  });
}

async function getMemberLinks(env, username) {
  const links = await getMemberLinksData(env, username);
  return json({success: true, links});
}

async function getMemberLinksData(env, username) {
  const list = await env.LINKS_DB.list({prefix: 'link:'});
  const links = [];
  for (const key of list.keys) {
    const data = await env.LINKS_DB.get(key.name);
    if (data) {
      const link = JSON.parse(data);
      if (link.createdBy === username) links.push(link);
    }
  }
  return links.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createMemberLink(request, env, username) {
  const body = await request.json();
  const domains = await getAvailableDomainsData(env);
  
  if (domains.length === 0) return json({error: 'Tidak ada domain tersedia'}, 400);
  
  const subdomain = body.customCode || Math.random().toString(36).substring(2, 10);
  const exists = await env.LINKS_DB.get('link:' + subdomain);
  if (exists) return json({error: 'Kode sudah digunakan'}, 409);
  
  const domain = body.domain || domains[0];
  
  const linkData = {
    subdomain,
    domain,
    title: body.title,
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    targetUrl: body.targetUrl,
    createdBy: username,
    clicks: 0,
    createdAt: new Date().toISOString()
  };
  
  await env.LINKS_DB.put('link:' + subdomain, JSON.stringify(linkData));
  return json({
    success: true,
    data: {...linkData, shortUrl: 'https://' + subdomain + '.' + domain}
  });
}

async function deleteMemberLink(request, env, username) {
  const body = await request.json();
  const data = await env.LINKS_DB.get('link:' + body.subdomain);
  
  if (!data) return json({error: 'Link tidak ditemukan'}, 404);
  
  const link = JSON.parse(data);
  if (link.createdBy !== username) return json({error: 'Forbidden'}, 403);
  
  await env.LINKS_DB.delete('link:' + body.subdomain);
  return json({success: true});
}

async function getAvailableDomains(env, config) {
  const domains = await getAvailableDomainsData(env, config);
  return json({success: true, domains});
}

async function getAvailableDomainsData(env, config) {
  const stored = await env.LINKS_DB.get('settings:domains');
  return stored ? JSON.parse(stored) : (config.defaultDomains || []);
}

// ==========================================
// REDIRECT HANDLER
// ==========================================

async function handleRedirect(request, env, subdomain, ctx) {
  const data = await env.LINKS_DB.get('link:' + subdomain);
  if (!data) return new Response('Link not found', {status: 404});
  
  const link = JSON.parse(data);
  const ua = request.headers.get('User-Agent') || '';
  const isBot = /facebook|facebot|whatsapp|bot|crawler/i.test(ua);
  
  // Update stats
  ctx.waitUntil(updateLinkStats(env, subdomain));
  
  if (isBot) {
    return new Response(generateOgPage(link), {
      headers: {'Content-Type': 'text/html'}
    });
  }
  
  return Response.redirect(link.targetUrl, 302);
}

async function updateLinkStats(env, subdomain) {
  const data = await env.LINKS_DB.get('link:' + subdomain);
  if (data) {
    const link = JSON.parse(data);
    link.clicks = (link.clicks || 0) + 1;
    await env.LINKS_DB.put('link:' + subdomain, JSON.stringify(link));
  }
}

async function checkSubdomain(hostname, config) {
  const stored = await config.kv.get('settings:domains');
  const domains = stored ? JSON.parse(stored) : config.defaultDomains;
  
  for (const domain of domains) {
    if (hostname.endsWith('.' + domain) && hostname !== domain) {
      return true;
    }
  }
  return false;
}

// ==========================================
// HTML PAGES
// ==========================================

function generateOgPage(link) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(link.title) + '</title><meta property="og:title" content="' + esc(link.title) + '"><meta property="og:description" content="' + esc(link.description) + '"><meta property="og:image" content="' + link.imageUrl + '"><meta http-equiv="refresh" content="3;url=' + link.targetUrl + '"><style>body{font-family:system-ui;background:#f0f2f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:400px}img{width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:20px;background:#f0f2f5}h2{margin:0 0 10px;color:#1c1e21}p{color:#65676b}</style></head><body><div class="box"><img src="' + link.imageUrl + '" onerror="this.style.display=\'none\'"><h2>' + esc(link.title) + '</h2><p>' + esc(link.description) + '</p><p>Redirecting...</p></div></body></html>';
}

function esc(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {'Content-Type': 'application/json'}
  });
}

// ==========================================
// UI PAGES
// ==========================================

function loginPage() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Login - FB Link Generator</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.container{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:400px;width:100%}.logo{width:80px;height:80px;background:linear-gradient(135deg,#1877f2,#42b72a);border-radius:20px;margin:0 auto 30px;display:flex;align-items:center;justify-content:center;font-size:40px;color:white}.tabs{display:flex;gap:10px;margin-bottom:30px}.tab{flex:1;padding:12px;border:none;background:#f0f2f5;border-radius:8px;cursor:pointer;font-weight:600;color:#65676b;transition:all 0.3s}.tab.active{background:#1877f2;color:white}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600;color:#1c1e21}input{width:100%;padding:14px;border:2px solid #e4e6eb;border-radius:12px;font-size:16px;transition:all 0.3s}input:focus{outline:none;border-color:#1877f2}button{width:100%;padding:14px;background:#1877f2;color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s}button:hover{background:#166fe5}.hidden{display:none}.error{color:#ff4444;font-size:14px;margin-top:10px;text-align:center}</style></head><body><div class="container"><div class="logo">🔗</div><div class="tabs"><button class="tab active" onclick="showTab(\'admin\')">Admin</button><button class="tab" onclick="showTab(\'member\')">Member</button></div><div id="adminForm"><div class="form-group"><label>Password Admin</label><input type="password" id="adminPass" placeholder="Masukkan password admin"></div><button onclick="loginAdmin()">Login Admin</button><p id="adminError" class="error hidden"></p></div><div id="memberForm" class="hidden"><div class="form-group"><label>Username</label><input type="text" id="memberUser" placeholder="Username"></div><div class="form-group"><label>Password</label><input type="password" id="memberPass" placeholder="Password"></div><button onclick="loginMember()">Login Member</button><p id="memberError" class="error hidden"></p></div></div><script>function showTab(tab){document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));event.target.classList.add("active");if(tab==="admin"){document.getElementById("adminForm").classList.remove("hidden");document.getElementById("memberForm").classList.add("hidden")}else{document.getElementById("adminForm").classList.add("hidden");document.getElementById("memberForm").classList.remove("hidden")}}async function loginAdmin(){const pass=document.getElementById("adminPass").value;const res=await fetch("/api/auth/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pass})});const data=await res.json();if(data.success){localStorage.setItem("admin_token",data.token);location.href="/admin"}else{document.getElementById("adminError").innerText="Password salah!";document.getElementById("adminError").classList.remove("hidden")}}async function loginMember(){const user=document.getElementById("memberUser").value;const pass=document.getElementById("memberPass").value;const res=await fetch("/api/auth/member",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user,password:pass})});const data=await res.json();if(data.success){localStorage.setItem("member_token",data.token);localStorage.setItem("member_user",data.username);location.href="/member"}else{document.getElementById("memberError").innerText=data.error||"Login gagal";document.getElementById("memberError").classList.remove("hidden")}}</script></body></html>';
}

function adminDashboard() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;color:#1c1e21}.header{background:white;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}.header h1{color:#1877f2;font-size:24px}.logout-btn{background:#ff4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600}.container{max-width:1200px;margin:30px auto;padding:0 20px}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:30px}.stat-card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);text-align:center}.stat-value{font-size:48px;font-weight:800;color:#1877f2}.stat-label{color:#65676b;font-weight:600;margin-top:10px}.nav-tabs{display:flex;gap:10px;margin-bottom:30px;background:white;padding:10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.nav-tab{padding:12px 24px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;color:#65676b;transition:all 0.3s}.nav-tab.active{background:#1877f2;color:white}.nav-tab:hover:not(.active){background:#f0f2f5}.card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px}.card h2{margin-bottom:20px;color:#1c1e21}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600}input,select{width:100%;padding:12px;border:2px solid #e4e6eb;border-radius:8px;font-size:16px}button.action-btn{background:#1877f2;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600}.table{width:100%;border-collapse:collapse;margin-top:20px}.table th,.table td{padding:12px;text-align:left;border-bottom:1px solid #e4e6eb}.table th{font-weight:600;color:#65676b}.badge{background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.badge-success{background:#e8f5e9;color:#2e7d32}.btn-danger{background:#ff4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px}.hidden{display:none}.alert{padding:12px 16px;border-radius:8px;margin-bottom:20px}.alert-success{background:#e8f5e9;color:#2e7d32}.alert-error{background:#ffebee;color:#c62828}</style></head><body><div class="header"><h1>👑 Admin Panel</h1><button class="logout-btn" onclick="logout()">Logout</button></div><div class="container"><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="statLinks">0</div><div class="stat-label">Total Links</div></div><div class="stat-card"><div class="stat-value" id="statMembers">0</div><div class="stat-label">Total Members</div></div><div class="stat-card"><div class="stat-value" id="statClicks">0</div><div class="stat-label">Total Klik</div></div></div><div class="nav-tabs"><button class="nav-tab active" onclick="showSection(\'links\')">Semua Link</button><button class="nav-tab" onclick="showSection(\'members\')">Members</button><button class="nav-tab" onclick="showSection(\'domains\')">Domains</button><button class="nav-tab" onclick="showSection(\'settings\')">Settings</button></div><div id="section-links" class="section"><div class="card"><h2>Semua Link</h2><table class="table"><thead><tr><th>Subdomain</th><th>Judul</th><th>Member</th><th>Klik</th><th>Aksi</th></tr></thead><tbody id="linksTable"><tr><td colspan="5" style="text-align:center;color:#999">Memuat...</td></tr></tbody></table></div></div><div id="section-members" class="section hidden"><div class="card"><h2>Tambah Member Baru</h2><div class="form-group"><label>Username</label><input type="text" id="newUsername" placeholder="username"></div><div class="form-group"><label>Password</label><input type="text" id="newPassword" placeholder="password"></div><div class="form-group"><label>Nama Lengkap (Opsional)</label><input type="text" id="newName" placeholder="Nama member"></div><button class="action-btn" onclick="createMember()">Tambah Member</button><div id="memberAlert"></div></div><div class="card"><h2>Daftar Members</h2><table class="table"><thead><tr><th>Username</th><th>Nama</th><th>Dibuat</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="membersTable"><tr><td colspan="5" style="text-align:center;color:#999">Memuat...</td></tr></tbody></table></div></div><div id="section-domains" class="section hidden"><div class="card"><h2>Tambah Domain Baru</h2><div class="form-group"><label>Domain (contoh: domain.com)</label><input type="text" id="newDomain" placeholder="domain.com"></div><button class="action-btn" onclick="addDomain()">Tambah Domain</button><div id="domainAlert"></div></div><div class="card"><h2>Domain Aktif</h2><div id="domainsList" style="display:flex;flex-direction:column;gap:10px"></div></div></div><div id="section-settings" class="section hidden"><div class="card"><h2>Global Settings</h2><div class="form-group"><label>Nama Situs</label><input type="text" id="siteName" value="FB Link Generator"></div><div class="form-group"><label>Redirect Delay (detik)</label><input type="number" id="redirectDelay" value="3" min="1" max="10"></div><button class="action-btn" onclick="saveSettings()">Simpan Settings</button></div></div></div><script>const token=localStorage.getItem("admin_token");if(!token)location.href="/";function logout(){localStorage.removeItem("admin_token");location.href="/"}function showSection(sec){document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));document.querySelectorAll(".nav-tab").forEach(t=>t.classList.remove("active"));document.getElementById("section-"+sec).classList.remove("hidden");event.target.classList.add("active");if(sec==="links")loadLinks();if(sec==="members")loadMembers();if(sec==="domains")loadDomains()}async function loadStats(){const res=await fetch("/api/admin/stats",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){document.getElementById("statLinks").innerText=data.stats.totalLinks;document.getElementById("statMembers").innerText=data.stats.totalMembers;document.getElementById("statClicks").innerText=data.stats.totalClicks}}async function loadLinks(){const res=await fetch("/api/admin/links",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const tbody=document.getElementById("linksTable");if(data.success&&data.links.length>0){tbody.innerHTML=data.links.map(l=>"<tr><td>"+l.subdomain+"</td><td>"+l.title+"</td><td>"+(l.createdBy||"-")+"</td><td>"+(l.clicks||0)+"</td><td><button class=\'btn-danger\' onclick=\'deleteLink(\""+l.subdomain+"\")\'>Hapus</button></td></tr>").join("")}else{tbody.innerHTML="<tr><td colspan=5 style=text-align:center>Belum ada link</td></tr>"}}async function loadMembers(){const res=await fetch("/api/admin/members",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const tbody=document.getElementById("membersTable");if(data.success&&data.members.length>0){tbody.innerHTML=data.members.map(m=>"<tr><td>"+m.username+"</td><td>"+(m.name||m.username)+"</td><td>"+new Date(m.createdAt).toLocaleDateString()+"</td><td>"+(m.active!==false?"<span class=badge>Aktif</span>":"<span class=badge style=background:#ffebee;color:#c62828>Nonaktif</span>")+"</td><td><button class=\'btn-danger\' onclick=\'deleteMember(\""+m.username+"\")\'>Hapus</button></td></tr>").join("")}else{tbody.innerHTML="<tr><td colspan=5 style=text-align:center>Belum ada member</td></tr>"}}async function loadDomains(){const res=await fetch("/api/admin/domains",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const list=document.getElementById("domainsList");if(data.success&&data.domains.length>0){list.innerHTML=data.domains.map(d=>"<div style=display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8f9fa;border-radius:8px><span>"+d+"</span><button class=\'btn-danger\' onclick=\'removeDomain(\""+d+"\")\'>Hapus</button></div>").join("")}else{list.innerHTML="<p style=color:#999>Belum ada domain</p>"}}async function createMember(){const u=document.getElementById("newUsername").value;const p=document.getElementById("newPassword").value;const n=document.getElementById("newName").value;if(!u||!p){alert("Username dan password wajib diisi");return}const res=await fetch("/api/admin/members/create",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({username:u,password:p,name:n})});const data=await res.json();const alert=document.getElementById("memberAlert");if(data.success){alert.className="alert alert-success";alert.innerText="Member berhasil dibuat!";document.getElementById("newUsername").value="";document.getElementById("newPassword").value="";document.getElementById("newName").value="";loadMembers();loadStats()}else{alert.className="alert alert-error";alert.innerText=data.error||"Gagal membuat member"}}async function deleteMember(u){if(!confirm("Yakin hapus member "+u+"? Semua linknya juga akan terhapus!"))return;await fetch("/api/admin/members/delete",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({username:u})});loadMembers();loadStats()}async function addDomain(){const d=document.getElementById("newDomain").value.trim();if(!d){alert("Domain tidak boleh kosong");return}const res=await fetch("/api/admin/domains/add",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({domain:d})});const data=await res.json();const alert=document.getElementById("domainAlert");if(data.success){alert.className="alert alert-success";alert.innerText="Domain ditambahkan!";document.getElementById("newDomain").value="";loadDomains()}else{alert.className="alert alert-error";alert.innerText=data.error}}async function removeDomain(d){if(!confirm("Yakin hapus domain "+d+"?"))return;await fetch("/api/admin/domains/remove",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({domain:d})});loadDomains()}async function deleteLink(sub){if(!confirm("Yakin hapus link "+sub+"?"))return;await fetch("/api/admin/links/delete",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({subdomain:sub})});loadLinks();loadStats()}async function saveSettings(){alert("Settings disimpan!")}loadStats();loadLinks()</script></body></html>';
}

function memberDashboard() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Member Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;color:#1c1e21}.header{background:white;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}.header h1{color:#42b72a;font-size:24px}.logout-btn{background:#ff4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600}.container{max-width:800px;margin:30px auto;padding:0 20px}.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:30px}.stat-card{background:white;padding:25px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);text-align:center}.stat-value{font-size:36px;font-weight:800;color:#42b72a}.stat-label{color:#65676b;font-weight:600;margin-top:8px;font-size:14px}.card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px}.card h2{margin-bottom:20px;color:#1c1e21;font-size:20px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600;font-size:14px}input,select,textarea{width:100%;padding:12px;border:2px solid #e4e6eb;border-radius:8px;font-size:16px;font-family:inherit}textarea{min-height:80px;resize:vertical}button.action-btn{background:#42b72a;color:white;border:none;padding:14px 28px;border-radius:8px;cursor:pointer;font-weight:600;font-size:16px;width:100%}.result{display:none;margin-top:20px;padding:20px;background:#e8f5e9;border-radius:12px;border-left:4px solid #42b72a}.link-box{background:white;padding:12px;border:2px dashed #42b72a;border-radius:8px;margin:10px 0;font-family:monospace;word-break:break-all;color:#2e7d32;font-weight:600}.links-list{margin-top:20px}.link-item{background:white;border:1.5px solid #e4e6eb;border-radius:12px;padding:16px;margin-bottom:12px}.link-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}.link-title{font-weight:700;font-size:16px;color:#1c1e21}.badge{background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.btn-copy{background:#1877f2;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;margin-top:10px}.welcome-text{color:#65676b;margin-bottom:20px}</style></head><body><div class="header"><div><h1>👤 Member Panel</h1></div><button class="logout-btn" onclick="logout()">Logout</button></div><div class="container"><div class="welcome-text">Selamat datang, <strong id="username">Member</strong>! Buat short link Anda di bawah ini.</div><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="myLinks">0</div><div class="stat-label">Link Saya</div></div><div class="stat-card"><div class="stat-value" id="myClicks">0</div><div class="stat-label">Total Klik</div></div></div><div class="card"><h2>Buat Link Baru</h2><div class="form-group"><label>Pilih Domain</label><select id="domainSelect"></select></div><div class="form-group"><label>Judul FB</label><input type="text" id="title" placeholder="Contoh: Diskon 50%"></div><div class="form-group"><label>Deskripsi</label><textarea id="desc" placeholder="Deskripsi singkat..."></textarea></div><div class="form-group"><label>URL Gambar</label><input type="url" id="img" placeholder="https://site.com/img.jpg"></div><div class="form-group"><label>URL Tujuan (Offer)</label><input type="url" id="target" placeholder="https://offer.com/lp"></div><div class="form-group"><label>Kode Custom (Opsional)</label><input type="text" id="code" placeholder="PROMO50"></div><button class="action-btn" onclick="createLink()">Generate Link</button><div id="result" class="result"><strong style="color:#2e7d32">Link Berhasil!</strong><div class="link-box" id="shortUrl"></div><button class="btn-copy" onclick="copyLink()">Copy Link</button></div></div><div class="card"><h2>Link Saya</h2><div id="linksList" class="links-list"><p style="color:#999;text-align:center;padding:40px">Memuat...</p></div></div></div><script>const token=localStorage.getItem("member_token");const username=localStorage.getItem("member_user");if(!token||!username)location.href="/";document.getElementById("username").innerText=username;async function loadStats(){const res=await fetch("/api/member/stats",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){document.getElementById("myLinks").innerText=data.stats.totalLinks;document.getElementById("myClicks").innerText=data.stats.totalClicks}}async function loadDomains(){const res=await fetch("/api/member/domains",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){const select=document.getElementById("domainSelect");select.innerHTML=data.domains.map(d=>"<option value="+d+">"+d+"</option>").join("")}}async function loadMyLinks(){const res=await fetch("/api/member/links",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const container=document.getElementById("linksList");if(data.success&&data.links.length>0){container.innerHTML=data.links.map(l=>"<div class=link-item><div class=link-header><div class=link-title>"+l.title+"</div><span class=badge>"+(l.clicks||0)+" klik</span></div><div style=font-size:13px;color:#999;margin-top:4px>"+l.subdomain+"."+l.domain+"</div><button class=btn-copy onclick=\"window.open('https://"+l.subdomain+"."+l.domain+"','_blank')\">Buka Link</button></div>").join("")}else{container.innerHTML="<p style=color:#999;text-align:center;padding:20px>Anda belum memiliki link</p>"}}async function createLink(){const btn=document.querySelector(".action-btn");btn.innerText="Generating...";const body={domain:document.getElementById("domainSelect").value,title:document.getElementById("title").value,description:document.getElementById("desc").value,imageUrl:document.getElementById("img").value,targetUrl:document.getElementById("target").value,customCode:document.getElementById("code").value};const res=await fetch("/api/member/links/create",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});const data=await res.json();if(data.success){document.getElementById("shortUrl").innerText=data.data.shortUrl;document.getElementById("result").style.display="block";loadMyLinks();loadStats()}else{alert(data.error||"Gagal membuat link")}btn.innerText="Generate Link"}function copyLink(){const url=document.getElementById("shortUrl").innerText;navigator.clipboard.writeText(url).then(()=>alert("Link dicopy!"))}function logout(){localStorage.removeItem("member_token");localStorage.removeItem("member_user");location.href="/"}loadStats();loadDomains();loadMyLinks()</script></body></html>';
}
