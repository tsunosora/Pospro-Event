import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarehousePinService {
    constructor(private prisma: PrismaService) { }

    private async ensureSettings() {
        let s = await this.prisma.storeSettings.findFirst();
        if (!s) {
            s = await this.prisma.storeSettings.create({
                data: { storeName: 'Pospenawaran' },
            });
        }
        return s;
    }

    async getStatus(): Promise<{ isSet: boolean }> {
        const s = await this.prisma.storeSettings.findFirst({
            select: { warehousePinHash: true },
        });
        return { isSet: !!s?.warehousePinHash };
    }

    async setPin(pin: string) {
        if (!pin || !/^\d{4,8}$/.test(pin)) {
            throw new BadRequestException('PIN harus berupa angka 4-8 digit');
        }
        const s = await this.ensureSettings();
        const hash = await bcrypt.hash(pin, 10);
        await this.prisma.storeSettings.update({
            where: { id: s.id },
            data: { warehousePinHash: hash },
        });
        return { ok: true };
    }

    async verify(pin: string): Promise<boolean> {
        if (!pin) return false;
        const s = await this.prisma.storeSettings.findFirst({
            select: { warehousePinHash: true },
        });
        if (!s?.warehousePinHash) return false;
        return bcrypt.compare(pin, s.warehousePinHash);
    }
}
