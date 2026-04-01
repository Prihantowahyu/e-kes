// routes/auth.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/database');

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('pages/login', { title: 'Login — Sistem Kesiswaan' });
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND aktif = 1', [username]
    );
    if (!rows.length) {
      req.flash('error', 'Username tidak ditemukan atau akun tidak aktif.');
      return res.redirect('/login');
    }
    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Password salah.');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.id, username: user.username,
      nama: user.nama, role: user.role, kelas: user.kelas
    };
    req.flash('success', `Selamat datang, ${user.nama}!`);
    res.redirect('/dashboard');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Server error: ' + e.message);
    res.redirect('/login');
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// GET / → redirect
router.get('/', (req, res) => res.redirect('/dashboard'));

module.exports = router;
