import api from './client';

export interface EventCrewAssignment {
    id: number;
    eventId: number;
    workerId: number;
    teamId: number | null;
    role: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    startPhotoUrl: string | null;
    endPhotoUrl: string | null;
    startNote: string | null;
    endNote: string | null;
    accessToken: string;
    createdAt: string;
    updatedAt: string;
    worker: { id: number; name: string; position: string | null; phone: string | null };
    team?: {
        id: number; name: string; color: string;
        leader?: { id: number; name: string; phone: string | null } | null;
    } | null;
}

export interface CrewReportRow {
    id: number;
    eventId: number;
    eventName: string;
    eventCode: string;
    workerId: number;
    workerName: string;
    teamId: number | null;
    teamName: string | null;
    teamColor: string | null;
    role: string | null;
    startedAt: string;
    finishedAt: string;
    durationMinutes: number;
}

export interface CrewReport {
    rows: CrewReportRow[];
    byWorker: Array<{ workerId: number; workerName: string; totalMinutes: number; jobs: number }>;
    byTeam: Array<{ teamId: number; teamName: string; teamColor: string | null; totalMinutes: number; jobs: number; uniqueWorkers: number }>;
}

export const listCrewByEvent = async (eventId: number) =>
    (await api.get<EventCrewAssignment[]>(`/event-crew/by-event/${eventId}`)).data;

export const getCrewReport = async (eventId?: number) => {
    const q = eventId ? `?eventId=${eventId}` : '';
    return (await api.get<CrewReport>(`/event-crew/report${q}`)).data;
};

export const createCrewAssignment = async (
    input: {
        eventId: number;
        workerId: number;
        teamId?: number | null;
        role?: string | null;
        scheduledStart?: string | null;
        scheduledEnd?: string | null;
    },
    opts: { notify?: boolean } = {},
) => {
    const params = new URLSearchParams();
    if (opts.notify === false) params.set('notify', 'false');
    if (typeof window !== 'undefined') params.set('baseUrl', window.location.origin);
    const q = params.toString() ? `?${params.toString()}` : '';
    return (await api.post<EventCrewAssignment & { _notified?: { crew: boolean; leader: boolean } }>(`/event-crew${q}`, input)).data;
};

export const createCrewAssignmentsBulk = async (input: {
    eventId: number;
    workerIds: number[];
    teamId?: number | null;
    role?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
}) => (await api.post<{
    created: number;
    skipped: number;
    createdIds: Array<{ workerId: number; assignmentId: number }>;
    skippedWorkerIds: number[];
}>('/event-crew/bulk', input)).data;

export const updateCrewAssignment = async (id: number, input: {
    teamId?: number | null;
    role?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
}) => (await api.patch<EventCrewAssignment>(`/event-crew/${id}`, input)).data;

export const deleteCrewAssignment = async (id: number) =>
    (await api.delete<{ ok: true }>(`/event-crew/${id}`)).data;

export const deleteCrewAssignmentsBulk = async (ids: number[]) =>
    (await api.delete<{ ok: true; deleted: number }>('/event-crew/bulk', { data: { ids } })).data;

export const reassignCrewTeamBulk = async (ids: number[], teamId: number | null) =>
    (await api.patch<{ ok: true; updated: number }>('/event-crew/bulk/reassign-team', { ids, teamId })).data;

export const regenerateCrewToken = async (id: number) =>
    (await api.post<{ id: number; accessToken: string }>(`/event-crew/${id}/regenerate-token`)).data;

// ── Public (no auth) ──

export interface PublicCrewView {
    id: number;
    eventId: number;
    workerId: number;
    teamId: number | null;
    role: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    startPhotoUrl: string | null;
    endPhotoUrl: string | null;
    startNote: string | null;
    endNote: string | null;
    worker: { id: number; name: string; phone: string | null; position: string | null };
    team?: {
        id: number; name: string; color: string;
        leader?: { id: number; name: string; phone: string | null } | null;
    } | null;
    event: {
        id: number;
        code: string;
        name: string;
        venue: string | null;
        eventStart: string | null;
        eventEnd: string | null;
        setupStart: string | null;
        setupEnd: string | null;
        loadingStart: string | null;
        loadingEnd: string | null;
        customerName: string | null;
    };
}

export const getPublicCrewByToken = async (token: string) =>
    (await api.get<PublicCrewView>(`/public/crew/${token}`)).data;

export const publicCheckIn = async (token: string, photo: File | null, note?: string) => {
    const fd = new FormData();
    if (photo) fd.append('photo', photo);
    if (note) fd.append('note', note);
    return (await api.post<PublicCrewView>(`/public/crew/${token}/check-in`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const publicCheckOut = async (token: string, photo: File | null, note?: string) => {
    const fd = new FormData();
    if (photo) fd.append('photo', photo);
    if (note) fd.append('note', note);
    return (await api.post<PublicCrewView>(`/public/crew/${token}/check-out`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};
