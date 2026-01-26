/**
 * UTILITIES - Helper functions dan konfigurasi
 */

/**
 * Ambil konfigurasi dari environment variables
 * @param {Object} env - Environment variables dari Cloudflare
 * @returns {Object} - Konfigurasi yang sudah diparse
 */
export function getConfig(env) {
  // Parse multiple domains (dipisah dengan koma)
  const domains = env.DOMAIN ? env.DOMAIN.split(',').map(d => d.trim()) : ['localhost'];
  
  return {
    domains: domains,
    adminKey: env.ADMIN_KEY || 'admin',
    kvBinding: env.LINKS_DB || null
  };
}

/**
 * Validasi URL format
 * @param {string} string - URL yang akan dicek
 * @returns {boolean} - True jika valid
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Generate random string untuk kode link
 * @param {number} length - Panjang karakter
 * @returns {string} - Random string
 */
export function generateRandomCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sanitize input untuk mencegah injection
 * @param {string} code - Input user
 * @returns {string} - Input yang sudah dibersihkan
 */
export function sanitizeCode(code) {
  // Hanya izinkan alphanumeric dan dash
  return code.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 20);
}

/**
 * Escape HTML entities untuk mencegah XSS
 * @param {string} text - Text yang akan di-escape
 * @returns {string} - Text yang aman
 */
export function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
