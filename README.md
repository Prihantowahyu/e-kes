# 🏫 Sistem Kesiswaan SMK Diponegoro Tumpang
**Node.js + Express + MySQL | v1.0**

---

## 📋 Fitur Lengkap
- ✅ Login & Manajemen User (Admin, Tatib, Wali Kelas, Petugas)
- ✅ Data Siswa (CRUD + foto + detail riwayat)
- ✅ Rekam Pelanggaran (input, konfirmasi, foto bukti)
- ✅ Surat Peringatan (rekap otomatis + buat SP)
- ✅ Penyitaan Barang (catat + pengembalian)
- ✅ Absensi KBM (input massal, otomatis catat pelanggaran)
- ✅ Dashboard statistik + grafik
- ✅ Manajemen Petugas Piket & KBM

---

## 🚀 Instalasi Lokal (VS Code)

### 1. Prasyarat
- **Node.js** v18+ → https://nodejs.org
- **MySQL** v8+ atau **XAMPP/WAMP**
- **VS Code** + extension ESLint (opsional)

### 2. Clone / Extract Proyek
```
cd /path/ke/folder/kamu
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Setup Database MySQL
Buka MySQL/phpMyAdmin, jalankan file SQL:
```bash
mysql -u root -p < sql/schema.sql
```
Atau copy-paste isi `sql/schema.sql` ke phpMyAdmin → tab SQL → Execute.

### 5. Konfigurasi .env
Edit file `.env` sesuai database kamu:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password_mysql_kamu
DB_NAME=kesiswaan_smk
SESSION_SECRET=ganti_dengan_string_acak_panjang
NODE_ENV=development
```

### 6. Jalankan Aplikasi
```bash
# Mode development (auto-restart saat ada perubahan)
npm run dev

# Mode production
npm start
```

Buka browser: **http://localhost:3000**

### 7. Login Default
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | Admin |
| tatib    | admin123 | Tatib |

---

## 🌐 Deploy ke Hosting (cPanel / VPS)

### Opsi A: Hosting VPS (Ubuntu/Debian) — DIREKOMENDASIKAN

#### 1. Install Node.js di Server
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # cek: v18.x.x
```

#### 2. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

#### 3. Upload Proyek ke Server
```bash
# Via SCP
scp -r ./kesiswaan user@ip-server:/var/www/

# Atau via Git
git clone [repo-url] /var/www/kesiswaan
```

#### 4. Install Dependencies di Server
```bash
cd /var/www/kesiswaan
npm install --production
```

#### 5. Setup Database di Server
```bash
mysql -u root -p < sql/schema.sql
```

#### 6. Edit .env untuk Production
```env
NODE_ENV=production
DB_HOST=localhost
DB_USER=user_db_hosting
DB_PASSWORD=password_db_hosting
DB_NAME=kesiswaan_smk
SESSION_SECRET=string_acak_sangat_panjang_dan_aman_min_32_karakter
PORT=3000
```

#### 7. Jalankan dengan PM2
```bash
cd /var/www/kesiswaan
pm2 start app.js --name "kesiswaan-smk"
pm2 save
pm2 startup  # agar otomatis jalan saat server restart
```

#### 8. Setup Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name domain-kamu.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Opsi B: Hosting Shared (cPanel) dengan Node.js App

> ⚠️ Pastikan hosting mendukung Node.js (Hostinger Business, Niagahoster Cloud, dll.)

1. Login cPanel → **Setup Node.js App**
2. Klik **Create Application**:
   - Node.js version: 18.x
   - Application mode: Production
   - Application root: `/public_html/kesiswaan`
   - Application URL: domain atau subdomain
   - Application startup file: `app.js`
3. Upload semua file ke folder tersebut (via File Manager atau FTP)
4. Di cPanel → **MySQL Databases**: buat database + user
5. Edit `.env` dengan kredensial database cPanel
6. Di Node.js App → klik **Run NPM Install**
7. Klik **Restart**

---

## 📁 Struktur Proyek
```
kesiswaan/
├── app.js                 # Entry point utama
├── package.json
├── .env                   # Konfigurasi (jangan di-commit ke Git!)
├── config/
│   └── database.js        # Koneksi MySQL pool
├── middleware/
│   └── auth.js            # Autentikasi & otorisasi
├── routes/
│   ├── auth.js            # Login/Logout
│   ├── dashboard.js       # Dashboard
│   ├── siswa.js           # Manajemen Siswa
│   ├── pelanggaran.js     # Rekam Pelanggaran
│   ├── sp.js              # Surat Peringatan
│   ├── penyitaan.js       # Penyitaan Barang
│   ├── kehadiran.js       # Absensi KBM
│   ├── users.js           # Manajemen User
│   └── petugas.js         # Manajemen Petugas
├── views/
│   ├── partials/
│   │   ├── header.ejs     # Sidebar + Header
│   │   └── footer.ejs     # Script + Footer
│   └── pages/
│       ├── login.ejs
│       ├── dashboard.ejs
│       ├── siswa/
│       ├── pelanggaran/
│       ├── sp/
│       ├── penyitaan/
│       ├── kehadiran/
│       ├── users/
│       └── petugas/
├── public/
│   ├── css/style.css      # Stylesheet utama
│   └── uploads/           # Foto bukti (auto-created)
└── sql/
    └── schema.sql         # Database schema + data awal
```

---

## 🔒 Keamanan Production
1. **Ganti password default** admin & tatib segera setelah deploy
2. **Ganti SESSION_SECRET** dengan string acak panjang (min 32 karakter)
3. Tambahkan HTTPS via Let's Encrypt: `sudo certbot --nginx`
4. Jangan upload file `.env` ke Git (sudah ada di .gitignore)

---

## 🆘 Troubleshooting
| Error | Solusi |
|-------|--------|
| `ER_ACCESS_DENIED` | Cek username/password di .env |
| `ECONNREFUSED 3306` | MySQL belum jalan, jalankan XAMPP/MySQL |
| `Cannot find module` | Jalankan `npm install` |
| Port 3000 sudah dipakai | Ganti PORT di .env ke 3001 dst. |

---

## 📞 Dukungan
Sistem ini dibuat untuk **SMK Diponegoro Tumpang**.
Untuk pertanyaan teknis, buka issue atau hubungi developer.
