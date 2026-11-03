const fs = require('fs');
const path = require('path');

// Fallback sheet configuration (Google Sheet ID & GID)
const DEFAULT_SHEET_ID = '1vE2xyPFCRN9XJfqErAF0W4DVUMPaWRVB7lLpUsNzdW0';
const DEFAULT_SHEET_GID = '979263331';

// In-memory cache for fast logins & resilience
let cachedStudents = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

// Simple robust CSV line parser handling quotes
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// Fetch students from live Google Sheet with caching and local fallback
async function fetchStudents(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedStudents.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedStudents;
  }

  let sheetId = process.env.GOOGLE_SHEET_ID ? process.env.GOOGLE_SHEET_ID.trim() : DEFAULT_SHEET_ID;
  const gid = process.env.GOOGLE_SHEET_GID ? process.env.GOOGLE_SHEET_GID.trim() : DEFAULT_SHEET_GID;

  // If user pasted full URL in env, extract the ID
  if (sheetId.includes('/spreadsheets/d/')) {
    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) sheetId = match[1];
  }

  if (sheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const text = await response.text();
        const { rows } = parseCsv(text);
        const students = [];

        for (const r of rows) {
          const firstName = (r['firstname'] || r['first'] || r['firstnames'] || '').trim();
          const lastName = (r['lastname'] || r['last'] || r['surname'] || '').trim();
          const fullName = (r['fullname'] || r['name'] || `${firstName} ${lastName}`).trim();
          const email = (r['email'] || r['emailaddress'] || '').trim();
          const phone = (r['phone'] || r['phonenumber'] || '').trim();
          const course = (r['course'] || r['program'] || 'Digital Marketing').trim();

          let studentId = (r['studentid'] || r['id'] || r['matric'] || r['matricno'] || r['studentnumber'] || '').trim();

          // If studentId column is empty or invalid, scan all cells for standard Pencraft pattern (e.g. PEN-2026-0006)
          if (!studentId || !studentId.toUpperCase().includes('PEN')) {
            for (const val of Object.values(r)) {
              if (typeof val === 'string' && /PEN[-\s_]?\d{4}[-\s_]?\d{3,5}/i.test(val.trim())) {
                studentId = val.trim();
                break;
              }
            }
          }

          if (studentId || fullName) {
            students.push({
              firstName,
              lastName,
              fullName: fullName || `${firstName} ${lastName}`.trim(),
              studentId,
              email,
              phone,
              course
            });
          }
        }

        if (students.length > 0) {
          cachedStudents = students;
          cacheTimestamp = now;
          return students;
        }
      } else {
        console.warn(`[GoogleSheet] HTTP ${response.status} when fetching sheet ID ${sheetId}.`);
      }
    } catch (err) {
      console.warn('[GoogleSheet] Error fetching sheet:', err.message);
    }
  }

  // If live fetch failed but we have cached students, return cache
  if (cachedStudents.length > 0) {
    return cachedStudents;
  }

  // Local fallback from data/students.json
  try {
    const localPath = path.join(__dirname, '..', 'data', 'students.json');
    if (fs.existsSync(localPath)) {
      const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      const fallbackList = data.map(s => ({
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        fullName: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        studentId: s.studentId || '',
        email: s.email || '',
        phone: s.phone || '',
        course: s.course || 'Digital Marketing'
      }));
      cachedStudents = fallbackList;
      cacheTimestamp = now;
      return fallbackList;
    }
  } catch (err) {
    console.error('Error reading local students.json:', err.message);
  }

  return [];
}

// Normalize ID for comparison: remove all spaces, hyphens, underscores and uppercase
function normalizeId(id) {
  return (id || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Normalize text for flexible name matching
function normalizeText(text) {
  return (text || '').toString().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Validate student record matching
function findStudentMatch(students, inputId, inputName) {
  const normInputId = normalizeId(inputId);
  const normInputName = normalizeText(inputName);

  if (!normInputId || !normInputName) return null;

  for (const s of students) {
    const normStudentId = normalizeId(s.studentId);
    if (!normStudentId || normStudentId !== normInputId) continue;

    // Student ID matches! Now verify name
    const sFirst = normalizeText(s.firstName);
    const sLast = normalizeText(s.lastName);
    const sFull = normalizeText(s.fullName || `${sFirst} ${sLast}`);
    const sReverse = `${sLast} ${sFirst}`.trim();
    const sEmailPrefix = normalizeText((s.email || '').split('@')[0]);

    // 1. Exact match on full name or reversed name (e.g. "Mofe Tuyi" or "Tuyi Mofe")
    if (normInputName === sFull || normInputName === sReverse) {
      return s;
    }

    // 2. Input contains both first name and last name
    if (sFirst && sLast && normInputName.includes(sFirst) && normInputName.includes(sLast)) {
      return s;
    }

    // 3. User entered just first name or just last name (e.g. "Mofe" or "Tuyi")
    if ((sFirst && normInputName === sFirst) || (sLast && normInputName === sLast)) {
      return s;
    }

    // 4. Partial substring match for common name extensions (e.g. "Mofeoluwa" when sheet has "Mofe")
    if (sFirst.length >= 3 && normInputName.includes(sFirst)) {
      return s;
    }
    if (sLast.length >= 3 && normInputName.includes(sLast)) {
      return s;
    }
    if (normInputName.length >= 3 && sFull.includes(normInputName)) {
      return s;
    }

    // 5. Match on email prefix if student used their email username
    if (sEmailPrefix && sEmailPrefix.length >= 3 && (normInputName === sEmailPrefix || normInputName.includes(sEmailPrefix))) {
      return s;
    }
  }

  return null;
}

module.exports = {
  fetchStudents,
  findStudentMatch,
  normalizeId,
  normalizeText,
  DEFAULT_SHEET_ID,
  DEFAULT_SHEET_GID
};
