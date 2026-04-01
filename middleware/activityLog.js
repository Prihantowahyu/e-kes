// middleware/activityLog.js
const db = require('../config/database');

async function log(req, aksi, tabel = null, refId = null, detail = null) {
  try {
    const user = req.session && req.session.user;
    const ip   = req.ip || req.connection.remoteAddress || '-';
    await db.execute(
      'INSERT INTO activity_log (user_id, username, nama, aksi, tabel, ref_id, detail, ip_address) VALUES (?,?,?,?,?,?,?,?)',
      [user?.id||null, user?.username||'system', user?.nama||'system', aksi, tabel, refId, detail, ip]
    );
  } catch(e) {
    // Log error tidak boleh crash aplikasi
    console.error('[Activity Log Error]', e.message);
  }
}

module.exports = { log };
