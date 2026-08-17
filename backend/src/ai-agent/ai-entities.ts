import { RetrievedEntity } from './ai-retrieval.service';

// Kembalikan hanya entitas yang benar-benar disebut di jawaban → kartu klik.
export function pickMentionedEntities(
  reply: string,
  entities: RetrievedEntity[],
): RetrievedEntity[] {
  const low = (reply ?? '').toLowerCase();
  const seen = new Set<string>();
  const out: RetrievedEntity[] = [];
  for (const e of entities) {
    const key = `${e.kind}:${e.id}`;
    if (!seen.has(key) && e.label && low.includes(e.label.toLowerCase())) {
      seen.add(key);
      out.push(e);
    }
  }
  return out.slice(0, 6);
}
