# AbsensiMap — Deploy ke Vercel

Aplikasi ini dibangun menggunakan:
- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Vercel Serverless Functions (Node.js)
- Database: Vercel KV (Redis)
- Session: HTTP-Only Cookies (via `cookie`)
- Security: Password di-hash (via `bcryptjs`)

## Cara Deploy ke Vercel

Ikuti langkah-langkah di bawah ini untuk meng-online-kan aplikasi secara gratis.

### 1. Upload ke GitHub
1. Buat repositori baru di akun GitHub kamu.
2. Upload semua file dalam folder ini ke repositori tersebut (pastikan struktur foldernya tetap sama).

### 2. Buat Project di Vercel
1. Kunjungi [vercel.com](https://vercel.com/) dan login menggunakan akun GitHub-mu.
2. Klik tombol **Add New... > Project**.
3. Pilih repositori GitHub `absensi-map` yang baru saja kamu buat, lalu klik **Import**.
4. Di bagian **Framework Preset**, pastikan pilihannya **Other** (karena kita menggunakan Vanilla JS).
5. Klik **Deploy** dan tunggu proses selesai.

*(Aplikasi saat ini akan error jika dibuka karena databasenya belum dibuat).*

### 3. Setup Vercel KV (Database)
1. Buka halaman Project yang baru di-deploy di Vercel Dashboard.
2. Masuk ke tab **Storage**.
3. Klik **Create Database**, pilih **KV (Redis)**, dan klik **Continue**.
4. Beri nama databasenya (contoh: `absensi_db`) dan pilih region (pilih yang dekat dengan Indonesia, misal `Singapore` atau biarkan default).
5. Klik **Create & Continue**.
6. Hubungkan (Connect) KV Database tersebut ke project AbsensiMap kamu.

Vercel akan otomatis menyuntikkan *Environment Variables* seperti `KV_URL`, `KV_REST_API_URL`, dll ke dalam project-mu.

### 4. Selesai!
1. Buka kembali URL websitemu (bisa dilihat di dashboard Vercel).
2. Halaman tidak akan *blank* lagi dan sistem sudah bisa berjalan.

---

## Akun Admin Pertama
1. Buka halaman `login.html` dan pilih tab **Daftar** (Register).
2. Daftarkan akun pertama kamu (contoh: `admin_absensi`).
3. Sistem secara otomatis mendeteksi bahwa ini adalah pendaftar pertama dan akan memberikannya role **admin**.
4. Pengguna-pengguna yang mendaftar setelahnya akan otomatis menjadi `user` biasa.
5. Login, klik tombol **Admin Panel**, dan kelola absensi!

## Data Awal (Seed)
Ketika kamu atau siapapun mengakses halaman dashboard untuk pertama kali, sistem akan mengecek apakah data absensi kosong. Jika kosong, sistem otomatis memasukkan daftar *default* (404, 90s blok, flux, dll). Kamu bisa langsung melihat dan mengubahnya via **Admin Panel**.
