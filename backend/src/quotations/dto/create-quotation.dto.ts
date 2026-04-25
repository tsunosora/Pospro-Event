import { QuotationVariant } from '@prisma/client';
import { QuotationItemInput } from './quotation-item.dto';

export interface CreateQuotationDto {
    quotationVariant: QuotationVariant;

    // Klien — boleh dari Customer existing, atau manual
    customerId?: number | null;
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;

    // Detail event/project
    projectName?: string;
    eventLocation?: string;
    eventDateStart?: string | Date;   // ISO
    eventDateEnd?: string | Date;

    // Penawaran terms
    date?: string | Date;
    validUntil?: string | Date;
    dpPercent?: number;
    bankAccountIds?: string;           // CSV: "1,3,7"
    notes?: string;

    // Angka
    taxRate?: number;
    discount?: number;

    items?: QuotationItemInput[];
}
