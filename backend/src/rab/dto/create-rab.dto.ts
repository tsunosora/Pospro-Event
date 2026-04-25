import { RabItemInput } from './rab-item.dto';

export interface CreateRabDto {
    title: string;
    projectName?: string;
    location?: string;
    periodStart?: string | Date;
    periodEnd?: string | Date;
    customerId?: number | null;
    dpAmount?: number;
    pelunasan?: number;
    incomeOther?: number;
    notes?: string;
    items?: RabItemInput[];
}

export type UpdateRabDto = Partial<CreateRabDto>;
