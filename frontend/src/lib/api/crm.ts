import api from './client';
import type { Brand } from './brands';

export type LeadLevel = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
export type LeadSource =
    | 'META_ADS' | 'INSTAGRAM_ADS' | 'FACEBOOK_ADS' | 'TIKTOK' | 'LINKEDIN'
    | 'WHATSAPP' | 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'EXHIBITION' | 'OTHER';

/** Visual metadata untuk LeadSource — emoji + label Indonesia. */
export const LEAD_SOURCE_META: Record<LeadSource, { emoji: string; label: string }> = {
    META_ADS:      { emoji: "📱", label: "Meta Ads" },
    INSTAGRAM_ADS: { emoji: "📸", label: "Instagram Ads" },
    FACEBOOK_ADS:  { emoji: "👤", label: "Facebook Ads" },
    TIKTOK:        { emoji: "🎵", label: "TikTok" },
    LINKEDIN:      { emoji: "💼", label: "LinkedIn" },
    WHATSAPP:      { emoji: "💬", label: "WhatsApp" },
    WEBSITE:       { emoji: "🌐", label: "Website" },
    REFERRAL:      { emoji: "👥", label: "Referral" },
    WALK_IN:       { emoji: "🚶", label: "Walk-in" },
    EXHIBITION:    { emoji: "🎪", label: "Pameran" },
    OTHER:         { emoji: "📌", label: "Lainnya" },
};

export const LEAD_SOURCE_ORDER: LeadSource[] = [
    "META_ADS", "INSTAGRAM_ADS", "FACEBOOK_ADS", "TIKTOK", "LINKEDIN",
    "WHATSAPP", "WEBSITE", "REFERRAL", "WALK_IN", "EXHIBITION", "OTHER",
];
export type LeadStatus =
    | 'NEW' | 'CONTACTED' | 'RESPONDED' | 'NO_RESPONSE'
    | 'WAITING' | 'WAITING_DECISION' | 'PROPOSAL_SENT' | 'NEGOTIATION'
    | 'IN_PROGRESS' | 'ON_HOLD'
    | 'CLOSED_DEAL' | 'CLOSED_LOST';

/** Metadata visual untuk LeadStatus — emoji, label Indonesia, dan warna badge. */
export const LEAD_STATUS_META: Record<LeadStatus, { emoji: string; label: string; bg: string; text: string; border: string }> = {
    NEW:               { emoji: "✨", label: "Baru",                bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200" },
    CONTACTED:         { emoji: "📤", label: "Dihubungi",           bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
    RESPONDED:         { emoji: "💬", label: "Merespon",            bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200" },
    NO_RESPONSE:       { emoji: "🔇", label: "Tidak Merespon",      bg: "bg-gray-100",   text: "text-gray-600",    border: "border-gray-300" },
    WAITING:           { emoji: "⏳", label: "Menunggu",            bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
    WAITING_DECISION:  { emoji: "🤔", label: "Menunggu Keputusan",  bg: "bg-yellow-50",  text: "text-yellow-700",  border: "border-yellow-300" },
    PROPOSAL_SENT:     { emoji: "📄", label: "Penawaran Terkirim",  bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
    NEGOTIATION:       { emoji: "🤝", label: "Negosiasi",           bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
    IN_PROGRESS:       { emoji: "⚙️", label: "Sedang Dikerjakan",   bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
    ON_HOLD:           { emoji: "⏸️", label: "Di-Pause",            bg: "bg-stone-100",  text: "text-stone-700",   border: "border-stone-300" },
    CLOSED_DEAL:       { emoji: "🏆", label: "Deal",                bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
    CLOSED_LOST:       { emoji: "❌", label: "Lost",                bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200" },
};

/** Order display untuk select / dropdown — sesuai progression alami pipeline. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
    "NEW", "CONTACTED", "RESPONDED", "NO_RESPONSE",
    "PROPOSAL_SENT", "WAITING_DECISION", "NEGOTIATION", "WAITING",
    "IN_PROGRESS", "ON_HOLD",
    "CLOSED_DEAL", "CLOSED_LOST",
];

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
    city: string | null;
    brand: Brand | null;
    level: LeadLevel | null;
    source: LeadSource;
    sourceDetail: string | null;
    greetingTemplate: string | null;
    status: LeadStatus;
    stageId: number;
    stageOrderIndex: number;
    assignedWorkerId: number | null;
    previousAssignedWorkerId: number | null;
    followUpDate: string | null;
    orderDescription: string | null;
    projectValueEst: string | null;
    eventDateStart: string | null;
    eventDateEnd: string | null;
    eventLocation: string | null;
    notes: string | null;
    imageUrl: string | null;
    leadCameAt: string;
    lastContactedAt: string | null;
    convertedCustomerId: number | null;
    convertedAt: string | null;
    createdAt: string;
    updatedAt: string;
    stage?: LeadStage;
    assignedWorker?: { id: number; name: string; position: string | null; photoUrl: string | null } | null;
    previousAssignedWorker?: { id: number; name: string; position: string | null; photoUrl: string | null } | null;
    convertedCustomer?: { id: number; name: string } | null;
    labels?: { label: LeadLabel }[];
    activities?: LeadActivity[];
}

export interface MarketerPerformance {
    workerId: number;
    name: string;
    position: string | null;
    photoUrl: string | null;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    totalValueClosed: number;
    avgResponseHours: number | null;
    stuckLeads: number;
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
    brand?: Brand;
    city?: string;
    productCategory?: string;
    search?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{ items: Lead[]; total: number }> =>
    (await api.get('/crm/leads', { params })).data;

export const getDistinctValues = async (
    field: 'city' | 'productCategory',
): Promise<string[]> => (await api.get(`/crm/distinct/${field}`)).data;

export const getMarketerPerformance = async (params: { from?: string; to?: string; brand?: Brand } = {}): Promise<MarketerPerformance[]> =>
    (await api.get('/crm/performance/by-marketer', { params })).data;

export interface DashboardSummary {
    period: { from: string | null; to: string | null; days: number };
    total: number;
    avgPerDay: number;
    byLevel: { level: string; count: number }[];
    bySource: { source: LeadSource; count: number }[];
    byStatus: { status: LeadStatus; count: number }[];
    byStage: {
        stageId: number;
        name: string;
        color: string;
        isWinStage: boolean;
        isTerminal: boolean;
        count: number;
    }[];
    projectValue: {
        won: number;
        lost: number;
        pipeline: number;
        wonCount: number;
        lostCount: number;
        pipelineCount: number;
        winRate: number;
    };
    dailySeries: {
        date: string;
        count: number;
        won: number;
        lost: number;
        valueWon: number;
        valueLost: number;
    }[];
}

export const getDashboardSummary = async (
    params: { from?: string; to?: string; brand?: Brand } = {},
): Promise<DashboardSummary> =>
    (await api.get('/crm/dashboard/summary', { params })).data;

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

/** Upload foto referensi lead. Max 5 MB. Returns lead ringkas dengan imageUrl baru. */
export const uploadLeadImage = async (leadId: number, file: File): Promise<{ id: number; name: string | null; imageUrl: string | null }> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post(`/crm/leads/${leadId}/upload-image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

/** Hapus foto lead. */
export const removeLeadImage = async (leadId: number): Promise<{ id: number; name: string | null; imageUrl: string | null }> =>
    (await api.delete(`/crm/leads/${leadId}/image`)).data;

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
