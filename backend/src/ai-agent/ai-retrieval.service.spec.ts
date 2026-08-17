import { AiRetrievalService } from './ai-retrieval.service';

function makePrisma(overrides: any = {}) {
  const empty = { findMany: async () => [] };
  return {
    invoice: { ...empty },
    event: { ...empty },
    rabPlan: { ...empty },
    customer: { ...empty },
    productVariant: { ...empty },
    lead: { ...empty },
    ...overrides,
  } as any;
}

const cashflowStub: any = {
  getMonthlyTrend: async () => [
    { month: 'Jul', income: 10_000_000, expense: 6_000_000 },
    { month: 'Agt', income: 20_000_000, expense: 8_000_000 },
  ],
  getCategoryBreakdown: async () => ({
    income: [{ category: 'DP Booth', total: 15_000_000 }],
    expense: [{ category: 'Material', total: 5_000_000 }],
  }),
  getAllEventsProfit: async () => ({
    rows: [{ eventId: 7, eventCode: 'EVT-1', eventName: 'Pameran Otomotif', totalIncome: 20_000_000, totalExpense: 8_000_000, grossProfit: 12_000_000, marginPct: 60 }],
    summary: { eventCount: 1, totalIncome: 20_000_000, totalExpense: 8_000_000, grossProfit: 12_000_000, marginPct: 60 },
  }),
};

const leadsStub: any = {
  stats: async () => ({ today: 2, week: 9, month: 30, total: 200, converted: 40, conversionRate: 20 }),
  performanceByMarketer: async () => [
    { workerId: 1, name: 'Budi', position: 'MARKETING', totalLeads: 50, convertedLeads: 12, conversionRate: 24, totalValueClosed: 80_000_000, avgResponseHours: 3, stuckLeads: 4, lostLeads: 8, totalValueLost: 10_000_000 },
  ],
};

function make(prisma: any) {
  return new AiRetrievalService(prisma, cashflowStub, leadsStub);
}

describe('AiRetrievalService — gating field biaya (existing)', () => {
  const prisma = makePrisma({
    productVariant: { findMany: async () => [{ id: 1, sku: 'SKU1', variantName: 'Booth 3x3', price: 5_000_000, hpp: 3_000_000, stock: 2 }] },
    rabPlan: { findMany: async () => [{ id: 9, code: 'RAB-2026-0001', title: 'Pameran X', dpAmount: 2_000_000, pelunasan: 4_000_000 }] },
  });

  it('non-manager: HPP & pelunasan tak muncul', async () => {
    const r = await make(prisma).retrieve('harga booth 3x3 rab pameran', false);
    expect(r.context).toContain('Booth 3x3');
    expect(r.context).not.toMatch(/HPP/);
    expect(r.context).not.toMatch(/pelunasan/);
  });
  it('manager: HPP & pelunasan muncul', async () => {
    const r = await make(prisma).retrieve('harga booth 3x3 rab pameran', true);
    expect(r.context).toMatch(/HPP/);
    expect(r.context).toMatch(/pelunasan/);
  });
});

describe('AiRetrievalService — leads & event detail', () => {
  it('lead masuk konteks; est di-gate manager', async () => {
    const prisma = makePrisma({
      lead: { findMany: async () => [{ id: 3, name: 'Andi', organization: 'PT Maju', phone: '0811', status: 'NEGOTIATION', productCategory: 'Booth', projectValueEst: 50_000_000, stage: { name: 'Negosiasi' }, assignedWorker: { name: 'Budi' } }] },
    });
    const nonMgr = await make(prisma).retrieve('lead pt maju booth', false);
    expect(nonMgr.context).toMatch(/Leads\/CRM terkait/);
    expect(nonMgr.context).toContain('Andi');
    expect(nonMgr.context).not.toMatch(/est Rp/);

    const mgr = await make(prisma).retrieve('lead pt maju booth', true);
    expect(mgr.context).toMatch(/est Rp50\.000\.000/);
  });

  it('event menampilkan timeline + crew + RAB', async () => {
    const prisma = makePrisma({
      event: { findMany: async () => [{ id: 7, code: 'EVT-1', name: 'Pameran Otomotif', venue: 'JCC', status: 'SCHEDULED', departureStart: '2026-08-20', setupStart: '2026-08-21', eventStart: '2026-08-22', eventEnd: '2026-08-24', picName: 'Sari', rabPlan: { code: 'RAB-9' }, _count: { crewAssignments: 6 } }] },
    });
    const r = await make(prisma).retrieve('event pameran otomotif', false);
    expect(r.context).toMatch(/jadwal:/);
    expect(r.context).toMatch(/crew 6/);
    expect(r.context).toMatch(/RAB RAB-9/);
    expect(r.context).toMatch(/PIC Sari/);
    expect(r.entities.find((e) => e.kind === 'event')?.href).toBe('/events/7');
  });
});

describe('AiRetrievalService — blok agregat keuangan & marketing', () => {
  const prisma = makePrisma();

  it('intent keuangan + manager → blok laporan keuangan', async () => {
    const r = await make(prisma).retrieve('tolong laporan keuangan bulan ini', true);
    expect(r.context).toMatch(/Laporan Keuangan/);
    expect(r.context).toMatch(/laba kotor Rp12\.000\.000/);
    expect(r.context).toMatch(/Material Rp5\.000\.000/);
  });

  it('intent marketing + manager → blok kinerja marketing', async () => {
    const r = await make(prisma).retrieve('kinerja marketing closing bulan ini', true);
    expect(r.context).toMatch(/Kinerja Marketing/);
    expect(r.context).toMatch(/Budi/);
    expect(r.context).toMatch(/nilai closing Rp80\.000\.000/);
  });

  it('intent keuangan tapi NON-manager → ditolak, tanpa angka', async () => {
    const r = await make(prisma).retrieve('laporan keuangan laba', false);
    expect(r.context).toMatch(/hanya tersedia untuk owner/);
    expect(r.context).not.toMatch(/12\.000\.000/);
  });

  it('tanpa intent → tak panggil agregat (blok keuangan absen)', async () => {
    const r = await make(prisma).retrieve('siapa customer PT ABC', true);
    expect(r.context).not.toMatch(/Laporan Keuangan/);
    expect(r.context).not.toMatch(/Kinerja Marketing/);
  });
});
