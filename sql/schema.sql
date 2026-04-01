-- ============================================================
--  DATABASE SISTEM KESISWAAN - SMK DIPONEGORO TUMPANG
-- ============================================================

CREATE DATABASE IF NOT EXISTS kesiswaan_smk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kesiswaan_smk;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  nama        VARCHAR(100) NOT NULL,
  role        ENUM('admin','wali_kelas','tatib','petugas') NOT NULL DEFAULT 'petugas',
  kelas       VARCHAR(20) DEFAULT NULL,
  aktif       TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── SISWA ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS siswa (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nis           VARCHAR(20) UNIQUE NOT NULL,
  nama          VARCHAR(100) NOT NULL,
  kelas         VARCHAR(20) NOT NULL,
  jenis_kelamin ENUM('L','P') NOT NULL,
  nama_wali     VARCHAR(100) DEFAULT NULL,
  no_wali       VARCHAR(20) DEFAULT NULL,
  alamat        TEXT DEFAULT NULL,
  foto          VARCHAR(255) DEFAULT NULL,
  status        ENUM('Aktif','Non-Aktif','Lulus','Pindah') DEFAULT 'Aktif',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── PETUGAS PIKET ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS petugas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  kode       VARCHAR(20) UNIQUE NOT NULL,
  nama       VARCHAR(100) NOT NULL,
  aktif      TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── PELANGGARAN ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pelanggaran (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  kode              VARCHAR(30) UNIQUE NOT NULL,
  nis               VARCHAR(20) NOT NULL,
  nama_siswa        VARCHAR(100) NOT NULL,
  kelas             VARCHAR(20) NOT NULL,
  nama_wali         VARCHAR(100) DEFAULT NULL,
  jenis_pelanggaran ENUM('Alpha','Terlambat','Bolos','Izin','Sakit','Lainnya') NOT NULL,
  tanggal           DATE NOT NULL,
  waktu             TIME NOT NULL,
  status            ENUM('Belum Dikonfirmasi','Terkonfirmasi') DEFAULT 'Belum Dikonfirmasi',
  foto_url          VARCHAR(500) DEFAULT NULL,
  catatan           TEXT DEFAULT NULL,
  input_oleh        VARCHAR(100) DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (nis) REFERENCES siswa(nis) ON UPDATE CASCADE
);

-- ── SURAT PERINGATAN ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surat_peringatan (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  kode_sp                 VARCHAR(30) UNIQUE NOT NULL,
  nis                     VARCHAR(20) NOT NULL,
  nama_siswa              VARCHAR(100) NOT NULL,
  kelas                   VARCHAR(20) NOT NULL,
  nama_wali               VARCHAR(100) DEFAULT NULL,
  no_wali                 VARCHAR(20) DEFAULT NULL,
  tipe_sp                 ENUM('SP 1','SP 2','SP 3','SP Tambahan') NOT NULL,
  tanggal_sp              DATE NOT NULL,
  jumlah_pelanggaran      INT DEFAULT 0,
  pelanggaran_pemicu      TEXT DEFAULT NULL,
  catatan_terlampir       TEXT DEFAULT NULL,
  dibuat_oleh             VARCHAR(100) DEFAULT NULL,
  status                  ENUM('Aktif','Selesai','Dibatalkan') DEFAULT 'Aktif',
  catatan_siswa           TEXT DEFAULT NULL,
  catatan_ortu            TEXT DEFAULT NULL,
  catatan_wali_kelas      TEXT DEFAULT NULL,
  catatan_tatib           TEXT DEFAULT NULL,
  catatan_koord_tatib     TEXT DEFAULT NULL,
  catatan_waka_kesiswaan  TEXT DEFAULT NULL,
  catatan_kepsek          TEXT DEFAULT NULL,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (nis) REFERENCES siswa(nis) ON UPDATE CASCADE
);

-- ── PENYITAAN BARANG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS penyitaan (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  kode_pst            VARCHAR(30) UNIQUE NOT NULL,
  nis                 VARCHAR(20) NOT NULL,
  nama_siswa          VARCHAR(100) NOT NULL,
  kelas               VARCHAR(20) NOT NULL,
  nama_wali           VARCHAR(100) DEFAULT NULL,
  no_wali             VARCHAR(20) DEFAULT NULL,
  jenis_barang        VARCHAR(100) NOT NULL,
  nama_barang         VARCHAR(200) NOT NULL,
  jumlah_barang       INT DEFAULT 1,
  kondisi             ENUM('Baik','Rusak','Sedang') DEFAULT 'Baik',
  tanggal             DATE NOT NULL,
  waktu               TIME NOT NULL,
  tempat_penyitaan    VARCHAR(200) DEFAULT NULL,
  petugas_penyita     VARCHAR(100) DEFAULT NULL,
  foto_url            VARCHAR(500) DEFAULT NULL,
  catatan             TEXT DEFAULT NULL,
  status_pengembalian ENUM('Belum Dikembalikan','Sudah Dikembalikan','Dibuang') DEFAULT 'Belum Dikembalikan',
  tanggal_pengambilan DATE DEFAULT NULL,
  catatan_pengambilan TEXT DEFAULT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (nis) REFERENCES siswa(nis) ON UPDATE CASCADE
);

-- ── KEHADIRAN ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kehadiran (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  kode_kh          VARCHAR(40) UNIQUE NOT NULL,
  tanggal          DATE NOT NULL,
  hari             VARCHAR(15) DEFAULT NULL,
  kelas            VARCHAR(20) NOT NULL,
  nis              VARCHAR(20) NOT NULL,
  nama_siswa       VARCHAR(100) NOT NULL,
  jenis_kelamin    ENUM('L','P') DEFAULT NULL,
  status_kehadiran ENUM('Hadir','Alpha','Terlambat','Izin','Sakit','Bolos','Tidak Ikut Jam') NOT NULL DEFAULT 'Hadir',
  jam_ke           VARCHAR(20) DEFAULT 'Penuh Hari',
  keterangan       TEXT DEFAULT NULL,
  petugas_kbm      VARCHAR(100) DEFAULT NULL,
  lokasi           VARCHAR(200) DEFAULT NULL,
  waktu_input      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nis) REFERENCES siswa(nis) ON UPDATE CASCADE
);

