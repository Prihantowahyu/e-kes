// routes/laporan.js
const express  = require('express');
const router   = express.Router();
const db       = require('../config/database');
const ExcelJS  = require('exceljs');
const PDFDoc   = require('pdfkit');
const moment   = require('moment');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const { isAuthenticated, isAdmin, isAdminOrTatib } = require('../middleware/auth');

// ── HALAMAN LAPORAN ───────────────────────────────────────────
router.get('/', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const bln  = bulan || moment().format('MM');
    const thn  = tahun || moment().format('YYYY');
    const dari = `${thn}-${bln}-01`;
    const sampai = moment(dari).endOf('month').format('YYYY-MM-DD');

    const [[{ totalPel }]]  = await db.execute('SELECT COUNT(*) AS totalPel FROM pelanggaran WHERE tanggal BETWEEN ? AND ?', [dari, sampai]);
    const [[{ totalSP }]]   = await db.execute('SELECT COUNT(*) AS totalSP FROM surat_peringatan WHERE tanggal_sp BETWEEN ? AND ?', [dari, sampai]);
    const [[{ totalPst }]]  = await db.execute('SELECT COUNT(*) AS totalPst FROM penyitaan WHERE tanggal BETWEEN ? AND ?', [dari, sampai]);
    const [[{ totalKh }]]   = await db.execute('SELECT COUNT(*) AS totalKh FROM kehadiran WHERE tanggal BETWEEN ? AND ?', [dari, sampai]);

    const [byJenis] = await db.execute(`
      SELECT jenis_pelanggaran, COUNT(*) AS jumlah FROM pelanggaran
      WHERE tanggal BETWEEN ? AND ? GROUP BY jenis_pelanggaran ORDER BY jumlah DESC`, [dari, sampai]);

    const [topSiswa] = await db.execute(`
      SELECT nis, nama_siswa, kelas, COUNT(*) AS jumlah FROM pelanggaran
      WHERE tanggal BETWEEN ? AND ? GROUP BY nis ORDER BY jumlah DESC LIMIT 10`, [dari, sampai]);

    const [trendHarian] = await db.execute(`
      SELECT DATE(tanggal) AS tgl, COUNT(*) AS jumlah FROM pelanggaran
      WHERE tanggal BETWEEN ? AND ? GROUP BY DATE(tanggal) ORDER BY tgl`, [dari, sampai]);

    const [kehadiranRekap] = await db.execute(`
      SELECT status_kehadiran, COUNT(*) AS jumlah FROM kehadiran
      WHERE tanggal BETWEEN ? AND ? GROUP BY status_kehadiran`, [dari, sampai]);

    // Tahun tersedia
    const [tahunList] = await db.execute(`
      SELECT DISTINCT YEAR(tanggal) AS thn FROM pelanggaran ORDER BY thn DESC`);

    res.render('pages/laporan/index', {
      title: 'Laporan & Statistik', bln, thn, dari, sampai,
      stats: { totalPel, totalSP, totalPst, totalKh },
      byJenis, topSiswa, trendHarian, kehadiranRekap,
      tahunList: tahunList.length ? tahunList : [{ thn: moment().year() }]
    });
  } catch (e) {
    console.error(e);
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// ── EXPORT EXCEL: PELANGGARAN ─────────────────────────────────
router.get('/export/pelanggaran', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { dari, sampai, kelas } = req.query;
    let sql = 'SELECT * FROM pelanggaran WHERE 1=1';
    const params = [];
    if (dari)   { sql += ' AND tanggal >= ?'; params.push(dari); }
    if (sampai) { sql += ' AND tanggal <= ?'; params.push(sampai); }
    if (kelas)  { sql += ' AND kelas = ?'; params.push(kelas); }
    sql += ' ORDER BY tanggal DESC, kelas';
    const [rows] = await db.execute(sql, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistem Kesiswaan SMK Diponegoro Tumpang';
    const ws = wb.addWorksheet('Rekap Pelanggaran', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    // Judul
    ws.mergeCells('A1:L1');
    ws.getCell('A1').value = 'REKAP PELANGGARAN SISWA';
    ws.getCell('A1').font  = { size: 14, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:L2');
    ws.getCell('A2').value = `SMK Diponegoro Tumpang | Periode: ${dari||'Semua'} s/d ${sampai||'Semua'}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getCell('A2').font = { size: 11, italic: true };

    ws.addRow([]);

    // Header
    const hdr = ws.addRow(['No','Kode','NIS','Nama Siswa','Kelas','Jenis Pelanggaran','Tanggal','Waktu','Status','Catatan','Input Oleh','Nama Wali']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B3E' } };
    hdr.alignment = { horizontal: 'center', vertical: 'middle' };
    hdr.height = 20;

    // Kolom lebar
    ws.columns = [
      {width:5},{width:18},{width:12},{width:25},{width:12},{width:18},
      {width:12},{width:10},{width:18},{width:30},{width:20},{width:25}
    ];

    rows.forEach((r, i) => {
      const row = ws.addRow([
        i+1, r.kode, r.nis, r.nama_siswa, r.kelas,
        r.jenis_pelanggaran,
        r.tanggal ? moment(r.tanggal).format('DD/MM/YYYY') : '-',
        r.waktu ? String(r.waktu).substring(0,5) : '-',
        r.status, r.catatan||'-', r.input_oleh||'-', r.nama_wali||'-'
      ]);
      // Warna baris alternatif
      if (i % 2 === 0) {
        row.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F5F5' } };
      }
      // Warna status
      const statusCell = row.getCell(9);
      if (r.status === 'Terkonfirmasi') {
        statusCell.font = { color: { argb: 'FF2E7D32' }, bold: true };
      } else {
        statusCell.font = { color: { argb: 'FFE53935' }, bold: true };
      }
      // Warna jenis
      const jenisCell = row.getCell(6);
      const jenisColor = { Alpha:'FFEF5350', Terlambat:'FFF9A825', Bolos:'FFEF5350', Izin:'FF1565C0', Sakit:'FF00796B' };
      if (jenisColor[r.jenis_pelanggaran]) {
        jenisCell.font = { color: { argb: jenisColor[r.jenis_pelanggaran] }, bold: true };
      }
    });

    // Summary di bawah
    ws.addRow([]);
    const sumRow = ws.addRow([`Total: ${rows.length} pelanggaran`]);
    sumRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pelanggaran_${dari||'all'}_${sampai||'all'}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e); req.flash('error', e.message); res.redirect('/laporan');
  }
});

// ── EXPORT EXCEL: KEHADIRAN ───────────────────────────────────
router.get('/export/kehadiran', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { dari, sampai, kelas } = req.query;
    let sql = 'SELECT * FROM kehadiran WHERE 1=1';
    const params = [];
    if (dari)  { sql += ' AND tanggal >= ?'; params.push(dari); }
    if (sampai){ sql += ' AND tanggal <= ?'; params.push(sampai); }
    if (kelas) { sql += ' AND kelas = ?'; params.push(kelas); }
    sql += ' ORDER BY tanggal DESC, kelas, nama_siswa';
    const [rows] = await db.execute(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Kehadiran');

    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = `REKAP KEHADIRAN SISWA — SMK Diponegoro Tumpang`;
    ws.getCell('A1').font = { size:13, bold:true };
    ws.getCell('A1').alignment = { horizontal:'center' };
    ws.addRow([`Periode: ${dari||'-'} s/d ${sampai||'-'} | Kelas: ${kelas||'Semua'}`]);
    ws.addRow([]);

    const hdr = ws.addRow(['No','Tanggal','Hari','Kelas','NIS','Nama Siswa','JK','Status Kehadiran','Jam Ke','Keterangan','Petugas KBM']);
    hdr.font = { bold:true, color:{ argb:'FFFFFFFF' } };
    hdr.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1B5E20' } };
    ws.columns = [{width:5},{width:13},{width:10},{width:12},{width:12},{width:25},{width:5},{width:18},{width:10},{width:25},{width:20}];

    const stColor = { Hadir:'FF2E7D32', Alpha:'FFC62828', Terlambat:'FFF57F17', Izin:'FF1565C0', Sakit:'FF00796B', Bolos:'FFC62828' };
    rows.forEach((r, i) => {
      const row = ws.addRow([
        i+1,
        r.tanggal ? moment(r.tanggal).format('DD/MM/YYYY') : '-',
        r.hari||'-', r.kelas, r.nis, r.nama_siswa,
        r.jenis_kelamin||'-', r.status_kehadiran, r.jam_ke||'Penuh Hari',
        r.keterangan||'-', r.petugas_kbm||'-'
      ]);
      if (i%2===0) row.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F5F5' } };
      const sc = row.getCell(8);
      if (stColor[r.status_kehadiran]) sc.font = { color:{ argb: stColor[r.status_kehadiran] }, bold:true };
    });
    ws.addRow([`Total: ${rows.length} records`]).font = { bold:true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kehadiran_${dari||'all'}_${sampai||'all'}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) {
    console.error(e); req.flash('error', e.message); res.redirect('/laporan');
  }
});

// ── EXPORT EXCEL: SURAT PERINGATAN ───────────────────────────
router.get('/export/sp', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    let sql = 'SELECT * FROM surat_peringatan WHERE 1=1';
    const params = [];
    if (dari)  { sql += ' AND tanggal_sp >= ?'; params.push(dari); }
    if (sampai){ sql += ' AND tanggal_sp <= ?'; params.push(sampai); }
    sql += ' ORDER BY tanggal_sp DESC';
    const [rows] = await db.execute(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Surat Peringatan');
    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = 'REKAP SURAT PERINGATAN — SMK Diponegoro Tumpang';
    ws.getCell('A1').font = { size:13, bold:true };
    ws.getCell('A1').alignment = { horizontal:'center' };
    ws.addRow([`Periode: ${dari||'-'} s/d ${sampai||'-'}`]);
    ws.addRow([]);
    const hdr = ws.addRow(['No','Kode SP','NIS','Nama Siswa','Kelas','Tipe SP','Tanggal SP','Jml Pelanggaran','Dibuat Oleh','Status']);
    hdr.font = { bold:true, color:{ argb:'FFFFFFFF' } };
    hdr.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF4A148C' } };
    ws.columns = [{width:5},{width:20},{width:12},{width:25},{width:12},{width:12},{width:14},{width:16},{width:20},{width:12}];
    const tipeColor = { 'SP 1':'FFF9A825','SP 2':'FFEF6C00','SP 3':'FFC62828','SP Tambahan':'FFC62828' };
    rows.forEach((r, i) => {
      const row = ws.addRow([i+1, r.kode_sp, r.nis, r.nama_siswa, r.kelas, r.tipe_sp,
        r.tanggal_sp ? moment(r.tanggal_sp).format('DD/MM/YYYY') : '-',
        r.jumlah_pelanggaran, r.dibuat_oleh||'-', r.status]);
      if (i%2===0) row.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F5F5' } };
      const tc = row.getCell(6);
      if (tipeColor[r.tipe_sp]) tc.font = { color:{ argb: tipeColor[r.tipe_sp] }, bold:true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=surat_peringatan_${dari||'all'}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) {
    console.error(e); req.flash('error', e.message); res.redirect('/laporan');
  }
});

// ── CETAK SP PDF ──────────────────────────────────────────────
router.get('/cetak-sp/:id', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM surat_peringatan WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).send('SP tidak ditemukan');
    const sp = rows[0];
    const [pelRows] = await db.execute(
      'SELECT * FROM pelanggaran WHERE nis=? AND status="Terkonfirmasi" ORDER BY tanggal DESC LIMIT 20', [sp.nis]);

    const doc = new PDFDoc({ size:'A4', margin:50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=SP_${sp.kode_sp}.pdf`);
    doc.pipe(res);

    // Header Kop Surat
    doc.fontSize(16).font('Helvetica-Bold').text('SMK DIPONEGORO TUMPANG', { align:'center' });
    doc.fontSize(10).font('Helvetica').text('Jl. Diponegoro No. 1, Tumpang, Malang, Jawa Timur', { align:'center' });
    doc.text('Telp: (0341) 000000 | Email: info@smkdiponegoro.sch.id', { align:'center' });

    // Garis
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(2).stroke('#0d1b3e');
    doc.moveTo(50, doc.y+2).lineTo(545, doc.y+2).lineWidth(0.5).stroke('#0d1b3e');
    doc.moveDown(0.5);

    // Judul SP
    const tipeColor = { 'SP 1':'#f57f17','SP 2':'#ef6c00','SP 3':'#c62828','SP Tambahan':'#c62828' };
    doc.fontSize(14).font('Helvetica-Bold').fillColor(tipeColor[sp.tipe_sp]||'#c62828')
       .text(`SURAT PERINGATAN ${sp.tipe_sp.toUpperCase()}`, { align:'center' });
    doc.fillColor('#000000');
    doc.fontSize(10).font('Helvetica').text(`No: ${sp.kode_sp}`, { align:'center' });
    doc.moveDown(1);

    // Data Siswa
    doc.fontSize(11).font('Helvetica-Bold').text('DATA SISWA:');
    doc.moveDown(0.3);
    const dataFields = [
      ['Nama Siswa',   sp.nama_siswa],
      ['NIS',          sp.nis],
      ['Kelas',        sp.kelas],
      ['Nama Wali',    sp.nama_wali||'-'],
      ['No. HP Wali',  sp.no_wali||'-'],
      ['Tanggal SP',   sp.tanggal_sp ? moment(sp.tanggal_sp).format('DD MMMM YYYY') : '-'],
    ];
    dataFields.forEach(([label, val]) => {
      doc.fontSize(10).font('Helvetica-Bold').text(label, 50, doc.y, { continued:true, width:150 });
      doc.font('Helvetica').text(`: ${val}`);
    });
    doc.moveDown(0.5);

    // Pelanggaran pemicu
    if (sp.pelanggaran_pemicu) {
      doc.fontSize(11).font('Helvetica-Bold').text('ALASAN PERINGATAN:');
      doc.moveDown(0.2);
      doc.rect(50, doc.y, 495, 40).fillAndStroke('#fff8e1', '#f9a825');
      doc.fillColor('#000').fontSize(10).font('Helvetica').text(sp.pelanggaran_pemicu, 58, doc.y-35, { width:480 });
      doc.moveDown(1.5);
    }

    // Isi surat
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(
      `Dengan ini kami memberitahukan bahwa siswa tersebut di atas telah melakukan pelanggaran tata tertib sekolah sebanyak ${sp.jumlah_pelanggaran||'-'} kali. Sehubungan dengan hal tersebut, kami memberikan ${sp.tipe_sp} sebagai peringatan keras kepada yang bersangkutan.`,
      { align:'justify' }
    );
    doc.moveDown(0.5);
    doc.text('Diharapkan kepada siswa yang bersangkutan untuk memperbaiki sikap dan perilakunya, serta tidak mengulangi pelanggaran yang sama. Apabila pelanggaran masih terus dilakukan, maka sekolah akan mengambil tindakan yang lebih tegas.', { align:'justify' });

    // Tanda tangan
    doc.moveDown(2);
    const sigY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text('Mengetahui,', 50, sigY);
    doc.text('Orang Tua/Wali Siswa', 50, sigY+10);
    doc.text('Koordinator Tatib', 220, sigY);
    doc.text('Waka Kesiswaan', 380, sigY);
    doc.moveDown(3.5);
    doc.text(`(${sp.nama_wali||'................................'})`, 50);
    doc.text('(......................................)', 220, doc.y-12);
    doc.text('(......................................)', 380, doc.y-12);

    // Footer
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke('#999');
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#666').text(
      `Dicetak oleh Sistem Kesiswaan SMK Diponegoro Tumpang — ${moment().format('DD/MM/YYYY HH:mm')}`,
      { align:'center' }
    );

    doc.end();
  } catch(e) {
    console.error(e); res.status(500).send('Error: ' + e.message);
  }
});

