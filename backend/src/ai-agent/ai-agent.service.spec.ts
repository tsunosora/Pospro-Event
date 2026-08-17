import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { AiConfig } from './ai-agent.types';

const enabledCfg: AiConfig = {
  enabled: true,
  chatEnabled: true,
  baseUrl: 'https://llm.test/v1',
  apiKey: 'k',
  model: 'm',
  name: 'Asisten Pospro',
  greeting: 'g',
  avatar: 'bot',
};

function build(opts: {
  cfg?: AiConfig;
  gate?: string; // jawaban classifier
  answer?: string; // jawaban tahap 2
  entities?: any[];
  roleName?: string | null;
}) {
  const cfgSvc: any = { getConfig: () => opts.cfg ?? enabledCfg };
  const retrieveSpy = jest.fn(async () => ({
    context: 'ctx',
    entities: opts.entities ?? [],
  }));
  const retrieval: any = { retrieve: retrieveSpy };
  const provider: any = {
    chatCompletion: jest.fn(async (_cfg: any, messages: any[]) => {
      const isClassifier = messages.some((m) => /klasifikasi topik/i.test(m.content));
      return isClassifier ? (opts.gate ?? 'YA') : (opts.answer ?? 'jawaban');
    }),
  };
  const prisma: any = {
    user: { findUnique: async () => ({ role: { name: opts.roleName ?? 'kasir' } }) },
  };
  const svc = new AiAgentService(prisma, cfgSvc, provider, retrieval);
  return { svc, provider, retrieveSpy };
}

describe('AiAgentService.chat', () => {
  it('config disabled → ForbiddenException', async () => {
    const { svc } = build({ cfg: { ...enabledCfg, enabled: false } });
    await expect(svc.chat(1, 'halo')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pesan kosong → BadRequestException', async () => {
    const { svc } = build({});
    await expect(svc.chat(1, '   ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('off-topic → refused, retrieval TIDAK dipanggil, hanya 1 call LLM', async () => {
    const { svc, provider, retrieveSpy } = build({ gate: 'TIDAK' });
    const res = await svc.chat(1, 'resep nasi goreng');
    expect(res.refused).toBe(true);
    expect(retrieveSpy).not.toHaveBeenCalled();
    expect(provider.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('on-topic → jawaban + kartu entitas yang disebut', async () => {
    const entities = [
      { kind: 'quotation', id: 42, label: '42/Xp/Pnwr/IV/26', href: '/penawaran/42' },
      { kind: 'event', id: 7, label: 'Pameran Otomotif', href: '/events/7' },
    ];
    const { svc, retrieveSpy } = build({
      gate: 'YA',
      answer: 'Penawaran 42/Xp/Pnwr/IV/26 statusnya SENT.',
      entities,
    });
    const res = await svc.chat(1, 'status penawaran ABC?');
    expect(res.refused).toBe(false);
    expect(retrieveSpy).toHaveBeenCalledTimes(1);
    expect(res.entities.map((e: any) => e.id)).toEqual([42]); // event tak disebut
  });

  it('gating: retrieval dipanggil dgn isManager=true untuk role owner', async () => {
    const { svc, retrieveSpy } = build({ gate: 'YA', roleName: 'owner' });
    await svc.chat(1, 'rab pameran');
    expect(retrieveSpy).toHaveBeenCalledWith('rab pameran', true);
  });

  it('gating: role kasir → isManager=false', async () => {
    const { svc, retrieveSpy } = build({ gate: 'YA', roleName: 'kasir' });
    await svc.chat(1, 'rab pameran');
    expect(retrieveSpy).toHaveBeenCalledWith('rab pameran', false);
  });
});

describe('AiAgentService.translate', () => {
  function buildT(providerReply: string, cfg: AiConfig = enabledCfg) {
    const cfgSvc: any = { getConfig: () => cfg };
    const provider: any = { chatCompletion: jest.fn(async () => providerReply) };
    const svc = new AiAgentService({} as any, cfgSvc, provider, {} as any);
    return { svc, provider };
  }

  it('menerjemahkan & menjaga urutan + string kosong', async () => {
    const { svc } = buildT('["LED Screen 3x3","day"]');
    const res = await svc.translate(['Layar LED 3x3', '', 'hari'], 'en');
    // kosong tetap kosong; 2 non-kosong diterjemahkan sesuai urутan unik
    expect(res.translations).toEqual(['LED Screen 3x3', '', 'day']);
  });

  it('dedupe: string sama hanya sekali dikirim, hasil dipetakan balik', async () => {
    const { svc, provider } = buildT('["day"]');
    const res = await svc.translate(['hari', 'hari'], 'en');
    expect(res.translations).toEqual(['day', 'day']);
    // hanya 1 string unik dikirim ke LLM
    const sentPrompt = provider.chatCompletion.mock.calls[0][1][0].content;
    expect(sentPrompt).toContain('["hari"]');
  });

  it('semua kosong → tak panggil LLM', async () => {
    const { svc, provider } = buildT('[]');
    const res = await svc.translate(['', '   '], 'en');
    expect(res.translations).toEqual(['', '   ']);
    expect(provider.chatCompletion).not.toHaveBeenCalled();
  });

  it('format balasan tak valid → error', async () => {
    const { svc } = buildT('maaf saya tidak bisa');
    await expect(svc.translate(['halo'], 'en')).rejects.toThrow(/format balasan tak valid/i);
  });
});
