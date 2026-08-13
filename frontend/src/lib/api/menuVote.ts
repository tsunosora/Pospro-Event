import api from './client';

export interface VoteCandidate {
  id: number;
  menuId: number;
  menu: { id: number; name: string; estimatedCost?: string; imageUrl?: string | null };
}

export interface VoteSessionRow {
  id: number;
  title?: string | null;
  planDate: string;
  status: 'OPEN' | 'CLOSED';
  winnerMenuId?: number | null;
  publicToken: string;
  expiresAt: string;
  candidates: VoteCandidate[];
  ballots?: { menuId: number; voterName: string; weight: number }[];
  tally?: { counts: Record<number, number>; winnerMenuId: number | null; totalVotes: number };
  plan?: { id: number } | null;
  _count?: { ballots: number };
}

export const getVoteSessions = async () => (await api.get<VoteSessionRow[]>('/menu-vote')).data;
export const getVoteSession = async (id: number) => (await api.get<VoteSessionRow>(`/menu-vote/${id}`)).data;
export const createVoteSession = async (input: { title?: string | null; planDate: string; menuIds: number[]; durationMinutes?: number }) =>
  (await api.post<VoteSessionRow>('/menu-vote', input)).data;
export const closeVoteSession = async (id: number) =>
  (await api.post<{ winnerMenuId: number | null; planId: number | null }>(`/menu-vote/${id}/close`, {})).data;
export const deleteVoteSession = async (id: number) => (await api.delete(`/menu-vote/${id}`)).data;

/** URL link publik untuk dibagikan. */
export const voteShareUrl = (token: string) =>
  typeof window !== 'undefined' ? `${window.location.origin}/vote/${token}` : `/vote/${token}`;
