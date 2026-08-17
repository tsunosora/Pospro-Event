export interface AiConfig {
  enabled: boolean;
  chatEnabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  name: string; // persona
  greeting: string;
  avatar: string; // emoji atau URL (widget only; icon UI tetap lucide)
}

export const AI_DEFAULT_CONFIG: AiConfig = {
  enabled: process.env.AI_ENABLED === 'true',
  chatEnabled: process.env.AI_CHAT_ENABLED !== 'false',
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet',
  name: process.env.AI_NAME || 'Asisten Pospro',
  greeting:
    process.env.AI_GREETING ||
    'Halo! Saya asisten Pospro Event. Tanya soal penawaran, event, RAB, atau customer.',
  avatar: process.env.AI_AVATAR || 'bot',
};

// Status publik (tanpa apiKey) — untuk semua user login
export interface AiPublicStatus {
  enabled: boolean;
  chatEnabled: boolean;
  name: string;
  greeting: string;
  avatar: string;
}

// Config untuk owner (apiKey disamarkan)
export interface AiMaskedConfig extends Omit<AiConfig, 'apiKey'> {
  apiKeySet: boolean;
  apiKeyMasked: string; // "sk-...abcd" atau ""
}
