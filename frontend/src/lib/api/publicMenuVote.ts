// Voting publik — TANPA login. Sengaja pakai fetch langsung (bukan axios `api`
// yang menyisipkan Bearer token), mengikuti pola publicSchedule.ts.

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PublicVoteCandidate {
  menuId: number;
  menu: { id: number; name: string; estimatedCost?: string; imageUrl?: string | null };
}

export interface PublicVoteData {
  id: number;
  title?: string | null;
  planDate: string;
  expiresAt: string;
  candidates: PublicVoteCandidate[];
}

export async function getPublicVote(token: string): Promise<PublicVoteData> {
  const r = await fetch(`${apiBase}/public/menu-vote/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (r.status === 403) throw new Error('Link vote sudah kedaluwarsa atau ditutup');
  if (!r.ok) throw new Error('Link vote tidak valid');
  return r.json();
}

export async function castPublicVote(token: string, menuId: number, voterName: string, weight = 1): Promise<{ ok: boolean }> {
  const r = await fetch(`${apiBase}/public/menu-vote/${encodeURIComponent(token)}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuId, voterName, weight }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || 'Gagal mengirim suara');
  return r.json();
}
