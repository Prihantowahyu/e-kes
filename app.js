// app.js - Main Application
require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const flash          = require('connect-flash');
const methodOverride = require('method-override');
const path           = require('path');
const multer         = require('multer');
const fs             = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── UPLOAD DIR ────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── VIEW ENGINE ───────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'kesiswaan_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));
app.use(flash());

// ── GLOBAL LOCALS ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user         = req.session.user || null;
  res.locals.success_msg  = req.flash('success');
  res.locals.error_msg    = req.flash('error');
  res.locals.info_msg     = req.flash('info');
  next();
});

// ── ROUTES ────────────────────────────────────────────────────
app.use('/',            require('./routes/auth'));
app.use('/dashboard',   require('./routes/dashboard'));
app.use('/siswa',       require('./routes/siswa'));
app.use('/pelanggaran', require('./routes/pelanggaran'));
app.use('/sp',          require('./routes/sp'));
app.use('/penyitaan',   require('./routes/penyitaan'));
app.use('/kehadiran',   require('./routes/kehadiran'));
app.use('/users',       require('./routes/users'));
app.use('/petugas',     require('./routes/petugas'));
app.use('/laporan',     require('./routes/laporan'));
app.use('/notif',       require('./routes/notif'));
app.use('/profil',      require('./routes/profil'));
app.use('/piket',       require('./routes/piket'));
app.use('/qr',          require('./routes/qr'));
app.use('/rapor',       require('./routes/rapor'));
app.use('/wali',        require('./routes/wali'));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Halaman Tidak Ditemukan' });
});

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('pages/error', { title: 'Server Error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
