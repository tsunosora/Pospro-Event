import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WageRateInput {
    city: string;
    division: string;
    dailyWageRate: number | string;
    overtimeRatePerHour: number | string;
    notes?: string | null;
    isActive?: boolean;
}

@Injectable()
export class WageRatesService {
    constructor(private prisma: PrismaService) { }

    async list(includeInactive = true) {
        return this.prisma.wageRate.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ city: 'asc' }, { division: 'asc' }],
        });
    }

    /** Distinct kota & divisi (untuk dropdown autocomplete di UI). */
    async listDistinct(): Promise<{ cities: string[]; divisions: string[] }> {
        const rows = await this.prisma.wageRate.findMany({
            where: { isActive: true },
            select: { city: true, division: true },
        });
        const citySet = new Set<string>();
        const divSet = new Set<string>();
        for (const r of rows) {
            if (r.city.trim()) citySet.add(r.city.trim());
            if (r.division.trim()) divSet.add(r.division.trim());
        }
        return {
            cities: Array.from(citySet).sort((a, b) => a.localeCompare(b, 'id')),
            divisions: Array.from(divSet).sort((a, b) => a.localeCompare(b, 'id')),
        };
    }

    async findOne(id: number) {
        const r = await this.prisma.wageRate.findUnique({ where: { id } });
        if (!r) throw new NotFoundException(`Rate id=${id} tidak ditemukan`);
        return r;
    }

    /** Cari rate spesifik by (city, division) — return null kalau gak ada. Dipakai payroll resolver. */
    async findByKey(city: string, division: string) {
        return this.prisma.wageRate.findUnique({
            where: { city_division: { city: city.trim(), division: division.trim() } },
        });
    }

    private parseRate(input: WageRateInput): {
        city: string;
        division: string;
        dailyWageRate: Prisma.Decimal | number;
        overtimeRatePerHour: Prisma.Decimal | number;
        notes: string | null;
        isActive: boolean;
    } {
        const city = input.city?.trim();
        const division = input.division?.trim();
        if (!city) throw new BadRequestException('Kota wajib diisi');
        if (!division) throw new BadRequestException('Divisi wajib diisi');
        const daily = Number(input.dailyWageRate);
        const overtime = Number(input.overtimeRatePerHour);
        if (Number.isNaN(daily) || daily < 0) throw new BadRequestException('Tarif harian invalid');
        if (Number.isNaN(overtime) || overtime < 0) throw new BadRequestException('Tarif lembur invalid');
        return {
            city, division,
            dailyWageRate: daily as any,
            overtimeRatePerHour: overtime as any,
            notes: input.notes?.trim() || null,
            isActive: input.isActive ?? true,
        };
    }

    async create(input: WageRateInput) {
        const data = this.parseRate(input);
        try {
            return await this.prisma.wageRate.create({ data });
        } catch (e: any) {
            if (e.code === 'P2002') {
                throw new ConflictException(`Rate untuk ${data.city} + ${data.division} sudah ada. Edit yang existing.`);
            }
            throw e;
        }
    }

    async update(id: number, input: Partial<WageRateInput>) {
        await this.findOne(id);
        const data: Prisma.WageRateUpdateInput = {};
        if (input.city !== undefined) {
            const city = input.city.trim();
            if (!city) throw new BadRequestException('Kota wajib diisi');
            data.city = city;
        }
        if (input.division !== undefined) {
            const div = input.division.trim();
            if (!div) throw new BadRequestException('Divisi wajib diisi');
            data.division = div;
        }
        if (input.dailyWageRate !== undefined) {
            const n = Number(input.dailyWageRate);
            if (Number.isNaN(n) || n < 0) throw new BadRequestException('Tarif harian invalid');
            data.dailyWageRate = n as any;
        }
        if (input.overtimeRatePerHour !== undefined) {
            const n = Number(input.overtimeRatePerHour);
            if (Number.isNaN(n) || n < 0) throw new BadRequestException('Tarif lembur invalid');
            data.overtimeRatePerHour = n as any;
        }
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        try {
            return await this.prisma.wageRate.update({ where: { id }, data });
        } catch (e: any) {
            if (e.code === 'P2002') {
                throw new ConflictException('Kombinasi kota+divisi sudah ada di rate lain');
            }
            throw e;
        }
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.wageRate.delete({ where: { id } });
    }
}
