export interface GuideSection {
  title: string;
  keywords: string[];
  body: string;
}

// Knowledge base ringkas — kurasi dari docs/wiki/*.md.
// Dipakai untuk grounding "cara pakai aplikasi" pada chat RAG.
export const APP_GUIDE: GuideSection[] = [
  {
    title: 'Alur Bisnis Pospro Event',
    keywords: ['alur', 'bisnis', 'workflow', 'proses', 'tahap', 'lead', 'penawaran', 'rab', 'event', 'cashflow'],
    body:
      'Alur 5 tahap: (1) Lead masuk (META Ads/WhatsApp/Website) dikelola di CRM Pipeline kanban; ' +
      '(2) Convert ke Customer saat Closed Deal, otomatis membuat draft Penawaran & RAB; ' +
      '(3a) Buat SPH untuk klien & kirim PDF, (3b) buat RAB internal untuk hitung modal & margin; ' +
      '(4) Eksekusi event dengan penjadwalan di Event Timeline dan assign crew (check-in via link WA unik); ' +
      '(5) Catat cashflow income/expense dan tag ke Event untuk laporan laba per project.',
  },
  {
    title: 'Penawaran / Quotation (SPH)',
    keywords: ['penawaran', 'quotation', 'sph', 'surat', 'sewa', 'pengadaan', 'booth', 'nomor', 'revisi', 'pdf', 'docx'],
    body:
      'Penawaran disimpan sebagai Invoice tipe QUOTATION dengan 2 variant: SEWA (rental) & PENGADAAN_BOOTH (custom build). ' +
      'Nomor berformat {seq}/{kode}/Pnwr/{bulan_romawi}/{yy} (mis. 42/Xp/Pnwr/IV/26). ' +
      'Workflow: DRAFT → isi item & data klien → assign nomor → export PDF/DOCX → kirim → status SENT → klien ACC jadi ACCEPTED → convert ke Invoice formal. ' +
      'Tombol Generate Penawaran di RAB bisa auto-create quotation dari item RAB.',
  },
  {
    title: 'Invoice & Dokumen Bisnis',
    keywords: ['invoice', 'faktur', 'tagihan', 'pembayaran', 'status', 'diskon', 'pajak', 'ppn', 'pph'],
    body:
      'Invoice (faktur tagihan) dibuat setelah klien ACC untuk penagihan; SPH dikirim sebelum deal. ' +
      'Tiga mode input item: katalog produk (harga otomatis), custom/jasa (manual), dan area-based per m² untuk percetakan. ' +
      'Status invoice DRAFT→SENT→PAID; status SPH DRAFT→SENT→ACCEPTED→REJECTED/EXPIRED. ' +
      'Konversi SPH ACCEPTED ke Invoice menyalin semua data dengan nomor baru INV-YYYYMMDD-XXX. Mendukung PPN (inclusive/exclusive) dan PPh (withholding).',
  },
  {
    title: 'CRM / Lead Pipeline',
    keywords: ['crm', 'lead', 'pipeline', 'kanban', 'stage', 'label', 'follow', 'negosiasi', 'closed', 'convert'],
    body:
      'CRM adalah kanban drag-drop untuk lead dari berbagai channel (META Ads, WhatsApp, Website). ' +
      'Lead bergerak antar stage (Lead Masuk → Follow Up → Penawaran → Negosiasi → Closed Deal/Lost) dengan activity timeline & label warna (HOT/WARM/COLD). ' +
      'Card bisa dibuka jadi drawer detail; tombol WA hijau membuka chat template otomatis. ' +
      'Di win stage (Closed Deal), tombol "Convert ke Customer" sekaligus membuat Customer + draft Penawaran + draft RAB. Lead tetap tersimpan untuk audit.',
  },
  {
    title: 'Konversi Lead → Customer (+ Penawaran & RAB)',
    keywords: ['convert', 'konversi', 'lead', 'customer', 'closed', 'deal', 'draft'],
    body:
      'Saat lead mencapai stage dengan isWinStage=true (default Closed Deal): tarik lead ke kolom Closed Deal → tab Convert di drawer → pilih sekalian buat draft Penawaran (variant SEWA/PENGADAAN_BOOTH) & draft RAB. ' +
      'Klik Convert menjalankan 1 transaksi: Customer baru dibuat, Lead ter-link via convertedCustomerId, activity CONVERTED di-log, dan draft Penawaran & RAB ter-generate. Lead tetap terlihat di stage Closed Deal.',
  },
  {
    title: 'Data Pelanggan (Customer)',
    keywords: ['customer', 'pelanggan', 'klien', 'company', 'perusahaan', 'pic', 'kontak', 'analytics'],
    body:
      'Customer adalah master data klien B2B (PT/CV) atau walk-in. Field utama: nama PIC, phone (unik, untuk matching analytics), email, alamat, companyName, companyPIC (penandatangan). ' +
      'Dibuat via CRM Convert (auto dari Lead) atau manual. Berelasi ke Invoice/RAB/Event. ' +
      'Halaman /customers menampilkan daftar + statistik per customer (order, revenue); klik baris untuk modal analytics.',
  },
  {
    title: 'Cashflow Bisnis',
    keywords: ['cashflow', 'kas', 'pemasukan', 'pengeluaran', 'income', 'expense', 'kategori', 'bank', 'approval', 'laba'],
    body:
      'Cashflow mencatat arus kas masuk/keluar dari 2 sumber: otomatis (POS/kasir) dan manual (vendor booth/event). ' +
      'Entri manual bisa di-tag ke Event/RabPlan lewat dropdown. Kategori booth: Income (DP/Pelunasan, Sewa), Expense (Material, Jasa, Transport, Akomodasi, Sewa Alat, Konsumsi), Operasional. ' +
      'Mendukung multi-bank. Ada approval workflow: user biasa mengajukan edit/hapus, owner meninjau approve/reject. Dashboard menampilkan tren bulanan & breakdown kategori.',
  },
  {
    title: 'Event Timeline (Gantt)',
    keywords: ['event', 'timeline', 'gantt', 'jadwal', 'schedule', 'setup', 'dismantle', 'crew', 'conflict', 'margin'],
    body:
      'Event Timeline adalah tampilan Gantt untuk melihat semua event paralel dalam satu layar. Tiap event punya 4 fase bar: Departure (abu), Setup (merah), Event (kuning), Dismantle (biru). ' +
      'Zoom Hari/Minggu/Kuartal. Fitur: deteksi konflik PIC (ring kuning), histogram kapasitas per hari, chip margin RAB per event (hijau/kuning/merah), group by Client/PIC/Brand/Venue. ' +
      'Edit mode: drag handle bar untuk resize tanggal. Tools: Print A3, export .ics, Copy ringkasan WA untuk grup crew.',
  },
  {
    title: 'RAB Event (Rencana Anggaran Biaya)',
    keywords: ['rab', 'anggaran', 'biaya', 'budget', 'modal', 'margin', 'item', 'kategori', 'cost'],
    body:
      'RAB adalah dokumen internal breakdown cost per event — selalu bisa diubah (mutable), format code RAB-YYYY-NNNN. ' +
      'Tiap item punya dua sisi: quantity+priceRab (yang ditawarkan ke klien) vs quantityCost+priceCost (cost internal yang dieksekusi). Kategori: Material/Jasa/Transport/Akomodasi/Sewa Alat. ' +
      'Ringkasan mengembalikan totalRab/totalCost/margin%. Tombol: Generate Penawaran (auto-create Invoice), Save as Product (promote item jadi katalog), Generate Cashflow (bulk expense auto-tag event).',
  },
  {
    title: 'Crew Tracking (Setup Time)',
    keywords: ['crew', 'tim', 'team', 'check-in', 'checkout', 'absensi', 'setter', 'loader', 'assignment', 'durasi'],
    body:
      'Crew Tracking untuk assign crew lapangan ke event & mencatat durasi setup. Master CrewTeam (mis. Team Kepuh, Team Sawah) dengan leader PIC. ' +
      'Alur: admin assign worker → generate token unik → kirim link WA → crew tap /public/crew/{token} (tanpa login) → Check-in (foto opsional) → Check-out → durasi terhitung otomatis. Status ASSIGNED→ON_SITE→DONE. ' +
      'Report /reports/crew menyediakan agregasi rows detail, leaderboard byWorker, dan byTeam.',
  },
  {
    title: 'Panduan Pemula (Setup Awal)',
    keywords: ['panduan', 'pemula', 'setup', 'awal', 'mulai', 'login', 'password', 'worker', 'supplier', 'backup'],
    body:
      'Langkah setup pengguna baru: (1) Login default admin@pospro.id/admin123 lalu ganti password; (2) Set profil toko (nama & logo); ' +
      '(3) Daftarkan Worker (sales, owner, crew); (4) Buat minimal 1 Team Crew; (5) Daftarkan Supplier; (6) Daftarkan Bank Account; ' +
      '(7) Cek CRM Stages & Labels (default sudah ada); (8) Lakukan Backup pertama (mis. ke Google Drive). Setelah ±1 jam setup, aplikasi siap dipakai harian.',
  },
];

export function guideTableOfContents(): string {
  return APP_GUIDE.map((s) => `- ${s.title}`).join('\n');
}

export function retrieveGuideSections(query: string, limit = 3): string[] {
  const q = query.toLowerCase();
  const qWords = q.split(/\W+/).filter((x) => x.length > 3);
  const scored = APP_GUIDE.map((s) => {
    const hay = (s.title + ' ' + s.keywords.join(' ') + ' ' + s.body).toLowerCase();
    let score = 0;
    for (const kw of s.keywords) if (q.includes(kw)) score += 2;
    for (const w of qWords) if (hay.includes(w)) score += 1;
    return { s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => `### ${x.s.title}\n${x.s.body}`);
}
