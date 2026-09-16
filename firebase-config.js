// ============================================================
// KONFIGURASI FIREBASE — GANTI DENGAN MILIK KAMU SENDIRI
// ============================================================
//
// Cara dapetin config ini (gratis, ±5 menit):
// 1. Buka https://console.firebase.google.com
// 2. Klik "Add project" → kasih nama bebas → lanjut sampai selesai
//    (boleh matiin Google Analytics, gak perlu)
// 3. Di dashboard project, klik ikon "</>" (Web app) → daftarkan app
//    → nanti muncul object firebaseConfig, copy semua isinya ke bawah ini
// 4. Di menu kiri, buka "Build" → "Realtime Database" → "Create Database"
//    → pilih lokasi server (misal Singapore/asia-southeast1) → mulai
//    dalam "test mode" dulu (biar gampang, tapi lihat catatan keamanan
//    di bawah)
// 5. Simpan file ini, upload ulang bareng index.html & style.css ke hosting
//    kamu (Netlify/Vercel/GitHub Pages/dll, atau cukup buka index.html
//    langsung di browser)
//
// CATATAN KEAMANAN:
// "Test mode" bikin database bisa dibaca+ditulis siapa aja yang tau
// URL-nya selama 30 hari lalu terkunci otomatis. Untuk pemakaian
// selanjutnya, di tab "Rules" Realtime Database ganti jadi:
//   {
//     "rules": {
//       ".read": true,
//       ".write": true
//     }
//   }
// (ini tetap publik/tanpa login — cocok buat kasus "tanpa database
// ribet" kayak sekarang, tapi siapa pun yang tau alamat databasenya
// bisa ubah data. Kalau butuh proteksi lebih, tambahkan Firebase
// Authentication — bilang aja kalau nanti mau upgrade ke situ.)

window.firebaseConfig = {
  apiKey: "AIzaSyBIVg4h60nVyUR86ZNnxblcHouSs9sBI2g",
  authDomain: "absenmap-8e424.firebaseapp.com",
  databaseURL: "https://console.firebase.google.com/project/absenmap-8e424/database/absenmap-8e424-default-rtdb/data/~2F",
  projectId: "absenmap-8e424",
  storageBucket: "absenmap-8e424.firebasestorage.app",
  messagingSenderId: "558749668297",
  appId: "1:558749668297:web:5e068cb71772545a914e18"
};

// Selama config di atas belum diganti, aplikasi otomatis jalan pakai
// localStorage biasa (mode lokal, tanpa sync antar device) — jadi
// aplikasi tetap berfungsi normal sebelum kamu setup Firebase.
