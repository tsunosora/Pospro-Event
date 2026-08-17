import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AiConfig, AI_DEFAULT_CONFIG, AiMaskedConfig } from './ai-agent.types';

@Injectable()
export class AiConfigService {
  private readonly filePath =
    process.env.AI_CONFIG_PATH ||
    path.join(process.cwd(), 'storage', 'ai-config.json');

  getConfig(): AiConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return { ...AI_DEFAULT_CONFIG, ...raw };
      }
    } catch {
      /* file korup → fallback default */
    }
    return { ...AI_DEFAULT_CONFIG };
  }

  saveConfig(cfg: AiConfig): AiConfig {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  applyUpdate(
    current: AiConfig,
    patch: Partial<AiConfig> & { clearApiKey?: boolean },
  ): AiConfig {
    const { clearApiKey, apiKey, ...rest } = patch;
    const next: AiConfig = { ...current, ...rest };
    if (clearApiKey) next.apiKey = '';
    else if (typeof apiKey === 'string' && apiKey.trim() !== '')
      next.apiKey = apiKey.trim();
    // apiKey kosong/undefined → pertahankan key lama
    return next;
  }

  maskConfig(cfg: AiConfig): AiMaskedConfig {
    const { apiKey, ...rest } = cfg;
    const set = !!apiKey;
    const masked =
      set && apiKey.length > 8
        ? `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`
        : set
          ? '****'
          : '';
    return { ...rest, apiKeySet: set, apiKeyMasked: masked };
  }
}