// ── IMPORT SISWA DARI EXCEL ───────────────────────────────────
const XLSX   = require('xlsx');
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/temp/' });

router.post('/import/siswa', isAuthenticated, isAdminOrTatib, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { req.flash('error','File tidak ditemukan'); return res.redirect('/laporan'); }
    const wb   = XLSX.readFile(req.file.path);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval:'' });

    let berhasil = 0, gagal = 0, errors = [];
    for (const row of data) {
      const nis   = String(row['NIS']||row['nis']||'').trim();
      const nama  = String(row['Nama']||row['nama']||row['NAMA']||'').trim();
      const kelas = String(row['Kelas']||row['kelas']||row['KELAS']||'').trim();
      const jk    = String(row['JenisKelamin']||row['jenis_kelamin']||row['JK']||'L').trim().toUpperCase();
      if (!nis || !nama || !kelas) { gagal++; errors.push(`Baris ${nis||'?'}: Data tidak lengkap`); continue; }
      try {
        await db.execute(
          `INSERT INTO siswa (nis,nama,kelas,jenis_kelamin,nama_wali,no_wali,status) VALUES (?,?,?,?,?,?,'Aktif')
           ON DUPLICATE KEY UPDATE nama=VALUES(nama), kelas=VALUES(kelas), jenis_kelamin=VALUES(jenis_kelamin)`,
          [nis, nama, kelas, jk==='P'?'P':'L',
           String(row['NamaWali']||row['nama_wali']||'').trim()||null,
           String(row['NoWali']||row['no_wali']||'').trim()||null]
        );
        berhasil++;
      } catch(e) { gagal++; errors.push(`${nis}: ${e.message}`); }
    }
    // Hapus file temp
    fs.unlinkSync(req.file.path);
    req.flash('success', `Import selesai: ${berhasil} berhasil, ${gagal} gagal.${errors.length?' Error: '+errors.slice(0,3).join('; '):''}`)
    res.redirect('/siswa');
  } catch(e) {
    req.flash('error', 'Gagal import: '+e.message); res.redirect('/laporan');
  }
});

