import type { MetadataRoute } from 'next';
import { getPublicSettings } from '@/lib/api/settings';

export const revalidate = 3600;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let storeName = 'PosPro';
  try {
    const settings = await getPublicSettings();
    if (settings?.storeName) storeName = settings.storeName;
  } catch {
    // Backend down, gunakan fallback
  }

  const shortName = storeName.length > 12 ? storeName.slice(0, 12) : storeName;

  return {
    name: storeName,
    short_name: shortName,
    description: 'Progressive Web Application for Point of Sale and Inventory Management',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    // Pakai icon statis yang pasti ada — /api/logo bisa 404 kalau logo toko belum di-set,
    // dan manifest dengan icon 404 bikin PWA install gagal + 404 berulang di log.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
