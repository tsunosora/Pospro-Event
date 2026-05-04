import api from './client';
import axios from 'axios';

export type AttendanceStatus = 'FULL_DAY' | 'HALF_DAY' | 'ABSENT';
export type AttendanceApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PayrollAdjustmentType = 'BONUS' | 'ALLOWANCE' | 'DEDUCTION' | 'ADVANCE';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT';

export interface AttendanceRow {
    id: number;
    workerId: number;
    attendanceDate: string;
    status: AttendanceStatus;
    overtimeHours: string;
    notes: string | null;
    recordedByPicId: number | null;
    recordedAt: string;
    updatedAt: string;
    worker?: {
        id: number; name: string; position: string | null;
        dailyWageRate: string | null; overtimeRatePerHour: string | null;
    };
    recordedByPic?: { id: number; name: string } | null;
}

export interface AttendanceInput {
    workerId: number;
    status: AttendanceStatus;
    overtimeHours?: number | string;
    notes?: string | null;
    eventId?: number | null;
    cityKey?: string | null;
    divisionKey?: string | null;
}

export interface WeeklySummary {
    weekStart: string;
    weekEnd: string;
    days: string[];
    rows: Array<{
        workerId: number;
        name: string;
        position: string | null;
        dailyWageRate: number;
        overtimeRatePerHour: number;
        hasPayroll: boolean;
        cells: Array<{
            id: number | null;
            date: string;
            status: AttendanceStatus | null;
            overtimeHours: number;
            total: number;
            source: 'event-pic' | 'event' | 'matrix' | 'worker' | 'none' | null;
            cityKey: string | null;
            divisionKey: string | null;
            eventId: number | null;
            approvalStatus: AttendanceApprovalStatus | null;
        }>;
        totalWage: number;
        approvedWage: number;
        adjustments: { bonus: number; allowance: number; deduction: number; advance: number; net: number };
        grandTotal: number;
    }>;
    grandTotal: number;
    grandApproved: number;
    grandAdjustment: number;
    grandFinal: number;
    pendingCount: number;
}

export interface MonthlySummary {
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    rows: Array<{
        workerId: number;
        name: string;
        position: string | null;
        dailyWageRate: number;
        overtimeRatePerHour: number;
        hasPayroll: boolean;
        fullDays: number;
        halfDays: number;
        absentDays: number;
        overtimeHours: number;
        baseTotal: number;
        overtimeTotal: number;
        totalWage: number;
        pendingCount: number;
        rejectedCount: number;
        approvedBase: number;
        approvedOvertime: number;
        approvedTotal: number;
        adjustments: { bonus: number; allowance: number; deduction: number; advance: number; net: number };
        grandTotal: number;
    }>;
    grandTotal: number;
    grandApproved: number;
    grandAdjustment: number;
    grandFinal: number;
}

// ─── Admin endpoints (JWT-protected) ──────────────────────────────────

export const getAttendance = async (params: { from?: string; to?: string; workerId?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    if (params.workerId) sp.set('workerId', String(params.workerId));
    const qs = sp.toString();
    return (await api.get<AttendanceRow[]>(`/payroll/attendance${qs ? `?${qs}` : ''}`)).data;
};

export const bulkUpsertAttendance = async (date: string, entries: AttendanceInput[]) =>
    (await api.post<{ upserted: number }>('/payroll/attendance/bulk', { date, entries })).data;

export const updateAttendance = async (
    id: number,
    body: { status?: AttendanceStatus; overtimeHours?: number; notes?: string | null },
) => (await api.patch<AttendanceRow>(`/payroll/attendance/${id}`, body)).data;

export const deleteAttendance = async (id: number) =>
    (await api.delete(`/payroll/attendance/${id}`)).data;

export const getWeeklySummary = async (weekStart: string) =>
    (await api.get<WeeklySummary>(`/payroll/summary/weekly?weekStart=${weekStart}`)).data;

export const getMonthlySummary = async (year: number, month: number) =>
    (await api.get<MonthlySummary>(`/payroll/summary/monthly?year=${year}&month=${month}`)).data;

// ─── Approval flow ────────────────────────────────────────────────────

export const approveAttendance = async (id: number) =>
    (await api.post(`/payroll/attendance/${id}/approve`)).data;

export const rejectAttendance = async (id: number, reason?: string) =>
    (await api.post(`/payroll/attendance/${id}/reject`, { reason })).data;

export const bulkApproveAttendance = async (ids: number[]) =>
    (await api.post<{ approved: number }>(`/payroll/attendance/bulk-approve`, { ids })).data;

// ─── Audit log ────────────────────────────────────────────────────────

export interface AuditLogEntry {
    id: number;
    attendanceId: number | null;
    action: AuditAction;
    changedById: number | null;
    changedByPicId: number | null;
    oldData: string | null;
    newData: string | null;
    notes: string | null;
    createdAt: string;
    changedBy: { id: number; name: string | null; email: string } | null;
    changedByPic: { id: number; name: string } | null;
}

export const getAttendanceAuditLog = async (id: number) =>
    (await api.get<AuditLogEntry[]>(`/payroll/attendance/${id}/audit`)).data;

// ─── Adjustments (tunjangan/potongan) ─────────────────────────────────

export interface PayrollAdjustment {
    id: number;
    workerId: number;
    type: PayrollAdjustmentType;
    amount: string;
    effectiveDate: string;
    notes: string | null;
    createdById: number | null;
    createdAt: string;
    updatedAt: string;
    worker?: { id: number; name: string; position: string | null };
    createdBy?: { id: number; name: string | null; email: string } | null;
}

export interface AdjustmentInput {
    workerId: number;
    type: PayrollAdjustmentType;
    amount: number | string;
    effectiveDate: string;
    notes?: string | null;
}

export const listAdjustments = async (params: { from?: string; to?: string; workerId?: number; type?: PayrollAdjustmentType } = {}) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    if (params.workerId) sp.set('workerId', String(params.workerId));
    if (params.type) sp.set('type', params.type);
    const qs = sp.toString();
    return (await api.get<PayrollAdjustment[]>(`/payroll/adjustments${qs ? `?${qs}` : ''}`)).data;
};