// ── TEMPLATE EXCEL SISWA ──────────────────────────────────────
router.get('/template/siswa', isAuthenticated, async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DataSiswa');
  const hdr = ws.addRow(['NIS','Nama','Kelas','JenisKelamin','NamaWali','NoWali']);
  hdr.font = { bold:true, color:{ argb:'FFFFFFFF' } };
  hdr.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0D1B3E' } };
  ws.columns = [{width:14},{width:30},{width:14},{width:14},{width:25},{width:18}];
  // Contoh data
  ws.addRow(['2024001','Ahmad Rizki Pratama','X TKJ 1','L','Bapak Hasan','08111111111']);
  ws.addRow(['2024002','Siti Fatimah','X TKJ 1','P','Ibu Ratna','08122222222']);

  const noteRow = ws.addRow([]);
  ws.addRow(['* JenisKelamin: L atau P']);
  ws.addRow(['* NIS yang sudah ada akan diupdate datanya']);

  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition','attachment; filename=template_import_siswa.xlsx');
  await wb.xlsx.write(res); res.end();
});

// ── BACKUP DATABASE ───────────────────────────────────────────
router.post('/backup', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', process.env.BACKUP_PATH||'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive:true });

    const tables = ['users','siswa','petugas','pelanggaran','surat_peringatan','penyitaan','kehadiran','petugas_kbm'];
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename  = `backup_kesiswaan_${timestamp}.sql`;
    const filepath  = path.join(backupDir, filename);

    let sql = `-- Backup Sistem Kesiswaan SMK Diponegoro Tumpang\n-- Tanggal: ${moment().format('DD/MM/YYYY HH:mm:ss')}\n-- Generated by Sistem Kesiswaan\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

    for (const table of tables) {
      try {
        const [rows] = await db.execute(`SELECT * FROM ${table}`);
        const [cols] = await db.execute(`DESCRIBE ${table}`);
        sql += `-- Table: ${table}\nTRUNCATE TABLE \`${table}\`;\n`;
        if (rows.length) {
          const colNames = cols.map(c=>`\`${c.Field}\``).join(',');
          for (const row of rows) {
            const vals = cols.map(c => {
              const v = row[c.Field];
              if (v===null||v===undefined) return 'NULL';
              if (v instanceof Date) return `'${moment(v).format('YYYY-MM-DD HH:mm:ss')}'`;
              return `'${String(v).replace(/'/g,"''")}'`;
            }).join(',');
            sql += `INSERT INTO \`${table}\` (${colNames}) VALUES (${vals});\n`;
          }
        }
        sql += '\n';
      } catch(te) { sql += `-- Skipped table ${table}: ${te.message}\n\n`; }
    }
    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

    fs.writeFileSync(filepath, sql);
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition',`attachment; filename=${filename}`);
    res.download(filepath, filename, () => {
      // Hapus setelah download (opsional, simpan saja jika ingin history)
      // fs.unlinkSync(filepath);
    });
  } catch(e) {
    console.error(e); req.flash('error','Backup gagal: '+e.message); res.redirect('/laporan');
  }
});

