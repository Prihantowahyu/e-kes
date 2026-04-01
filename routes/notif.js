// routes/notif.js — Endpoint notifikasi WhatsApp
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { kirimWA, pesanPelanggaran, pesanSP, pesanAbsensi } = require('../helpers/whatsapp');
const { isAuthenticated } = require('../middleware/auth');

// POST /notif/kirim
router.post('/kirim', isAuthenticated, async (req, res) => {
  const { nis, tipe, refId } = req.body;
  try {
    const [siswaRows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [nis]);
    if (!siswaRows.length) return res.json({ ok:false, reason:'Siswa tidak ditemukan' });
    const siswa = siswaRows[0];

    if (!siswa.no_wali) return res.json({ ok:false, reason:'Nomor wali tidak tersedia' });

    let pesan = '';
    if (tipe === 'pelanggaran') {
      const [rows] = await db.execute('SELECT * FROM pelanggaran WHERE id=?', [refId]);
      if (!rows.length) return res.json({ ok:false, reason:'Data tidak ditemukan' });
      const p = rows[0];
      pesan = pesanPelanggaran(siswa, p.jenis_pelanggaran,
        moment(p.tanggal).format('DD MMMM YYYY'), p.catatan);
    } else if (tipe === 'sp') {
      const [rows] = await db.execute('SELECT * FROM surat_peringatan WHERE id=?', [refId]);
      if (!rows.length) return res.json({ ok:false, reason:'Data tidak ditemukan' });
      const sp = rows[0];
      pesan = pesanSP(siswa, sp.tipe_sp,
        moment(sp.tanggal_sp).format('DD MMMM YYYY'), sp.pelanggaran_pemicu);
    } else {
      return res.json({ ok:false, reason:'Tipe notifikasi tidak dikenal' });
    }

    const result = await kirimWA(siswa.no_wali, pesan);
    res.json(result);
  } catch(e) {
    console.error(e);
    res.json({ ok:false, error:e.message });
  }
});

// POST /notif/wa-bulk — Kirim WA ke semua wali siswa yang alpha hari ini
router.post('/wa-bulk-alpha', isAuthenticated, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const [rows] = await db.execute(`
      SELECT p.*, s.no_wali, s.nama_wali FROM pelanggaran p
      LEFT JOIN siswa s ON s.nis = p.nis
      WHERE p.tanggal=? AND p.jenis_pelanggaran='Alpha' AND s.no_wali IS NOT NULL`, [today]);

    let berhasil = 0, gagal = 0;
    for (const r of rows) {
      const pesan = pesanAbsensi(
        { nama:r.nama_siswa, kelas:r.kelas, namaWali:r.nama_wali },
        'Alpha', today, moment().locale('id').format('dddd')
      );
      const result = await kirimWA(r.no_wali, pesan);
      if (result.ok) berhasil++; else gagal++;
      await new Promise(r => setTimeout(r, 1500)); // jeda antar pesan
    }
    req.flash('success', `Notif WA terkirim: ${berhasil} berhasil, ${gagal} gagal.`);
    res.redirect('/kehadiran');
  } catch(e) {
    req.flash('error', 'Gagal kirim WA: '+e.message);
    res.redirect('/kehadiran');
  }
});

module.exports = router;
