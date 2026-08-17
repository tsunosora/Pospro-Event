import api from './client';

export interface AiStatus {
    enabled: boolean;
    chatEnabled: boolean;
    name: string;
    greeting: string;
    avatar: string;
}

export interface AiEntity {
    kind: 'quotation' | 'event' | 'rab' | 'customer';
    id: number;
    label: string;
    sublabel?: string;
    href: string;
}

export interface ChatResponse {
    reply: string;
    refused: boolean;
    entities: AiEntity[];
}

export interface AiMaskedConfig {
    enabled: boolean;
    chatEnabled: boolean;
    baseUrl: string;
    model: string;
    name: string;
    greeting: string;
    avatar: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}

export interface UpdateAiConfigPayload {
    enabled?: boolean;
    chatEnabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    name?: string;
    greeting?: string;
    avatar?: string;
    clearApiKey?: boolean;
}

export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

export const getAiStatus = async (): Promise<AiStatus> =>
    (await api.get('/ai-agent/status')).data;

export const sendAiChat = async (
    message: string,
    history: ChatTurn[] = [],
): Promise<ChatResponse> =>
    (await api.post('/ai-agent/chat', { message, history })).data;

export const getAiConfig = async (): Promise<AiMaskedConfig> =>
    (await api.get('/ai-agent/config')).data;

export const updateAiConfig = async (
    data: UpdateAiConfigPayload,
): Promise<AiMaskedConfig> => (await api.put('/ai-agent/config', data)).data;

export const testAiConfig = async (): Promise<{ ok: boolean; sample: string }> =>
    (await api.post('/ai-agent/test', {})).data;

// Terjemah batch teks ID→target (default 'en'). Urutan & panjang output = input.
export const translateTexts = async (
    texts: string[],
    to = 'en',
): Promise<{ translations: string[] }> =>
    (await api.post('/ai-agent/translate', { texts, to })).data;
