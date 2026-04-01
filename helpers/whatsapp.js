// helpers/whatsapp.js
// Menggunakan Fonnte API (fonnte.com) - gratis untuk volume rendah
const axios = require('axios');
require('dotenv').config();

const WA_ENABLED = process.env.WA_ENABLED === 'true';
const WA_TOKEN   = process.env.WA_TOKEN || '';

/**
 * Kirim pesan WhatsApp ke nomor tertentu
 * @param {string} to   - nomor HP (08xxx atau 628xxx)
 * @param {string} message - isi pesan
 */
async function kirimWA(to, message) {
  if (!WA_ENABLED || !WA_TOKEN) {
    console.log(`[WA DISABLED] To: ${to} | Msg: ${message.substring(0,60)}...`);
    return { ok: false, reason: 'WA tidak diaktifkan' };
  }
  try {
    const nomor = to.replace(/\D/g, '').replace(/^0/, '62');
    const res = await axios.post('https://api.fonnte.com/send', {
      target:  nomor,
      message: message,
      countryCode: '62'
    }, {
      headers: { Authorization: WA_TOKEN },
      timeout: 10000
    });
    console.log(`[WA OK] To: ${nomor}`);
    return { ok: true, data: res.data };
  } catch (e) {
    console.error('[WA ERROR]', e.message);
    return { ok: false, error: e.message };
  }
}

// ── Template Pesan ────────────────────────────────────────────

function pesanPelanggaran(siswa, jenis, tanggal, catatan) {
  return `🏫 *SMK Diponegoro Tumpang*
Sistem Informasi Kesiswaan

Yth. Bapak/Ibu *${siswa.nama_wali || 'Orang Tua/Wali'}*,

Kami memberitahukan bahwa putra/putri Bapak/Ibu:

👤 Nama  : *${siswa.nama}*
🏷️ Kelas : *${siswa.kelas}*
⚠️ Jenis  : *${jenis}*
📅 Tanggal: *${tanggal}*
${catatan ? `📝 Catatan: ${catatan}` : ''}

Mohon perhatian dan bimbingan dari Bapak/Ibu di rumah agar kejadian serupa tidak terulang.

Terima kasih atas kerjasamanya.

_Salam Hormat,_
*Bagian Kesiswaan SMK Diponegoro Tumpang*`;
}

function pesanSP(siswa, tipeSP, tanggal, alasan) {
  return `🏫 *SMK Diponegoro Tumpang*
Sistem Informasi Kesiswaan

⚠️ *PEMBERITAHUAN ${tipeSP.toUpperCase()}* ⚠️

Yth. Bapak/Ibu *${siswa.nama_wali || 'Orang Tua/Wali'}*,

Dengan hormat kami memberitahukan bahwa putra/putri Bapak/Ibu:

👤 Nama  : *${siswa.nama}*
🏷️ Kelas : *${siswa.kelas}*
📋 Status : *${tipeSP}*
📅 Tanggal: *${tanggal}*
📝 Alasan : ${alasan || 'Pelanggaran tata tertib sekolah'}

Kami mengharapkan Bapak/Ibu untuk hadir ke sekolah guna menandatangani surat peringatan ini dan berdiskusi mengenai perkembangan putra/putri Bapak/Ibu.

Terima kasih atas perhatian dan kerjasamanya.

_Salam Hormat,_
*Bagian Kesiswaan SMK Diponegoro Tumpang*`;
}

function pesanAbsensi(siswa, status, tanggal, hari) {
  const emoji = { Alpha:'❌', Terlambat:'⏰', Bolos:'🚫', Izin:'📋', Sakit:'🏥' };
  return `🏫 *SMK Diponegoro Tumpang*
Informasi Kehadiran Siswa

Yth. Bapak/Ibu *${siswa.namaWali || 'Orang Tua/Wali'}*,

${emoji[status] || '⚠️'} Putra/putri Bapak/Ibu tercatat:

👤 Nama   : *${siswa.nama}*
🏷️ Kelas  : *${siswa.kelas}*
📅 Tanggal: *${hari}, ${tanggal}*
📊 Status : *${status}*

Mohon konfirmasi dan perhatiannya.

_Terima kasih._
*Bagian Kesiswaan SMK Diponegoro Tumpang*`;
}

module.exports = { kirimWA, pesanPelanggaran, pesanSP, pesanAbsensi };
