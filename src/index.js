/**
 * FB LINK GENERATOR - WORKER ENTRY POINT
 * 
 * Aplikasi ini berjalan di Cloudflare Workers
 * Fungsi: Generate short link dengan subdomain unik untuk redirect ke offer
 * Fitur: Multiple domain support, KV storage, OG Tags untuk Facebook
 */

// Import handlers dari file terpisah (untuk modularitas)
import { handleRedirect, handleApi } from './handlers.js';
import { dashboardHTML } from './html.js';
import { getConfig } from './utils.js';

// Export default handler untuk Cloudflare Workers
export default {
  /**
   * Fungsi utama yang menangani setiap request masuk
   * @param {Request} request - Request object dari client
   * @param {Object} env - Environment variables (termasuk KV bindings)
   * @param {ExecutionContext} ctx - Execution context untuk background tasks
   */
  async fetch(request, env, ctx) {
    // Parse URL untuk analisis path dan hostname
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    // Ambil konfigurasi (domain yang tersedia, dll)
    const config = getConfig(env);
    
    // ==========================================
    // ROUTING LOGIC
    // ==========================================
    
    // 1. CEK SUBDOMAIN - Jika akses via subdomain (contoh: abc123.domain.com)
    // Maka ini adalah link redirect, bukan dashboard
    if (isSubdomain(hostname, config.domains)) {
      const subdomain = extractSubdomain(hostname);
      return handleRedirect(request, env, subdomain, ctx, config);
    }
    
    // 2. API ROUTES - Endpoint untuk create/list/delete links
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, pathname, config);
    }
    
    // 3. STATIC ASSETS - CSS, JS, images (jika ada)
    if (pathname.startsWith('/static/')) {
      return serveStatic(pathname);
    }
    
    // 4. DASHBOARD UI - Halaman admin utama
    return new Response(dashboardHTML(config), {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache' // Selalu ambil versi terbaru
      }
    });
  }
};

/**
 * Cek apakah hostname adalah subdomain (bukan domain utama)
 * @param {string} hostname - Hostname dari request (contoh: abc123.domain.com)
 * @param {Array} domains - List domain utama yang diizinkan
 * @returns {boolean} - True jika ini subdomain
 */
function isSubdomain(hostname, domains) {
  // Cek apakah hostname mengandung titik (berarti ada subdomain)
  // Dan bukan www (www adalah exception)
  // Dan bukan domain utama yang terdaftar
  if (!hostname.includes('.')) return false;
  if (hostname.startsWith('www.')) return false;
  
  // Cek apakah hostname cocok dengan salah satu domain utama
  for (const domain of domains) {
    if (hostname === domain) return false; // Ini domain utama, bukan subdomain
    if (hostname.endsWith('.' + domain)) return true; // Ini subdomain
  }
  
  return false;
}

/**
 * Ekstrak nama subdomain dari hostname
 * @param {string} hostname - Full hostname (contoh: abc123.domain.com)
 * @returns {string} - Nama subdomain (contoh: abc123)
 */
function extractSubdomain(hostname) {
  // Split hostname berdasarkan titik, ambil elemen pertama
  return hostname.split('.')[0];
}

/**
 * Serve static files (CSS, JS, dll) - Placeholder untuk pengembangan future
 */
function serveStatic(pathname) {
  return new Response('Not implemented', { status: 501 });
    }
