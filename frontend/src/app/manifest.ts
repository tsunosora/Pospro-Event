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
    icons: [
      { src: '/api/logo', sizes: '192x192', type: 'image/png' },
      { src: '/api/logo', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
