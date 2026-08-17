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
  return [
    {
      role: 'system',
      content:
        'Kamu penjaga topik untuk asisten aplikasi manajemen penawaran & event vendor booth (Pospro Event). ' +
        'Topik RELEVAN: penawaran/quotation, invoice, RAB, event/pameran, customer/lead CRM, produk/booth, cashflow, crew, dan cara pakai aplikasi. ' +
        'Jawab HANYA satu kata: YA jika pesan relevan, TIDAK jika tidak relevan.',
    },
    { role: 'user', content: message },
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
