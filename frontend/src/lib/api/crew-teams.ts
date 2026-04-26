import api from './client';

export interface CrewTeam {
    id: number;
    name: string;
    leaderWorkerId: number | null;
    color: string;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    leader?: { id: number; name: string; position: string | null; phone: string | null } | null;
    _count?: { assignments: number };
}

export interface CrewTeamInput {
    name: string;
    leaderWorkerId?: number | null;
    color?: string;
    notes?: string | null;
    isActive?: boolean;
}

export const listCrewTeams = async (includeInactive = false) => {
    const q = includeInactive ? '?includeInactive=true' : '';
    return (await api.get<CrewTeam[]>(`/crew-teams${q}`)).data;
};

export const getCrewTeam = async (id: number) =>
    (await api.get<CrewTeam>(`/crew-teams/${id}`)).data;

export const createCrewTeam = async (input: CrewTeamInput) =>
    (await api.post<CrewTeam>('/crew-teams', input)).data;

export const updateCrewTeam = async (id: number, input: Partial<CrewTeamInput>) =>
    (await api.patch<CrewTeam>(`/crew-teams/${id}`, input)).data;

export const deleteCrewTeam = async (id: number) =>
    (await api.delete<{ ok: true }>(`/crew-teams/${id}`)).data;
