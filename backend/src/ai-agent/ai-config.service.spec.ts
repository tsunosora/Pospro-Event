import { AiConfigService } from './ai-config.service';
import { AiConfig } from './ai-agent.types';

const base: AiConfig = {
  enabled: false,
  chatEnabled: true,
  baseUrl: 'x',
  apiKey: 'old',
  model: 'm',
  name: 'n',
  greeting: 'g',
  avatar: 'a',
};

describe('AiConfigService.maskConfig', () => {
  const svc = new AiConfigService();
  it('menyamarkan apiKey panjang', () => {
    const m = svc.maskConfig({ ...base, apiKey: 'sk-1234567890abcd' });
    expect(m.apiKeySet).toBe(true);
    expect(m.apiKeyMasked).toMatch(/^sk-.*abcd$/);
    expect((m as any).apiKey).toBeUndefined();
  });
  it('apiKey kosong → apiKeySet false', () => {
    const m = svc.maskConfig({ ...base, apiKey: '' });
    expect(m.apiKeySet).toBe(false);
    expect(m.apiKeyMasked).toBe('');
  });
});

describe('AiConfigService.applyUpdate', () => {
  const svc = new AiConfigService();
  it('tidak menghapus apiKey bila field kosong', () => {
    const out = svc.applyUpdate(base, { enabled: true, apiKey: '' });
    expect(out.enabled).toBe(true);
    expect(out.apiKey).toBe('old');
  });
  it('mengganti apiKey bila string non-kosong', () => {
    const out = svc.applyUpdate(base, { apiKey: 'new' });
    expect(out.apiKey).toBe('new');
  });
  it('clearApiKey menghapus key', () => {
    const out = svc.applyUpdate(base, { clearApiKey: true });
    expect(out.apiKey).toBe('');
  });
});
