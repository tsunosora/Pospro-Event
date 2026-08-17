import { ServiceUnavailableException } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';

const svc = new AiProviderService();
const cfg = { baseUrl: 'https://llm.test/v1', apiKey: 'k', model: 'm' };

describe('mapNetworkError', () => {
  it.each([
    ['ECONNREFUSED', /tidak dapat terhubung/i],
    ['ETIMEDOUT', /waktu habis|timeout/i],
    ['ENOTFOUND', /tidak ditemukan|host/i],
    ['ECONNRESET', /terputus/i],
  ])('%s → pesan ramah', (code, re) => {
    expect(svc.mapNetworkError({ cause: { code } })).toMatch(re);
  });
  it('error tak dikenal → pesan generik', () => {
    expect(svc.mapNetworkError({ message: 'boom' })).toMatch(/gagal memanggil LLM/i);
  });
});

describe('chatCompletion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('mengembalikan content dari choices[0].message.content', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'halo' } }] }),
    } as any);
    await expect(svc.chatCompletion(cfg, [{ role: 'user', content: 'hi' }])).resolves.toBe('halo');
  });

  it('upstream non-ok → ServiceUnavailableException', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as any);
    await expect(svc.chatCompletion(cfg, [{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fetch throw (jaringan) → ServiceUnavailableException dgn pesan ramah', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue({ cause: { code: 'ECONNREFUSED' } });
    await expect(svc.chatCompletion(cfg, [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      message: expect.stringMatching(/tidak dapat terhubung/i),
    });
  });
});
