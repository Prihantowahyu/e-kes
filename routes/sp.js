// routes/sp.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');

const BATAS_ALPHA     = 5;
const BATAS_TERLAMBAT = 10;

function genId() {
  return 'SP-' + moment().format('YYYYMMDD') + '-' + Date.now().toString().slice(-4);
}

// GET /sp
router.get('/', isAuthenticated, async (req, res) => {
  const { q, tipe, status } = req.query;
  let sql = 'SELECT * FROM surat_peringatan WHERE 1=1';
  const params = [];
  if (q)      { sql += ' AND (nis LIKE ? OR nama_siswa LIKE ?)'; params.push(`%${q}%`,`%${q}%`); }
  if (tipe)   { sql += ' AND tipe_sp = ?'; params.push(tipe); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY tanggal_sp DESC';
  try {
    const [sp] = await db.execute(sql, params);
    res.render('pages/sp/index', { title: 'Surat Peringatan', sp, filter: { q, tipe, status } });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// GET /sp/rekap — Rekap siswa yang perlu SP
router.get('/rekap', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const [siswaAktif] = await db.execute('SELECT * FROM siswa WHERE status="Aktif" ORDER BY kelas,nama');
    const rekap = [];

    for (const s of siswaAktif) {
      const [pelRows] = await db.execute(
        'SELECT * FROM pelanggaran WHERE nis=? AND status="Terkonfirmasi" ORDER BY tanggal ASC', [s.nis]
      );
      const [spRows] = await db.execute(
        'SELECT * FROM surat_peringatan WHERE nis=? ORDER BY tanggal_sp ASC', [s.nis]
      );

      const levelSP  = spRows.length;
      let pelPeriode = pelRows;

      if (levelSP > 0) {
        const tglSPTerakhir = spRows[spRows.length - 1].tanggal_sp;
        pelPeriode = pelRows.filter(p => p.tanggal > tglSPTerakhir);
      }

      const alpha      = pelPeriode.filter(p => p.jenis_pelanggaran === 'Alpha').length;
      const terlambat  = pelPeriode.filter(p => p.jenis_pelanggaran === 'Terlambat').length;
      const lainnya    = pelPeriode.filter(p => !['Alpha','Terlambat'].includes(p.jenis_pelanggaran)).length;
      const eligible   = alpha >= BATAS_ALPHA || terlambat >= BATAS_TERLAMBAT || lainnya > 0;

      const labelSPMap = { 0:'Belum Ada SP', 1:'SP 1', 2:'SP 2', 3:'SP 3' };
      const labelSP    = levelSP >= 4 ? `SP 3 + Tambahan (${levelSP-3})` : (labelSPMap[levelSP] || 'SP 3');
      const labelBaru  = levelSP === 0 ? 'SP 1' : levelSP === 1 ? 'SP 2' : levelSP === 2 ? 'SP 3' : `SP Tambahan (${levelSP - 2})`;

      if (eligible || levelSP > 0 || pelRows.length > 0) {
        rekap.push({
          ...s, levelSP, labelSP, labelBaru, eligible,
          jumlahAlpha: pelRows.filter(p => p.jenis_pelanggaran === 'Alpha').length,
          jumlahTerlambat: pelRows.filter(p => p.jenis_pelanggaran === 'Terlambat').length,
          jumlahTotal: pelRows.length,
          alphaPeriode: alpha, terlambatPeriode: terlambat, lainnyaPeriode: lainnya,
          spTerakhir: spRows.length ? spRows[spRows.length-1] : null
        });
      }
    }

    rekap.sort((a, b) => {
      const pa = a.eligible ? 3 : a.levelSP > 0 ? 2 : 1;
      const pb = b.eligible ? 3 : b.levelSP > 0 ? 2 : 1;
      return pb - pa || b.levelSP - a.levelSP || b.jumlahTotal - a.jumlahTotal;
    });

    res.render('pages/sp/rekap', { title: 'Rekap SP', rekap, BATAS_ALPHA, BATAS_TERLAMBAT });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/sp');
  }
});

// POST /sp
router.post('/', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { nis, tipe_sp, tanggal_sp, jumlah_pelanggaran, pelanggaran_pemicu, catatan_terlampir,
          catatan_siswa, catatan_ortu, catatan_wali_kelas, catatan_tatib,
          catatan_koord_tatib, catatan_waka_kesiswaan, catatan_kepsek } = req.body;
  try {
    const [siswaRows] = await db.execute('SELECT * FROM siswa WHERE nis=?', [nis]);
    if (!siswaRows.length) { req.flash('error','Siswa tidak ditemukan'); return res.redirect('/sp/rekap'); }
    const s    = siswaRows[0];
    const kode = genId();
    const tgl  = tanggal_sp || moment().format('YYYY-MM-DD');
    await db.execute(
      `INSERT INTO surat_peringatan
       (kode_sp,nis,nama_siswa,kelas,nama_wali,no_wali,tipe_sp,tanggal_sp,jumlah_pelanggaran,
        pelanggaran_pemicu,catatan_terlampir,dibuat_oleh,catatan_siswa,catatan_ortu,
        catatan_wali_kelas,catatan_tatib,catatan_koord_tatib,catatan_waka_kesiswaan,catatan_kepsek)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [kode, s.nis, s.nama, s.kelas, s.nama_wali, s.no_wali, tipe_sp, tgl,
       jumlah_pelanggaran||0, pelanggaran_pemicu||null, catatan_terlampir||null,
       req.session.user.nama,
       catatan_siswa||null, catatan_ortu||null, catatan_wali_kelas||null,
       catatan_tatib||null, catatan_koord_tatib||null, catatan_waka_kesiswaan||null, catatan_kepsek||null]
    );
    req.flash('success', `${tipe_sp} untuk ${s.nama} berhasil dibuat.`);
    res.redirect('/sp');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/sp/rekap');
  }
});

// GET /sp/:id
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM surat_peringatan WHERE id=?', [req.params.id]);
    if (!rows.length) { req.flash('error','SP tidak ditemukan'); return res.redirect('/sp'); }
    const [pelRows] = await db.execute(
      'SELECT * FROM pelanggaran WHERE nis=? ORDER BY tanggal DESC', [rows[0].nis]
    );
    res.render('pages/sp/detail', { title: 'Detail SP', sp: rows[0], pelanggaran: pelRows });
  } catch (e) {
    req.flash('error', e.message); res.redirect('/sp');
  }
});

// PUT /sp/:id/status
router.put('/:id/status', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    await db.execute('UPDATE surat_peringatan SET status=? WHERE id=?', [req.body.status, req.params.id]);
    req.flash('success', 'Status SP diperbarui.');
    res.redirect('/sp');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/sp');
  }
});

// DELETE /sp/:id
router.delete('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    await db.execute('DELETE FROM surat_peringatan WHERE id=?', [req.params.id]);
    req.flash('success', 'Surat peringatan dihapus.');
    res.redirect('/sp');
  } catch (e) {
    req.flash('error', e.message); res.redirect('/sp');
  }
});

module.exports = router;
