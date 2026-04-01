// routes/users.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const bcrypt  = require('bcryptjs');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  const [users] = await db.execute('SELECT id,username,nama,role,kelas,aktif,created_at FROM users ORDER BY nama');
  res.render('pages/users/index', { title: 'Manajemen User', users });
});

router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  const { username, password, nama, role, kelas } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (username,password,nama,role,kelas) VALUES (?,?,?,?,?)',
      [username, hash, nama, role, kelas||null]);
    req.flash('success', `User ${nama} berhasil dibuat.`);
    res.redirect('/users');
  } catch (e) {
    req.flash('error', e.code === 'ER_DUP_ENTRY' ? 'Username sudah digunakan.' : e.message);
    res.redirect('/users');
  }
});

router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { nama, role, kelas, aktif, password } = req.body;
  try {
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 10);
      await db.execute('UPDATE users SET nama=?,role=?,kelas=?,aktif=?,password=? WHERE id=?',
        [nama, role, kelas||null, aktif?1:0, hash, req.params.id]);
    } else {
      await db.execute('UPDATE users SET nama=?,role=?,kelas=?,aktif=? WHERE id=?',
        [nama, role, kelas||null, aktif?1:0, req.params.id]);
    }
    req.flash('success', 'User berhasil diperbarui.');
    res.redirect('/users');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/users');
  }
});

router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  if (req.params.id == req.session.user.id) {
    req.flash('error', 'Tidak dapat menghapus akun sendiri.');
    return res.redirect('/users');
  }
  await db.execute('DELETE FROM users WHERE id=?', [req.params.id]);
  req.flash('success', 'User dihapus.');
  res.redirect('/users');
});

module.exports = router;
