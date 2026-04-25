import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Pospro Event',
  description: 'Dokumentasi lengkap Pospro Event — Aplikasi Manajemen CRM Lead, Penawaran, RAB, Booth & Event',
  srcDir: 'docs/wiki',
  base: '/Pospro-Event/',

  head: [
    ['link', { rel: 'icon', href: '/Pospro-Event/favicon.ico' }],
  ],

  themeConfig: {
    siteTitle: 'Pospro Event Docs',

    nav: [
      { text: 'Mulai di Sini', link: '/alur-bisnis' },
      { text: 'Wiki Lengkap', link: '/' },
      { text: 'v1.0', items: [{ text: 'Lihat Daftar Isi', link: '/#daftar-isi-wiki' }] },
    ],

    sidebar: [
      {
        text: '📖 Panduan Awal',
        items: [
          { text: 'Beranda', link: '/' },
          { text: 'Wiki Lengkap (Daftar Isi)', link: '/README' },
          { text: '🔄 Alur Bisnis Event', link: '/alur-bisnis' },
        ]
      },
      {
        text: '🎯 CRM & Lead Pipeline',
        items: [
          { text: '📊 CRM Overview', link: '/crm' },
          { text: '🗂️ Pipeline Kanban', link: '/crm-kanban' },
          { text: '📥 Import Lead XLSX', link: '/crm-import' },
          { text: '🔁 Convert Lead → Customer', link: '/crm-convert' },
        ]
      },
      {
        text: '📑 Penawaran & RAB Event',
        items: [
          { text: '📄 Penawaran Booth/Event', link: '/penawaran-event' },
          { text: '🧮 RAB Event', link: '/rab-event' },
          { text: '🏭 Data Supplier', link: '/suppliers' },
        ]
      },
      {
        text: '🏪 Operasional Event',
        items: [
          { text: '🖨️ Antrian Produksi', link: '/produksi' },
          { text: '🖨️ Antrian Cetak Paper', link: '/mesin-cetak' },
          { text: '📋 Stok Opname', link: '/stock-opname' },
        ]
      },
      {
        text: '💰 Laporan & Keuangan',
        items: [
          { text: '💸 Cashflow Bisnis', link: '/cashflow' },
          { text: '📊 Laporan Stok', link: '/laporan-stok' },
          { text: '🧮 Kalkulator HPP', link: '/hpp-calculator' },
          { text: '🗺️ Peta Cuan Lokasi', link: '/peta-cuan' },
        ]
      },
      {
        text: '⚙️ Pengaturan & Teknis',
        items: [
          { text: '💾 Backup & Restore', link: '/backup' },
          { text: '🚀 Panduan Deployment', link: '/deployment' },
        ]
      }
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Cari dokumentasi...',
                buttonAriaLabel: 'Cari'
              },
              modal: {
                noResultsText: 'Tidak ada hasil untuk',
                resetButtonTitle: 'Reset pencarian',
                footer: {
                  selectText: 'pilih',
                  navigateText: 'navigasi',
                  closeText: 'tutup'
                }
              }
            }
          }
        }
      }
    },

    footer: {
      message: 'Pospro Event — Aplikasi Manajemen CRM, Penawaran, RAB, Booth & Event',
      copyright: '© 2026 Muhammad Faishal Abdul Hakim'
    },

    lastUpdated: {
      text: 'Terakhir diperbarui',
      formatOptions: {
        dateStyle: 'long',
      }
    },

    docFooter: {
      prev: 'Halaman Sebelumnya',
      next: 'Halaman Berikutnya'
    },

    outline: {
      label: 'Di halaman ini',
      level: [2, 3]
    },

    returnToTopLabel: 'Kembali ke atas',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Mode Terang',
    darkModeSwitchTitle: 'Mode Gelap',
  },

  markdown: {
    lineNumbers: false,
  },
})
