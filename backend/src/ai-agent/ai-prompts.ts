import { LlmMessage } from './ai-provider.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function parseTopicGate(raw: string): boolean {
  const s = raw.trim();
  return /\bya\b/i.test(s) && !/\btidak\b/i.test(s);
}

export function trimHistory(history: ChatTurn[], maxMsg = 8, cap = 4000): ChatTurn[] {
  return history
    .slice(-maxMsg)
    .map((m) => ({ role: m.role, content: (m.content ?? '').slice(0, cap) }));
}

export function classifierMessages(message: string): LlmMessage[] {
  // Instruksi ditaruh di pesan USER (bukan system): beberapa gateway OpenAI-compatible
  // (mis. proxy claude-cli) hanya "menempelkan" system prompt sehingga instruksi
  // di system terdilusi. Prompt lenient — default YA agar tak salah menolak pertanyaan sah.
  return [
    {
      role: 'user',
      content:
        'Tugas: klasifikasi topik. Keluarkan SATU KATA saja tanpa penjelasan.\n' +
        'Balas YA bila pertanyaan berkaitan dengan bisnis vendor booth/event: penawaran, quotation, invoice, RAB, event, customer, lead, produk, cashflow, crew, atau cara pakai aplikasi.\n' +
        'Balas TIDAK hanya bila jelas di luar itu (mis. resep masakan, cuaca, politik, matematika umum).\n' +
        'Kalau ragu, balas YA.\n\n' +
        `Pertanyaan: "${message}"\nJawaban (YA/TIDAK):`,
    },
  ];
}

export function answerMessages(params: {
  persona: string;
  message: string;
  history: ChatTurn[];
  dataContext: string;
  guideSections: string[];
  guideToc: string;
}): LlmMessage[] {
  const system =
    `Kamu ${params.persona}, asisten internal aplikasi Pospro Event (manajemen penawaran, RAB, dan event vendor booth). ` +
    'Kamu boleh berdiskusi, menjelaskan cara pakai aplikasi, dan merekomendasikan langkah. ' +
    'ATURAN PENTING: Semua angka/harga/nominal HANYA boleh dari DATA yang diberikan di bawah. ' +
    'JANGAN mengarang angka, nomor penawaran, kode, atau nama yang tidak ada di data. ' +
    'Jika data tidak cukup, katakan terus terang dan sarankan cara mencarinya di aplikasi. ' +
    'Gaya: ringkas, bahasa Indonesia, format Rupiah (mis. Rp1.000.000), tanpa tabel besar, gunakan poin bila perlu.\n\n' +
    `### Daftar topik panduan (TOC)\n${params.guideToc}\n\n` +
    (params.guideSections.length
      ? `### Panduan relevan\n${params.guideSections.join('\n\n')}\n\n`
      : '') +
    `### Data internal terkait\n${params.dataContext}`;

  return [
    { role: 'system', content: system },
    ...trimHistory(params.history),
    { role: 'user', content: params.message },
  ];
}

const CANNED_REFUSAL =
  'Maaf, saya hanya membantu seputar Pospro Event: penawaran, RAB, event, customer, produk/booth, cashflow, dan cara pakai aplikasi.';

export function cannedRefusal(): string {
  return CANNED_REFUSAL;
}
