// routes/rapor.js — Rapor Perilaku Per Semester
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const ExcelJS = require('exceljs');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');
const actLog  = require('../middleware/activityLog');

// GET /rapor
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { semester, tahun_ajaran, kelas } = req.query;
    const thnAjaran = tahun_ajaran || getTahunAjaran();
    const smt       = semester || getSemester();

    let sql = 'SELECT * FROM rapor_perilaku WHERE semester=? AND tahun_ajaran=?';
    const params = [smt, thnAjaran];
    if (kelas) { sql += ' AND kelas=?'; params.push(kelas); }
    sql += ' ORDER BY kelas, nama_siswa';

    const [rapor]     = await db.execute(sql, params);
    const [kelasList] = await db.execute('SELECT DISTINCT kelas FROM siswa WHERE status="Aktif" ORDER BY kelas');
    const tahunList   = generateTahunList();

    res.render('pages/rapor/index', {
      title: 'Rapor Perilaku', rapor, kelasList, tahunList,
      filter: { semester: smt, tahun_ajaran: thnAjaran, kelas }
    });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// POST /rapor/generate — Generate rapor otomatis dari data pelanggaran
router.post('/generate', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { semester, tahun_ajaran, kelas } = req.body;

    // Hitung periode semester
    const [dari, sampai] = getPeriodeSemester(semester, tahun_ajaran);

    // Ambil semua siswa aktif
    let sqlSiswa = 'SELECT * FROM siswa WHERE status="Aktif"';
    const paramsSiswa = [];
    if (kelas) { sqlSiswa += ' AND kelas=?'; paramsSiswa.push(kelas); }
    const [siswaList] = await db.execute(sqlSiswa, paramsSiswa);

    let generated = 0;
    for (const s of siswaList) {
      // Hitung pelanggaran dalam periode
      const [[{alpha}]]      = await db.execute(
        'SELECT COUNT(*) AS alpha FROM pelanggaran WHERE nis=? AND jenis_pelanggaran="Alpha" AND tanggal BETWEEN ? AND ?',
        [s.nis, dari, sampai]
      );
      const [[{terlambat}]]  = await db.execute(
        'SELECT COUNT(*) AS terlambat FROM pelanggaran WHERE nis=? AND jenis_pelanggaran="Terlambat" AND tanggal BETWEEN ? AND ?',
        [s.nis, dari, sampai]
      );
      const [[{total_pel}]]  = await db.execute(
        'SELECT COUNT(*) AS total_pel FROM pelanggaran WHERE nis=? AND tanggal BETWEEN ? AND ?',
        [s.nis, dari, sampai]
      );
      const [[{total_sp}]]   = await db.execute(
        'SELECT COUNT(*) AS total_sp FROM surat_peringatan WHERE nis=? AND tanggal_sp BETWEEN ? AND ?',
        [s.nis, dari, sampai]
      );

      // Tentukan nilai perilaku
      let nilai = 'A';
      if (total_sp >= 3 || alpha >= 15 || terlambat >= 20 || total_pel >= 20) nilai = 'D';
      else if (total_sp >= 2 || alpha >= 10 || terlambat >= 15 || total_pel >= 15) nilai = 'C';
      else if (total_sp >= 1 || alpha >= 5  || terlambat >= 10 || total_pel >= 10) nilai = 'B';

      await db.execute(
        `INSERT INTO rapor_perilaku
         (nis,nama_siswa,kelas,semester,tahun_ajaran,nilai_perilaku,total_alpha,total_terlambat,total_pelanggaran,total_sp,dibuat_oleh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           nilai_perilaku=VALUES(nilai_perilaku), total_alpha=VALUES(total_alpha),
           total_terlambat=VALUES(total_terlambat), total_pelanggaran=VALUES(total_pelanggaran),
           total_sp=VALUES(total_sp), dibuat_oleh=VALUES(dibuat_oleh), updated_at=NOW()`,
        [s.nis, s.nama, s.kelas, semester, tahun_ajaran, nilai, alpha, terlambat, total_pel, total_sp,
         req.session.user.nama]
      );
      generated++;
    }

    await actLog.log(req, 'Generate Rapor Perilaku', 'rapor_perilaku', null,
      `Semester ${semester} TA ${tahun_ajaran} - ${generated} siswa`);
    req.flash('success', `Rapor perilaku ${generated} siswa berhasil digenerate.`);
    res.redirect(`/rapor?semester=${semester}&tahun_ajaran=${tahun_ajaran}&kelas=${kelas||''}`);
  } catch(e) {
    req.flash('error', e.message); res.redirect('/rapor');
  }
});

