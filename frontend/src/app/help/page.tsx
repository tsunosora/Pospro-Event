"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, BookOpen, Phone, Mail, Workflow, ChevronRight, Lightbulb, Rocket, Target, FileText, Calculator, Tent, Wallet, Package, HardHat, Database, Briefcase, BarChart3, Smartphone, MessageCircle, Upload, PenLine, Link2, Truck, Wrench, CheckCircle2, Banknote, Landmark, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Halaman Bantuan / Help — informatif & navigable, mirip VitePress.
 *
 * Layout: 2 kolom (sidebar kategori di kiri, konten di kanan).
 * Konten hardcoded di file ini (tidak fetch API) — self-contained, mudah di-edit.
 * Bahasa Indonesia sederhana, step-by-step numbered, ringkas untuk boomer + milenial.
 */

type FaqItem = {
    q: string;
    a: string | string[];   // string = 1 paragraf; array = numbered steps
    tip?: string;
};

type Section = {
    id: string;             // anchor untuk scroll-to
    icon: LucideIcon;       // ikon lucide untuk visual familiar
    title: string;
    summary: string;        // 1 kalimat penjelasan singkat kategori
    faqs: FaqItem[];
};

type WorkflowStep = {
    icon: LucideIcon;          // ikon lucide
    role: string;              // siapa yang ngerjakan (Marketing/Owner/Crew/Finance)
    roleColor: "violet" | "blue" | "amber" | "emerald" | "rose";
    title: string;             // judul langkah
    detail: string;            // detail apa yang dilakukan
    where?: string;            // menu/halaman di app (mis. "CRM → Board")
};

type Workflow = {
    id: string;                // anchor scroll-to
    icon: LucideIcon;
    title: string;
    summary: string;           // 1 kalimat: apa & kapan alur ini terjadi
    steps: WorkflowStep[];
};

