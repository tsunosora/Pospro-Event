import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { tallyVote } from './vote.logic';

export interface CreateSessionDto {
  title?: string | null;
  planDate: string;
  menuIds: number[]; // kandidat (admin pilih ±5 dari ratusan)
  durationMinutes?: number; // masa berlaku link, default 15 menit
}

@Injectable()
export class MenuVoteService {
  constructor(private prisma: PrismaService) {}

  // ─── MANAJEMEN (owner/admin, JWT + ManagerGuard) ───────────────────────

  async create(dto: CreateSessionDto, userId: number) {
    if (!dto.planDate) throw new BadRequestException('Tanggal wajib diisi');
    const menuIds = [...new Set(dto.menuIds || [])];
    if (menuIds.length < 2) throw new BadRequestException('Minimal 2 kandidat menu');
    const minutes = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 15;
    const token = crypto.randomBytes(16).toString('hex'); // 32 char hex
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    return this.prisma.menuVoteSession.create({
      data: {
        title: dto.title ?? null,
        planDate: new Date(dto.planDate),
        publicToken: token,
        expiresAt,
        createdById: userId,
        candidates: { create: menuIds.map((menuId) => ({ menuId })) },
      },
      include: { candidates: { include: { menu: { select: { id: true, name: true, estimatedCost: true } } } } },
    });
  }

  async detail(id: number) {
    await this.autoCloseIfExpired(id); // finalisasi bila sudah lewat expiresAt
    const session = await this.prisma.menuVoteSession.findUnique({
      where: { id },
      include: {
        candidates: { include: { menu: { select: { id: true, name: true, estimatedCost: true, imageUrl: true } } } },
        ballots: true,
        plan: { select: { id: true } },
      },
    });
    if (!session) throw new NotFoundException('Sesi vote tidak ditemukan');
    const tally = tallyVote(
      session.ballots.map((b) => ({ menuId: b.menuId, weight: b.weight })),
      session.candidates.map((c) => c.menuId),
    );
    return { ...session, tally };
  }

  async list() {
    // auto-close semua sesi OPEN yang sudah kedaluwarsa sebelum menampilkan
    const expired = await this.prisma.menuVoteSession.findMany({
      where: { status: 'OPEN', expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    for (const s of expired) await this.autoCloseIfExpired(s.id);
    return this.prisma.menuVoteSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        candidates: { include: { menu: { select: { id: true, name: true } } } },
        plan: { select: { id: true } },
        _count: { select: { ballots: true } },
      },
    });
  }

  /** Manual close (owner/admin) → finalisasi pemenang dari skor terakhir. */
  async close(sessionId: number, userId: number) {
    const s = await this.prisma.menuVoteSession.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundException('Sesi tidak ditemukan');
    if (s.status === 'CLOSED') throw new BadRequestException('Sesi sudah ditutup');
    return this.finalize(sessionId, userId);
  }

  /** Auto-close bila lewat expiresAt & masih OPEN (dipanggil lazily saat list/detail). */
  private async autoCloseIfExpired(sessionId: number) {
    const s = await this.prisma.menuVoteSession.findUnique({ where: { id: sessionId } });
    if (!s || s.status !== 'OPEN') return;
    if (s.expiresAt.getTime() >= Date.now()) return;
    await this.finalize(sessionId, s.createdById); // atribusi ke pembuat sesi
  }

  /** Tutup sesi → pemenang dari skor terakhir → buat MenuMakanPlan (VOTE).
   *  Idempoten: aman dipanggil ganda (skip bila sudah CLOSED). Tanpa suara → CLOSED tanpa plan. */
  private async finalize(sessionId: number, byUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.menuVoteSession.findUnique({
        where: { id: sessionId },
        include: { candidates: true, ballots: true },
      });
      if (!s || s.status === 'CLOSED') return { winnerMenuId: s?.winnerMenuId ?? null, planId: null };
      const tally = tallyVote(
        s.ballots.map((b) => ({ menuId: b.menuId, weight: b.weight })),
        s.candidates.map((c) => c.menuId),
      );
      const winnerMenuId = tally.winnerMenuId;
      await tx.menuVoteSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', winnerMenuId } });
      if (!winnerMenuId) return { winnerMenuId: null, planId: null }; // tak ada suara
      const dailyBudget = Number((await tx.menuMakanSetting.findUnique({ where: { id: 1 } }))?.dailyBudget) || 0;
      const menu = await tx.menuMakan.findUnique({ where: { id: winnerMenuId } });
      const plan = await tx.menuMakanPlan.create({
        data: {
          planDate: s.planDate,
          menuId: winnerMenuId,
          servings: menu?.servings ?? 1,
          selectionMethod: 'VOTE',
          estimatedCost: menu?.estimatedCost ?? 0,
          budget: dailyBudget > 0 ? dailyBudget : null,
          voteSessionId: sessionId,
          createdById: byUserId,
        },
      });
      return { winnerMenuId, planId: plan.id };
    });
  }

  async remove(id: number) {
    return this.prisma.menuVoteSession.delete({ where: { id } });
  }

  // ─── PUBLIK (tanpa login, via publicToken) ─────────────────────────────

  private async loadOpenByToken(token: string) {
    const session = await this.prisma.menuVoteSession.findUnique({
      where: { publicToken: token },
      include: { candidates: { include: { menu: { select: { id: true, name: true, estimatedCost: true, imageUrl: true } } } } },
    });
    if (!session) throw new NotFoundException('Link vote tidak valid');
    if (session.status === 'CLOSED') throw new ForbiddenException('Voting sudah ditutup');
    if (session.expiresAt.getTime() < Date.now()) throw new ForbiddenException('Link vote sudah kedaluwarsa');
    return session;
  }

  /** Data untuk halaman vote publik — TANPA menampilkan tally (hindari bandwagon). */
  async publicDetail(token: string) {
    const s = await this.loadOpenByToken(token);
    return {
      id: s.id,
      title: s.title,
      planDate: s.planDate,
      expiresAt: s.expiresAt,
      candidates: s.candidates.map((c) => ({ menuId: c.menuId, menu: c.menu })),
    };
  }

  /** Catat/ubah suara publik: 1 entri per nama per sesi, dengan bobot (jumlah suara diwakili). */
  async publicVote(token: string, menuId: number, voterName: string, weight = 1) {
    const s = await this.loadOpenByToken(token);
    const name = (voterName || '').trim();
    if (!name) throw new BadRequestException('Nama wajib diisi');
    if (!s.candidates.some((c) => c.menuId === menuId)) throw new BadRequestException('Menu bukan kandidat');
    const w = Number(weight) > 0 ? Math.floor(Number(weight)) : 1; // min 1
    await this.prisma.menuVoteBallot.upsert({
      where: { sessionId_voterName: { sessionId: s.id, voterName: name } },
      create: { sessionId: s.id, menuId, voterName: name, weight: w },
      update: { menuId, weight: w },
    });
    return { ok: true };
  }
}
