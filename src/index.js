/**
 * FB LINK GENERATOR - ENTERPRISE
 * Konfigurasi ada di wrangler.toml, jangan edit file ini
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    // Ambil konfigurasi dari environment (wrangler.toml)
    const ADMIN_PASS = env.ADMIN_KEY;
    const DOMAINS = env.DOMAIN ? env.DOMAIN.split(',').map(d => d.trim()) : ['localhost'];
    const KV = env.LINKS_DB;
    
    // Cek subdomain
    const isSubdomain = checkSubdomain(hostname, DOMAINS);
    if (isSubdomain) {
      const sub = hostname.split('.')[0];
      return handleRedirect(request, env, sub, ctx, KV);
    }
    
    // API Routes
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, pathname, ADMIN_PASS, DOMAINS, KV);
    }
    
    // Pages
    if (pathname === '/' || pathname === '/login') {
      return new Response(loginPage(), {headers: {'Content-Type': 'text/html'}});
    }
    if (pathname === '/admin') {
      return new Response(adminPage(), {headers: {'Content-Type': 'text/html'}});
    }
    if (pathname === '/member') {
      return new Response(memberPage(), {headers: {'Content-Type': 'text/html'}});
    }
    
    return new Response('Not Found', {status: 404});
  }
};

// Helper functions
function checkSubdomain(hostname, domains) {
  if (!hostname.includes('.')) return false;
  if (hostname.startsWith('www.')) return false;
  for (const d of domains) {
    if (hostname === d) return false;
    if (hostname.endsWith('.' + d)) return true;
  }
  return false;
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {'Content-Type': 'application/json'}
  });
}

function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// API Handlers
async function handleApi(req, env, pathname, adminPass, domains, kv) {
  
  // Auth Admin
  if (pathname === '/api/auth/admin' && req.method === 'POST') {
    const body = await req.json();
    if (body.password === adminPass) {
      return json({success: true, token: adminPass});
    }
    return json({success: false, error: 'Password salah'}, 401);
  }
  
  // Auth Member
  if (pathname === '/api/auth/member' && req.method === 'POST') {
    const body = await req.json();
    const userData = await kv.get('user:' + body.username);
    if (!userData) return json({error: 'User tidak ditemukan'}, 404);
    
    const user = JSON.parse(userData);
    if (user.password !== body.password) return json({error: 'Password salah'}, 401);
    if (user.active === false) return json({error: 'Akun tidak aktif'}, 403);
    
    const token = btoa(body.username + ':' + body.password);
    return json({success: true, token, username: body.username});
  }
  
  // Check auth
  const auth = req.headers.get('Authorization') || '';
  
  // Admin routes
  if (pathname.startsWith('/api/admin/')) {
    if (auth !== 'Bearer ' + adminPass) return json({error: 'Unauthorized'}, 401);
    
    if (pathname === '/api/admin/stats') return getStats(kv);
    if (pathname === '/api/admin/domains') return getDomains(kv, domains);
    if (pathname === '/api/admin/domains/add' && req.method === 'POST') {
      const body = await req.json();
      return addDomain(kv, body.domain, domains);
    }
    if (pathname === '/api/admin/domains/remove' && req.method === 'POST') {
      const body = await req.json();
      return removeDomain(kv, body.domain);
    }
    if (pathname === '/api/admin/members') return listMembers(kv);
    if (pathname === '/api/admin/members/create' && req.method === 'POST') {
      const body = await req.json();
      return createMember(kv, body);
    }
    if (pathname === '/api/admin/members/delete' && req.method === 'POST') {
      const body = await req.json();
      return deleteMember(kv, body.username);
    }
    if (pathname === '/api/admin/links') return getAllLinks(kv);
  }
  
  // Member routes
  if (pathname.startsWith('/api/member/')) {
    if (!auth.startsWith('Bearer ')) return json({error: 'Unauthorized'}, 401);
    
    const token = auth.replace('Bearer ', '');
    const decoded = atob(token);
    const [username, password] = decoded.split(':');
    
    const userData = await kv.get('user:' + username);
    if (!userData) return json({error: 'Unauthorized'}, 401);
    const user = JSON.parse(userData);
    if (user.password !== password) return json({error: 'Unauthorized'}, 401);
    
    if (pathname === '/api/member/stats') return getMemberStats(kv, username);
    if (pathname === '/api/member/links') return getMemberLinks(kv, username);
    if (pathname === '/api/member/domains') return getDomains(kv, domains);
    if (pathname === '/api/member/links/create' && req.method === 'POST') {
      const body = await req.json();
      return createLink(kv, body, username, domains);
    }
    if (pathname === '/api/member/links/delete' && req.method === 'POST') {
      const body = await req.json();
      return deleteLink(kv, body.subdomain, username);
    }
  }
  
  return json({error: 'Not found'}, 404);
}

// Admin functions
async function getStats(kv) {
  const links = await kv.list({prefix: 'link:'});
  const members = await kv.list({prefix: 'user:'});
  let clicks = 0;
  for (const k of links.keys) {
    const d = await kv.get(k.name);
    if (d) clicks += JSON.parse(d).clicks || 0;
  }
  return json({success: true, stats: {totalLinks: links.keys.length, totalMembers: members.keys.length, totalClicks: clicks}});
}

async function getDomains(kv, defaultDomains) {
  const stored = await kv.get('settings:domains');
  return json({success: true, domains: stored ? JSON.parse(stored) : defaultDomains});
}

async function addDomain(kv, domain, defaultDomains) {
  if (!domain) return json({error: 'Domain wajib diisi'}, 400);
  const stored = await kv.get('settings:domains');
  let list = stored ? JSON.parse(stored) : defaultDomains;
  if (!list.includes(domain)) {
    list.push(domain);
    await kv.put('settings:domains', JSON.stringify(list));
  }
  return json({success: true, domains: list});
}

async function removeDomain(kv, domain) {
  const stored = await kv.get('settings:domains');
  if (!stored) return json({success: true});
  let list = JSON.parse(stored).filter(d => d !== domain);
  await kv.put('settings:domains', JSON.stringify(list));
  return json({success: true});
}

async function listMembers(kv) {
  const list = await kv.list({prefix: 'user:'});
  const members = [];
  for (const k of list.keys) {
    const d = await kv.get(k.name);
    if (d) {
      const m = JSON.parse(d);
      delete m.password;
      m.username = k.name.replace('user:', '');
      members.push(m);
    }
  }
  return json({success: true, members});
}

async function createMember(kv, body) {
  const {username, password, name} = body;
  if (!username || !password) return json({error: 'Username dan password wajib'}, 400);
  
  const exists = await kv.get('user:' + username);
  if (exists) return json({error: 'Username sudah ada'}, 409);
  
  await kv.put('user:' + username, JSON.stringify({
    name: name || username,
    password: password,
    createdAt: new Date().toISOString(),
    active: true
  }));
  return json({success: true});
}

async function deleteMember(kv, username) {
  await kv.delete('user:' + username);
  // Hapus link member
  const links = await kv.list({prefix: 'link:'});
  for (const k of links.keys) {
    const d = await kv.get(k.name);
    if (d && JSON.parse(d).createdBy === username) {
      await kv.delete(k.name);
    }
  }
  return json({success: true});
}

async function getAllLinks(kv) {
  const list = await kv.list({prefix: 'link:'});
  const links = [];
  for (const k of list.keys) {
    const d = await kv.get(k.name);
    if (d) links.push(JSON.parse(d));
  }
  return json({success: true, links: links.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))});
}

// Member functions
async function getMemberStats(kv, username) {
  const links = await getMemberLinksData(kv, username);
  const clicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  return json({success: true, stats: {totalLinks: links.length, totalClicks: clicks}});
}

async function getMemberLinks(kv, username) {
  const links = await getMemberLinksData(kv, username);
  return json({success: true, links});
}

async function getMemberLinksData(kv, username) {
  const list = await kv.list({prefix: 'link:'});
  const links = [];
  for (const k of list.keys) {
    const d = await kv.get(k.name);
    if (d && JSON.parse(d).createdBy === username) links.push(JSON.parse(d));
  }
  return links.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createLink(kv, body, username, defaultDomains) {
  const {title, description, imageUrl, targetUrl, customCode, domain} = body;
  if (!title || !targetUrl) return json({error: 'Judul dan URL wajib'}, 400);
  
  const sub = customCode || Math.random().toString(36).substring(2, 10);
  if (await kv.get('link:' + sub)) return json({error: 'Kode sudah ada'}, 409);
  
  const stored = await kv.get('settings:domains');
  const available = stored ? JSON.parse(stored) : defaultDomains;
  const dom = domain || available[0];
  
  if (!available.includes(dom)) return json({error: 'Domain tidak tersedia'}, 400);
  
  const data = {
    subdomain: sub,
    domain: dom,
    title, description: description || '', imageUrl: imageUrl || '', targetUrl,
    createdBy: username,
    clicks: 0,
    createdAt: new Date().toISOString()
  };
  
  await kv.put('link:' + sub, JSON.stringify(data));
  return json({success: true, data: {...data, shortUrl: 'https://' + sub + '.' + dom}});
}

async function deleteLink(kv, subdomain, username) {
  const data = await kv.get('link:' + subdomain);
  if (!data) return json({error: 'Link tidak ditemukan'}, 404);
  if (JSON.parse(data).createdBy !== username) return json({error: 'Forbidden'}, 403);
  await kv.delete('link:' + subdomain);
  return json({success: true});
}

// Redirect handler
async function handleRedirect(req, env, subdomain, ctx, kv) {
  const data = await kv.get('link:' + subdomain);
  if (!data) return new Response('Link not found', {status: 404});
  
  const link = JSON.parse(data);
  const ua = req.headers.get('User-Agent') || '';
  const isBot = /facebook|facebot|whatsapp|bot/i.test(ua);
  
  ctx.waitUntil((async () => {
    link.clicks = (link.clicks || 0) + 1;
    await kv.put('link:' + subdomain, JSON.stringify(link));
  })());
  
  if (isBot) {
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(link.title) + '</title><meta property="og:title" content="' + esc(link.title) + '"><meta property="og:description" content="' + esc(link.description) + '"><meta property="og:image" content="' + link.imageUrl + '"><meta http-equiv="refresh" content="3;url=' + link.targetUrl + '"><style>body{font-family:system-ui;background:#f0f2f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:400px}img{width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:20px;background:#f0f2f5}h2{margin:0 0 10px;color:#1c1e21}p{color:#65676b}</style></head><body><div class="box"><img src="' + link.imageUrl + '" onerror="this.style.display=\'none\'"><h2>' + esc(link.title) + '</h2><p>' + esc(link.description) + '</p><p>Redirecting...</p></div></body></html>';
    return new Response(html, {headers: {'Content-Type': 'text/html'}});
  }
  
  return Response.redirect(link.targetUrl, 302);
}

// HTML Pages
function loginPage() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.container{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:400px;width:100%}.logo{width:80px;height:80px;background:linear-gradient(135deg,#1877f2,#42b72a);border-radius:20px;margin:0 auto 30px;display:flex;align-items:center;justify-content:center;font-size:40px;color:white}.tabs{display:flex;gap:10px;margin-bottom:30px}.tab{flex:1;padding:12px;border:none;background:#f0f2f5;border-radius:8px;cursor:pointer;font-weight:600;color:#65676b}.tab.active{background:#1877f2;color:white}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600}input{width:100%;padding:14px;border:2px solid #e4e6eb;border-radius:12px;font-size:16px}button{width:100%;padding:14px;background:#1877f2;color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer}.hidden{display:none}.error{color:#ff4444;font-size:14px;margin-top:10px;text-align:center}</style></head><body><div class="container"><div class="logo">🔗</div><div class="tabs"><button class="tab active" onclick="showTab(\'admin\')">Admin</button><button class="tab" onclick="showTab(\'member\')">Member</button></div><div id="adminForm"><div class="form-group"><label>Password Admin</label><input type="password" id="adminPass" placeholder="Password"></div><button onclick="loginAdmin()">Login</button><p id="adminError" class="error hidden"></p></div><div id="memberForm" class="hidden"><div class="form-group"><label>Username</label><input type="text" id="memberUser" placeholder="Username"></div><div class="form-group"><label>Password</label><input type="password" id="memberPass" placeholder="Password"></div><button onclick="loginMember()">Login</button><p id="memberError" class="error hidden"></p></div></div><script>function showTab(tab){document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));event.target.classList.add("active");if(tab==="admin"){document.getElementById("adminForm").classList.remove("hidden");document.getElementById("memberForm").classList.add("hidden")}else{document.getElementById("adminForm").classList.add("hidden");document.getElementById("memberForm").classList.remove("hidden")}}async function loginAdmin(){const pass=document.getElementById("adminPass").value;const res=await fetch("/api/auth/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pass})});const data=await res.json();if(data.success){localStorage.setItem("admin_token",data.token);location.href="/admin"}else{document.getElementById("adminError").innerText="Password salah";document.getElementById("adminError").classList.remove("hidden")}}async function loginMember(){const user=document.getElementById("memberUser").value;const pass=document.getElementById("memberPass").value;const res=await fetch("/api/auth/member",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user,password:pass})});const data=await res.json();if(data.success){localStorage.setItem("member_token",data.token);localStorage.setItem("member_user",data.username);location.href="/member"}else{document.getElementById("memberError").innerText=data.error||"Login gagal";document.getElementById("memberError").classList.remove("hidden")}}</script></body></html>';
}

function adminPage() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5}.header{background:white;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}.header h1{color:#1877f2;font-size:24px}.logout-btn{background:#ff4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600}.container{max-width:1200px;margin:30px auto;padding:0 20px}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:30px}.stat-card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);text-align:center}.stat-value{font-size:48px;font-weight:800;color:#1877f2}.stat-label{color:#65676b;font-weight:600;margin-top:10px}.nav-tabs{display:flex;gap:10px;margin-bottom:30px;background:white;padding:10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.nav-tab{padding:12px 24px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;color:#65676b}.nav-tab.active{background:#1877f2;color:white}.card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px}.card h2{margin-bottom:20px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600}input{width:100%;padding:12px;border:2px solid #e4e6eb;border-radius:8px;font-size:16px}button.action-btn{background:#1877f2;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600}.btn-danger{background:#ff4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px}.table{width:100%;border-collapse:collapse;margin-top:20px}.table th,.table td{padding:12px;text-align:left;border-bottom:1px solid #e4e6eb}.table th{background:#f8f9fa;font-weight:600;color:#65676b}.badge{background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.hidden{display:none}.alert{padding:12px;border-radius:8px;margin-top:10px}.alert-success{background:#e8f5e9;color:#2e7d32}.alert-error{background:#ffebee;color:#c62828}</style></head><body><div class="header"><h1>Admin Panel</h1><button class="logout-btn" onclick="logout()">Logout</button></div><div class="container"><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="statLinks">0</div><div class="stat-label">Total Links</div></div><div class="stat-card"><div class="stat-value" id="statMembers">0</div><div class="stat-label">Total Members</div></div><div class="stat-card"><div class="stat-value" id="statClicks">0</div><div class="stat-label">Total Klik</div></div></div><div class="nav-tabs"><button class="nav-tab active" onclick="showSection(\'links\')">Semua Link</button><button class="nav-tab" onclick="showSection(\'members\')">Members</button><button class="nav-tab" onclick="showSection(\'domains\')">Domains</button></div><div id="section-links" class="section"><div class="card"><h2>Semua Link</h2><table class="table"><thead><tr><th>Subdomain</th><th>Judul</th><th>Member</th><th>Klik</th><th>Aksi</th></tr></thead><tbody id="linksTable"><tr><td colspan="5" style="text-align:center;color:#999">Memuat...</td></tr></tbody></table></div></div><div id="section-members" class="section hidden"><div class="card"><h2>Tambah Member Baru</h2><div class="form-group"><label>Username</label><input type="text" id="newUsername" placeholder="username"></div><div class="form-group"><label>Password</label><input type="text" id="newPassword" placeholder="password"></div><div class="form-group"><label>Nama (Opsional)</label><input type="text" id="newName" placeholder="Nama"></div><button class="action-btn" onclick="createMember()">Tambah Member</button><div id="memberAlert"></div></div><div class="card"><h2>Daftar Members</h2><table class="table"><thead><tr><th>Username</th><th>Nama</th><th>Dibuat</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="membersTable"><tr><td colspan="5" style="text-align:center;color:#999">Memuat...</td></tr></tbody></table></div></div><div id="section-domains" class="section hidden"><div class="card"><h2>Tambah Domain Baru</h2><div class="form-group"><label>Domain</label><input type="text" id="newDomain" placeholder="domain.com"></div><button class="action-btn" onclick="addDomain()">Tambah Domain</button><div id="domainAlert"></div></div><div class="card"><h2>Domain Aktif</h2><div id="domainsList" style="display:flex;flex-direction:column;gap:10px"></div></div></div></div><script>const token=localStorage.getItem("admin_token");if(!token)location.href="/";function logout(){localStorage.removeItem("admin_token");location.href="/"}function showSection(sec){document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));document.querySelectorAll(".nav-tab").forEach(t=>t.classList.remove("active"));document.getElementById("section-"+sec).classList.remove("hidden");event.target.classList.add("active");if(sec==="links")loadLinks();if(sec==="members")loadMembers();if(sec==="domains")loadDomains()}async function loadStats(){const res=await fetch("/api/admin/stats",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){document.getElementById("statLinks").innerText=data.stats.totalLinks;document.getElementById("statMembers").innerText=data.stats.totalMembers;document.getElementById("statClicks").innerText=data.stats.totalClicks}}async function loadLinks(){const res=await fetch("/api/admin/links",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const tbody=document.getElementById("linksTable");if(data.success&&data.links.length>0){tbody.innerHTML=data.links.map(l=>"<tr><td>"+l.subdomain+"."+l.domain+"</td><td>"+l.title+"</td><td>"+(l.createdBy||"-")+"</td><td>"+(l.clicks||0)+"</td><td><button class=btn-danger onclick=\"deleteLink(\'"+l.subdomain+"\')\">Hapus</button></td></tr>").join("")}else{tbody.innerHTML="<tr><td colspan=5 style=text-align:center>Belum ada link</td></tr>"}}async function loadMembers(){const res=await fetch("/api/admin/members",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const tbody=document.getElementById("membersTable");if(data.success&&data.members.length>0){tbody.innerHTML=data.members.map(m=>"<tr><td>"+m.username+"</td><td>"+(m.name||m.username)+"</td><td>"+new Date(m.createdAt).toLocaleDateString()+"</td><td>"+(m.active!==false?"<span class=badge>Aktif</span>":"<span style=color:#999>Nonaktif</span>")+"</td><td><button class=btn-danger onclick=\"deleteMember(\'"+m.username+"\')\">Hapus</button></td></tr>").join("")}else{tbody.innerHTML="<tr><td colspan=5 style=text-align:center>Belum ada member</td></tr>"}}async function loadDomains(){const res=await fetch("/api/admin/domains",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const list=document.getElementById("domainsList");if(data.success&&data.domains.length>0){list.innerHTML=data.domains.map(d=>"<div style=display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8f9fa;border-radius:8px><span>"+d+"</span><button class=btn-danger onclick=\"removeDomain(\'"+d+"\')\">Hapus</button></div>").join("")}else{list.innerHTML="<p style=color:#999>Belum ada domain</p>"}}async function createMember(){const u=document.getElementById("newUsername").value;const p=document.getElementById("newPassword").value;const n=document.getElementById("newName").value;if(!u||!p){alert("Username dan password wajib diisi");return}const res=await fetch("/api/admin/members/create",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({username:u,password:p,name:n})});const data=await res.json();const alertDiv=document.getElementById("memberAlert");if(data.success){alertDiv.className="alert alert-success";alertDiv.innerText="Member berhasil dibuat";document.getElementById("newUsername").value="";document.getElementById("newPassword").value="";document.getElementById("newName").value="";loadMembers();loadStats()}else{alertDiv.className="alert alert-error";alertDiv.innerText=data.error||"Gagal"}}async function deleteMember(u){if(!confirm("Yakin hapus member "+u+"? Semua linknya juga akan terhapus"))return;await fetch("/api/admin/members/delete",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({username:u})});loadMembers();loadStats()}async function addDomain(){const d=document.getElementById("newDomain").value.trim();if(!d){alert("Domain tidak boleh kosong");return}const res=await fetch("/api/admin/domains/add",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({domain:d})});const data=await res.json();const alertDiv=document.getElementById("domainAlert");if(data.success){alertDiv.className="alert alert-success";alertDiv.innerText="Domain ditambahkan";document.getElementById("newDomain").value="";loadDomains()}else{alertDiv.className="alert alert-error";alertDiv.innerText=data.error}}async function removeDomain(d){if(!confirm("Yakin hapus domain "+d+"?"))return;await fetch("/api/admin/domains/remove",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({domain:d})});loadDomains()}async function deleteLink(sub){if(!confirm("Yakin hapus link "+sub+"?"))return;await fetch("/api/admin/links/delete",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({subdomain:sub})});loadLinks();loadStats()}loadStats();loadLinks()</script></body></html>';
}

function memberPage() {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Member Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5}.header{background:white;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}.header h1{color:#42b72a;font-size:24px}.logout-btn{background:#ff4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600}.container{max-width:800px;margin:30px auto;padding:0 20px}.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:30px}.stat-card{background:white;padding:25px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);text-align:center}.stat-value{font-size:36px;font-weight:800;color:#42b72a}.stat-label{color:#65676b;font-weight:600;margin-top:8px}.card{background:white;padding:30px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px}.card h2{margin-bottom:20px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;font-weight:600}input,select,textarea{width:100%;padding:12px;border:2px solid #e4e6eb;border-radius:8px;font-size:16px}textarea{min-height:80px}button.action-btn{background:#42b72a;color:white;border:none;padding:14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:16px;width:100%}.result{display:none;margin-top:20px;padding:20px;background:#e8f5e9;border-radius:12px;border-left:4px solid #42b72a}.link-box{background:white;padding:12px;border:2px dashed #42b72a;border-radius:8px;margin:10px 0;font-family:monospace;word-break:break-all;color:#2e7d32;font-weight:600}.btn-copy{background:#1877f2;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;margin-top:10px}.links-list{margin-top:20px}.link-item{background:white;border:1px solid #e4e6eb;border-radius:12px;padding:16px;margin-bottom:12px}.link-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.link-title{font-weight:700}.badge{background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.welcome-text{color:#65676b;margin-bottom:20px}</style></head><body><div class="header"><h1>Member Panel</h1><button class="logout-btn" onclick="logout()">Logout</button></div><div class="container"><div class="welcome-text">Selamat datang, <strong id="username">Member</strong></div><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="myLinks">0</div><div class="stat-label">Link Saya</div></div><div class="stat-card"><div class="stat-value" id="myClicks">0</div><div class="stat-label">Total Klik</div></div></div><div class="card"><h2>Buat Link Baru</h2><div class="form-group"><label>Pilih Domain</label><select id="domainSelect"></select></div><div class="form-group"><label>Judul FB</label><input type="text" id="title" placeholder="Contoh: Diskon 50%"></div><div class="form-group"><label>Deskripsi</label><textarea id="desc" placeholder="Deskripsi..."></textarea></div><div class="form-group"><label>URL Gambar</label><input type="url" id="img" placeholder="https://site.com/img.jpg"></div><div class="form-group"><label>URL Tujuan</label><input type="url" id="target" placeholder="https://offer.com/lp"></div><div class="form-group"><label>Kode Custom (Opsional)</label><input type="text" id="code" placeholder="PROMO50"></div><button class="action-btn" onclick="createLink()">Generate Link</button><div id="result" class="result"><strong style="color:#2e7d32">Link Berhasil!</strong><div class="link-box" id="shortUrl"></div><button class="btn-copy" onclick="copyLink()">Copy Link</button></div></div><div class="card"><h2>Link Saya</h2><div id="linksList" class="links-list"><p style="color:#999;text-align:center;padding:40px">Memuat...</p></div></div></div><script>const token=localStorage.getItem("member_token");const username=localStorage.getItem("member_user");if(!token||!username)location.href="/";document.getElementById("username").innerText=username;async function loadStats(){const res=await fetch("/api/member/stats",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){document.getElementById("myLinks").innerText=data.stats.totalLinks;document.getElementById("myClicks").innerText=data.stats.totalClicks}}async function loadDomains(){const res=await fetch("/api/member/domains",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){document.getElementById("domainSelect").innerHTML=data.domains.map(d=>"<option value="+d+">"+d+"</option>").join("")}}async function loadMyLinks(){const res=await fetch("/api/member/links",{headers:{"Authorization":"Bearer "+token}});const data=await res.json();const container=document.getElementById("linksList");if(data.success&&data.links.length>0){container.innerHTML=data.links.map(l=>"<div class=link-item><div class=link-header><div class=link-title>"+l.title+"</div><span class=badge>"+(l.clicks||0)+" klik</span></div><div style=font-size:13px;color:#999>"+l.subdomain+"."+l.domain+"</div></div>").join("")}else{container.innerHTML="<p style=color:#999;text-align:center;padding:20px>Anda belum memiliki link</p>"}}async function createLink(){const btn=document.querySelector(".action-btn");btn.innerText="Generating...";const body={domain:document.getElementById("domainSelect").value,title:document.getElementById("title").value,description:document.getElementById("desc").value,imageUrl:document.getElementById("img").value,targetUrl:document.getElementById("target").value,customCode:document.getElementById("code").value};const res=await fetch("/api/member/links/create",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});const data=await res.json();if(data.success){document.getElementById("shortUrl").innerText=data.data.shortUrl;document.getElementById("result").style.display="block";loadMyLinks();loadStats()}else{alert(data.error||"Gagal membuat link")}btn.innerText="Generate Link"}function copyLink(){navigator.clipboard.writeText(document.getElementById("shortUrl").innerText).then(()=>alert("Link dicopy!"))}function logout(){localStorage.removeItem("member_token");localStorage.removeItem("member_user");location.href="/"}loadStats();loadDomains();loadMyLinks()</script></body></html>';
    }
