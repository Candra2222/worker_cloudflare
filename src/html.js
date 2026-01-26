<script>
// ==========================================
// INISIALISASI & KONFIGURASI
// ==========================================

// Ambil API Key dari localStorage
const API_KEY = localStorage.getItem('admin_key') || '';

// Debug: Log status (buka console browser untuk lihat)
console.log('Status:', API_KEY ? 'Sudah login' : 'Belum login');

// ==========================================
// EVENT LISTENERS
// ==========================================

// Tunggu DOM fully loaded sebelum eksekusi
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Loaded');
  
  if (API_KEY) {
    console.log('Menampilkan dashboard...');
    showDashboard();
  } else {
    console.log('Menampilkan login form...');
    showLogin();
  }
});

// ==========================================
// NAVIGATION FUNCTIONS
// ==========================================

function showLogin() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard() {
  console.log('Memuat dashboard...');
  
  // Sembunyikan login, tampilkan dashboard
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  
  // Load data dengan delay kecil agar UI tidak freeze
  setTimeout(() => {
    loadStats();
    loadLinks();
  }, 100);
}

// ==========================================
// AUTHENTICATION
// ==========================================

function handleLogin(e) {
  e.preventDefault(); // Penting: Cegah form submission default
  
  const keyInput = document.getElementById('loginKey');
  const key = keyInput.value.trim();
  
  console.log('Login attempt...');
  
  if (!key) {
    alert('Password tidak boleh kosong!');
    return;
  }
  
  // Simpan ke localStorage
  localStorage.setItem('admin_key', key);
  
  // Tampilkan dashboard tanpa reload (lebih smooth)
  showDashboard();
  
  // Optional: Clear input
  keyInput.value = '';
}

function handleLogout() {
  localStorage.removeItem('admin_key');
  location.reload();
}

// ==========================================
// API CALLS
// ==========================================

async function loadLinks() {
  console.log('Loading links...');
  
  try {
    const response = await fetch('/api/list', {
      headers: { 
        'Authorization': 'Bearer ' + API_KEY 
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.status === 401) {
      // Password salah
      alert('Password tidak valid! Silakan login ulang.');
      handleLogout();
      return;
    }
    
    if (!response.ok) {
      throw new Error('Server error: ' + response.status);
    }
    
    const result = await response.json();
    console.log('Links loaded:', result.data.length);
    
    renderLinksList(result.data);
    
  } catch (error) {
    console.error('Error loading links:', error);
    document.getElementById('linksList').innerHTML = 
      '<div class="empty-state"><p>Gagal memuat data. Coba refresh.</p></div>';
  }
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats', {
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    
    if (response.status === 401) return; // Sudah dihandle di loadLinks
    
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('statTotalLinks').innerText = result.data.totalLinks;
      document.getElementById('statTotalClicks').innerText = result.data.totalClicks;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ==========================================
// LINK OPERATIONS
// ==========================================

async function handleCreate(e) {
  e.preventDefault();
  
  const btn = document.getElementById('submitBtn');
  const originalText = btn.innerText;
  
  // Loading state
  btn.innerHTML = '<span class="loading"></span> Generating...';
  btn.disabled = true;
  
  try {
    const domainSelect = document.getElementById('domain');
    const domain = domainSelect ? domainSelect.value : document.getElementById('domain').value;
    
    const payload = {
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      imageUrl: document.getElementById('imageUrl').value,
      targetUrl: document.getElementById('targetUrl').value,
      customCode: document.getElementById('customCode').value,
      domain: domain
    };
    
    console.log('Creating link...', payload);
    
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 401) {
      alert('Sesi habis. Silakan login ulang.');
      handleLogout();
      return;
    }
    
    const result = await response.json();
    
    if (result.success) {
      displayResult(result.data);
      loadLinks();
      loadStats();
      // Reset form
      document.getElementById('createForm').reset();
    } else {
      alert('Error: ' + result.error);
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert('Gagal membuat link: ' + error.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function displayResult(data) {
  document.getElementById('generatedUrl').innerText = data.shortUrl;
  document.getElementById('previewDomain').innerText = data.domain;
  document.getElementById('previewTitle').innerText = data.title;
  document.getElementById('previewDesc').innerText = data.description || '';
  document.getElementById('previewImage').src = data.imageUrl || '';
  
  document.getElementById('resultSection').style.display = 'block';
  document.getElementById('resultSection').classList.add('show');
  
  // Scroll ke hasil
  setTimeout(() => {
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

async function deleteLink(subdomain) {
  if (!confirm('Yakin hapus link "' + subdomain + '"?')) return;
  
  try {
    const response = await fetch('/api/delete/' + subdomain, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }
    
    const result = await response.json();
    
    if (result.success) {
      loadLinks();
      loadStats();
    }
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}

// ==========================================
// UTILITIES
// ==========================================

function copyToClipboard() {
  const url = document.getElementById('generatedUrl').innerText;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link dicopy!');
  }).catch(() => {
    // Fallback untuk mobile
    const textarea = document.createElement('textarea');
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Link dicopy!');
  });
}

function renderLinksList(links) {
  const container = document.getElementById('linksList');
  
  if (!links || links.length === 0) {
    container.innerHTML = 
      '<div class="empty-state">' +
      '<div class="empty-state-icon">📭</div>' +
      '<p>Belum ada link</p>' +
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
        '<span style="color: #999; font-family: monospace;">' + link.subdomain + '</span>' +
        '<span style="color: #bbb">•</span>' +
        '<span style="font-size: 12px; color: #666;">' + formatDate(link.createdAt) + '</span>' +
      '</div>' +
    '</div>'
  ).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}
</script>
