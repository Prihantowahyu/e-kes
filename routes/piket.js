// routes/piket.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const moment  = require('moment');
const { isAuthenticated, isAdminOrTatib } = require('../middleware/auth');
const actLog  = require('../middleware/activityLog');

// GET /piket
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { minggu } = req.query;
    const startOfWeek = minggu
      ? moment(minggu).startOf('isoWeek')
      : moment().startOf('isoWeek');
    const endOfWeek = startOfWeek.clone().endOf('isoWeek');

    const [jadwal]  = await db.execute(
      'SELECT * FROM jadwal_piket WHERE tanggal BETWEEN ? AND ? ORDER BY tanggal, shift',
      [startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD')]
    );
    const [petugas] = await db.execute('SELECT * FROM petugas WHERE aktif=1 ORDER BY nama');

    // Buat struktur 7 hari
    const hariList = [];
    for (let i = 0; i < 6; i++) { // Senin-Sabtu
      const tgl = startOfWeek.clone().add(i, 'days');
      hariList.push({
        tanggal : tgl.format('YYYY-MM-DD'),
        hari    : tgl.locale('id').format('dddd'),
        jadwal  : jadwal.filter(j => j.tanggal === tgl.format('YYYY-MM-DD') || moment(j.tanggal).format('YYYY-MM-DD') === tgl.format('YYYY-MM-DD'))
      });
    }

    res.render('pages/piket/index', {
      title: 'Jadwal Piket',
      hariList, petugas,
      mingguIni: startOfWeek.format('YYYY-MM-DD'),
      mingguDepan: startOfWeek.clone().add(1,'week').format('YYYY-MM-DD'),
      mingguLalu:  startOfWeek.clone().subtract(1,'week').format('YYYY-MM-DD'),
      labelMinggu: `${startOfWeek.format('DD MMM')} — ${endOfWeek.format('DD MMM YYYY')}`
    });
  } catch(e) {
    req.flash('error', e.message); res.redirect('/dashboard');
  }
});

// POST /piket/generate — Generate otomatis jadwal seminggu bergilir
router.post('/generate', isAuthenticated, isAdminOrTatib, async (req, res) => {
  try {
    const { minggu_mulai, shift } = req.body;
    const [petugas] = await db.execute('SELECT * FROM petugas WHERE aktif=1 ORDER BY nama');
    if (!petugas.length) {
      req.flash('error', 'Belum ada petugas piket aktif.'); return res.redirect('/piket');
    }

    const start = moment(minggu_mulai).startOf('isoWeek');
    const namaHari = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    let inserted = 0;

    for (let i = 0; i < 6; i++) {
      const tgl     = start.clone().add(i, 'days');
      const tglStr  = tgl.format('YYYY-MM-DD');
      const petugas_i = petugas[i % petugas.length];
      // Cek apakah sudah ada
      const [exist] = await db.execute(
        'SELECT id FROM jadwal_piket WHERE tanggal=? AND shift=?', [tglStr, shift||'Pagi']
      );
      if (!exist.length) {
        await db.execute(
          'INSERT INTO jadwal_piket (tanggal, hari, petugas_id, nama, shift) VALUES (?,?,?,?,?)',
          [tglStr, namaHari[i], petugas_i.id, petugas_i.nama, shift||'Pagi']
        );
        inserted++;
      }
    }
    await actLog.log(req, 'Generate Jadwal Piket', 'jadwal_piket', null, `Minggu: ${start.format('DD/MM/YYYY')}`);
    req.flash('success', `${inserted} jadwal piket berhasil dibuat otomatis.`);
    res.redirect('/piket?minggu=' + start.format('YYYY-MM-DD'));
  } catch(e) {
    req.flash('error', e.message); res.redirect('/piket');
  }
});

// POST /piket — Tambah manual
router.post('/', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const { tanggal, hari, nama, shift, keterangan } = req.body;
  try {
    await db.execute(
      'INSERT INTO jadwal_piket (tanggal, hari, nama, shift, keterangan) VALUES (?,?,?,?,?)',
      [tanggal, hari||'', nama, shift||'Pagi', keterangan||null]
    );
    await actLog.log(req, 'Tambah Jadwal Piket', 'jadwal_piket', null, `${nama} - ${tanggal}`);
    req.flash('success', 'Jadwal piket ditambahkan.');
    const start = moment(tanggal).startOf('isoWeek').format('YYYY-MM-DD');
    res.redirect('/piket?minggu=' + start);
  } catch(e) {
    req.flash('error', e.message); res.redirect('/piket');
  }
});

// DELETE /piket/:id
router.delete('/:id', isAuthenticated, isAdminOrTatib, async (req, res) => {
  const minggu = req.body.minggu;
  await db.execute('DELETE FROM jadwal_piket WHERE id=?', [req.params.id]);
  await actLog.log(req, 'Hapus Jadwal Piket', 'jadwal_piket', req.params.id);
  req.flash('success', 'Jadwal dihapus.');
  res.redirect('/piket' + (minggu ? '?minggu='+minggu : ''));
});

module.exports = router;