const SECTIONS: Section[] = [
    {
        id: "mulai-cepat",
        icon: Rocket,
        title: "Mulai Cepat",
        summary: "Langkah pertama pakai Pospro Event setelah login.",
        faqs: [
            {
                q: "Saya baru pertama kali login. Harus mulai dari mana?",
                a: [
                    "Buka menu Pengaturan (pojok kiri bawah) → ganti Profil Toko (nama, alamat, logo).",
                    "Daftarkan rekening bank kamu di Pengaturan → Bank Account.",
                    "Daftarkan crew/karyawan di Pengaturan → Worker.",
                    "Bikin Team Crew (mis. Team Kepuh, Team Sawah) di Pengaturan → Crew Teams.",
                    "Buat backup pertama (Pengaturan → Backup & Restore → Download ZIP). Ulangi tiap minggu.",
                ],
                tip: "Default email admin: admin@pospro.id, password: admin123 — wajib ganti setelah login pertama.",
            },
            {
                q: "Saya lupa password admin. Bagaimana reset?",
                a: "Hubungi developer (muhamadfaisal288@gmail.com). Reset password butuh akses ke database — tidak ada tombol reset di UI untuk keamanan.",
            },
            {
                q: "Aplikasi bisa dipakai berapa user sekaligus?",
                a: "Tidak ada batas. Selama akses ke server yang sama (LAN atau internet), banyak user bisa login dan kerja bersamaan.",
            },
        ],
    },
    {
        id: "crm",
        icon: Target,
        title: "CRM — Lead & Pipeline",
        summary: "Kelola calon klien dari pertama kontak sampai closed deal.",
        faqs: [
            {
                q: "Cara menambah lead baru dari WhatsApp",
                a: [
                    "Buka menu CRM → Board (Kanban).",
                    "Klik tombol + di kolom 'Lead Masuk'.",
                    "Isi: Nama, No. HP (wajib), Kota, Sumber (Meta Ads / WhatsApp / dll).",
                    "Klik Simpan — lead langsung muncul di kanban.",
                    "Untuk follow-up: klik card → klik tombol WA hijau (auto buka WhatsApp dengan template salam).",
                ],
                tip: "Kalau no. HP duplikat dengan lead lain, banner kuning akan muncul untuk warn kamu.",
            },
            {
                q: "Bagaimana drag lead dari satu tahap ke tahap lain?",
                a: [
                    "Di CRM Board, tahan klik (hold mouse) pada card lead.",
                    "Geser ke kolom tujuan (mis. Lead Masuk → Follow Up → Penawaran).",
                    "Lepas. Status otomatis ter-update.",
                ],
                tip: "Di HP, sentuh & tahan 1 detik baru bisa geser.",
            },
            {
                q: "Lead sudah deal, gimana convert jadi customer?",
                a: [
                    "Buka detail lead → klik tombol 'Convert ke Customer'.",
                    "Isi data tambahan (perusahaan, alamat lengkap) kalau perlu.",
                    "Customer baru otomatis muncul di menu Pelanggan, lead lama ter-tag CLOSED_DEAL.",
                    "Bisa langsung buat penawaran dari customer baru ini.",
                ],
            },
            {
                q: "Import lead dari file Excel",
                a: [
                    "Buka CRM → Import.",
                    "Download template XLSX yang disediakan.",
                    "Isi datanya di Excel (kolom: name, phone, source, dll).",
                    "Upload kembali file XLSX-nya.",
                    "Review hasil import sebelum confirm — lead duplikat akan ter-skip otomatis.",
                ],
            },
        ],
    },
    {
        id: "penawaran",
        icon: FileText,
        title: "Penawaran & SPK",
        summary: "Bikin Surat Penawaran Harga (SPH), Invoice, dan Surat Perintah Kerja (SPK).",
        faqs: [
            {
                q: "Cara bikin penawaran baru untuk klien",
                a: [
                    "Buka menu Penawaran → klik tombol + Baru.",
                    "Pilih varian: Sewa atau Pengadaan Booth.",
                    "Pilih klien (dari customer existing) atau isi manual.",
                    "Isi item penawaran: deskripsi, qty, harga.",
                    "Klik Simpan — nomor draft otomatis ter-assign.",
                    "Untuk nomor resmi (mis. 5260/Xp.Pnwr/V/26), klik 'Assign Nomor'.",
                ],
                tip: "1 RAB bisa di-convert jadi penawaran dengan 1 klik di halaman RAB.",
            },
            {
                q: "Bedanya mode Detail vs Ringkas di preview penawaran?",
                a: [
                    "Mode Detail: tampilkan harga per item + qty + subtotal per kategori.",
                    "Mode Ringkas: sembunyikan harga per item, hanya tampilkan total per kategori (untuk klien yang lebih suka summary).",
                    "Toggle ada di pojok kanan atas saat preview PDF.",
                ],
            },
            {
                q: "Apa itu SPK dan kapan dipakai?",
                a: "SPK (Surat Perintah Kerja) adalah dokumen kontrak yang ditandatangani klien setelah penawaran disetujui. Berisi lingkup kerja, term pembayaran (DP + pelunasan), dan tanda tangan kedua pihak. Di Pospro Event, SPK auto-generate dari data penawaran — tinggal klik preview SPK di halaman penawaran detail.",
            },
            {
                q: "Bagaimana ubah PIC (Penanggung Jawab) di SPK atau Invoice?",
                a: [
                    "Buka penawaran → tab 'Custom Text Surat'.",
                    "Pilih tab SPK atau Invoice (tergantung dokumen mana).",
                    "Isi nama PIC, jabatan, no. telp di section 'Penanggung Jawab'.",
                    "Save — PIC di dokumen tersebut akan ter-override (penawaran utama tetap pakai PIC asli).",
                ],
                tip: "Berguna ketika tagihan invoice perlu dikirim ke Finance team yang berbeda dari PIC marketing klien.",
            },
            {
                q: "Cara generate Invoice DP atau Pelunasan dari penawaran",
                a: [
                    "Buka penawaran yang sudah punya nomor resmi.",
                    "Klik tombol 'Generate Invoice'.",
                    "Pilih bagian: DP / Pelunasan / Full.",
                    "Isi tanggal jatuh tempo.",
                    "Klik Buat — invoice baru ter-generate, otomatis link ke penawaran asal.",
                ],
            },
            {
                q: "Klien minta perpanjang jatuh tempo pembayaran. Cara update?",
                a: [
                    "Buka invoice yang bersangkutan.",
                    "Edit kolom 'Jatuh Tempo' dengan tanggal baru.",
                    "Isi 'Alasan Perubahan' (mis. 'Klien minta tunda 1 minggu').",
                    "Save. History extend tersimpan di audit log — bisa dilihat owner kapan saja.",
                ],
            },
            {
                q: "Tandai invoice sudah dibayar",
                a: [
                    "Buka invoice → klik tombol 'Tandai Pembayaran Masuk'.",
                    "Isi: jumlah, tanggal bayar, metode (Transfer/Cash/QRIS), rekening tujuan.",
                    "Upload bukti TF (foto resi) — opsional tapi disarankan.",
                    "Save — invoice ter-update status PAID (atau PARTIALLY_PAID kalau cicilan).",
                ],
                tip: "Cashflow otomatis ter-buat sebagai INCOME, ter-tag ke invoice ini.",
            },
        ],
    },
    {
        id: "rab",
        icon: Calculator,
        title: "RAB — Rencana Anggaran",
        summary: "Hitung anggaran proyek dengan dual qty/price (klien vs modal) untuk lihat margin real-time.",
        faqs: [
            {
                q: "Apa itu RAB dan beda dengan Penawaran?",
                a: "RAB (Rencana Anggaran Biaya) = perhitungan modal INTERNAL untuk satu proyek. Penawaran = dokumen HARGA JUAL ke klien. Bedanya: RAB punya 2 kolom harga (harga klien & harga modal aktual) supaya margin terlihat. Penawaran cuma kolom harga klien.",
            },
            {
                q: "Cara bikin RAB baru",
                a: [
                    "Buka menu RAB → klik tombol + Baru.",
                    "Isi judul, project, lokasi, periode (start-end).",
                    "Pilih klien (opsional, untuk link ke histori customer).",
                    "Tambah item per kategori (Material, Jasa, Transport, Akomodasi, Sewa Alat, dll).",
                    "Untuk tiap item: isi qty/harga klien (kolom kiri) + qty/harga modal (kolom kanan).",
                    "Margin auto-hitung di pojok atas.",
                    "Save — kode `RAB-2026-XXXX` auto-assign.",
                ],
                tip: "Item yang punya flag 'Inventaris' akan otomatis spawn pengadaan barang aset (tracking di Inventory Acquisition).",
            },
            {
                q: "Generate penawaran dari RAB",
                a: [
                    "Buka RAB yang sudah final.",
                    "Klik tombol 'Buat Penawaran' di atas.",
                    "Pilih varian (Sewa/Pengadaan Booth).",
                    "Penawaran baru otomatis ter-buat dengan items copy dari RAB (pakai harga klien).",
                    "Bisa di-edit lebih lanjut di halaman penawaran sebelum kirim klien.",
                ],
            },
            {
                q: "Tag RAB untuk filter & laporan",
                a: "Di halaman RAB list, ada filter berdasarkan tag (mis. 'Stand Standar 3x3', 'Pengadaan', 'Booth Premium'). Tag di-set di field 'Tags' saat edit RAB. Berguna untuk laporan per tipe proyek.",
            },
        ],
    },
    {
        id: "event",
        icon: Tent,
        title: "Event, Crew & Timeline",
        summary: "Jadwal event, assign crew, track check-in/out lapangan dengan foto.",
        faqs: [
            {
                q: "Bikin event baru di kalender",
                a: [
                    "Buka menu Events → klik tombol + Baru.",
                    "Isi: Nama event, brand, venue, klien, PIC dari pekerja.",
                    "Isi 4 fase tanggal (tanpa jam): Berangkat, Pasang / Setup, Event, Bongkar / Dismantle.",
                    "Optional: link ke RAB Plan, set override gaji crew khusus untuk event ini.",
                    "Save — event muncul di list & timeline Gantt.",
                ],
                tip: "Marketing input tanggal saja, jam otomatis disimpan 00:00 (tidak perlu tebak jam event).",
            },
            {
                q: "Apa itu Event Timeline Gantt?",
                a: "Visualisasi semua event paralel dalam 1 layar. Tiap event jadi bar horizontal, warna sesuai fase (Setup merah, Event kuning, Dismantle biru). Bisa drag-drop untuk geser tanggal. Bermanfaat untuk lihat konflik crew (PIC yang sama dipakai 2 event sekaligus).",
            },
            {
                q: "Assign crew ke event + kirim link check-in via WA",
                a: [
                    "Buka detail event → tab 'Crew'.",
                    "Klik 'Assign Crew' → pilih worker dari team.",
                    "Set jadwal Mulai-Selesai (opsional).",
                    "Klik 'Kirim Link via WA' — link unik ter-copy ke clipboard, paste ke chat WA crew.",
                    "Crew klik link → tap 'Check-in' saat tiba lokasi → upload foto (opsional) → 'Check-out' saat selesai.",
                    "Durasi auto-hitung, owner bisa lihat di tab Crew Report.",
                ],
            },
            {
                q: "Bikin daftar barang packing untuk event",
                a: [
                    "Buka detail event → tab 'Packing List'.",
                    "Tambah item: pilih dari ProductVariant + qty + lokasi rak.",
                    "Set disposition: PINJAM (dikembalikan) atau OPERASIONAL (habis pakai).",
                    "Saat barang ter-pack, klik checkbox — auto-record siapa & kapan.",
                    "Print packing list (PDF) untuk dibawa crew ke gudang.",
                ],
            },
        ],
    },
    {
        id: "cashflow",
        icon: Wallet,
        title: "Cashflow & Laba Project",
        summary: "Catat pemasukan/pengeluaran, tag ke event/RAB → laba per proyek auto-hitung.",
        faqs: [
            {
                q: "Catat pengeluaran proyek",
                a: [
                    "Buka menu Cashflow → klik 'Tambah Pengeluaran'.",
                    "Isi: kategori (Material/Jasa/Transport/dll), nominal, catatan.",
                    "Pilih bank account (kalau transfer) atau Cash.",
                    "TAG ke Event atau RAB (penting! supaya masuk laba project).",
                    "Save — entry langsung masuk laporan.",
                ],
                tip: "Kalau ter-tag ke Event/RAB, entry akan terhitung di laba per project di laporan Event Profit.",
            },
            {
                q: "Lihat laba per project",
                a: [
                    "Buka menu Reports → Event Profit.",
                    "List semua event dengan: total pemasukan, total pengeluaran (yang ter-tag ke event tsb), laba bersih, margin %.",
                    "Sortir by laba terbesar/terkecil untuk audit cepat.",
                    "Klik event → drill-down ke daftar cashflow yang ter-tag.",
                ],
            },
            {
                q: "Edit cashflow yang sudah masuk",
                a: [
                    "Buka detail cashflow → klik 'Request Edit'.",
                    "Isi alasan + perubahan yang diinginkan.",
                    "Save — request masuk ke admin untuk approve.",
                    "Setelah approve, cashflow ter-update + history perubahan ter-record.",
                ],
                tip: "Sistem approval ini mencegah edit langsung tanpa jejak — penting untuk audit keuangan.",
            },
        ],
    },
    {
        id: "stok",
        icon: Package,
        title: "Stok & Gudang",
        summary: "Manage stok per gudang, peminjaman dengan foto, stock opname.",
        faqs: [
            {
                q: "Cara crew pinjam barang dari gudang",
                a: [
                    "Crew buka link gudang publik (dapat PIN dari admin).",
                    "Pilih barang yang mau dipinjam + qty.",
                    "WAJIB upload foto barang saat ambil.",
                    "Set jadwal pengembalian.",
                    "Submit — record peminjaman ter-buat, admin bisa pantau di /gudang/peminjaman.",
                    "Saat kembalikan: buka link yang sama → klik 'Kembalikan' → upload foto kembali.",
                ],
                tip: "Sistem auto-deteksi peminjaman OVERDUE kalau telat dari jadwal kembali.",
            },
            {
                q: "Stock opname (audit stok fisik)",
                a: [
                    "Buka menu Opname → klik 'Sesi Baru'.",
                    "Pilih kategori barang yang mau di-audit (atau semua).",
                    "Link unik di-generate — bisa di-share ke operator yang di lapangan.",
                    "Operator buka link → input stok aktual per item.",
                    "Selesai? Klik Tutup Sesi — variance per item auto-hitung.",
                    "Penyesuaian stok bisa di-approve owner sebelum di-commit.",
                ],
            },
        ],
    },
    {
        id: "payroll",
        icon: HardHat,
        title: "Payroll & Absensi",
        summary: "Absensi harian crew, tarif kota+divisi, bonus/potongan, audit log.",
        faqs: [
            {
                q: "Set gaji harian default per worker",
                a: [
                    "Buka Pengaturan → Workers → edit worker.",
                    "Isi 'Gaji Harian (Rp)' & 'Lembur per Jam (Rp)'.",
                    "Save. Default ini dipakai kalau tidak ada override dari Event atau Wage Matrix.",
                ],
            },
            {
                q: "Cara PIC input absensi crew dari lokasi",
                a: [
                    "PIC dapat link unik (dari admin) + PIN 4-6 digit.",
                    "Buka link di HP → input PIN.",
                    "Centang nama crew yang hadir hari ini (status: FULL DAY / HALF DAY / ABSENT).",
                    "Input jam lembur (kalau ada).",
                    "Submit — absensi masuk dengan status PENDING.",
                    "Admin approve di /payroll page sebelum payroll final.",
                ],
            },
            {
                q: "Set tarif gaji per kota & divisi",
                a: [
                    "Buka Pengaturan → Wage Rates.",
                    "Tambah row: Kota (mis. 'Jakarta'), Divisi (mis. 'Tukang Kayu'), tarif harian + lembur.",
                    "Save. Tarif ini auto-dipakai saat hitung payroll kalau absensi crew ter-tag ke kota+divisi yang match.",
                ],
                tip: "Prioritas tarif: Override Event > Matrix Kota+Divisi > Default Worker.",
            },
            {
                q: "Tambah bonus atau potongan untuk crew tertentu",
                a: [
                    "Buka /payroll → tab 'Adjustments'.",
                    "Klik 'Tambah Penyesuaian'.",
                    "Pilih worker, tipe (BONUS / ALLOWANCE / DEDUCTION / ADVANCE/kasbon), nominal, tanggal berlaku.",
                    "Save — penyesuaian otomatis kepotong/ketambah di payroll periode tsb.",
                ],
            },
        ],
    },
    {
        id: "backup",
        icon: Database,
        title: "Backup & Restore",
        summary: "Asuransi data — 1 klik download semua, 1 klik restore.",
        faqs: [
            {
                q: "Cara bikin backup mingguan",
                a: [
                    "Buka Pengaturan → Backup & Restore.",
                    "Centang paket data yang mau di-backup (untuk aman, centang semua).",
                    "Klik 'Download Backup ZIP'.",
                    "Simpan file `backup-pospro-event-YYYY-MM-DD.zip` di folder aman (Google Drive, Hard Disk eksternal).",
                ],
                tip: "Versi backup saat ini: 2.17 — 68 tabel + semua fitur baru ter-cover (cicilan, due-date history, payroll, dll).",
            },
            {
                q: "Restore dari backup ZIP",
                a: [
                    "Buka Pengaturan → Backup & Restore → tab 'Restore / Import'.",
                    "Klik 'Pilih File ZIP' → pilih backup yang mau di-restore.",
                    "Review preview: tabel apa saja yang ada, jumlah record per tabel.",
                    "Centang tabel yang mau di-restore (default: semua).",
                    "Klik 'Restore' — DATA EXISTING AKAN DI-REPLACE. Confirm 2x.",
                ],
                tip: "⚠️ Restore = destructive. Selalu backup data terkini DULU sebelum restore data lama.",
            },
            {
                q: "Auto-backup ke cloud (Rclone)",
                a: [
                    "Setup di Pengaturan → Backup & Restore → section 'Auto-Backup (Rclone)'.",
                    "Aktifkan toggle, isi remote (mis. 'gdrive:Backup'), schedule cron (mis. '0 2 * * *' = setiap hari jam 2 pagi).",
                    "Set 'Keep Count' (mis. 7 = simpan 7 backup terbaru saja, lama auto-delete).",
                    "Save — backup auto-jalan sesuai jadwal, status terakhir tampil di UI.",
                ],
            },
        ],
    },
];

