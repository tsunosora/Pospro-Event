import api from './client';

export type TemplateKey = 'sewa' | 'pengadaan-booth';

export interface QuotationVariantConfig {
    id: number;
    code: string;
    label: string;
    subject: string | null;
    templateKey: TemplateKey;
    defaultDpPercent: string;       // Decimal serialized
    color: string | null;
    description: string | null;
    orderIndex: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertVariantInput {
    code: string;
    label: string;
    subject?: string | null;
    templateKey?: TemplateKey;
    defaultDpPercent?: number | string;
    color?: string | null;
    description?: string | null;
    orderIndex?: number;
    isActive?: boolean;
}

export const listQuotationVariants = async (
    includeInactive = false,
): Promise<QuotationVariantConfig[]> =>
    (await api.get(`/quotation-variants${includeInactive ? '?includeInactive=1' : ''}`)).data;

export const getQuotationVariant = async (code: string): Promise<QuotationVariantConfig> =>
    (await api.get(`/quotation-variants/${code}`)).data;

export const createQuotationVariant = async (input: UpsertVariantInput): Promise<QuotationVariantConfig> =>
    (await api.post('/quotation-variants', input)).data;

export const updateQuotationVariant = async (id: number, input: Partial<UpsertVariantInput>): Promise<QuotationVariantConfig> =>
    (await api.patch(`/quotation-variants/${id}`, input)).data;

export const deleteQuotationVariant = async (id: number): Promise<{ ok: boolean; mode?: string } | QuotationVariantConfig> =>
    (await api.delete(`/quotation-variants/${id}`)).data;
