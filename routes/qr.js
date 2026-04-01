// routes/qr.js — QR Code Absensi Siswa
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated } = require('../middleware/auth');

// GET /qr — Halaman generate QR per kelas
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [kelasList] = await db.execute(
      'SELECT DISTINCT kelas FROM siswa WHERE status="Aktif" ORDER BY kelas'
    );
    res.render('pages/qr/index', {
      title: 'QR Code Absensi',
      kelasList,
      today: moment().format('YYYY-MM-DD'),
      hari: moment().locale('id').format('dddd')
    });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// GET /qr/scan/:token — Halaman scan QR (mobile friendly, tanpa login)
router.get('/scan/:token', async (req, res) => {
  try {
    // Token format: base64(kelas|tanggal)
    const decoded = Buffer.from(req.params.token, 'base64').toString('utf8');
    const [kelas, tanggal] = decoded.split('|');
    if (!kelas || !tanggal) return res.status(400).send('QR Code tidak valid.');

    const [siswa] = await db.execute(
      'SELECT * FROM siswa WHERE kelas=? AND status="Aktif" ORDER BY nama', [kelas]
    );

    // Ambil yang sudah absen hari ini
    const [sudahAbsen] = await db.execute(
      'SELECT nis, status_kehadiran FROM kehadiran WHERE kelas=? AND tanggal=? AND jam_ke="Penuh Hari"',
      [kelas, tanggal]
    );
    const sudahAbsenMap = {};
    sudahAbsen.forEach(s => { sudahAbsenMap[s.nis] = s.status_kehadiran; });

    res.render('pages/qr/scan', {
      title: `Absensi ${kelas} — ${tanggal}`,
      kelas, tanggal, siswa, sudahAbsenMap,
      hari: moment(tanggal).locale('id').format('dddd'),
      token: req.params.token,
      layout: false // halaman standalone tanpa sidebar
    });
  } catch(e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// POST /qr/absen — Submit absensi dari halaman scan
router.post('/absen', async (req, res) => {
  try {
    const { nis, status, kelas, tanggal, hari } = req.body;
    if (!nis || !status || !kelas || !tanggal) {
      return res.json({ ok: false, message: 'Data tidak lengkap.' });
    }

    const [siswaRows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [nis]);
    if (!siswaRows.length) return res.json({ ok: false, message: 'Siswa tidak ditemukan.' });
    const s = siswaRows[0];

    // Cek apakah sudah absen
    const [exist] = await db.execute(
      'SELECT id FROM kehadiran WHERE nis=? AND tanggal=? AND jam_ke="Penuh Hari"', [nis, tanggal]
    );
    if (exist.length) {
      return res.json({ ok: false, message: `${s.nama} sudah tercatat absen hari ini.` });
    }

    const now    = moment();
    const kodeKH = `KH-QR-${now.format('YYYYMMDD')}-${now.valueOf().toString().slice(-6)}`;
    const waktu  = now.format('YYYY-MM-DD HH:mm:ss');

    await db.execute(
      `INSERT INTO kehadiran (kode_kh,tanggal,hari,kelas,nis,nama_siswa,jenis_kelamin,status_kehadiran,jam_ke,keterangan,petugas_kbm,waktu_input)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [kodeKH, tanggal, hari||'', kelas, nis, s.nama, s.jenis_kelamin, status, 'Penuh Hari', 'Via QR Code', 'QR System', waktu]
    );

    // Auto catat pelanggaran jika Alpha/Terlambat/Bolos
    if (['Alpha','Terlambat','Bolos'].includes(status)) {
      const idPel = `PLG-QR-${now.format('YYYYMMDD')}-${now.valueOf().toString().slice(-5)}`;
      await db.execute(
        `INSERT INTO pelanggaran (kode,nis,nama_siswa,kelas,nama_wali,jenis_pelanggaran,tanggal,waktu,status,catatan,input_oleh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [idPel, nis, s.nama, kelas, s.nama_wali||'', status, tanggal, now.format('HH:mm:ss'),
         'Belum Dikonfirmasi', 'Input via QR Code Absensi', 'QR System']
      );
    }

    return res.json({ ok: true, message: `✅ ${s.nama} — ${status}`, nama: s.nama, status });
  } catch(e) {
    return res.json({ ok: false, message: e.message });
  }
});

// GET /qr/generate/:kelas/:tanggal — Generate token QR
router.get('/generate/:kelas/:tanggal', isAuthenticated, (req, res) => {
  const token = Buffer.from(`${req.params.kelas}|${req.params.tanggal}`).toString('base64');
  res.json({ token, url: `/qr/scan/${token}` });
});

module.exports = router;
