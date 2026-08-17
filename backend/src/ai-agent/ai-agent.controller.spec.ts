import { AiAgentController } from './ai-agent.controller';
import { AiConfigService } from './ai-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/manager.guard';
import { AiConfig } from './ai-agent.types';

const cfg: AiConfig = {
  enabled: true,
  chatEnabled: true,
  baseUrl: 'https://llm.test/v1',
  apiKey: 'sk-abcdefgh1234',
  model: 'm',
  name: 'Asisten Pospro',
  greeting: 'g',
  avatar: 'bot',
};

function make() {
  const real = new AiConfigService();
  const saveSpy = jest.spyOn(real, 'saveConfig').mockImplementation((c) => c);
  jest.spyOn(real, 'getConfig').mockReturnValue({ ...cfg });
  const svc: any = {
    chat: jest.fn(async () => ({ reply: 'hi', refused: false, entities: [] })),
    testConnection: jest.fn(async () => ({ ok: true, sample: 'OK' })),
  };
  return { ctrl: new AiAgentController(svc, real), svc, cfgSvc: real, saveSpy };
}

describe('AiAgentController', () => {
  it('status() TIDAK membocorkan apiKey', () => {
    const { ctrl } = make();
    const s = ctrl.status();
    expect(s).toEqual({ enabled: true, chatEnabled: true, name: 'Asisten Pospro', greeting: 'g', avatar: 'bot' });
    expect((s as any).apiKey).toBeUndefined();
  });

  it('getConfig() mengembalikan apiKey tersamar', () => {
    const { ctrl } = make();
    const c: any = ctrl.getConfig();
    expect(c.apiKeySet).toBe(true);
    expect(c.apiKeyMasked).toMatch(/^sk-.*1234$/);
    expect(c.apiKey).toBeUndefined();
  });

  it('updateConfig() merge + save + kembalikan tersamar', () => {
    const { ctrl, saveSpy } = make();
    const c: any = ctrl.updateConfig({ model: 'baru', apiKey: '' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].model).toBe('baru');
    expect(saveSpy.mock.calls[0][0].apiKey).toBe('sk-abcdefgh1234'); // key lama dipertahankan
    expect(c.apiKey).toBeUndefined();
  });

  it('chat() meneruskan userId dari req.user', async () => {
    const { ctrl, svc } = make();
    await ctrl.chat({ user: { userId: 99 } }, { message: 'halo', history: [] });
    expect(svc.chat).toHaveBeenCalledWith(99, 'halo', []);
  });
});

describe('AiAgentController — guard terpasang', () => {
  const guardsOf = (t: any) => Reflect.getMetadata('__guards__', t) ?? [];

  it('class-level: JwtAuthGuard', () => {
    expect(guardsOf(AiAgentController)).toContain(JwtAuthGuard);
  });

  it('config & test = owner-only (ManagerGuard)', () => {
    const p = AiAgentController.prototype;
    expect(guardsOf(p.getConfig)).toContain(ManagerGuard);
    expect(guardsOf(p.updateConfig)).toContain(ManagerGuard);
    expect(guardsOf(p.test)).toContain(ManagerGuard);
  });

  it('status & chat = TANPA ManagerGuard (semua user login)', () => {
    const p = AiAgentController.prototype;
    expect(guardsOf(p.status)).not.toContain(ManagerGuard);
    expect(guardsOf(p.chat)).not.toContain(ManagerGuard);
  });
});
