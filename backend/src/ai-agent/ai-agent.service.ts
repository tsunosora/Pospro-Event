import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { translateMessages, parseTranslations } from './ai-translate';
import { PrismaService } from '../prisma/prisma.service';
import { AiConfigService } from './ai-config.service';
import { AiProviderService } from './ai-provider.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { isManagerRoleName } from './ai-authz';
import { retrieveGuideSections, guideTableOfContents } from './app-guide';
import {
  classifierMessages,
  answerMessages,
  parseTopicGate,
  cannedRefusal,
  ChatTurn,
} from './ai-prompts';
import { pickMentionedEntities } from './ai-entities';

@Injectable()
export class AiAgentService {
  constructor(
    private prisma: PrismaService,
    private cfgSvc: AiConfigService,
    private provider: AiProviderService,
    private retrieval: AiRetrievalService,
  ) {}

  private async isManager(userId: number): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    return isManagerRoleName(u?.role?.name);
  }

  async chat(userId: number, message: string, history: ChatTurn[] = []) {
    const cfg = this.cfgSvc.getConfig();
    if (!cfg.enabled || !cfg.chatEnabled)
      throw new ForbiddenException('AI chat dinonaktifkan.');
    if (!message?.trim()) throw new BadRequestException('Pesan kosong.');

    const localProxy =
      cfg.baseUrl.includes('127.0.0.1') || cfg.baseUrl.includes('localhost');
    if (!cfg.apiKey && !localProxy)
      throw new ForbiddenException('AI belum dikonfigurasi (apiKey kosong).');

    // Tahap 1 — topic gate (murah)
    const gate = await this.provider.chatCompletion(
      cfg,
      classifierMessages(message),
      { temperature: 0 },
    );
    if (!parseTopicGate(gate)) {
      return { reply: cannedRefusal(), refused: true, entities: [] };
    }

    // Tahap 2 — retrieval + jawab
    const manager = await this.isManager(userId);
    const { context, entities } = await this.retrieval.retrieve(message, manager);
    const guide = retrieveGuideSections(message, 3);
    const reply = await this.provider.chatCompletion(
      cfg,
      answerMessages({
        persona: cfg.name,
        message,
        history,
        dataContext: context,
        guideSections: guide,
        guideToc: guideTableOfContents(),
      }),
      { temperature: 0.6 },
    );

    return {
      reply,
      refused: false,
      entities: pickMentionedEntities(reply, entities),
    };
  }

  /**
   * Terjemahkan sekumpulan teks ID→target (default 'en').
   * String kosong dilewati; duplikat di-dedupe agar hemat token & konsisten.
   * Urutan & panjang output dijamin sama dengan input.
   */
  async translate(texts: string[], to = 'en') {
    const cfg = this.cfgSvc.getConfig();
    if (!cfg.enabled) throw new ForbiddenException('AI dinonaktifkan.');
    const localProxy =
      cfg.baseUrl.includes('127.0.0.1') || cfg.baseUrl.includes('localhost');
    if (!cfg.apiKey && !localProxy)
      throw new ForbiddenException('AI belum dikonfigurasi (apiKey kosong).');
    if (!Array.isArray(texts)) throw new BadRequestException('texts harus array.');

    const clean = texts.map((t) => (t ?? '').toString());
    const uniq = [...new Set(clean.filter((t) => t.trim() !== ''))];
    if (uniq.length === 0) return { translations: clean };

    const raw = await this.provider.chatCompletion(
      cfg,
      translateMessages(uniq, to),
      { temperature: 0.2 },
    );
    const out = parseTranslations(raw, uniq.length);
    if (!out)
      throw new ServiceUnavailableException(
        'AI: gagal memproses terjemahan (format balasan tak valid).',
      );

    const map = new Map<string, string>();
    uniq.forEach((u, i) => map.set(u, out[i]));
    return {
      translations: clean.map((t) => (t.trim() === '' ? t : map.get(t) ?? t)),
    };
  }

  async testConnection() {
    const cfg = this.cfgSvc.getConfig();
    const out = await this.provider.chatCompletion(
      cfg,
      [{ role: 'user', content: 'Balas satu kata: OK' }],
      { temperature: 0 },
    );
    return { ok: true, sample: out.slice(0, 120) };
  }
}
