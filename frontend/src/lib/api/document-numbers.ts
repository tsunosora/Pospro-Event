import api from './client';

export interface DocumentNumberCounter {
    id: number;
    docType: string;       // 'Pnwr', 'INV', 'RAB', dll
    kode: string;          // 'Ep', 'Xp', dll (atau 'INV', 'RAB' untuk non-brand)
    year: number;
    lastSeq: number;       // counter terakhir
    createdAt: string;
    updatedAt: string;
}

export const listDocCounters = async (params: { docType?: string; year?: number } = {}): Promise<DocumentNumberCounter[]> => {
    const qs = new URLSearchParams();
    if (params.docType) qs.set('docType', params.docType);
    if (params.year) qs.set('year', String(params.year));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await api.get(`/document-numbers/counters${suffix}`)).data;
};

export const setDocCounter = async (input: { docType: string; kode: string; year: number; lastSeq: number }): Promise<DocumentNumberCounter> =>
    (await api.post('/document-numbers/counters/set', input)).data;
