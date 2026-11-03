const fs = require('fs');
const path = require('path');

// Simple robust CSV line parser handling quotes
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

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

// Fetch students from Google Sheet or fallback to data/students.json
async function fetchStudents() {
  let sheetId = process.env.GOOGLE_SHEET_ID ? process.env.GOOGLE_SHEET_ID.trim() : '';
  const gid = process.env.GOOGLE_SHEET_GID ? process.env.GOOGLE_SHEET_GID.trim() : '979263331';

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
          // Identify keys dynamically (handling common headers)
          const firstName = r['firstname'] || r['first'] || r['firstnames'] || '';
          const lastName = r['lastname'] || r['last'] || r['surname'] || '';
          const fullName = r['fullname'] || r['name'] || `${firstName} ${lastName}`.trim();
          const studentId = r['studentid'] || r['id'] || r['matric'] || r['matricno'] || r['studentnumber'] || '';

          if (studentId || fullName) {
            students.push({
              firstName,
              lastName,
              fullName,
              studentId
            });
          }
        }
        if (students.length > 0) {
          return students;
        }
      } else {
        console.warn(`[GoogleSheet] HTTP ${response.status} when fetching sheet ID ${sheetId}. Check that sharing is set to "Anyone with the link can view".`);
      }
    } catch (err) {
      console.warn('[GoogleSheet] Error fetching sheet:', err.message);
    }
  }

  // Local fallback
  try {
    const localPath = path.join(__dirname, '..', 'data', 'students.json');
    if (fs.existsSync(localPath)) {
      const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      return data.map(s => ({
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        fullName: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        studentId: s.studentId || ''
      }));
    }
  } catch (err) {
    console.error('Error reading local students.json:', err.message);
  }

  return [];
}

// Validate student record matching
function findStudentMatch(students, inputId, inputName) {
  const cleanId = (inputId || '').trim().toLowerCase();
  const cleanName = (inputName || '').trim().toLowerCase().replace(/\s+/g, ' ');

  for (const s of students) {
    const sId = (s.studentId || '').trim().toLowerCase();
    if (!sId || sId !== cleanId) continue;

    const sFirst = (s.firstName || '').trim().toLowerCase();
    const sLast = (s.lastName || '').trim().toLowerCase();
    const sFull = (s.fullName || `${sFirst} ${sLast}`).trim().toLowerCase().replace(/\s+/g, ' ');
    const sReverse = `${sLast} ${sFirst}`.trim().toLowerCase().replace(/\s+/g, ' ');

    if (cleanName === sFull || cleanName === sReverse) {
      return s;
    }
    // Also match if user typed first and last name matching both fields
    if (sFirst && sLast && (cleanName.includes(sFirst) && cleanName.includes(sLast))) {
      return s;
    }
  }
  return null;
}

module.exports = {
  fetchStudents,
  findStudentMatch
};
