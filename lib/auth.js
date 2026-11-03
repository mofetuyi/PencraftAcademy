const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'pencraft_default_secret_fallback_key_2026';

// Sign token
function createToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// Verify token
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Convert Google Drive link to preview embed format
function convertDriveToEmbed(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Pattern 1: /file/d/ID/...
  const match1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) {
    return `https://drive.google.com/file/d/${match1[1]}/preview`;
  }

  // Pattern 2: ?id=ID
  const match2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) {
    return `https://drive.google.com/file/d/${match2[1]}/preview`;
  }

  // Pattern 3: already /preview
  if (trimmed.includes('/preview')) {
    return trimmed;
  }

  return trimmed;
}

// In-memory brute force lockout tracker
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 mins

function checkRateLimit(key) {
  const record = failedAttempts.get(key);
  if (!record) return { allowed: true };

  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    failedAttempts.delete(key);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const remainingMins = Math.ceil((LOCKOUT_MS - (Date.now() - record.lastAttempt)) / 60000);
    return {
      allowed: false,
      message: `Too many unsuccessful attempts. For security, please try again in ${remainingMins} minute(s).`
    };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

function recordFailedAttempt(key) {
  const record = failedAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(key, record);
}

function resetFailedAttempts(key) {
  failedAttempts.delete(key);
}

module.exports = {
  createToken,
  verifyToken,
  convertDriveToEmbed,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts
};