export const createAdjustment = async (input: AdjustmentInput) =>
    (await api.post<PayrollAdjustment>(`/payroll/adjustments`, input)).data;

export const updateAdjustment = async (id: number, input: Partial<AdjustmentInput>) =>
    (await api.patch<PayrollAdjustment>(`/payroll/adjustments/${id}`, input)).data;

export const deleteAdjustment = async (id: number) =>
    (await api.delete(`/payroll/adjustments/${id}`)).data;

// ─── XLSX export ──────────────────────────────────────────────────────

/** Download payslip PDF per worker per periode (from-to) */
export const exportPayslipPdf = async (workerId: number, from: string, to: string): Promise<Blob> => {
    const res = await api.get(`/payroll/payslip/${workerId}.pdf?from=${from}&to=${to}`, { responseType: 'blob' });
    return res.data as Blob;
};

/** Download rekap mingguan sebagai .xlsx blob */
export const exportWeeklyXlsx = async (weekStart: string): Promise<Blob> => {
    const res = await api.get(`/payroll/export/weekly.xlsx?weekStart=${weekStart}`, { responseType: 'blob' });
    return res.data as Blob;
};

/** Download rekap bulanan sebagai .xlsx blob */
export const exportMonthlyXlsx = async (year: number, month: number): Promise<Blob> => {
    const res = await api.get(`/payroll/export/monthly.xlsx?year=${year}&month=${month}`, { responseType: 'blob' });
    return res.data as Blob;
};

// ─── Public endpoints (NO JWT — pakai token di path) ──────────────────
// Dipakai oleh /pic/[token] page yang TIDAK butuh login.
// Buat axios instance terpisah supaya gak include Authorization header.

const publicApi = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

/** Helper: build header object dengan PIN kalau ada. */
function pinHeader(pin?: string | null): Record<string, string> {
    return pin ? { 'X-Pic-Pin': pin } : {};
}

export interface PicContext {
    pic: { id: number; name: string; position: string | null };
    team: { id: number; name: string; color: string } | null;
    date: string;
    workers: Array<{
        id: number;
        name: string;
        position: string | null;
        photoUrl: string | null;
        hasPayroll: boolean;
        defaultCityKey: string | null;
        defaultDivisionKey: string | null;
        existing: {
            id: number; workerId: number; status: AttendanceStatus;
            overtimeHours: string; notes: string | null;
            eventId: number | null; cityKey: string | null; divisionKey: string | null;
        } | null;
    }>;
    cities: string[];
    divisions: string[];
    events: Array<{ id: number; code: string; name: string; venue: string | null; hasWageOverride: boolean }>;
}

export interface PicTeamData {
    team: { id: number; name: string; color: string; notes: string | null } | null;
    members: Array<{ id: number; name: string; position: string | null; photoUrl: string | null; phone: string | null }>;
    available: Array<{ id: number; name: string; position: string | null; photoUrl: string | null; phone: string | null }>;
}

export const getPicTeam = async (token: string, pin?: string | null): Promise<PicTeamData> =>
    (await publicApi.get(`/public/attendance/${token}/team`, { headers: pinHeader(pin) })).data;

export const addPicTeamMember = async (token: string, workerId: number, pin?: string | null) =>
    (await publicApi.post(`/public/attendance/${token}/team/add`, { workerId }, { headers: pinHeader(pin) })).data;

export const removePicTeamMember = async (token: string, workerId: number, pin?: string | null) =>
    (await publicApi.delete(`/public/attendance/${token}/team/${workerId}`, { headers: pinHeader(pin) })).data;

/** Cek token + apakah perlu PIN. NO sensitive data returned. */
export const checkPicToken = async (token: string): Promise<{ ok: true; picName: string; needsPin: boolean }> =>
    (await publicApi.get(`/public/attendance/${token}/check`)).data;

export const getPicContext = async (token: string, date?: string, pin?: string | null): Promise<PicContext> => {
    const qs = date ? `?date=${date}` : '';
    return (await publicApi.get(`/public/attendance/${token}${qs}`, { headers: pinHeader(pin) })).data;
};

export const submitPicAttendance = async (
    token: string,
    date: string,
    entries: AttendanceInput[],
    pin?: string | null,
): Promise<{ upserted: number }> =>
    (await publicApi.post(`/public/attendance/${token}/submit`, { date, entries }, { headers: pinHeader(pin) })).data;