-- ── PETUGAS KBM ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS petugas_kbm (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  kode       VARCHAR(20) UNIQUE NOT NULL,
  nama       VARCHAR(100) NOT NULL,
  aktif      TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── INDEKS PERFORMA ───────────────────────────────────────────
CREATE INDEX idx_pelanggaran_nis     ON pelanggaran(nis);
CREATE INDEX idx_pelanggaran_tanggal ON pelanggaran(tanggal);
CREATE INDEX idx_pelanggaran_status  ON pelanggaran(status);
CREATE INDEX idx_sp_nis              ON surat_peringatan(nis);
CREATE INDEX idx_penyitaan_nis       ON penyitaan(nis);
CREATE INDEX idx_kehadiran_tanggal   ON kehadiran(tanggal);
CREATE INDEX idx_kehadiran_kelas     ON kehadiran(kelas);
CREATE INDEX idx_kehadiran_nis       ON kehadiran(nis);

-- ── DATA AWAL ─────────────────────────────────────────────────
-- Password: admin123 (bcrypt)
INSERT INTO users (username, password, nama, role) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHG', 'Administrator', 'admin'),
('tatib', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHG', 'Staff Tata Tertib', 'tatib');

-- Siswa contoh
INSERT INTO siswa (nis, nama, kelas, jenis_kelamin, nama_wali, no_wali, status) VALUES
('2024001','Ahmad Rizki Pratama','X TKJ 1','L','Bapak Hasan Basri','08111111111','Aktif'),
('2024002','Siti Fatimah Zahra','X TKJ 1','P','Ibu Ratna Dewi','08122222222','Aktif'),
('2024003','Budi Santoso','XI TKJ 1','L','Bapak Joko Widodo','08133333333','Aktif'),
('2024004','Dewi Rahayu Ningsih','XI TKJ 2','P','Ibu Sari Indah','08144444444','Aktif'),
('2024005','Eko Prasetyo','XII TKJ 1','L','Bapak Agus Salim','08155555555','Aktif');

-- Petugas piket
INSERT INTO petugas (kode, nama) VALUES
('PTG-001','Bapak Suryono'),
('PTG-002','Ibu Dewi Kartika'),
('PTG-003','Bapak Rudi Hartono');

-- Petugas KBM
INSERT INTO petugas_kbm (kode, nama) VALUES
('KBM-001','Bapak Suryono'),
('KBM-002','Ibu Dewi Kartika'),
('KBM-003','Bapak Rudi Hartono');

-- ── LOG AKTIVITAS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT DEFAULT NULL,
  username   VARCHAR(50) DEFAULT NULL,
  nama       VARCHAR(100) DEFAULT NULL,
  aksi       VARCHAR(100) NOT NULL,
  tabel      VARCHAR(50) DEFAULT NULL,
  ref_id     VARCHAR(50) DEFAULT NULL,
  detail     TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── JADWAL PIKET ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jadwal_piket (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  tanggal    DATE NOT NULL,
  hari       VARCHAR(15) DEFAULT NULL,
  petugas_id INT DEFAULT NULL,
  nama       VARCHAR(100) NOT NULL,
  shift      ENUM('Pagi','Siang','Sore') DEFAULT 'Pagi',
  keterangan VARCHAR(200) DEFAULT NULL,
  status     ENUM('Aktif','Libur','Diganti') DEFAULT 'Aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jadwal_tgl (tanggal)
);

-- ── RAPOR PERILAKU ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapor_perilaku (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nis             VARCHAR(20) NOT NULL,
  nama_siswa      VARCHAR(100) NOT NULL,
  kelas           VARCHAR(20) NOT NULL,
  semester        ENUM('1','2') NOT NULL,
  tahun_ajaran    VARCHAR(10) NOT NULL,
  nilai_perilaku  ENUM('A','B','C','D') DEFAULT 'B',
  total_alpha     INT DEFAULT 0,
  total_terlambat INT DEFAULT 0,
  total_pelanggaran INT DEFAULT 0,
  total_sp        INT DEFAULT 0,
  catatan         TEXT DEFAULT NULL,
  dibuat_oleh     VARCHAR(100) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rapor (nis, semester, tahun_ajaran),
  FOREIGN KEY (nis) REFERENCES siswa(nis) ON UPDATE CASCADE
);

CREATE INDEX idx_activity_log ON activity_log(created_at, username);
