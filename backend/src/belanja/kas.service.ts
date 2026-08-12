import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeSaldoKas } from './belanja.logic';

export interface CreatePenerimaanDto {
  amount: number;
  source?: string | null;
  note?: string | null;
  receivedAt?: string;
  attributeToUserId?: number | null; // opsi: atribusikan ke admin lain (default = user token)
}

@Injectable()
export class KasService {
  constructor(private prisma: PrismaService) {}

  listPenerimaan(userId?: number) {
    return this.prisma.penerimaanDana.findMany({
      where: userId ? { createdById: userId } : undefined,
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async createPenerimaan(dto: CreatePenerimaanDto, tokenUserId: number) {
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('Nominal harus > 0');
    return this.prisma.penerimaanDana.create({
      data: {
        amount: dto.amount,
        source: dto.source?.trim() || null,
        note: dto.note?.trim() || null,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
        createdById: dto.attributeToUserId || tokenUserId,
      },
    });
  }

  async removePenerimaan(id: number) {
    const row = await this.prisma.penerimaanDana.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Penerimaan tidak ditemukan');
    await this.prisma.penerimaanDana.delete({ where: { id } });
    return { ok: true };
  }

  /** Ringkasan kas: global atau per-admin (bila userId diberikan). */
  async summary(userId?: number) {
    const scope = userId ? { createdById: userId } : {};
    const [masukAgg, keluarAgg, untagged] = await Promise.all([
      this.prisma.penerimaanDana.aggregate({ _sum: { amount: true }, where: scope }),
      this.prisma.belanja.aggregate({ _sum: { amount: true }, where: scope }),
      this.prisma.belanja.count({ where: { ...scope, eventId: null, category: null } }),
    ]);
    const s = computeSaldoKas(Number(masukAgg._sum.amount ?? 0), Number(keluarAgg._sum.amount ?? 0));
    return { ...s, untaggedCount: untagged, userId: userId ?? null };
  }

  /** Saldo kas per admin — untuk melihat siapa pegang berapa. */
  async byAdmin() {
    const [masuk, keluar] = await Promise.all([
      this.prisma.penerimaanDana.groupBy({ by: ['createdById'], _sum: { amount: true } }),
      this.prisma.belanja.groupBy({ by: ['createdById'], _sum: { amount: true } }),
    ]);
    const ids = new Set<number>();
    masuk.forEach((m) => ids.add(m.createdById));
    keluar.forEach((k) => ids.add(k.createdById));
    if (!ids.size) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.name ?? `User #${u.id}`]));
    const masukOf = new Map(masuk.map((m) => [m.createdById, Number(m._sum.amount ?? 0)]));
    const keluarOf = new Map(keluar.map((k) => [k.createdById, Number(k._sum.amount ?? 0)]));
    return Array.from(ids)
      .map((id) => {
        const s = computeSaldoKas(masukOf.get(id) ?? 0, keluarOf.get(id) ?? 0);
        return { userId: id, name: nameOf.get(id), ...s };
      })
      .sort((a, b) => b.saldo - a.saldo);
  }
}
