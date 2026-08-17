import { pickMentionedEntities } from './ai-entities';
import { RetrievedEntity } from './ai-retrieval.service';

const ents: RetrievedEntity[] = [
  { kind: 'quotation', id: 1, label: '42/Xp/Pnwr/IV/26', href: '/penawaran/1' },
  { kind: 'event', id: 2, label: 'Pameran Otomotif', href: '/events/2' },
  { kind: 'customer', id: 3, label: 'PT ABC', href: '/customers/3' },
];

describe('pickMentionedEntities', () => {
  it('hanya entitas yang disebut di reply', () => {
    const out = pickMentionedEntities('Penawaran 42/Xp/Pnwr/IV/26 untuk PT ABC sudah ACCEPTED.', ents);
    expect(out.map((e) => e.id).sort()).toEqual([1, 3]);
  });
  it('case-insensitive', () => {
    const out = pickMentionedEntities('event pameran otomotif berjalan', ents);
    expect(out.map((e) => e.id)).toEqual([2]);
  });
  it('tidak ada yang disebut → kosong', () => {
    expect(pickMentionedEntities('Tidak ada data relevan.', ents)).toHaveLength(0);
  });
  it('dedup & cap 6', () => {
    const many: RetrievedEntity[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'event',
      id: i,
      label: `EVT-${i}`,
      href: `/events/${i}`,
    }));
    const reply = many.map((e) => e.label).join(' ');
    expect(pickMentionedEntities(reply, many).length).toBe(6);
  });
});
