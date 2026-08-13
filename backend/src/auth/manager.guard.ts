import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_KEYWORDS = ['admin', 'owner', 'pemilik', 'manajer', 'manager', 'supervisor', 'kepala'];

/** Cek role manajerial dari nama role (selaras useCurrentUser().isManager di frontend). */
export function isManagerRole(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return MANAGER_KEYWORDS.some((k) => n === k || n.includes(k));
}

@Injectable()
export class ManagerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req?.user?.userId ?? req?.user?.id ?? req?.user?.sub;
    if (!userId) throw new ForbiddenException('Tidak terautentikasi');
    const user = await this.prisma.user.findUnique({
      where: { id: Number(userId) },
      include: { role: true },
    });
    if (!isManagerRole(user?.role?.name)) {
      throw new ForbiddenException('Hanya owner/admin yang boleh mengakses fitur ini');
    }
    return true;
  }
}
