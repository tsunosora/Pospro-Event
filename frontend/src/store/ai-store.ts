import { create } from 'zustand';
import type { AiEntity } from '@/lib/api/aiAgent';

export interface ChatMsg {
    role: 'user' | 'assistant';
    content: string;
    entities?: AiEntity[];
    refused?: boolean;
}

interface AiState {
    isOpen: boolean;
    messages: ChatMsg[];
    loading: boolean;
    toggle: () => void;
    open: () => void;
    close: () => void;
    push: (m: ChatMsg) => void;
    setLoading: (v: boolean) => void;
    reset: () => void;
}

export const useAiStore = create<AiState>((set) => ({
    isOpen: false,
    messages: [],
    loading: false,
    toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    push: (m) => set((s) => ({ messages: [...s.messages, m] })),
    setLoading: (v) => set({ loading: v }),
    reset: () => set({ messages: [] }),
}));
