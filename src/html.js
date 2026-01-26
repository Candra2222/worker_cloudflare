/**
 * HTML TEMPLATES - UI Dashboard Admin
 * Desain: Modern, clean, responsive untuk mobile
 */

export function dashboardHTML(config) {
  // Generate options untuk dropdown domain
  const domainOptions = config.domains.map((domain, index) => 
    `<option value="${domain}" ${index === 0 ? 'selected' : ''}>${domain}</option>`
  ).join('');
  
  // Tampilkan selector domain hanya jika ada lebih dari 1 domain
  const domainSelector = config.domains.length > 1 ? `
    <div class="form-group">
      <label>Pilih Domain</label>
      <select id="domain" class="form-control">
        ${domainOptions}
      </select>
      <small class="form-text">Pilih domain untuk short link</small>
    </div>
  ` : `
    <input type="hidden" id="domain" value="${config.domains[0]}">
  `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>FB Link Generator - Dashboard</title>
<style>
/* ==========================================
   CSS VARIABLES & RESET
   ========================================== */
:root {
  --primary: #1877f2;
  --primary-dark: #166fe5;
  --success: #42b72a;
  --danger: #ff4444;
  --warning: #ffc107;
  --bg: #f0f2f5;
  --card: #ffffff;
  --text: #1c1e21;
  --text-secondary: #65676b;
  --border: #dddfe2;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --radius: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding-bottom: 40px;
}

/* ==========================================
   LAYOUT & CONTAINER
   ========================================== */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

/* ==========================================
   HEADER
   ========================================== */
.header {
  text-align: center;
  margin-bottom: 24px;
  padding-top: 20px;
}

.header h1 {
  font-size: 28px;
  color: var(--primary);
  margin-bottom: 8px;
  font-weight: 700;
}

.header p {
  color: var(--text-secondary);
  font-size: 14px;
}

/* ==========================================
   CARDS
   ========================================== */
.card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--bg);
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.card-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ==========================================
   FORM ELEMENTS
   ========================================== */
.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

.form-control {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: #fff;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(24, 119, 242, 0.1);
}

textarea.form-control {
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
}

