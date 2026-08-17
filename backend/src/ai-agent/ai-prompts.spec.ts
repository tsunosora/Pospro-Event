import {
  parseTopicGate,
  trimHistory,
  classifierMessages,
  answerMessages,
  ChatTurn,
} from './ai-prompts';

describe('parseTopicGate', () => {
  it.each(['YA', 'Ya.', 'ya, on-topic'])('%s → true', (s) => expect(parseTopicGate(s)).toBe(true));
  it.each(['TIDAK', 'Tidak', 'nope', 'maaf', 'ya tapi tidak'])('%s → false', (s) =>
    expect(parseTopicGate(s)).toBe(false),
  );
});

describe('trimHistory', () => {
  it('membatasi 8 pesan terakhir & cap panjang konten', () => {
    const hist: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: 'x'.repeat(5000) + i,
    }));
    const out = trimHistory(hist);
    expect(out.length).toBe(8);
    expect(out[0].content.length).toBeLessThanOrEqual(4000);
  });
  it('history pendek dikembalikan apa adanya', () => {
    const hist: ChatTurn[] = [{ role: 'user', content: 'halo' }];
    expect(trimHistory(hist)).toEqual(hist);
  });
});

describe('classifierMessages', () => {
  it('satu pesan user berisi instruksi + pertanyaan (bukan di system)', () => {
    const m = classifierMessages('Harga booth 3x3?');
    expect(m).toHaveLength(1);
    expect(m[0].role).toBe('user');
    expect(m[0].content).toMatch(/satu kata/i);
    expect(m[0].content).toContain('Harga booth 3x3?');
  });
});

describe('answerMessages', () => {
  it('menyisipkan konteks, TOC, persona, dan klausa anti-halusinasi', () => {
    const msgs = answerMessages({
      persona: 'Asisten Pospro',
      message: 'Penawaran PT ABC?',
      history: [{ role: 'user', content: 'halo' }],
      dataContext: 'DATA-CONTEXT-XYZ',
      guideSections: ['### Penawaran\nisi'],
      guideToc: '- Penawaran',
    });
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('Asisten Pospro');
    expect(msgs[0].content).toMatch(/JANGAN mengarang/);
    expect(msgs[0].content).toContain('DATA-CONTEXT-XYZ');
    expect(msgs[0].content).toContain('- Penawaran');
    // history + user terakhir
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'Penawaran PT ABC?' });
  });
});
