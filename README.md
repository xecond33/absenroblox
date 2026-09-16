# AbsensiMap — Deploy (Google Sheets + Vercel)

Aplikasi absensi ini dirancang menggunakan arsitektur **Serverless Frontend (Vercel)** dan **Google Sheets + Google Apps Script (Backend)**. Tidak diperlukan server Node.js maupun langganan *database*.

## Tahap 1: Persiapan Database (Google Sheets)
1. Buka [Google Sheets](https://sheets.google.com) dan buat *spreadsheet* baru (bebas beri nama apa saja).
2. Perhatikan struktur *sheet* yang dibutuhkan. Namun tenang saja, *sheet* dan struktur (kolom-kolom) ini akan **dibuat secara otomatis** oleh skrip yang sudah disiapkan jika belum ada.
3. Klik menu **Extensions > Apps Script** di Google Sheets kamu.

## Tahap 2: Menanamkan Kode Backend
1. Saat editor Apps Script terbuka, hapus fungsi `myFunction()` bawaan.
2. Buka file [`apps_script_backend.js`](./apps_script_backend.js) yang ada di folder proyek ini.
3. *Copy* (salin) **seluruh** isi dari file `apps_script_backend.js` tersebut.
4. *Paste* (tempel) ke dalam editor Google Apps Script kamu.
5. Klik ikon disket (Save) atau tekan `Ctrl+S` / `Cmd+S`.

## Tahap 3: Deploy API (Google Apps Script)
1. Di kanan atas editor Apps Script, klik tombol biru **Deploy > New deployment**.
2. Klik ikon gir (Settings) di sebelah tulisan "Select type", centang **Web app**.
3. Isi deskripsi bebas (contoh: `V1`).
4. Pada bagian **Execute as**, pilih **Me (email-kamu@gmail.com)**.
5. Pada bagian **Who has access**, **SANGAT PENTING**: pilih **Anyone (Siapa saja)**.
6. Klik **Deploy**.
7. Google mungkin akan meminta izin akses (Authorize access). Klik **Review permissions**, pilih akun Google-mu, klik **Advanced** (Lanjutan), dan klik **Go to... (unsafe)**. Klik **Allow** (Izinkan).
8. Setelah berhasil, kamu akan mendapatkan **Web app URL** yang panjang (berakhiran `.../exec`). **Copy URL tersebut!**

## Tahap 4: Hubungkan Frontend ke API
1. Kembali ke komputer lokalmu, buka file [`auth.js`](./auth.js).
2. Cari baris berikut (di bagian paling atas):
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
   ```
3. Ganti URL tersebut dengan URL Web App yang baru saja kamu *copy* dari langkah sebelumnya.
4. Simpan file `auth.js`.

## Tahap 5: Deploy Frontend ke Vercel
1. Buat repositori baru di GitHub-mu, lalu *upload* seluruh file dalam folder ini (pastikan `auth.js` yang di-upload sudah berisi URL yang benar).
2. Login ke [Vercel](https://vercel.com).
3. Klik **Add New... > Project**.
4. Import repositori GitHub tersebut.
5. Di bagian **Framework Preset**, pilih **Other** (jangan ubah pengaturan lainnya).
6. Klik **Deploy**.
7. Selesai! Kamu akan mendapatkan *link* Vercel publik untuk website-mu.

## Akun Admin Pertama
1. Buka website (dari Vercel) dan masuk ke halaman Register.
2. Karena *database* (Sheet 'Users') kamu masih kosong, **pengguna pertama yang mendaftar secara otomatis akan dijadikan Admin**.
3. Pengguna kedua dan seterusnya otomatis berstatus `user`.
4. Jika kamu ingin menjadikan orang lain sebagai admin, buka Google Sheets-mu, masuk ke *sheet* **Users**, dan ubah tulisan `user` di kolom `role` menjadi `admin`.

Selamat! Aplikasi AbsensiMap kamu sekarang *online* secara gratis, aman, dan *database*-nya sangat mudah dilihat via Google Sheets.