// ── API: STATISTIK BULANAN (untuk grafik) ────────────────────
router.get('/api/statistik', isAuthenticated, async (req, res) => {
  try {
    const { tahun } = req.query;
    const thn = tahun || moment().year();
    const [monthly] = await db.execute(`
      SELECT MONTH(tanggal) AS bln, COUNT(*) AS jumlah FROM pelanggaran
      WHERE YEAR(tanggal)=? GROUP BY MONTH(tanggal) ORDER BY bln`, [thn]);
    const [bySiswa] = await db.execute(`
      SELECT nis, nama_siswa, kelas, COUNT(*) AS jumlah FROM pelanggaran
      WHERE YEAR(tanggal)=? GROUP BY nis ORDER BY jumlah DESC LIMIT 10`, [thn]);
    const [byKelas] = await db.execute(`
      SELECT kelas, COUNT(*) AS jumlah FROM pelanggaran
      WHERE YEAR(tanggal)=? GROUP BY kelas ORDER BY jumlah DESC`, [thn]);
    res.json({ ok:true, monthly, bySiswa, byKelas });
  } catch(e) {
    res.json({ ok:false, error:e.message });
  }
});

// ── API: PENCARIAN SISWA REAL-TIME ────────────────────────────
router.get('/api/cari-siswa', isAuthenticated, async (req, res) => {
  try {
    const { q, kelas } = req.query;
    if (!q || q.length < 2) return res.json([]);
    let sql = 'SELECT nis,nama,kelas,jenis_kelamin,nama_wali,no_wali FROM siswa WHERE status="Aktif" AND (nis LIKE ? OR nama LIKE ?)';
    const params = [`%${q}%`,`%${q}%`];
    if (kelas) { sql += ' AND kelas=?'; params.push(kelas); }
    sql += ' ORDER BY kelas,nama LIMIT 20';
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch(e) {
    res.json([]);
  }
});

module.exports = router;
