// routes/profil.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const bcrypt  = require('bcryptjs');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const actLog  = require('../middleware/activityLog');

// GET /profil
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [logs] = await db.execute(
      'SELECT * FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 30',
      [req.session.user.id]
    );
    res.render('pages/profil/index', { title: 'Profil Saya', logs });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// POST /profil/ganti-password
router.post('/ganti-password', isAuthenticated, async (req, res) => {
  const { password_lama, password_baru, password_konfirmasi } = req.body;
  try {
    if (password_baru !== password_konfirmasi) {
      req.flash('error', 'Password baru dan konfirmasi tidak cocok.');
      return res.redirect('/profil');
    }
    if (password_baru.length < 6) {
      req.flash('error', 'Password baru minimal 6 karakter.');
      return res.redirect('/profil');
    }
    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.session.user.id]);
    if (!rows.length) { req.flash('error','User tidak ditemukan'); return res.redirect('/profil'); }

    const match = await bcrypt.compare(password_lama, rows[0].password);
    if (!match) { req.flash('error', 'Password lama salah.'); return res.redirect('/profil'); }

    const hash = await bcrypt.hash(password_baru, 10);
    await db.execute('UPDATE users SET password=? WHERE id=?', [hash, req.session.user.id]);
    await actLog.log(req, 'Ganti Password', 'users', req.session.user.id);
    req.flash('success', 'Password berhasil diubah. Silakan login ulang.');
    req.session.destroy(() => res.redirect('/login'));
  } catch(e) {
    req.flash('error', e.message); res.redirect('/profil');
  }
});

// GET /profil/log-aktivitas (admin only)
router.get('/log-aktivitas', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { q, tabel, dari, sampai } = req.query;
    let sql = 'SELECT * FROM activity_log WHERE 1=1';
    const params = [];
    if (q)      { sql += ' AND (username LIKE ? OR aksi LIKE ? OR detail LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    if (tabel)  { sql += ' AND tabel=?'; params.push(tabel); }
    if (dari)   { sql += ' AND DATE(created_at)>=?'; params.push(dari); }
    if (sampai) { sql += ' AND DATE(created_at)<=?'; params.push(sampai); }
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const [logs] = await db.execute(sql, params);
    res.render('pages/profil/log', { title: 'Log Aktivitas', logs, filter: { q, tabel, dari, sampai } });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

module.exports = router;
