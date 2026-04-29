import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout/MainLayout";
import Providers from "./providers";
import { SyncManager } from "@/lib/SyncManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "Pospro Event",
  title: {
    default: "Pospro Event — CRM, RAB, Booth & Event",
    template: "%s · Pospro Event",
  },
  description:
    "Aplikasi manajemen vendor booth & event — CRM Lead Pipeline, Penawaran (SPH), RAB Project, Stok Lapangan, Cashflow per Project. By Muhammad Faishal Abdul Hakim.",
  authors: [{ name: "Muhammad Faishal Abdul Hakim", url: "mailto:muhamadfaisal288@gmail.com" }],
  creator: "Muhammad Faishal Abdul Hakim",
  publisher: "Muhammad Faishal Abdul Hakim",
  keywords: ["booth", "event", "CRM", "RAB", "penawaran", "vendor", "Indonesia"],
  // Manifest di-link manual via <head> di bawah supaya gak konflik dengan public/manifest.webmanifest
  // (Next.js 15+ auto-generates manifest route kalau pakai metadata.manifest)
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pospro Event",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        {/* Manifest link — public/manifest.webmanifest (Next.js metadata.manifest dihindari karena konflik dengan public file) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Service worker registration — production only (dev mode pakai HMR, SW bikin stale cache) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isProd = ${process.env.NODE_ENV === "production" ? "true" : "false"};
                if ('serviceWorker' in navigator) {
                  if (isProd) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js').then(function(reg) {
                        // Cek update tiap 1 jam (utk user yang buka aplikasi lama)
                        setInterval(function() { reg.update().catch(function(){}); }, 60 * 60 * 1000);
                        // Notify saat ada SW baru ready → reload otomatis
                        reg.addEventListener('updatefound', function() {
                          var nw = reg.installing;
                          if (!nw) return;
                          nw.addEventListener('statechange', function() {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                              // Versi baru tersedia, reload supaya pakai chunk baru
                              if (confirm('Versi baru Pospro Event tersedia. Reload sekarang?')) {
                                window.location.reload();
                              }
                            }
                          });
                        });
                      }).catch(function(){});
                    });
                  } else {
                    // Dev mode: unregister SW yang mungkin masih ke-install dari prod build sebelumnya
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      regs.forEach(function(r) { r.unregister(); });
                    }).catch(function(){});
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <MainLayout>{children}</MainLayout>
          <SyncManager />
        </Providers>
      </body>
    </html>
  );
}
