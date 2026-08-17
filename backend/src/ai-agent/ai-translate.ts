import { LlmMessage } from './ai-provider.service';

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  id: 'Indonesian',
  ar: 'Arabic',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
};

// Instruksi ditaruh di pesan USER (bukan system) — gateway claude-cli hanya
// menempelkan system prompt sehingga instruksi di system terdilusi. Lihat ai-prompts.ts.
export function translateMessages(texts: string[], to: string): LlmMessage[] {
  const target = LANG_NAMES[to] ?? to;
  return [
    {
      role: 'user',
      content:
        `Terjemahkan setiap string dalam array JSON berikut ke ${target}. ` +
        'Konteks: dokumen penawaran bisnis (vendor booth & event). Gunakan register formal/profesional. ' +
        'Pertahankan angka, ukuran (mis. "3x3", "m²"), kode, serta nama merek/orang/tempat apa adanya. ' +
        'JANGAN menambah, mengurangi, atau menukar urutan elemen. ' +
        'Balas HANYA array JSON string dengan panjang & urutan PERSIS sama seperti input — tanpa penjelasan, tanpa code fence.\n\n' +
        `Input:\n${JSON.stringify(texts)}\n\nOutput:`,
    },
  ];
}

// Parse defensif: ambil blok array JSON pertama..terakhir, validasi tipe & panjang.
export function parseTranslations(raw: string, expectedLen: number): string[] | null {
  if (!raw) return null;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr) || arr.length !== expectedLen) return null;
    return arr.map((x) => (typeof x === 'string' ? x : String(x ?? '')));
  } catch {
    return null;
  }
}
