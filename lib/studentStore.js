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

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const firstName = (r['firstname'] || r['first'] || r['firstnames'] || '').trim();
          const lastName = (r['lastname'] || r['last'] || r['surname'] || '').trim();
          const fullName = (r['fullname'] || r['name'] || `${firstName} ${lastName}`).trim();
          const email = (r['email'] || r['emailaddress'] || '').trim();
          const phone = (r['phone'] || r['phonenumber'] || '').trim();
          const course = (r['course'] || r['program'] || 'Digital Marketing').trim();

          // Skip completely empty rows
          if (!firstName && !lastName && !email && !phone) continue;

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

          // Sequential fallback ID if admin hasn't entered an ID in the sheet yet
          const rowNum = students.length + 1;
          const fallbackId = `PEN-2026-${String(rowNum).padStart(4, '0')}`;

          students.push({
            firstName,
            lastName,
            fullName: fullName || `${firstName} ${lastName}`.trim(),
            studentId: studentId || fallbackId,
            explicitStudentId: studentId,
            fallbackId,
            email,
            phone,
            course
          });
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
function findStudentMatch(students, inputId, inputName = '', inputFirstName = '', inputLastName = '') {
  const normInputId = normalizeId(inputId);
  if (!normInputId) return null;

  const rawFirst = (inputFirstName || '').trim();
  const rawLast = (inputLastName || '').trim();
  const combinedName = (inputName || `${rawFirst} ${rawLast}`).trim();
  const normInputName = normalizeText(combinedName);
  const normInputFirst = normalizeText(rawFirst);
  const normInputLast = normalizeText(rawLast);

  if (!normInputName && !normInputFirst && !normInputLast) return null;

  for (const s of students) {
    const normStudentId = normalizeId(s.studentId);
    const normExplicitId = normalizeId(s.explicitStudentId);
    const normFallbackId = normalizeId(s.fallbackId);
    const normPhone = normalizeId(s.phone);
    const normEmail = normalizeId(s.email);

    // Matches if input matches:
    // 1. The assigned Student ID (e.g. PEN-2026-0006 or PEN-2026-0001)
    // 2. The explicit Student ID entered in Google Sheet
    // 3. The sequential fallback ID
    // 4. The student's registered phone number (e.g. 07076630396)
    // 5. The student's registered email
    const idMatches = (normStudentId && normStudentId === normInputId) ||
                      (normExplicitId && normExplicitId === normInputId) ||
                      (normFallbackId && normFallbackId === normInputId) ||
                      (normPhone && normPhone.length >= 7 && (normPhone === normInputId || normInputId.endsWith(normPhone) || normPhone.endsWith(normInputId))) ||
                      (normEmail && normEmail.length >= 5 && normEmail === normInputId);

    if (!idMatches) continue;

    // Student ID matches! Now verify name
    const sFirst = normalizeText(s.firstName);
    const sLast = normalizeText(s.lastName);
    const sFull = normalizeText(s.fullName || `${sFirst} ${sLast}`);
    const sReverse = `${sLast} ${sFirst}`.trim();
    const sEmailPrefix = normalizeText((s.email || '').split('@')[0]);

    // A. Direct First Name & Last Name matching
    if (normInputFirst && normInputLast) {
      // 1. Direct match (e.g. First: Mofe, Last: Tuyi)
      if (normInputFirst === sFirst && normInputLast === sLast) return s;
      // 2. Swapped match (in case user entered surname in first name field)
      if (normInputFirst === sLast && normInputLast === sFirst) return s;
      // 3. Name variations (e.g. Mofeoluwa matching Mofe)
      const firstOk = (normInputFirst === sFirst) ||
                      (sFirst.length >= 3 && normInputFirst.includes(sFirst)) ||
                      (normInputFirst.length >= 3 && sFirst.includes(normInputFirst));
      const lastOk = (normInputLast === sLast) ||
                     (sLast.length >= 3 && normInputLast.includes(sLast)) ||
                     (normInputLast.length >= 3 && sLast.includes(normInputLast));
      if (firstOk && lastOk) return s;
    }

    // B. Combined full name matching
    if (normInputName) {
      if (normInputName === sFull || normInputName === sReverse) return s;
      if (sFirst && sLast && normInputName.includes(sFirst) && normInputName.includes(sLast)) return s;
      if ((sFirst && normInputName === sFirst) || (sLast && normInputName === sLast)) return s;
      if (sFirst.length >= 3 && normInputName.includes(sFirst)) return s;
      if (sLast.length >= 3 && normInputName.includes(sLast)) return s;
      if (normInputName.length >= 3 && sFull.includes(normInputName)) return s;
      if (sEmailPrefix && sEmailPrefix.length >= 3 && (normInputName === sEmailPrefix || normInputName.includes(sEmailPrefix))) return s;
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
