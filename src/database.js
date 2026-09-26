const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'bot.db');
let db;
let saveTimer = null;

async function init() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, created_at DESC)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_memory (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      notes TEXT DEFAULT '',
      first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now')),
      message_count INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS diary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      mood TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS emotion_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emotion TEXT NOT NULL,
      intensity INTEGER DEFAULT 5,
      trigger_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS relationship_stats (
      user_id TEXT PRIMARY KEY,
      affection INTEGER DEFAULT 50,
      trust INTEGER DEFAULT 50,
      jealousy INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fight_state (
      user_id TEXT PRIMARY KEY,
      active INTEGER DEFAULT 0,
      reason TEXT DEFAULT '',
      started_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS anniversary_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      event TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anniv_user ON anniversary_dates(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS skinship_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_skinship_user ON skinship_log(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS topic_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      topic TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  save();
  console.log('[DB] 初期化完了');
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    save();
    saveTimer = null;
  }, 5000);
}

function addMessage(userId, channelId, role, content) {
  db.run(
    'INSERT INTO conversations (user_id, channel_id, role, content) VALUES (?, ?, ?, ?)',
    [userId, channelId, role, content]
  );
  scheduleSave();
}

function getRecentHistory(userId, limit = 20) {
  const stmt = db.prepare(
    'SELECT role, content FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  );
  stmt.bind([userId, limit]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.reverse();
}

function touchUser(userId, displayName) {
  const existing = getUser(userId);
  if (existing) {
    db.run(
      `UPDATE user_memory SET display_name = ?, last_seen = datetime('now'), message_count = message_count + 1 WHERE user_id = ?`,
      [displayName, userId]
    );
  } else {
    db.run(
      `INSERT INTO user_memory (user_id, display_name) VALUES (?, ?)`,
      [userId, displayName]
    );
  }
  scheduleSave();
}

function getUser(userId) {
  const stmt = db.prepare('SELECT * FROM user_memory WHERE user_id = ?');
  stmt.bind([userId]);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function setUserNotes(userId, notes) {
  db.run('UPDATE user_memory SET notes = ? WHERE user_id = ?', [notes, userId]);
  scheduleSave();
}

function getUserMessageCount(userId) {
  const user = getUser(userId);
  return user?.message_count || 0;
}

function clearHistory(userId) {
  db.run('DELETE FROM conversations WHERE user_id = ?', [userId]);
  scheduleSave();
}

function getStats() {
  let users = 0, messages = 0;
  const s1 = db.prepare('SELECT COUNT(*) as c FROM user_memory');
  if (s1.step()) users = s1.getAsObject().c;
  s1.free();
  const s2 = db.prepare('SELECT COUNT(*) as c FROM conversations');
  if (s2.step()) messages = s2.getAsObject().c;
  s2.free();
  return { users, messages };
}

function addMemory(userId, key, content) {
  db.run('INSERT INTO memories (user_id, key, content) VALUES (?, ?, ?)', [userId, key, content]);
  scheduleSave();
}

function getMemories(userId, query) {
  let sql = 'SELECT key, content, created_at FROM memories WHERE user_id = ?';
  const params = [userId];
  if (query) {
    sql += ' AND (content LIKE ? OR key LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT 30';
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function searchHistory(userId, keyword) {
  const stmt = db.prepare(
    'SELECT role, content, created_at FROM conversations WHERE user_id = ? AND content LIKE ? ORDER BY id DESC LIMIT 15'
  );
  stmt.bind([userId, `%${keyword}%`]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.reverse();
}

function addDiary(content, mood) {
  db.run('INSERT INTO diary (content, mood) VALUES (?, ?)', [content, mood || null]);
  scheduleSave();
}

function getDiary(limit = 10) {
  const stmt = db.prepare('SELECT * FROM diary ORDER BY id DESC LIMIT ?');
  stmt.bind([limit]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows.reverse();
}

function addPromise(userId, content) {
  db.run('INSERT INTO promises (user_id, content) VALUES (?, ?)', [userId, content]);
  scheduleSave();
}

function getPromises(userId, status) {
  let sql = 'SELECT * FROM promises WHERE user_id = ?';
  const params = [userId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY id DESC LIMIT 20';
  const stmt = db.prepare(sql); stmt.bind(params);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function updatePromise(id, status) {
  db.run('UPDATE promises SET status = ? WHERE id = ?', [status, id]);
  scheduleSave();
}

function logEmotion(emotion, intensity, trigger) {
  db.run('INSERT INTO emotion_log (emotion, intensity, trigger_text) VALUES (?, ?, ?)', [emotion, intensity, trigger]);
  scheduleSave();
}

function getEmotionLog(limit = 10) {
  const stmt = db.prepare('SELECT * FROM emotion_log ORDER BY id DESC LIMIT ?');
  stmt.bind([limit]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows.reverse();
}

function getRelStats(userId) {
  const stmt = db.prepare('SELECT * FROM relationship_stats WHERE user_id = ?');
  stmt.bind([userId]);
  let row = null; if (stmt.step()) row = stmt.getAsObject(); stmt.free();
  return row;
}

function updateRelStats(userId, field, delta) {
  const existing = getRelStats(userId);
  if (!existing) {
    db.run('INSERT INTO relationship_stats (user_id) VALUES (?)', [userId]);
  }
  const val = Math.max(0, Math.min(100, (existing?.[field] || 50) + delta));
  db.run(`UPDATE relationship_stats SET ${field} = ?, last_updated = datetime('now') WHERE user_id = ?`, [val, userId]);
  scheduleSave();
  return val;
}

function deleteMemory(userId, key) {
  db.run('DELETE FROM memories WHERE user_id = ? AND key = ?', [userId, key]);
  scheduleSave();
}

function getConversationCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE user_id = ? AND role = ?');
  stmt.bind([userId, 'user']);
  let count = 0; if (stmt.step()) count = stmt.getAsObject().c; stmt.free();
  return count;
}

function getFirstConversationDate(userId) {
  const stmt = db.prepare('SELECT created_at FROM conversations WHERE user_id = ? ORDER BY id ASC LIMIT 1');
  stmt.bind([userId]);
  let date = null; if (stmt.step()) date = stmt.getAsObject().created_at; stmt.free();
  return date;
}

function getFightState(userId) {
  const stmt = db.prepare('SELECT * FROM fight_state WHERE user_id = ? AND active = 1');
  stmt.bind([userId]);
  let row = null; if (stmt.step()) row = stmt.getAsObject(); stmt.free();
  if (row) {
    const mins = (Date.now() - new Date(row.started_at + 'Z').getTime()) / 60000;
    if (mins > 60) { clearFightState(userId); return null; }
    row.minutesAgo = Math.floor(mins);
  }
  return row;
}

function setFightState(userId, reason) {
  db.run("INSERT OR REPLACE INTO fight_state (user_id, active, reason, started_at) VALUES (?, 1, ?, datetime('now'))", [userId, reason]);
  scheduleSave();
}

function clearFightState(userId) {
  db.run('UPDATE fight_state SET active = 0 WHERE user_id = ?', [userId]);
  scheduleSave();
}

function addAnniversaryDate(userId, date, event) {
  db.run('INSERT INTO anniversary_dates (user_id, date, event) VALUES (?, ?, ?)', [userId, date, event]);
  scheduleSave();
}

function getAnniversaryDates(userId) {
  const stmt = db.prepare('SELECT * FROM anniversary_dates WHERE user_id = ? ORDER BY date');
  stmt.bind([userId]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function getUpcomingAnniversaries() {
  const stmt = db.prepare('SELECT * FROM anniversary_dates ORDER BY date');
  stmt.bind([]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function addSkinship(userId, type) {
  db.run('INSERT INTO skinship_log (user_id, type) VALUES (?, ?)', [userId, type]);
  scheduleSave();
}

function getSkinshipStats(userId) {
  const stmt = db.prepare('SELECT type, COUNT(*) as count FROM skinship_log WHERE user_id = ? GROUP BY type ORDER BY count DESC');
  stmt.bind([userId]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function getRecentTopics(userId, limit = 5) {
  const stmt = db.prepare('SELECT topic, created_at FROM topic_log WHERE user_id = ? ORDER BY id DESC LIMIT ?');
  stmt.bind([userId, limit]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function addTopic(userId, channelId, topic) {
  db.run('INSERT INTO topic_log (user_id, channel_id, topic) VALUES (?, ?, ?)', [userId, channelId, topic]);
  scheduleSave();
}

function getAllBoyfriendStats() {
  const stmt = db.prepare('SELECT rs.user_id, rs.affection, rs.trust, rs.jealousy, um.display_name, um.message_count FROM relationship_stats rs LEFT JOIN user_memory um ON rs.user_id = um.user_id ORDER BY rs.affection DESC');
  stmt.bind([]);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
  return rows;
}

function close() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  save();
}

module.exports = {
  init, addMessage, getRecentHistory, touchUser, getUser,
  setUserNotes, getUserMessageCount, clearHistory, getStats, close,
  addMemory, getMemories, searchHistory, deleteMemory,
  addDiary, getDiary, addPromise, getPromises, updatePromise,
  logEmotion, getEmotionLog, getRelStats, updateRelStats,
  getConversationCount, getFirstConversationDate,
  getFightState, setFightState, clearFightState,
  addAnniversaryDate, getAnniversaryDates, getUpcomingAnniversaries,
  addSkinship, getSkinshipStats,
  getRecentTopics, addTopic, getAllBoyfriendStats,
};
