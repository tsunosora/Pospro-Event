import { AiRetrievalService } from './ai-retrieval.service';

function makePrisma(overrides: any = {}) {
  const empty = { findMany: async () => [] };
  return {
    invoice: { ...empty },
    event: { ...empty },
    rabPlan: { ...empty },
    customer: { ...empty },
    productVariant: { ...empty },
    ...overrides,
  } as any;
}

describe('AiRetrievalService.retrieve — gating field biaya', () => {
  const prisma = makePrisma({
    productVariant: {
      findMany: async () => [
        { id: 1, sku: 'SKU1', variantName: 'Booth 3x3', price: 5000000, hpp: 3000000, stock: 2 },
      ],
    },
    rabPlan: {
      findMany: async () => [
        { id: 9, code: 'RAB-2026-0001', title: 'Pameran X', dpAmount: 2000000, pelunasan: 4000000 },
      ],
    },
  });
  const svc = new AiRetrievalService(prisma);

  it('non-manager: HPP & pelunasan TIDAK muncul di context', async () => {
    const r = await svc.retrieve('harga booth 3x3 rab pameran', false);
    expect(r.context).toContain('Booth 3x3');
    expect(r.context).toContain('RAB-2026-0001');
    expect(r.context).not.toMatch(/HPP/);
    expect(r.context).not.toMatch(/pelunasan/);
    expect(r.context).not.toContain('3.000.000');
  });

  it('manager: HPP & pelunasan muncul', async () => {
    const r = await svc.retrieve('harga booth 3x3 rab pameran', true);
    expect(r.context).toMatch(/HPP/);
    expect(r.context).toContain('3.000.000');
    expect(r.context).toMatch(/pelunasan/);
  });
});

describe('AiRetrievalService.retrieve — entities & guard', () => {
  it('membuat kartu entitas dgn href yang benar', async () => {
    const prisma = makePrisma({
      invoice: {
        findMany: async () => [
          { id: 42, invoiceNumber: '42/Xp/Pnwr/IV/26', clientName: 'PT ABC', projectName: 'Booth', total: 1000000, status: 'SENT' },
        ],
      },
      event: {
        findMany: async () => [{ id: 7, code: 'EVT-1', name: 'Pameran Otomotif', venue: 'JCC', status: 'SCHEDULED' }],
      },
    });
    const svc = new AiRetrievalService(prisma);
    const r = await svc.retrieve('penawaran pameran otomotif', false);
    const hrefs = r.entities.map((e) => e.href);
    expect(hrefs).toContain('/penawaran/42');
    expect(hrefs).toContain('/events/7');
    expect(r.entities.find((e) => e.kind === 'quotation')?.label).toBe('42/Xp/Pnwr/IV/26');
  });

  it('pesan tanpa kata kunci (semua pendek) → tak query, entities kosong', async () => {
    let called = false;
    const prisma = makePrisma({ invoice: { findMany: async () => { called = true; return []; } } });
    const svc = new AiRetrievalService(prisma);
    const r = await svc.retrieve('ok ya', false);
    expect(r.entities).toHaveLength(0);
    expect(called).toBe(false);
  });
});
