# 🌐 Airbnb Pricing Helper — Frontend (Next.js + React + TypeScript)

Next.js frontend untuk interaksi dengan backend AI (price recommendation + booking simulation).

---

## Daftar Isi
1. [Ringkasan](#ringkasan)
2. [Tech Stack](#tech-stack)
3. [Struktur Folder](#struktur-folder)
4. [Instalasi & Menjalankan (Local)](#instalasi--menjalankan-local)
5. [Konfigurasi API](#konfigurasi-api)
6. [Fitur & Flow UI](#fitur--flow-ui)
7. [UX / Testing Suggestions](#ux--testing-suggestions)
8. [Deployment](#deployment)
9. [Limitations](#limitations)
10. [Lisensi](#lisensi)

---

## Ringkasan
UI yang sederhana untuk:
- Input detail listing (example / custom)
- Mendapat rekomendasi harga dari backend
- Mensimulasikan probabilitas booking 7-hari

---

## Tech Stack
- **Framework:** Next.js (App Router)
- **Library:** React + TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (design primitives)
- **Data Fetching:** Fetch API (native)

---

## Struktur Folder

frontend/
├── app/
│   └── page.tsx            # Main page / route
├── components/
│   └── ui/                 # shadcn components
├── public/
├── styles/
├── package.json
└── README.md

## Instalasi & Menjalankan (Local)
### 1. Install dependencies

npm install

### 2. Run dev server
npm run dev

Buka browser di: http://localhost:3000
Konfigurasi API
Cari konstanta konfigurasi API (biasanya di file utils atau di dalam komponen utama):
const API_BASE_DEFAULT = "http://localhost:8000";

Pastikan Backend:
 * Sudah running.
 * Mengizinkan origin frontend lewat konfigurasi CORS.
Fitur & Flow UI
1. Example Listing
 * Pilih row_index (dari dataset) → panggil POST /recommend_by_index.
 * Berguna untuk demo / testing end-to-end tanpa input manual.
2. Custom Listing
 * Form input: room_type, accommodates, bathrooms, amenities, latitude, longitude, instant_bookable, minimum_nights, dll.
 * Submit → POST /recommend_from_features.
3. Booking Simulation
 * Input: base_price, start_date, row_index atau anchor.
 * Submit → POST /booking_week_by_index.
 * Tampilkan: Probabilitas per hari & ringkasan 7-hari (grafik).
4. Result UI
 * Menampilkan recommended_price, price_bucket, dan explanations (kontribusi fitur).
 * Grafik sederhana untuk probabilitas booking (bar chart).
UX / Testing Suggestions
 * Validasi: Client-side validation untuk fields (required, numeric ranges).
 * Demo: Tombol “Use example listing” untuk pengisian otomatis.
 * Feedback: Loading state & error handling yang jelas (toast / inline message).
 * Testing: Unit tests dengan mock API responses untuk komponen utama (recommendation, booking chart).
Deployment
 * Platform: Vercel / Netlify / Cloudflare Pages (Static/Edge).
 * Penting: Backend harus dideploy terpisah. Pastikan variabel API_BASE di frontend diarahkan ke URL produksi backend (bukan localhost).
Limitations
 * Stateless: Frontend tidak menyimpan state persisten; semua inference ada di backend.
 * Approximation: Booking simulation untuk custom listing menggunakan nearest dataset peer.
 * Market: Backend & model assumption hanya valid untuk market Seattle.
Lisensi
Academic / Educational Use
