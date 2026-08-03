import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulePinService {
    constructor(private prisma: PrismaService) { }

    private async ensureSettings() {
        let s = await this.prisma.storeSettings.findFirst({ orderBy: { id: 'asc' } });
        if (!s) {
            s = await this.prisma.storeSettings.create({
                data: { storeName: 'Pospenawaran' },
            });
        }
        return s;
    }

    async getStatus(): Promise<{ isSet: boolean }> {
        const s = await this.prisma.storeSettings.findFirst({
            orderBy: { id: 'asc' },
            select: { schedulePinHash: true },
        });
        return { isSet: !!s?.schedulePinHash };
    }

    async setPin(pin: string) {
        if (!pin || !/^\d{4,8}$/.test(pin)) {
            throw new BadRequestException('PIN harus berupa angka 4-8 digit');
        }
        const s = await this.ensureSettings();
        const hash = await bcrypt.hash(pin, 10);
        await this.prisma.storeSettings.update({
            where: { id: s.id },
            data: { schedulePinHash: hash },
        });
        return { ok: true };
    }

    async verify(pin: string): Promise<boolean> {
        if (!pin) return false;
        const s = await this.prisma.storeSettings.findFirst({
            orderBy: { id: 'asc' },
            select: { schedulePinHash: true },
        });
        if (!s?.schedulePinHash) return false;
        return bcrypt.compare(pin, s.schedulePinHash);
    }
}
