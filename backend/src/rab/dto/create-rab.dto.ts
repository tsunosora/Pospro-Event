import type { EventBrand } from '@prisma/client';
import { RabItemInput } from './rab-item.dto';

export interface CreateRabDto {
    title: string;
    projectName?: string;
    location?: string;
    periodStart?: string | Date;
    periodEnd?: string | Date;
    customerId?: number | null;
    brand?: EventBrand | null;
    dpAmount?: number;
    pelunasan?: number;
    incomeOther?: number;
    notes?: string;
    tags?: string[];
    items?: RabItemInput[];
}

export type UpdateRabDto = Partial<CreateRabDto>;
