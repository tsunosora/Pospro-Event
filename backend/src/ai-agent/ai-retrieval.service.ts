import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RetrievedEntity {
  kind: 'quotation' | 'event' | 'rab' | 'customer';
  id: number;
  label: string;
  sublabel?: string;
  href: string; // deep-link route FE
}

const rp = (n: any): string =>
  n == null ? '-' : 'Rp' + Number(n).toLocaleString('id-ID');

@Injectable()
export class AiRetrievalService {
  constructor(private prisma: PrismaService) {}

  private terms(msg: string): string[] {
    return msg
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3)
      .slice(0, 6);
  }

  async retrieve(
    message: string,
    isManager: boolean,
  ): Promise<{ context: string; entities: RetrievedEntity[] }> {
    const words = this.terms(message);
    if (words.length === 0) {
      return { context: '(tidak ada kata kunci yang bisa dicari)', entities: [] };
    }
    const orLike = (fields: string[]) =>
      words.flatMap((w) => fields.map((f) => ({ [f]: { contains: w } })));

    const [invoices, events, rabs, customers, variants] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          OR: orLike(['invoiceNumber', 'clientName', 'clientCompany', 'projectName', 'eventLocation']),
        },
        take: 5,
        orderBy: { date: 'desc' },
      }),
      this.prisma.event.findMany({
        where: { OR: orLike(['code', 'name', 'venue', 'customerName']) },
        take: 5,
        orderBy: { eventStart: 'desc' },
      }),
      this.prisma.rabPlan.findMany({
        where: { OR: orLike(['code', 'title', 'projectName', 'location']) },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.findMany({
        where: { OR: orLike(['name', 'companyName', 'companyPIC', 'phone']) },
        take: 5,
        orderBy: { name: 'asc' },
      }),
      this.prisma.productVariant.findMany({
        where: { OR: orLike(['sku', 'variantName', 'size']) },
        take: 5,
      }),
    ]);

    const entities: RetrievedEntity[] = [];
    const lines: string[] = [];

    if (invoices.length) {
      lines.push('## Penawaran/Invoice terkait');
      for (const q of invoices as any[]) {
        lines.push(
          `- ${q.invoiceNumber} | ${q.clientName ?? '-'} | ${q.projectName ?? '-'} | total ${rp(q.total)} | status ${q.status}`,
        );
        entities.push({
          kind: 'quotation',
          id: q.id,
          label: q.invoiceNumber,
          sublabel: q.clientName ?? undefined,
          href: `/penawaran/${q.id}`,
        });
      }
    }

    if (events.length) {
      lines.push('## Event terkait');
      for (const e of events as any[]) {
        lines.push(`- ${e.code} | ${e.name} | ${e.venue ?? '-'} | status ${e.status}`);
        entities.push({
          kind: 'event',
          id: e.id,
          label: e.name,
          sublabel: e.venue ?? undefined,
          href: `/events/${e.id}`,
        });
      }
    }

    if (rabs.length) {
      lines.push('## RAB terkait');
      for (const r of rabs as any[]) {
        const money = isManager
          ? ` | DP ${rp(r.dpAmount)} | pelunasan ${rp(r.pelunasan)}`
          : '';
        lines.push(`- ${r.code} | ${r.title ?? r.projectName ?? '-'}${money}`);
        entities.push({
          kind: 'rab',
          id: r.id,
          label: r.code,
          sublabel: r.title ?? undefined,
          href: `/rab/${r.id}`,
        });
      }
    }

    if (customers.length) {
      lines.push('## Customer terkait');
      for (const c of customers as any[]) {
        lines.push(`- ${c.name} | ${c.companyName ?? '-'} | ${c.phone ?? '-'}`);
        entities.push({
          kind: 'customer',
          id: c.id,
          label: c.name,
          sublabel: c.companyName ?? undefined,
          href: `/customers/${c.id}`,
        });
      }
    }

    if (variants.length) {
      lines.push('## Produk/Material terkait');
      for (const v of variants as any[]) {
        const cost = isManager ? ` | HPP ${rp(v.hpp)}` : '';
        lines.push(
          `- ${v.sku} | ${v.variantName ?? '-'} | harga ${rp(v.price)}${cost} | stok ${v.stock ?? '-'}`,
        );
      }
    }

    return {
      context: lines.join('\n') || '(tidak ada data internal yang cocok)',
      entities,
    };
  }
}
