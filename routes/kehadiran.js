// routes/kehadiran.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated } = require('../middleware/auth');

// GET /kehadiran
router.get('/', isAuthenticated, async (req, res) => {
  const { tanggal, kelas, status } = req.query;
  const tgl = tanggal || moment().format('YYYY-MM-DD');
  let sql = 'SELECT * FROM kehadiran WHERE 1=1';
  const params = [];
  if (tgl)    { sql += ' AND tanggal = ?'; params.push(tgl); }
  if (kelas)  { sql += ' AND kelas = ?'; params.push(kelas); }
  if (status) { sql += ' AND status_kehadiran = ?'; params.push(status); }
  sql += ' ORDER BY kelas, nama_siswa';
  try {
    const [kehadiran]   = await db.execute(sql, params);
    const [kelasList]   = await db.execute('SELECT DISTINCT kelas FROM siswa WHERE status="Aktif" ORDER BY kelas');
    const [petugasKBM]  = await db.execute('SELECT * FROM petugas_kbm WHERE aktif=1');

    // Summary hari ini
    const [sumRows] = await db.execute(`
      SELECT status_kehadiran, COUNT(*) AS jml FROM kehadiran WHERE tanggal=? GROUP BY status_kehadiran`, [tgl]);
    const summary = { Hadir:0, Alpha:0, Terlambat:0, Izin:0, Sakit:0, Bolos:0 };
    sumRows.forEach(r => { summary[r.status_kehadiran] = r.jml; });

    res.render('pages/kehadiran/index', { title: 'Rekap Kehadiran', kehadiran, kelasList, petugasKBM, summary, filter: { tanggal: tgl, kelas, status } });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// GET /kehadiran/input — form input massal
router.get('/input', isAuthenticated, async (req, res) => {
  const { kelas, tanggal } = req.query;
  try {
    const [kelasList]  = await db.execute('SELECT DISTINCT kelas FROM siswa WHERE status="Aktif" ORDER BY kelas');
    const [petugasKBM] = await db.execute('SELECT * FROM petugas_kbm WHERE aktif=1');
    let siswaKelas = [];
    if (kelas) {
      siswaKelas = (await db.execute('SELECT * FROM siswa WHERE kelas=? AND status="Aktif" ORDER BY nama', [kelas]))[0];
    }
    const tgl = tanggal || moment().format('YYYY-MM-DD');
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(tgl).getDay()];
    res.render('pages/kehadiran/input', { title: 'Input Kehadiran', kelasList, petugasKBM, siswaKelas, filter: { kelas, tanggal: tgl }, hari });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/kehadiran');
  }
});

// POST /kehadiran/input
router.post('/input', isAuthenticated, async (req, res) => {
  const { tanggal, hari, kelas, jam_ke, petugas_kbm, lokasi } = req.body;
  const siswaData = req.body.siswa || [];
  try {
    if (!Array.isArray(siswaData) || !siswaData.length) {
      req.flash('error', 'Tidak ada data siswa.');
      return res.redirect('/kehadiran/input?kelas=' + kelas + '&tanggal=' + tanggal);
    }
    const now     = moment();
    const waktuIn = now.format('YYYY-MM-DD HH:mm:ss');
    const rowsKh  = [];
    const rowsPel = [];
    const statusPel = { Alpha:'Alpha', Terlambat:'Terlambat', Bolos:'Bolos' };

    siswaData.forEach((s, i) => {
      const idKH = `KH-${moment().format('YYYYMMDD')}${now.valueOf().toString().slice(-4)}${String(i).padStart(3,'0')}`;
      const statusKh = s.status || 'Hadir';
      rowsKh.push([idKH, tanggal, hari||'', kelas, s.nis, s.nama, s.jk||'', statusKh, jam_ke||'Penuh Hari', s.ket||'', petugas_kbm||'', lokasi||'', waktuIn]);

      if (statusPel[statusKh]) {
        const idPel = `PLG-${moment().format('YYYYMMDD')}-${now.valueOf().toString().slice(-5)}${i}`;
        let cat = 'Input dari Absensi KBM';
        if (jam_ke && jam_ke !== 'Penuh Hari') cat += ` | Jam ke-${jam_ke}`;
        if (lokasi) cat += ` | ${lokasi}`;
        if (s.ket)  cat += ` | ${s.ket}`;
        rowsPel.push([idPel, s.nis, s.nama, kelas, s.namaWali||'', statusPel[statusKh], tanggal, now.format('HH:mm:ss'), 'Belum Dikonfirmasi', '', cat, petugas_kbm||'']);
      }
    });

    if (rowsKh.length) {
      const placeholders = rowsKh.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      await db.execute(`INSERT INTO kehadiran (kode_kh,tanggal,hari,kelas,nis,nama_siswa,jenis_kelamin,status_kehadiran,jam_ke,keterangan,petugas_kbm,lokasi,waktu_input) VALUES ${placeholders}`, rowsKh.flat());
    }
    if (rowsPel.length) {
      const placeholders = rowsPel.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      await db.execute(`INSERT INTO pelanggaran (kode,nis,nama_siswa,kelas,nama_wali,jenis_pelanggaran,tanggal,waktu,status,foto_url,catatan,input_oleh) VALUES ${placeholders}`, rowsPel.flat());
    }

    req.flash('success', `Kehadiran ${rowsKh.length} siswa berhasil disimpan. ${rowsPel.length} pelanggaran otomatis tercatat.`);
    res.redirect('/kehadiran?tanggal=' + tanggal + '&kelas=' + kelas);
  } catch (e) {
    console.error(e);
    req.flash('error', e.message);
    res.redirect('/kehadiran/input?kelas=' + kelas + '&tanggal=' + tanggal);
  }
});

module.exports = router;