/**
 * 3 alur kerja end-to-end paling penting untuk vendor booth/event.
 * Format timeline vertical — tiap langkah punya role badge + lokasi menu di app
 * supaya user tahu siapa yang ngerjakan & di mana di aplikasi.
 */
const WORKFLOWS: Workflow[] = [
    {
        id: "alur-sales",
        icon: Briefcase,
        title: "Alur Sales — Lead jadi Deal",
        summary: "Dari pertama klien WA sampai tanda tangan SPK & DP masuk. Biasanya 3-14 hari.",
        steps: [
            {
                icon: Smartphone,
                role: "Marketing",
                roleColor: "violet",
                title: "Lead masuk",
                detail: "Klien chat WA / klik iklan Meta Ads. Marketing input ke kanban kolom 'Lead Masuk'.",
                where: "CRM → Board",
            },
            {
                icon: MessageCircle,
                role: "Marketing",
                roleColor: "violet",
                title: "Follow up & qualifikasi",
                detail: "Tombol WA hijau di card → buka chat dengan template salam. Geser card ke 'Follow Up' kalau klien serius. Catat kebutuhan event di field 'Order Description'.",
                where: "CRM → Board",
            },
            {
                icon: Calculator,
                role: "Owner",
                roleColor: "amber",
                title: "Bikin RAB (anggaran internal)",
                detail: "Hitung modal proyek: material, jasa, transport. Pakai kolom kanan untuk harga modal aktual, kolom kiri untuk harga jual klien. Margin auto-hitung.",
                where: "RAB → + Baru",
            },
            {
                icon: FileText,
                role: "Owner",
                roleColor: "amber",
                title: "Generate Penawaran dari RAB",
                detail: "Klik 'Buat Penawaran' di halaman RAB → varian Sewa/Pengadaan otomatis copy items. Edit final → klik 'Assign Nomor' untuk dapat nomor resmi (mis. 5260/Xp.Pnwr/V/26).",
                where: "RAB → detail",
            },
            {
                icon: Upload,
                role: "Marketing",
                roleColor: "violet",
                title: "Kirim PDF Penawaran ke klien",
                detail: "Klik tombol Download PDF → kirim via WA/Email. Mode 'Detail' (lengkap dgn harga per item) atau 'Ringkas' (per kategori) tergantung preferensi klien.",
                where: "Penawaran → preview",
            },
            {
                icon: PenLine,
                role: "Klien",
                roleColor: "rose",
                title: "Klien setuju → tanda tangan SPK",
                detail: "Klik preview SPK di halaman penawaran detail → kirim PDF SPK ke klien untuk tanda tangan. Geser card CRM ke 'Closed Deal'.",
                where: "Penawaran → preview SPK",
            },
            {
                icon: Wallet,
                role: "Finance",
                roleColor: "emerald",
                title: "Generate Invoice DP & terima pembayaran",
                detail: "Klik 'Generate Invoice' → pilih bagian 'DP'. Kirim invoice ke klien. Saat transfer masuk, klik 'Tandai Pembayaran Masuk' → upload bukti TF → status invoice jadi PAID.",
                where: "Penawaran → Generate Invoice",
            },
        ],
    },
    {
        id: "alur-event",
        icon: Tent,
        title: "Alur Event — Persiapan sampai Eksekusi",
        summary: "Dari DP masuk sampai event selesai dan crew pulang. Biasanya 1-30 hari sebelum hari H.",
        steps: [
            {
                icon: Target,
                role: "Owner",
                roleColor: "amber",
                title: "Bikin Event baru",
                detail: "Isi nama event, venue, brand, klien, PIC dari pekerja. Set 4 fase tanggal: Berangkat, Pasang/Setup, Event, Bongkar/Dismantle (tanpa jam — marketing input tanggal saja).",
                where: "Events → + Baru",
            },
            {
                icon: Link2,
                role: "Owner",
                roleColor: "amber",
                title: "Link Event ke RAB",
                detail: "Pilih RAB yang sudah dibuat di alur sales. Berguna untuk: (1) cashflow auto-tag, (2) laba per event terhitung, (3) konsisten data klien.",
                where: "Events → edit",
            },
            {
                icon: Package,
                role: "Owner",
                roleColor: "amber",
                title: "Bikin Packing List",
                detail: "Tab 'Packing List' di event detail → tambah barang per ProductVariant + qty + lokasi rak gudang. Set disposition PINJAM (dikembalikan) atau OPERASIONAL (habis pakai). Print PDF untuk dibawa crew.",
                where: "Event detail → Packing List",
            },
            {
                icon: HardHat,
                role: "Owner",
                roleColor: "amber",
                title: "Assign Crew & kirim link WA",
                detail: "Tab 'Crew' → pilih worker dari team (mis. Team Kepuh). Klik 'Kirim Link via WA' — link unik ter-copy, paste ke chat WA crew. Crew tap link saat tiba lokasi.",
                where: "Event detail → Crew",
            },
            {
                icon: Truck,
                role: "Crew",
                roleColor: "blue",
                title: "Hari H: Berangkat & check-in lokasi",
                detail: "Crew buka link WA → tap 'Check-in' saat sampai lokasi. Upload foto (opsional, untuk bukti). Sistem auto-record jam datang.",
                where: "Link WA crew (publik)",
            },
            {
                icon: Wrench,
                role: "Crew",
                roleColor: "blue",
                title: "Setup & eksekusi event",
                detail: "Pasang booth, loading peserta, jalankan event. Owner bisa pantau crew yang sudah check-in real-time di Event detail tab Crew.",
                where: "Lapangan",
            },
            {
                icon: CheckCircle2,
                role: "Crew",
                roleColor: "blue",
                title: "Selesai → check-out + foto bukti",
                detail: "Crew tap 'Check-out' di link WA → upload foto kondisi akhir. Durasi total auto-hitung (jam check-in s/d check-out). Owner mark event status COMPLETED.",
                where: "Link WA crew + Event detail",
            },
        ],
    },
    {
        id: "alur-finance",
        icon: BarChart3,
        title: "Alur Finance — Pelunasan sampai Laba",
        summary: "Setelah event selesai: tagih pelunasan, catat semua biaya, lihat laba bersih per event.",
        steps: [
            {
                icon: Banknote,
                role: "Finance",
                roleColor: "emerald",
                title: "Generate Invoice Pelunasan",
                detail: "Buka penawaran original → klik 'Generate Invoice' → pilih 'Pelunasan'. Sistem auto-hitung sisa (Total - DP). Kirim ke klien.",
                where: "Penawaran → Generate Invoice",
            },
            {
                icon: Landmark,
                role: "Finance",
                roleColor: "emerald",
                title: "Terima pembayaran + bukti TF",
                detail: "Saat transfer masuk: klik 'Tandai Pembayaran Masuk' di invoice → pilih bank, isi nominal & tanggal, upload bukti TF. Cashflow INCOME auto-buat & tag ke invoice.",
                where: "Invoice → Tandai Bayar",
            },
            {
                icon: ClipboardList,
                role: "Finance",
                roleColor: "emerald",
                title: "Catat semua pengeluaran event",
                detail: "Untuk tiap biaya (transport, makan crew, lembur, beli material tambahan): buka Cashflow → Tambah Pengeluaran. PENTING: tag ke Event/RAB supaya masuk hitungan laba.",
                where: "Cashflow → Pengeluaran",
            },
            {
                icon: HardHat,
                role: "Owner",
                roleColor: "amber",
                title: "Approve absensi crew (payroll)",
                detail: "PIC sudah submit absensi via link → buka /payroll → review tiap row → klik Approve. Payroll auto-hitung pakai tarif (Override Event > Wage Matrix > Default Worker).",
                where: "Payroll → Approval",
            },
            {
                icon: BarChart3,
                role: "Owner",
                roleColor: "amber",
                title: "Lihat laba per event",
                detail: "Buka Reports → Event Profit. List semua event dengan pemasukan, pengeluaran, laba bersih, margin %. Sortir by laba terbesar/terkecil untuk audit cepat.",
                where: "Reports → Event Profit",
            },
            {
                icon: Target,
                role: "Owner",
                roleColor: "amber",
                title: "Audit & evaluasi",
                detail: "Klik event yang laba-nya tidak sesuai ekspektasi → drill-down ke daftar cashflow ter-tag. Identifikasi pengeluaran tak terduga → improve estimasi RAB event berikutnya.",
                where: "Reports → drill-down",
            },
            {
                icon: Database,
                role: "Owner",
                roleColor: "amber",
                title: "Backup mingguan",
                detail: "Setiap minggu sekali: Pengaturan → Backup & Restore → Download ZIP. Simpan di Google Drive / hard disk eksternal. Atau setup Rclone untuk auto-backup harian.",
                where: "Pengaturan → Backup",
            },
        ],
    },
];

