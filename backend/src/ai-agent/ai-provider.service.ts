import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiProviderService {
  mapNetworkError(err: any): string {
    const code = err?.cause?.code || err?.code;
    switch (code) {
      case 'ECONNREFUSED':
        return 'AI: tidak dapat terhubung ke server LLM (ECONNREFUSED). Cek baseUrl.';
      case 'ETIMEDOUT':
        return 'AI: waktu habis menunggu respons LLM (timeout).';
      case 'ENOTFOUND':
        return 'AI: alamat server LLM tidak ditemukan (host salah).';
      case 'ECONNRESET':
        return 'AI: koneksi ke LLM terputus (ECONNRESET).';
      default:
        return `AI: gagal memanggil LLM${err?.message ? ` — ${err.message}` : ''}.`;
    }
  }

  async chatCompletion(
    cfg: { baseUrl: string; apiKey: string; model: string },
    messages: LlmMessage[],
    opts: { temperature?: number } = {},
  ): Promise<string> {
    const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: opts.temperature ?? 0.6,
          stream: false,
        }),
      });
    } catch (err) {
      throw new ServiceUnavailableException(this.mapNetworkError(err));
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `AI: upstream ${res.status} — ${body.slice(0, 300)}`,
      );
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
