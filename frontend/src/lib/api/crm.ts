import api from './client';

export type LeadLevel = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
export type LeadSource = 'META_ADS' | 'WHATSAPP' | 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'OTHER';
export type LeadStatus =
    | 'NEW' | 'CONTACTED' | 'RESPONDED' | 'NO_RESPONSE'
    | 'WAITING' | 'IN_PROGRESS' | 'CLOSED_DEAL' | 'CLOSED_LOST';

export interface LeadStage {
    id: number;
    name: string;
    color: string;
    orderIndex: number;
    isTerminal: boolean;
    isWinStage: boolean;
}

export interface LeadLabel {
    id: number;
    name: string;
    color: string;
}

export interface LeadActivity {
    id: number;
    leadId: number;
    kind: string;
    text: string | null;
    meta: any;
    workerId: number | null;
    createdAt: string;
    worker?: { id: number; name: string } | null;
}

export interface Lead {
    id: number;
    name: string | null;
    phone: string;
    phoneNormalized: string;
    organization: string | null;
    productCategory: string | null;
    level: LeadLevel | null;
    source: LeadSource;
    sourceDetail: string | null;
    greetingTemplate: string | null;
    status: LeadStatus;
    stageId: number;
    stageOrderIndex: number;
    assignedWorkerId: number | null;
    followUpDate: string | null;
    orderDescription: string | null;
    projectValueEst: string | null;
    eventDate: string | null;
    eventLocation: string | null;
    notes: string | null;
    leadCameAt: string;
    lastContactedAt: string | null;
    convertedCustomerId: number | null;
    convertedAt: string | null;
    createdAt: string;
    updatedAt: string;
    stage?: LeadStage;
    assignedWorker?: { id: number; name: string; position: string | null; photoUrl: string | null } | null;
    convertedCustomer?: { id: number; name: string } | null;
    labels?: { label: LeadLabel }[];
    activities?: LeadActivity[];
}

export interface BoardData {
    stages: LeadStage[];
    leadsByStage: Record<number, Lead[]>;
}

export interface LeadStats {
    today: number;
    week: number;
    month: number;
    total: number;
    converted: number;
    conversionRate: number;
    bySource: { source: LeadSource; _count: { _all: number } }[];
}

export const getBoard = async (): Promise<BoardData> =>
    (await api.get('/crm/board')).data;

export const getStats = async (): Promise<LeadStats> =>
    (await api.get('/crm/stats')).data;

export const listLeads = async (params: {
    stageId?: number;
    level?: LeadLevel;
    assignedWorkerId?: number;
    search?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{ items: Lead[]; total: number }> =>
    (await api.get('/crm/leads', { params })).data;

export const getLead = async (id: number): Promise<Lead> =>
    (await api.get(`/crm/leads/${id}`)).data;

export const createLead = async (data: Partial<Lead> & { phone: string; labelIds?: number[] }): Promise<Lead> =>
    (await api.post('/crm/leads', data)).data;

export const updateLead = async (id: number, data: Partial<Lead> & { labelIds?: number[] }): Promise<Lead> =>
    (await api.patch(`/crm/leads/${id}`, data)).data;

export const deleteLead = async (id: number): Promise<{ ok: true }> =>
    (await api.delete(`/crm/leads/${id}`)).data;

export const reorderLead = async (input: { leadId: number; newStageId: number; newOrderIndex: number }): Promise<Lead> =>
    (await api.post('/crm/leads/reorder', input)).data;

export const addActivity = async (leadId: number, input: { kind: string; text?: string; workerId?: number | null; meta?: any }): Promise<LeadActivity> =>
    (await api.post(`/crm/leads/${leadId}/activities`, input)).data;

export const listActivities = async (leadId: number): Promise<LeadActivity[]> =>
    (await api.get(`/crm/leads/${leadId}/activities`)).data;

export const convertLead = async (leadId: number, input: { createQuotation?: boolean; quotationVariant?: string; createRab?: boolean }): Promise<{ customerId: number; customer: any }> =>
    (await api.post(`/crm/leads/${leadId}/convert`, input)).data;

export const importLeadsXlsx = async (file: File, dryRun = false): Promise<any> => {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.post(`/crm/import/xlsx${dryRun ? '?dryRun=1' : ''}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Stages
export const listStages = async (): Promise<LeadStage[]> =>
    (await api.get('/crm/stages')).data;

export const createStage = async (data: { name: string; color?: string; isTerminal?: boolean; isWinStage?: boolean }): Promise<LeadStage> =>
    (await api.post('/crm/stages', data)).data;

export const updateStage = async (id: number, data: Partial<{ name: string; color: string; isTerminal: boolean; isWinStage: boolean }>): Promise<LeadStage> =>
    (await api.patch(`/crm/stages/${id}`, data)).data;

export const deleteStage = async (id: number): Promise<{ ok: true }> =>
    (await api.delete(`/crm/stages/${id}`)).data;

export const reorderStages = async (orderedIds: number[]): Promise<LeadStage[]> =>
    (await api.post('/crm/stages/reorder', { orderedIds })).data;

// Labels
export const listLabels = async (): Promise<LeadLabel[]> =>
    (await api.get('/crm/labels')).data;

export const createLabel = async (data: { name: string; color?: string }): Promise<LeadLabel> =>
    (await api.post('/crm/labels', data)).data;

export const updateLabel = async (id: number, data: Partial<{ name: string; color: string }>): Promise<LeadLabel> =>
    (await api.patch(`/crm/labels/${id}`, data)).data;

export const deleteLabel = async (id: number): Promise<{ ok: true }> =>
    (await api.delete(`/crm/labels/${id}`)).data;

// WA helper
export function waLink(phone: string, text?: string): string {
    const n = (phone || '').replace(/\D/g, '').replace(/^0/, '62').replace(/^620/, '62');
    const url = `https://wa.me/${n}`;
    return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}