// PUT /rapor/:id — Update manual
router.put('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { nilai_perilaku, catatan } = req.body;
  try {
    await db.execute('UPDATE rapor_perilaku SET nilai_perilaku=?, catatan=? WHERE id=?',
      [nilai_perilaku, catatan||null, req.params.id]);
    await actLog.log(req, 'Update Rapor Perilaku', 'rapor_perilaku', req.params.id);
    req.flash('success', 'Rapor diperbarui.');
    res.redirect('/rapor');
  } catch(e) {
    req.flash('error', e.message); res.redirect('/rapor');
  }
});

// GET /rapor/export — Export Excel rapor
router.get('/export', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { semester, tahun_ajaran, kelas } = req.query;
    let sql = 'SELECT * FROM rapor_perilaku WHERE semester=? AND tahun_ajaran=?';
    const params = [semester, tahun_ajaran];
    if (kelas) { sql += ' AND kelas=?'; params.push(kelas); }
    sql += ' ORDER BY kelas, nama_siswa';
    const [rows] = await db.execute(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rapor Perilaku');

    ws.mergeCells('A1:J1');
    ws.getCell('A1').value = `REKAP RAPOR PERILAKU SISWA`;
    ws.getCell('A1').font  = { size:14, bold:true };
    ws.getCell('A1').alignment = { horizontal:'center' };
    ws.mergeCells('A2:J2');
    ws.getCell('A2').value = `SMK Diponegoro Tumpang | Semester ${semester} | Tahun Ajaran ${tahun_ajaran} | Kelas: ${kelas||'Semua'}`;
    ws.getCell('A2').alignment = { horizontal:'center' };
    ws.addRow([]);

    const hdr = ws.addRow(['No','NIS','Nama Siswa','Kelas','Nilai','Alpha','Terlambat','Jml Pelanggaran','Jml SP','Catatan']);
    hdr.font = { bold:true, color:{ argb:'FFFFFFFF' } };
    hdr.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0D1B3E' } };
    hdr.alignment = { horizontal:'center' };
    ws.columns = [{width:5},{width:13},{width:28},{width:14},{width:8},{width:8},{width:12},{width:18},{width:8},{width:30}];

    const nilaiColor = { A:'FF2E7D32', B:'FF1565C0', C:'FFF57F17', D:'FFC62828' };
    rows.forEach((r, i) => {
      const row = ws.addRow([i+1, r.nis, r.nama_siswa, r.kelas, r.nilai_perilaku,
        r.total_alpha, r.total_terlambat, r.total_pelanggaran, r.total_sp, r.catatan||'-']);
      if (i%2===0) row.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F5F5' } };
      const nc = row.getCell(5);
      nc.font = { bold:true, color:{ argb: nilaiColor[r.nilai_perilaku]||'FF000000' } };
      nc.alignment = { horizontal:'center' };
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=rapor_perilaku_smt${semester}_${tahun_ajaran}.xlsx`);
    await wb.xlsx.write(res); res.end();
  } catch(e) {
    req.flash('error', e.message); res.redirect('/rapor');
  }
});

// ── Helper functions ──────────────────────────────────────────
function getTahunAjaran() {
  const now = moment();
  const thn = now.year();
  return now.month() >= 6 ? `${thn}/${thn+1}` : `${thn-1}/${thn}`;
}
function getSemester() {
  return moment().month() >= 6 ? '1' : '2';
}
function generateTahunList() {
  const thn = moment().year();
  return [`${thn-1}/${thn}`, `${thn}/${thn+1}`, `${thn+1}/${thn+2}`];
}
function getPeriodeSemester(smt, thnAjaran) {
  const [thn1] = thnAjaran.split('/');
  if (smt === '1') return [`${thn1}-07-01`, `${thn1}-12-31`];
  return [`${parseInt(thn1)+1}-01-01`, `${parseInt(thn1)+1}-06-30`];
}

module.exports = router;
