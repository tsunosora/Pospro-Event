import api from './client';

export interface MenuBahan {
  id?: number;
  name: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  note?: string | null;
}

export interface MenuRow {
  id: number;
  name: string;
  description?: string | null;
  servings: number;
  recipe?: string | null;
  imageUrl?: string | null;
  imageUrls?: string | null; // JSON array path (bisa >1)
  estimatedCost: string;
  isActive: boolean;
  bahan?: MenuBahan[];
  createdBy?: { id: number; name?: string };
}

export interface MenuInput {
  name: string;
  description?: string | null;
  servings?: number;
  recipe?: string | null;
  imageUrls?: string[];
  isActive?: boolean;
  bahan?: MenuBahan[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Path foto (relatif) → URL absolut yang bisa dirender. */
export const menuPhotoUrl = (path: string) => (path.startsWith('http') ? path : `${API_BASE}${path}`);

/** Ambil daftar foto dari MenuRow (imageUrls JSON, fallback imageUrl tunggal). */
export function parseMenuPhotos(m: Pick<MenuRow, 'imageUrls' | 'imageUrl'>): string[] {
  if (m.imageUrls) {
    try {
      const arr = JSON.parse(m.imageUrls);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
    } catch {
      /* abaikan JSON rusak */
    }
  }
  return m.imageUrl ? [m.imageUrl] : [];
}

export const getMenus = async (params: { active?: boolean; q?: string } = {}) =>
  (await api.get<MenuRow[]>('/menu', { params })).data;
export const getMenu = async (id: number) => (await api.get<MenuRow>(`/menu/${id}`)).data;
export const createMenu = async (input: MenuInput) => (await api.post<MenuRow>('/menu', input)).data;
export const updateMenu = async (id: number, input: MenuInput) => (await api.patch<MenuRow>(`/menu/${id}`, input)).data;
export const deleteMenu = async (id: number) => (await api.delete(`/menu/${id}`)).data;

/** Upload foto menu (bisa banyak). Return path relatif untuk disertakan di payload create/update. */
export const uploadMenuPhotos = async (files: File[]): Promise<string[]> => {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  const res = await api.post<{ urls: string[] }>('/menu/upload-photos', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.urls;
};