select.form-control {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23656b76' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.form-text {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* ==========================================
   BUTTONS
   ========================================== */
.btn {
  display: inline-block;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  width: 100%;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-success {
  background: var(--success);
  color: white;
  margin-top: 8px;
}

.btn-danger {
  background: var(--danger);
  color: white;
  padding: 6px 12px;
  font-size: 13px;
  width: auto;
}

/* ==========================================
   RESULT SECTION
   ========================================== */
.result {
  display: none;
  margin-top: 20px;
  padding: 20px;
  background: #e7f3ff;
  border-radius: var(--radius);
  border-left: 4px solid var(--primary);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.result.show {
  display: block;
}

.link-display {
  background: white;
  padding: 12px;
  border: 2px dashed var(--primary);
  border-radius: 8px;
  margin: 12px 0;
  font-family: "SF Mono", Monaco, monospace;
  font-size: 14px;
  word-break: break-all;
  color: var(--primary);
  font-weight: 600;
}

/* ==========================================
   FB PREVIEW CARD
   ========================================== */
.fb-preview {
  margin-top: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: white;
}

.fb-preview-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: linear-gradient(45deg, #f0f2f5 25%, transparent 25%), 
              linear-gradient(-45deg, #f0f2f5 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #f0f2f5 75%), 
              linear-gradient(-45deg, transparent 75%, #f0f2f5 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.fb-preview-content {
  padding: 12px;
}

.fb-domain {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fb-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-top: 4px;
  line-height: 1.4;
}

.fb-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

/* ==========================================
   LINKS LIST
   ========================================== */
.links-list {
  margin-top: 16px;
}

.link-item {
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.link-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.link-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.link-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  flex: 1;
  padding-right: 10px;
}

.link-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: #e8f5e9;
  color: #2e7d32;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
}

/* ==========================================
   LOGIN SECTION
   ========================================== */
.login-container {
  max-width: 400px;
  margin: 60px auto;
  text-align: center;
}

.login-logo {
  font-size: 64px;
  margin-bottom: 20px;
}

.login-form {
  margin-top: 24px;
}

.error-message {
  color: var(--danger);
  font-size: 14px;
  margin-top: 8px;
  display: none;
}

.error-message.show {
  display: block;
}

/* ==========================================
   LOADING & SPINNER
   ========================================== */
.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==========================================
   RESPONSIVE
   ========================================== */
@media (max-width: 600px) {
  .container {
    padding: 12px;
  }
  
  .card {
    padding: 16px;
  }
  
  .header h1 {
    font-size: 24px;
  }
}
</style>
</head>
<body>

<!-- ==========================================
     LOGIN SECTION
     ========================================== -->
<div id="loginSection" class="login-container">
  <div class="card">
    <div class="login-logo">🔗</div>
    <h2 style="margin-bottom: 8px">Dashboard Admin</h2>
    <p style="color: var(--text-secondary); font-size: 14px">Masukkan password untuk melanjutkan</p>
    
    <form class="login-form" onsubmit="handleLogin(event)">
      <div class="form-group">
        <input type="password" id="loginKey" class="form-control" placeholder="Password admin" required>
        <div id="loginError" class="error-message">Password salah!</div>
      </div>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  </div>
</div>

<!-- ==========================================
     MAIN DASHBOARD
     ========================================== -->
<div id="dashboardSection" style="display: none">
  <div class="container">
    
    <!-- Header -->
    <div class="header">
      <h1>FB Link Generator</h1>
      <p>Buat short link dengan preview Facebook yang menarik</p>
    </div>
    
    <!-- Form Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Buat Link Baru</div>
          <div class="card-subtitle">Isi detail untuk generate link</div>
        </div>
      </div>
      
      <form id="createForm" onsubmit="handleCreate(event)">
        
        <!-- Domain Selector (Hanya muncul jika multiple domains) -->
        ${domainSelector}
        
        <!-- Judul -->
        <div class="form-group">
          <label for="title">Judul Post Facebook *</label>
          <input type="text" id="title" class="form-control" placeholder="Contoh: Diskon 50% Spesial Hari Ini" required>
          <small class="form-text">Judul yang muncul saat di-share di Facebook</small>
        </div>
        
        <!-- Deskripsi -->
        <div class="form-group">
          <label for="description">Deskripsi</label>
          <textarea id="description" class="form-control" placeholder="Dapatkan diskon besar-besaran untuk pembelian hari ini..."></textarea>
        </div>
        
        <!-- URL Gambar -->
        <div class="form-group">
          <label for="imageUrl">URL Gambar (1200x630 pixel)</label>
          <input type="url" id="imageUrl" class="form-control" placeholder="https://example.com/promo-image.jpg">
          <small class="form-text">Ukuran optimal untuk preview Facebook: 1200x630 pixel</small>
        </div>
        
        <!-- URL Tujuan -->
        <div class="form-group">
          <label for="targetUrl">URL Tujuan (Landing Page) *</label>
          <input type="url" id="targetUrl" class="form-control" placeholder="https://offer-anda.com/landing-page" required>
          <small class="form-text">Halaman yang akan dituju setelah user klik link</small>
        </div>
        
        <!-- Kode Custom -->
        <div class="form-group">
          <label for="customCode">Kode Custom (Opsional)</label>
          <input type="text" id="customCode" class="form-control" placeholder="PROMO50">
          <small class="form-text">Biarkan kosong untuk generate otomatis (8 karakter random)</small>
        </div>
        
        <!-- Submit Button -->
        <button type="submit" class="btn btn-primary" id="submitBtn">
          Generate Link
        </button>
      </form>
      
      <!-- Result Section -->
      <div id="resultSection" class="result">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
          <span style="color: var(--success); font-size: 20px">✓</span>
          <strong style="color: var(--primary)">Link Berhasil Dibuat!</strong>
        </div>
        
        <div class="link-display" id="generatedUrl"></div>
        
        <button class="btn btn-success" onclick="copyToClipboard()">
          📋 Copy Link
        </button>
        
        <!-- Facebook Preview Simulation -->
        <div class="fb-preview">
          <img id="previewImage" class="fb-preview-image" src="" alt="Preview" onerror="this.style.display='none'">
          <div class="fb-preview-content">
            <div class="fb-domain" id="previewDomain"></div>
            <div class="fb-title" id="previewTitle"></div>
            <div class="fb-desc" id="previewDesc"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Stats Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Statistik</div>
          <div class="card-subtitle">Overview performa link</div>
        </div>
        <button class="btn btn-primary" style="width: auto; padding: 8px 16px; font-size: 14px" onclick="loadStats()">
          Refresh
        </button>
      </div>
      <div id="statsContent" style="display: flex; gap: 20px; text-align: center">
        <div style="flex: 1">
          <div style="font-size: 32px; font-weight: 700; color: var(--primary)" id="statTotalLinks">-</div>
          <div style="font-size: 14px; color: var(--text-secondary)">Total Links</div>
        </div>
        <div style="flex: 1">
          <div style="font-size: 32px; font-weight: 700; color: var(--success)" id="statTotalClicks">-</div>
          <div style="font-size: 14px; color: var(--text-secondary)">Total Klik</div>
        </div>
      </div>
    </div>
    
    <!-- Links List Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Link Aktif</div>
          <div class="card-subtitle">Semua link yang telah dibuat</div>
        </div>
      </div>
      <div id="linksList" class="links-list">
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>Memuat data...</p>
        </div>
      </div>
    </div>
    
  </div>
</div>

<!-- ==========================================
     JAVASCRIPT LOGIC
     ========================================== -->
<script>
// Inisialisasi API Key dari localStorage
const API_KEY = localStorage.getItem('admin_key') || '';

// Cek apakah sudah login
if (API_KEY) {
  showDashboard();
} else {
  document.getElementById('loginSection').style.display = 'block';
}

/**
 * Handle login form submission
 */
function handleLogin(e) {
  e.preventDefault();
  const key = document.getElementById('loginKey').value;
  
  // Simpan ke localStorage dan reload
  localStorage.setItem('admin_key', key);
  location.reload();
}

/**
 * Tampilkan dashboard dan sembunyikan login
 */
function showDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  
  // Load data
  loadLinks();
  loadStats();
}

/**
 * Handle create link form submission
 */
async function handleCreate(e) {
  e.preventDefault();
  
  const btn = document.getElementById('submitBtn');
  const originalText = btn.innerText;
  btn.innerHTML = '<span class="loading"></span> Generating...';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        imageUrl: document.getElementById('imageUrl').value,
        targetUrl: document.getElementById('targetUrl').value,
        customCode: document.getElementById('customCode').value,
        domain: document.getElementById('domain').value
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      displayResult(result.data);
      loadLinks(); // Refresh list
      loadStats(); // Refresh stats
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Gagal membuat link: ' + error.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

/**
 * Display generated link result
 */
function displayResult(data) {
  document.getElementById('generatedUrl').innerText = data.shortUrl;
  document.getElementById('previewDomain').innerText = data.domain;
  document.getElementById('previewTitle').innerText = data.title;
  document.getElementById('previewDesc').innerText = data.description;
  document.getElementById('previewImage').src = data.imageUrl;
  
  document.getElementById('resultSection').classList.add('show');
  
  // Scroll ke hasil
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Copy link ke clipboard
 */
function copyToClipboard() {
  const url = document.getElementById('generatedUrl').innerText;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link berhasil dicopy!');
  });
}

/**
 * Load semua links dari API
 */
async function loadLinks() {
  try {
    const response = await fetch('/api/list', {
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      handleAuthError();
      return;
    }
    
    renderLinksList(result.data);
  } catch (error) {
    document.getElementById('linksList').innerHTML = 
      '<div class="empty-state"><p>Gagal memuat data</p></div>';
  }
}

/**
 * Render links list ke DOM
 */
function renderLinksList(links) {
  const container = document.getElementById('linksList');
  
  if (links.length === 0) {
    container.innerHTML = 
      '<div class="empty-state">' +
      '<div class="empty-state-icon">📭</div>' +
      '<p>Belum ada link yang dibuat</p>' +
      '</div>';
    return;
  }
  
  container.innerHTML = links.map(link => 
    '<div class="link-item">' +
      '<div class="link-header">' +
        '<div class="link-title">' + escapeHtml(link.title) + '</div>' +
        '<button class="btn btn-danger" onclick="deleteLink(\'' + link.subdomain + '\')">Hapus</button>' +
      '</div>' +
      '<div class="link-meta">' +
        '<span class="badge">' + (link.clicks || 0) + ' klik</span>' +
        '<span style="color: #999; font-family: monospace; font-size: 12px">' + link.subdomain + '</span>' +
        '<span style="color: #bbb">•</span>' +
        '<span style="font-size: 12px">' + formatDate(link.createdAt) + '</span>' +
      '</div>' +
    '</div>'
  ).join('');
}

/**
 * Load statistik dari API
 */
async function loadStats() {
  try {
    const response = await fetch('/api/stats', {
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('statTotalLinks').innerText = result.data.totalLinks;
      document.getElementById('statTotalClicks').innerText = result.data.totalClicks;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

/**
 * Delete link confirmation dan execution
 */
async function deleteLink(subdomain) {
  if (!confirm('Yakin ingin menghapus link ini? Tindakan ini tidak bisa dibatalkan.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/delete/' + subdomain, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    
    const result = await response.json();
    
    if (result.success) {
      loadLinks(); // Refresh list
      loadStats(); // Refresh stats
    } else {
      alert('Gagal menghapus: ' + result.error);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

/**
 * Handle authentication error (token invalid)
 */
function handleAuthError() {
  localStorage.removeItem('admin_key');
  alert('Sesi berakhir, silakan login ulang');
  location.reload();
}

/**
 * Helper: Escape HTML untuk mencegah XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

/**
 * Helper: Format tanggal ke format lokal
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}
</script>

</body>
</html>`;
}