const ROLE_BADGE_STYLES: Record<WorkflowStep["roleColor"], string> = {
    violet: "bg-primary/15 text-primary border-primary/30",
    blue: "bg-info/15 text-info border-info/30",
    amber: "bg-warning/15 text-warning border-warning/30",
    emerald: "bg-success/15 text-success border-success/30",
    rose: "bg-destructive/12 text-destructive border-destructive/20",
};

export default function HelpPage() {
    const [query, setQuery] = useState("");
    const [activeSection, setActiveSection] = useState<string>("mulai-cepat");

    // Filter section + FAQ berdasarkan query — case insensitive, match di question & answer
    const filteredSections = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return SECTIONS;
        return SECTIONS.map((s) => ({
            ...s,
            faqs: s.faqs.filter((f) => {
                const inQ = f.q.toLowerCase().includes(q);
                const aText = Array.isArray(f.a) ? f.a.join(" ") : f.a;
                const inA = aText.toLowerCase().includes(q);
                const inTip = (f.tip ?? "").toLowerCase().includes(q);
                return inQ || inA || inTip;
            }),
        })).filter((s) => s.faqs.length > 0 || s.title.toLowerCase().includes(q));
    }, [query]);

    // Filter workflows berdasarkan query — match di title, summary, step title/detail/role
    const filteredWorkflows = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return WORKFLOWS;
        return WORKFLOWS.filter((w) => {
            if (w.title.toLowerCase().includes(q)) return true;
            if (w.summary.toLowerCase().includes(q)) return true;
            return w.steps.some((s) =>
                s.title.toLowerCase().includes(q) ||
                s.detail.toLowerCase().includes(q) ||
                s.role.toLowerCase().includes(q) ||
                (s.where ?? "").toLowerCase().includes(q)
            );
        });
    }, [query]);

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Top bar — judul + back + search */}
            <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" /> Kembali
                    </Link>
                    <div className="flex items-center gap-2 mr-auto">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h1 className="text-lg sm:text-xl font-bold text-foreground">Bantuan & Panduan</h1>
                    </div>
                    <div className="relative flex-1 max-w-md hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari fitur, mis. 'pinjam barang', 'penawaran'..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-muted text-sm focus:bg-card focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
                        />
                    </div>
                </div>
                {/* Search mobile — di bawah top bar */}
                <div className="sm:hidden border-t border-border px-4 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari panduan..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-muted text-sm focus:bg-card focus:border-primary/50 focus:outline-none transition-colors"
                        />
                    </div>
                </div>
            </header>

            {/* Hero — singkat & ramah */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6">
                <div className="max-w-3xl">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                        Cara pakai Pospro Event, dijelaskan sederhana.
                    </h2>
                    <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
                        Pilih topik di samping atau cari fitur di kolom pencarian. Tiap panduan ditulis step-by-step,
                        tidak pakai istilah teknis yang rumit.
                    </p>
                </div>
            </section>

            {/* Layout 2 kolom — sidebar + konten */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
                {/* Sidebar — sticky di desktop */}
                <aside className="hidden lg:block">
                    <nav className="sticky top-24 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4">
                        {/* Grup 1: Alur Kerja End-to-End */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3 flex items-center gap-1.5">
                            <Workflow className="h-3 w-3" />
                            Alur Kerja
                        </div>
                        {WORKFLOWS.map((w) => (
                            <button
                                key={w.id}
                                onClick={() => scrollToSection(w.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                                    activeSection === w.id
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-foreground hover:bg-muted"
                                }`}
                            >
                                <w.icon className="h-4 w-4 shrink-0" />
                                <span>{w.title}</span>
                            </button>
                        ))}

                        {/* Grup 2: Topik per Fitur */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-6 px-3">
                            Topik per Fitur
                        </div>
                        {SECTIONS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => scrollToSection(s.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                                    activeSection === s.id
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-foreground hover:bg-muted"
                                }`}
                            >
                                <s.icon className="h-4 w-4 shrink-0" />
                                <span>{s.title}</span>
                            </button>
                        ))}

                        <div className="pt-6 mt-6 border-t border-border">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3">
                                Butuh Bantuan Lebih?
                            </div>
                            <a
                                href="mailto:muhamadfaisal288@gmail.com"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>Email developer</span>
                            </a>
                        </div>
                    </nav>
                </aside>

                {/* Konten utama */}
                <main className="min-w-0 space-y-12">
                    {filteredSections.length === 0 && filteredWorkflows.length === 0 && (
                        <div className="rounded-xl border border-border bg-card p-8 text-center">
                            <p className="text-muted-foreground">
                                Tidak ada panduan yang cocok dengan{" "}
                                <strong className="text-foreground">&ldquo;{query}&rdquo;</strong>.
                            </p>
                            <button
                                onClick={() => setQuery("")}
                                className="mt-3 text-sm text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors"
                            >
                                Hapus pencarian
                            </button>
                        </div>
                    )}

                    {/* Workflows — alur kerja end-to-end, tampil paling atas */}
                    {filteredWorkflows.length > 0 && (
                        <div className="space-y-10">
                            <div className="flex items-start gap-3 pb-2">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                                    <Workflow className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">Alur Kerja End-to-End</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        3 alur utama dari klien WA pertama kali sampai laba project terhitung.
                                        Ikuti urut dari atas ke bawah.
                                    </p>
                                </div>
                            </div>

                            {filteredWorkflows.map((wf) => (
                                <WorkflowSection key={wf.id} workflow={wf} />
                            ))}
                        </div>
                    )}

                    {filteredSections.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-24">
                            {/* Section header */}
                            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border">
                                <section.icon className="h-7 w-7 shrink-0 text-primary" />
                                <div className="min-w-0">
                                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">{section.title}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>
                                </div>
                            </div>

                            {/* FAQ items */}
                            <div className="space-y-4">
                                {section.faqs.map((faq, idx) => (
                                    <FaqCard key={idx} faq={faq} />
                                ))}
                            </div>
                        </section>
                    ))}

                    {/* Kontak — di akhir konten, jelas & accessible */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                                <Phone className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-bold text-foreground">Masih bingung?</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Hubungi developer untuk pertanyaan teknis, request fitur baru, atau lapor bug.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <a
                                        href="mailto:muhamadfaisal288@gmail.com"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        <Mail className="h-4 w-4" />
                                        Email
                                    </a>
                                    <a
                                        href="https://wa.me/6289669180127"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
                                    >
                                        <Phone className="h-4 w-4" />
                                        WhatsApp 0896-6918-0127
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

/**
 * 1 alur kerja sebagai timeline vertical. Tiap step punya icon, role badge berwarna,
 * judul, detail, dan lokasi menu/halaman di aplikasi.
 * Vertical timeline lebih readable dari horizontal flowchart untuk 6-7 step.
 */
function WorkflowSection({ workflow }: { workflow: Workflow }) {
    return (
        <section id={workflow.id} className="scroll-mt-24 rounded-2xl border border-border bg-card overflow-hidden">
            {/* Header alur */}
            <div className="border-b border-border bg-primary/5 px-5 sm:px-6 py-5">
                <div className="flex items-start gap-3">
                    <workflow.icon className="h-7 w-7 shrink-0 text-primary" />
                    <div className="min-w-0">
                        <h4 className="text-lg sm:text-xl font-bold text-foreground">{workflow.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{workflow.summary}</p>
                    </div>
                </div>
            </div>

            {/* Timeline vertical */}
            <div className="p-5 sm:p-6">
                <ol className="relative space-y-6 sm:space-y-7">
                    {/* Garis vertical penghubung — pakai pseudo via border-l di tiap step kecuali terakhir */}
                    {workflow.steps.map((step, idx) => {
                        const isLast = idx === workflow.steps.length - 1;
                        return (
                            <li key={idx} className="relative pl-14 sm:pl-16">
                                {/* Icon bulat di kiri */}
                                <div className="absolute left-0 top-0 flex flex-col items-center">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-sm relative z-10">
                                        <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                    </div>
                                    {/* Garis penghubung ke step berikutnya (kecuali step terakhir) */}
                                    {!isLast && (
                                        <div className="absolute top-10 sm:top-12 left-1/2 -translate-x-1/2 w-0.5 bg-border h-full" />
                                    )}
                                </div>

                                {/* Content step */}
                                <div className="pt-1.5 sm:pt-2">
                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                            STEP {idx + 1}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${ROLE_BADGE_STYLES[step.roleColor]}`}>
                                            {step.role}
                                        </span>
                                    </div>
                                    <h5 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
                                        {step.title}
                                    </h5>
                                    <p className="mt-1.5 text-sm sm:text-[15px] text-foreground leading-relaxed">
                                        {step.detail}
                                    </p>
                                    {step.where && (
                                        <div className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted border border-border text-xs text-muted-foreground">
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-medium">{step.where}</span>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}

/**
 * Card untuk 1 FAQ item — pertanyaan + jawaban (paragraf atau numbered) + tip (opsional).
 * Style clean, spacing generous untuk readability.
 */
function FaqCard({ faq }: { faq: FaqItem }) {
    return (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 hover:border-border/80 transition-colors">
            <h4 className="font-semibold text-foreground text-base sm:text-lg leading-snug">
                {faq.q}
            </h4>
            <div className="mt-3 text-foreground leading-relaxed text-sm sm:text-base">
                {Array.isArray(faq.a) ? (
                    <ol className="space-y-2 list-decimal list-inside marker:text-primary marker:font-semibold">
                        {faq.a.map((step, i) => (
                            <li key={i} className="pl-1">{step}</li>
                        ))}
                    </ol>
                ) : (
                    <p>{faq.a}</p>
                )}
            </div>
            {faq.tip && (
                <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning flex gap-2">
                    <Lightbulb className="shrink-0 w-4 h-4 mt-0.5" />
                    <p className="leading-relaxed">{faq.tip}</p>
                </div>
            )}
        </div>
    );
}
