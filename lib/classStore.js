const fs = require('fs');
const path = require('path');
const { convertDriveToEmbed } = require('./auth');

const CLASSES_FILE = path.join(__dirname, '..', 'data', 'classes.json');

function getClasses() {
  try {
    if (!fs.existsSync(CLASSES_FILE)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(CLASSES_FILE, 'utf8'));
    // Ensure embedUrl is always dynamically available
    const normalized = data.map(c => ({
      ...c,
      embedUrl: c.embedUrl || convertDriveToEmbed(c.driveUrl)
    }));
    // Sort newest first by date or creation
    return normalized.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } catch (err) {
    console.error('Error reading classes:', err.message);
    return [];
  }
}

function saveClasses(classes) {
  try {
    fs.mkdirSync(path.dirname(CLASSES_FILE), { recursive: true });
    fs.writeFileSync(CLASSES_FILE, JSON.stringify(classes, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving classes:', err.message);
    return false;
  }
}

function addClass({ title, date, driveUrl, notes }) {
  const list = getClasses();
  const newClass = {
    id: 'class_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    title: (title || 'Untitled Session').trim(),
    date: date || new Date().toISOString().split('T')[0],
    driveUrl: (driveUrl || '').trim(),
    embedUrl: convertDriveToEmbed(driveUrl),
    notes: (notes || '').trim()
  };
  list.unshift(newClass);
  saveClasses(list);
  return newClass;
}

function updateClass(id, { title, date, driveUrl, notes }) {
  const list = getClasses();
  const index = list.findIndex(c => c.id === id);
  if (index === -1) return null;

  list[index].title = (title || list[index].title).trim();
  list[index].date = date || list[index].date;
  if (driveUrl !== undefined) {
    list[index].driveUrl = driveUrl.trim();
    list[index].embedUrl = convertDriveToEmbed(driveUrl);
  }
  if (notes !== undefined) {
    list[index].notes = notes.trim();
  }

  saveClasses(list);
  return list[index];
}

function deleteClass(id) {
  const list = getClasses();
  const filtered = list.filter(c => c.id !== id);
  if (filtered.length === list.length) return false;
  saveClasses(filtered);
  return true;
}

module.exports = {
  getClasses,
  addClass,
  updateClass,
  deleteClass
};
