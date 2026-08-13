export interface BallotInput {
  menuId: number;
  weight?: number; // jumlah suara yang diwakili (default 1)
}

export interface TallyResult {
  counts: Record<number, number>; // total bobot per menu
  winnerMenuId: number | null;
  totalVotes: number; // total bobot seluruh suara
}

export function tallyVote(ballots: BallotInput[], candidateMenuIds: number[]): TallyResult {
  const counts: Record<number, number> = {};
  for (const id of candidateMenuIds) counts[id] = 0;
  let totalVotes = 0;
  for (const b of ballots) {
    const w = Number(b.weight) > 0 ? Math.floor(Number(b.weight)) : 1; // invalid/kosong → 1
    counts[b.menuId] = (counts[b.menuId] || 0) + w;
    totalVotes += w;
  }
  let winnerMenuId: number | null = null;
  let best = -1;
  for (const idStr of Object.keys(counts).sort((a, b) => Number(a) - Number(b))) {
    const id = Number(idStr);
    if (counts[id] > best) {
      best = counts[id];
      winnerMenuId = id;
    }
  }
  if (totalVotes === 0) winnerMenuId = null;
  return { counts, winnerMenuId, totalVotes };
}
