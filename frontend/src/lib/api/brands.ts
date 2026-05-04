import api from './client';

export type Brand = 'EXINDO' | 'XPOSER' | 'OTHER';

/** Metadata visual per-brand untuk UI (warna, label, dll) */
export const BRAND_META: Record<Brand, { label: string; short: string; color: string; bg: string; text: string; border: string; emoji: string }> = {
    EXINDO: {
        label: 'CV. Exindo Pratama',
        short: 'Exindo',
        color: '#1e40af', // blue-800
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-300',
        emoji: '🟦',
    },
    XPOSER: {
        label: 'CV. Xposer Event',
        short: 'Xposer',
        color: '#0d9488', // teal-600
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-300',
        emoji: '🟩',
    },
    OTHER: {
        label: 'Lainnya',
        short: 'Lainnya',
        color: '#64748b',
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-300',
        emoji: '⬜',
    },
};

/** Brand yang aktif untuk CRM/RAB/Quotation (tidak termasuk OTHER) */
export const ACTIVE_BRANDS: Brand[] = ['EXINDO', 'XPOSER'];

export interface BrandSettings {
    id: number;
    brand: Brand;
    companyName: string;
    companyCode: string;
    directorName: string | null;
    logoImageUrl: string | null;
    letterheadImageUrl: string | null;
    stampImageUrl: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    npwp: string | null;
    bankAccountIds: string | null;
    letterheadFooter: string | null;
    quotationDisclaimer: string | null;
    quotationPaymentTerms: string | null;
    quotationClosing: string | null;
    invoiceClosingText: string | null;
    openingTemplate: string | null;
    quotationDisclaimerEn: string | null;
    quotationPaymentTermsEn: string | null;
    quotationClosingEn: string | null;
    invoiceClosingTextEn: string | null;
    openingTemplateEn: string | null;
    themeColor: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertBrandInput {
    companyName: string;
    companyCode: string;
    directorName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    npwp?: string | null;
    bankAccountIds?: string | null;
    letterheadFooter?: string | null;
    quotationDisclaimer?: string | null;
    quotationPaymentTerms?: string | null;
    quotationClosing?: string | null;
    invoiceClosingText?: string | null;
    openingTemplate?: string | null;
    quotationDisclaimerEn?: string | null;
    quotationPaymentTermsEn?: string | null;
    quotationClosingEn?: string | null;
    invoiceClosingTextEn?: string | null;
    openingTemplateEn?: string | null;
    themeColor?: string | null;
    isActive?: boolean;
}

export interface BrandStats {
    leadCount: number;
    rabCount: number;
    quotationCount: number;
}

export const listBrands = async (): Promise<BrandSettings[]> =>
    (await api.get('/brands')).data;

export const getBrand = async (brand: Brand): Promise<BrandSettings> =>
    (await api.get(`/brands/${brand}`)).data;

export const getBrandStats = async (brand: Brand): Promise<BrandStats> =>
    (await api.get(`/brands/${brand}/stats`)).data;

export const upsertBrand = async (brand: Brand, input: UpsertBrandInput): Promise<BrandSettings> =>
    (await api.patch(`/brands/${brand}`, input)).data;

export const uploadBrandLogo = async (brand: Brand, file: File): Promise<BrandSettings> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post(`/brands/${brand}/upload-logo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const removeBrandLogo = async (brand: Brand): Promise<BrandSettings> =>
    (await api.delete(`/brands/${brand}/logo`)).data;

export const uploadBrandLetterhead = async (brand: Brand, file: File): Promise<BrandSettings> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post(`/brands/${brand}/upload-letterhead`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const removeBrandLetterhead = async (brand: Brand): Promise<BrandSettings> =>
    (await api.delete(`/brands/${brand}/letterhead`)).data;

export const uploadBrandStamp = async (brand: Brand, file: File): Promise<BrandSettings> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post(`/brands/${brand}/upload-stamp`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const removeBrandStamp = async (brand: Brand): Promise<BrandSettings> =>
    (await api.delete(`/brands/${brand}/stamp`)).data;

/** Default disclaimer text untuk auto-fill di settings UI */
export const DEFAULT_DISCLAIMER = `# Harga belum termasuk : managemen fee official contractor, deposit ke penyelenggara atau Gedung, asuransi, sambungan listrik & titik daya, instalasi air dan suplai air, dan biaya lainnya dalam acara ini.
# Harga untuk pembelian satu set booth, barang tidak bisa di beli secara terpisah`;

export const DEFAULT_PAYMENT_TERMS = `Sedangkan system pembayaran 50% dari nilai nominal kontrak yang harus telah kami terima pada saat penandatangan kontrak, dan sisanya di bayarkan pada saat booth siap dikirim. Penambahan fasilitas diluar spesifikasi di atas akan dikenakan biaya sesuai dengan Harga kami.
Harga di atas sudah termasuk di dalam nya biaya pasang dan bongkar event pertama, untuk event selanjutnya akan kami kenakan biaya pasang dan bongkar serta biaya simpan apabila di perlukan.`;

export const DEFAULT_CLOSING = `Demikian penawaran Kerjasama kami. Semoga terjalin Kerjasama yang baik. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.`;

export const DEFAULT_INVOICE_CLOSING = `# Jika terjadi pembatalan pemesanan, maka DP yang sudah dibayarkan tidak dapat dikembalikan.`;
