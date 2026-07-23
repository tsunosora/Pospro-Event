"use client";

import { use, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Plus, Trash2, Save, Hash, GitBranch, FileDown, FileText, Loader2, ScrollText,
    Eye, X, Download, Calculator, Copy, GripVertical, Pencil,
    CalendarDays, AlertTriangle, CheckCircle2, Wallet, Minimize2, SlidersHorizontal,
    Percent, TrendingDown, FileCheck, Globe, User, Paperclip, Zap, List, BarChart2,
    Bot, ArrowUp, ArrowDown, Clock, CalendarRange, History, Pin, Package, ChevronDown,
    Lightbulb, CreditCard, Mail, MessageSquare,
} from "lucide-react";
import {
    DndContext, PointerSensor, useSensor, useSensors,
    closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuotationItemCalculator, { type QuotationCalcResult } from "./QuotationItemCalculator";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotation, updateQuotation, assignQuotationNumber, editQuotationNumber, reviseQuotation,
    downloadQuotationExport, generateInvoiceFromQuotation, listInvoicesByQuotation,
    getDueDateHistory,
    type Quotation, type QuotationItem, type DueDateHistoryEntry,
} from "@/lib/api/quotations";
import { Receipt } from "lucide-react";
import { ACTIVE_BRANDS, BRAND_META, getBrand, type Brand } from "@/lib/api/brands";
import { listQuotationVariants } from "@/lib/api/quotation-variants";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { getBankAccounts } from "@/lib/api/transactions";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import type { Customer } from "@/lib/api/customers";
import { Search } from "lucide-react";

dayjs.locale("id");

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-info/15 text-info",
    ACCEPTED: "bg-success/15 text-success",
    PAID: "bg-success/15 text-success",
    REJECTED: "bg-destructive/12 text-destructive",
    CANCELLED: "bg-destructive/12 text-destructive",
    EXPIRED: "bg-warning/15 text-warning",
};

type ItemRow = QuotationItem & { _key: string };

/**
 * Normalisasi item dari DB:
 * - unit: separator legacy " - " → " x " (mis. "unit - 3 hari" → "unit x 3 hari")
 * - description: strip suffix faktor "(... unit/hari/jam/m²)" yang dulu di-append calculator
 * Apply saat load supaya saat user save lagi, data juga tersimpan dalam format baru.
 */
function normalizeItem(it: QuotationItem): QuotationItem {
    const unit = typeof it.unit === 'string' ? it.unit.replace(/\s+-\s+/g, ' x ') : it.unit;
    const description = typeof it.description === 'string'
        ? it.description.replace(/\s*\([^()]*(?:unit|hari|jam|m²|m2)[^()]*\)\s*$/i, '').trim()
        : it.description;
    return { ...it, unit, description };
}

function keyed(items: QuotationItem[]): ItemRow[] {
    return items.map((it, idx) => ({ ...normalizeItem(it), _key: `${it.id ?? "new"}-${idx}-${Math.random()}` }));
}

// Lebar default kolom tabel Rincian Item (px) — dipakai sebagai fallback & tombol reset.
const DEFAULT_ITEM_COL_WIDTHS: Record<string, number> = {
    kategori: 160, event: 130, paket: 90, uraian: 280, qty: 90, satuan: 110, harga: 130, subtotal: 130,
};

/** Textarea yang tingginya otomatis mengikuti isi (teks turun ke baris berikutnya
 *  saat panjang), dipakai di sel tabel item agar Uraian panjang tidak kepotong. */
function AutoGrowTextarea({ value, onChange, placeholder, className }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const resize = () => {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        };
        resize();
        // Recompute juga saat lebar kolom berubah (resize kolom) → teks re-wrap, tinggi ikut.
        const parent = el.parentElement;
        if (!parent) return;
        const ro = new ResizeObserver(resize);
        ro.observe(parent);
        return () => ro.disconnect();
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full resize-none overflow-hidden leading-snug align-top ${className ?? ""}`}
        />
    );
}

/** Handle drag di batas kanan header untuk resize kolom.
 *  Zona grab lebar (12px) yang menstraddle batas kolom, dengan garis pembatas
 *  yang SELALU terlihat (bg-border) dan menyorot primary saat hover/drag. */
function ColResizeHandle({ onPointerDown }: { onPointerDown: (e: ReactPointerEvent) => void }) {
    return (
        <span
            onPointerDown={onPointerDown}
            className="group absolute -right-1.5 top-0 z-20 flex h-full w-3 justify-center cursor-col-resize select-none touch-none"
            title="Geser untuk ubah lebar kolom"
        >
            <span className="h-full w-0.5 bg-muted-foreground/30 group-hover:bg-primary group-hover:w-1 group-active:bg-primary group-active:w-1 transition-all" />
        </span>
    );
}

export default function PenawaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = parseInt(idStr, 10);
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["quotation", id],
        queryFn: () => getQuotation(id),
    });

    const [customerId, setCustomerIdState] = useState<number | null>(null);
    const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [clientName, setClientName] = useState("");
    const [clientCompany, setClientCompany] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientEmail, setClientEmail] = useState("");
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [eventDateStart, setEventDateStart] = useState("");
    const [eventDateEnd, setEventDateEnd] = useState("");
    /** Event tambahan — kalau penawaran cover banyak event dengan tanggal beda. Event utama tetap di field di atas. */
    const [additionalEvents, setAdditionalEvents] = useState<Array<{
        name: string;
        location: string;
        dateStart: string;
        dateEnd: string;
    }>>([]);
    const [validUntil, setValidUntil] = useState("");
    // Jatuh tempo invoice — editable, support single date atau range (start+end)
    const [dueDate, setDueDate] = useState("");
    const [dueDateEnd, setDueDateEnd] = useState("");
    const [dueDateMode, setDueDateMode] = useState<"single" | "range">("single");
    const [dueDateChangeReason, setDueDateChangeReason] = useState("");
    // Track original dueDate untuk detect change (perlu reason)
    const [originalDueDate, setOriginalDueDate] = useState("");
    const [originalDueDateEnd, setOriginalDueDateEnd] = useState("");
    const [docDate, setDocDate] = useState("");
    const [signCity, setSignCity] = useState("");
    const [taxRate, setTaxRate] = useState(0);
    const [taxAmount, setTaxAmount] = useState(0);
    const [taxMode, setTaxMode] = useState<"percent" | "amount">("percent");
    // Pricing mode: false (default) = harga item belum termasuk PPN. true = sudah termasuk.
    const [priceIncludesTax, setPriceIncludesTax] = useState(false);
    const [pphRate, setPphRate] = useState(0);
    const [pphAmount, setPphAmount] = useState(0);
    const [pphMode, setPphMode] = useState<"percent" | "amount">("percent");
    // Auto gross-up: kalau ON, harga items dianggap target net (vendor terima sesuai input setelah PPh)
    const [grossUpPph, setGrossUpPph] = useState(false);
    const [discount, setDiscount] = useState(0);
    const [dpPercent, setDpPercent] = useState(50);
    const [notes, setNotes] = useState("");
    const [brand, setBrand] = useState<Brand | null>(null);
    const [variantCode, setVariantCode] = useState<string | null>(null);
    const [signedByWorkerId, setSignedByWorkerId] = useState<number | null>(null);
    const [itemDisplayMode, setItemDisplayMode] = useState<'detailed' | 'category-summary'>('detailed');
    const [bankAccountIds, setBankAccountIds] = useState<string>("");
    const [items, setItems] = useState<ItemRow[]>([]);
    // Custom text per quotation (override brand defaults)
    const [customOpeningText, setCustomOpeningText] = useState<string>("");
    // Full custom override — kalau diisi, REPLACE default brand (brand setting di-skip total).
    const [customDisclaimer, setCustomDisclaimer] = useState<string>("");
    const [customPaymentTerms, setCustomPaymentTerms] = useState<string>("");
    const [customClosing, setCustomClosing] = useState<string>("");
    // SPK-specific custom text — terpisah dari penawaran, pengaruh hanya saat render SPK
    const [customOpeningSpk, setCustomOpeningSpk] = useState<string>("");
    const [customDisclaimerSpk, setCustomDisclaimerSpk] = useState<string>("");
    /** Penanggung Jawab SPK — override clientName di SPK kalau berbeda dengan penawaran */
    const [spkPicName, setSpkPicName] = useState<string>("");
    const [spkPicPosition, setSpkPicPosition] = useState<string>("");
    const [spkPicPhone, setSpkPicPhone] = useState<string>("");
    /** Batas Pelunasan SPK — tanggal "selambat-lambatnya" pelunasan dibayar (kalau kosong, fallback ke validUntil) */
    const [spkPaymentDeadline, setSpkPaymentDeadline] = useState<string>("");
    /** Penanggung Jawab Invoice — override clientName di Invoice (mis. ke Finance team) */
    const [invoicePicName, setInvoicePicName] = useState<string>("");
    const [invoicePicPosition, setInvoicePicPosition] = useState<string>("");
    const [invoicePicPhone, setInvoicePicPhone] = useState<string>("");
    const [customPaymentTermsSpk, setCustomPaymentTermsSpk] = useState<string>("");
    const [customClosingSpk, setCustomClosingSpk] = useState<string>("");
    // Invoice-specific custom text — terpisah, pengaruh hanya saat render Invoice
    const [customOpeningInvoice, setCustomOpeningInvoice] = useState<string>("");
    const [customDisclaimerInvoice, setCustomDisclaimerInvoice] = useState<string>("");
    const [customPaymentTermsInvoice, setCustomPaymentTermsInvoice] = useState<string>("");
    const [customClosingInvoice, setCustomClosingInvoice] = useState<string>("");
    /** Tab aktif untuk Custom Text Surat: penawaran / spk / invoice. */
    const [customTextTab, setCustomTextTab] = useState<'penawaran' | 'spk' | 'invoice'>('penawaran');
    /**
     * Form mode — kalau "simple", sembunyikan semua advanced fields (multi-event, package,
     * payment schedule custom, specifications, custom subject, custom text override).
     * Tampil cuma yang wajib + sering dipakai. Default: simple untuk user baru.
     * Pakai localStorage supaya pilihan tersimpan.
     */
    const [formMode, setFormMode] = useState<'simple' | 'advanced'>(() => {
        if (typeof window === 'undefined') return 'simple';
        return (localStorage.getItem('pospro:quotation:formMode') as any) || 'simple';
    });
    useEffect(() => {
        try { localStorage.setItem('pospro:quotation:formMode', formMode); } catch { /* ignore */ }
    }, [formMode]);
    /** Collapsible state per section — default collapse semua advanced. */
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

    // ── Lebar kolom tabel Rincian Item — bisa di-resize (drag batas kanan header),
    //    disimpan per browser supaya konsisten antar dokumen.
    const [itemColWidths, setItemColWidths] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return { ...DEFAULT_ITEM_COL_WIDTHS };
        try {
            const s = localStorage.getItem('pospro:quotation:itemColWidths');
            if (s) return { ...DEFAULT_ITEM_COL_WIDTHS, ...JSON.parse(s) };
        } catch { /* ignore */ }
        return { ...DEFAULT_ITEM_COL_WIDTHS };
    });
    const resetItemColWidths = () => {
        setItemColWidths({ ...DEFAULT_ITEM_COL_WIDTHS });
        try { localStorage.removeItem('pospro:quotation:itemColWidths'); } catch { /* ignore */ }
    };
    /** Mulai drag-resize kolom dari handle di header; update live, persist saat lepas. */
    const startColResize = (key: string, e: ReactPointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = itemColWidths[key] ?? 120;
        const onMove = (ev: PointerEvent) => {
            const next = Math.max(56, startW + (ev.clientX - startX));
            setItemColWidths((prev) => ({ ...prev, [key]: next }));
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setItemColWidths((prev) => {
                try { localStorage.setItem('pospro:quotation:itemColWidths', JSON.stringify(prev)); } catch { /* ignore */ }
                return prev;
            });
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };
    // Append/prepend per section — combine dengan brand default
    const [disclaimerPrepend, setDisclaimerPrepend] = useState<string>("");
    const [disclaimerAppend, setDisclaimerAppend] = useState<string>("");
    const [paymentTermsPrepend, setPaymentTermsPrepend] = useState<string>("");
    const [paymentTermsAppend, setPaymentTermsAppend] = useState<string>("");
    const [closingPrepend, setClosingPrepend] = useState<string>("");
    const [closingAppend, setClosingAppend] = useState<string>("");
    const [attachmentCount, setAttachmentCount] = useState<number>(1);
    const [customAttachmentText, setCustomAttachmentText] = useState<string>("");
    const [language, setLanguage] = useState<'id' | 'en'>('id');
    /** Toggle mata uang USD — kalau true, label Rp diganti USD. Marketing input nilai USD manual. */
    const [useUsdCurrency, setUseUsdCurrency] = useState<boolean>(false);
    /** Custom subject (Hal:) — kalau kosong, auto-derive dari variant. */
    const [customSubject, setCustomSubject] = useState<string>("");
    /** Payment schedule custom multi-step. Empty = pakai dpPercent legacy. */
    const [paymentSchedule, setPaymentSchedule] = useState<Array<{ label: string; percent: number }>>([]);
    /**
     * Specifications terpisah dari item (sesuai PDF Nukahiji + Jalakx).
     * `packageGroup` opsional — kalau di-set, spec ini cuma tampil untuk paket itu di mode package.
     */
    const [specifications, setSpecifications] = useState<Array<{
        title: string;
        items: string[];
        packageGroup?: string;
    }>>([]);
    // Rincian Pekerjaan dikelola di halaman khusus /penawaran/[id]/rincian (bukan di sini).
    /** Harga paket — alternatif diskon dengan label "Harga Paket". 0 = pakai total normal. */
    const [packagePrice, setPackagePrice] = useState<number>(0);
    /** Tampilkan grand total di footer? Default true. False untuk mode 'package'. */
    const [showGrandTotal, setShowGrandTotal] = useState<boolean>(true);
    /** Tampilkan baris Diskon di PDF invoice. Default true. */
    const [showDiscount, setShowDiscount] = useState<boolean>(true);
    /** Tampilkan baris PPh di PDF invoice. Default true. */
    const [showPph, setShowPph] = useState<boolean>(true);
    /** Tampilkan baris Harga Paket di PDF invoice. Default true. */
    const [showPackagePrice, setShowPackagePrice] = useState<boolean>(true);

    // Bank accounts dari /settings/bank-accounts
    // Brand settings — untuk button "Salin dari Brand" di custom text section
    const { data: brandSettings } = useQuery({
        queryKey: ["brand-settings", brand],
        queryFn: () => brand ? getBrand(brand) : Promise.resolve(null),
        enabled: !!brand,
    });

    const { data: allBanks = [] } = useQuery<Array<{ id: number; bankName: string; accountNumber: string; accountOwner: string }>>({
        queryKey: ["bank-accounts"],
        queryFn: getBankAccounts,
    });

    const { data: variantConfigs = [] } = useQuery({
        queryKey: ["quotation-variants", true],
        queryFn: () => listQuotationVariants(true),
    });

    // Workers untuk dropdown penandatangan.
    // Untuk QUOTATION → MARKETING/SALES (yang handle penjualan)
    // Untuk INVOICE → ADMIN + MARKETING/SALES (admin biasanya yang TTD invoice/finance)
    const isInvoiceMode = data?.type === "INVOICE";
    const { data: marketers = [] } = useQuery({
        queryKey: ["workers", "signers", isInvoiceMode ? "invoice" : "quotation"],
        queryFn: () => isInvoiceMode
            ? getWorkers(false, { positions: ["ADMIN", ...MARKETER_POSITIONS] })
            : getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
        enabled: !!data,
    });

    // Preview state — modal dengan PDF iframe inline
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    /** Type dokumen yang sedang di-preview: penawaran/invoice (pdf) atau SPK. */
    const [previewType, setPreviewType] = useState<"pdf" | "spk-pdf" | "rincian-pekerjaan-pdf">("pdf");

    // Calculator state — modal multiplier per row
    const [calcOpenKey, setCalcOpenKey] = useState<string | null>(null);

    const applyCalc = (key: string, r: QuotationCalcResult) => {
        setItems((prev) => prev.map((it) => it._key === key ? {
            ...it,
            description: r.descriptionText,
            unit: r.unit,
            quantity: r.quantity,
            unitMultiplier: r.unitMultiplier,
            price: r.pricePerUnit,
        } : it));
        setCalcOpenKey(null);
    };

    useEffect(() => {
        if (!data) return;
        setCustomerIdState(data.customerId ?? null);
        // Hydrate linkedCustomer dari data.customer kalau backend include relation
        if ((data as any).customer) {
            setLinkedCustomer((data as any).customer as Customer);
        } else {
            setLinkedCustomer(null);
        }
        setClientName(data.clientName ?? "");
        setClientCompany(data.clientCompany ?? "");
        setClientAddress(data.clientAddress ?? "");
        setClientPhone(data.clientPhone ?? "");
        setClientEmail(data.clientEmail ?? "");
        setProjectName(data.projectName ?? "");
        setEventLocation(data.eventLocation ?? "");
        setEventDateStart(data.eventDateStart ? data.eventDateStart.slice(0, 10) : "");
        setEventDateEnd(data.eventDateEnd ? data.eventDateEnd.slice(0, 10) : "");
        setAdditionalEvents(
            Array.isArray(data.additionalEvents)
                ? data.additionalEvents.map((e) => ({
                      name: e?.name ?? "",
                      location: e?.location ?? "",
                      dateStart: e?.dateStart ? e.dateStart.slice(0, 10) : "",
                      dateEnd: e?.dateEnd ? e.dateEnd.slice(0, 10) : "",
                  }))
                : [],
        );
        setValidUntil(data.validUntil ? data.validUntil.slice(0, 10) : "");
        // Hydrate due date — auto-detect mode dari ada/tidaknya dueDateEnd
        const dd = (data as any).dueDate ? (data as any).dueDate.slice(0, 10) : "";
        const dde = (data as any).dueDateEnd ? (data as any).dueDateEnd.slice(0, 10) : "";
        setDueDate(dd);
        setDueDateEnd(dde);
        setDueDateMode(dde ? "range" : "single");
        setOriginalDueDate(dd);
        setOriginalDueDateEnd(dde);
        setDueDateChangeReason("");
        setDocDate(data.date ? data.date.slice(0, 10) : "");
        setSignCity(data.signCity ?? "");
        const loadedTaxRate = Number(data.taxRate ?? 0);
        const loadedTaxAmount = Number(data.taxAmount ?? 0);
        setTaxRate(loadedTaxRate);
        setTaxAmount(loadedTaxAmount);
        // Auto-detect mode: kalau taxRate=0 tapi taxAmount>0 → mode "amount"
        setTaxMode(loadedTaxRate === 0 && loadedTaxAmount > 0 ? "amount" : "percent");
        setPriceIncludesTax(!!(data as any).priceIncludesTax);
        const loadedPphRate = Number((data as any).pphRate ?? 0);
        const loadedPphAmount = Number((data as any).pphAmount ?? 0);
        setPphRate(loadedPphRate);
        setPphAmount(loadedPphAmount);
        // Auto-detect mode: kalau pphRate=0 tapi pphAmount>0 → mode "amount" (admin input Rp langsung)
        setPphMode(loadedPphRate === 0 && loadedPphAmount > 0 ? "amount" : "percent");
        setGrossUpPph(!!(data as any).grossUpPph);
        setDiscount(Number(data.discount ?? 0));
        setDpPercent(Number(data.dpPercent ?? 50));
        // DP Sudah Dibayar — restore mode & nominal custom dari DB
        setDpPaidMode((data as any).dpPaidMode === 'custom' ? 'custom' : 'auto');
        setDpPaidCustom((data as any).dpPaidCustom != null ? String(Number((data as any).dpPaidCustom)) : "");
        setNotes(data.notes ?? "");
        setBrand(data.brand);
        setVariantCode(data.variantCode ?? null);
        setSignedByWorkerId(data.signedByWorkerId ?? null);
        setItemDisplayMode(
            data.itemDisplayMode === 'category-summary' ? 'category-summary' : 'detailed'
        );
        setBankAccountIds(data.bankAccountIds ?? "");
        setCustomOpeningText((data as any).customOpeningText ?? "");
        setCustomDisclaimer((data as any).customDisclaimer ?? "");
        setCustomPaymentTerms((data as any).customPaymentTerms ?? "");
        setCustomClosing((data as any).customClosing ?? "");
        setCustomOpeningSpk((data as any).customOpeningSpk ?? "");
        setCustomDisclaimerSpk((data as any).customDisclaimerSpk ?? "");
        setSpkPicName((data as any).spkPicName ?? "");
        setSpkPicPosition((data as any).spkPicPosition ?? "");
        setSpkPicPhone((data as any).spkPicPhone ?? "");
        setSpkPaymentDeadline((data as any).spkPaymentDeadline ? (data as any).spkPaymentDeadline.slice(0, 10) : "");
        setInvoicePicName((data as any).invoicePicName ?? "");
        setInvoicePicPosition((data as any).invoicePicPosition ?? "");
        setInvoicePicPhone((data as any).invoicePicPhone ?? "");
        setCustomPaymentTermsSpk((data as any).customPaymentTermsSpk ?? "");
        setCustomClosingSpk((data as any).customClosingSpk ?? "");
        setCustomOpeningInvoice((data as any).customOpeningInvoice ?? "");
        setCustomDisclaimerInvoice((data as any).customDisclaimerInvoice ?? "");
        setCustomPaymentTermsInvoice((data as any).customPaymentTermsInvoice ?? "");
        setCustomClosingInvoice((data as any).customClosingInvoice ?? "");
        setDisclaimerPrepend((data as any).disclaimerPrepend ?? "");
        setDisclaimerAppend((data as any).disclaimerAppend ?? "");
        setPaymentTermsPrepend((data as any).paymentTermsPrepend ?? "");
        setPaymentTermsAppend((data as any).paymentTermsAppend ?? "");
        setClosingPrepend((data as any).closingPrepend ?? "");
        setClosingAppend((data as any).closingAppend ?? "");
        setAttachmentCount(Number((data as any).attachmentCount) || 1);
        setCustomAttachmentText((data as any).customAttachmentText ?? "");
        setLanguage((data as any).language === 'en' ? 'en' : 'id');
        setUseUsdCurrency(Boolean((data as any).useUsdCurrency));
        setCustomSubject((data as any).customSubject ?? "");
        setPaymentSchedule(
            Array.isArray((data as any).paymentSchedule)
                ? (data as any).paymentSchedule.map((s: any) => ({
                      label: String(s?.label ?? ""),
                      percent: Number(s?.percent ?? 0),
                  }))
                : [],
        );
        setSpecifications(
            Array.isArray((data as any).specifications)
                ? (data as any).specifications.map((g: any) => ({
                      title: String(g?.title ?? ""),
                      items: Array.isArray(g?.items) ? g.items.map((s: any) => String(s ?? "")) : [],
                      packageGroup: String(g?.packageGroup ?? ""),
                  }))
                : [],
        );
        setPackagePrice(Number((data as any).packagePrice) || 0);
        setShowGrandTotal((data as any).showGrandTotal !== false);
        setShowDiscount((data as any).showDiscount !== false);
        setShowPph((data as any).showPph !== false);
        setShowPackagePrice((data as any).showPackagePrice !== false);
        setItems(keyed(data.items ?? []));
    }, [data]);

    /**
     * Auto-prefill custom text dari brand settings saat field masih kosong.
     * User bisa edit/hapus bagian tertentu tanpa nulis ulang dari nol.
     * Pakai ref supaya tidak re-fill setelah user sengaja kosongin.
     * Saat save, kalau isi sama persis dengan default brand → simpan null (tetap pakai brand default).
     */
    const prefilledRef = useRef<{ opening: boolean; disclaimer: boolean; payment: boolean; closing: boolean }>({
        opening: false, disclaimer: false, payment: false, closing: false,
    });
    useEffect(() => {
        if (!brandSettings) return;
        const useEn = language === 'en';
        const openingDef = useEn ? (brandSettings.openingTemplateEn || brandSettings.openingTemplate) : brandSettings.openingTemplate;
        const disclaimerDef = useEn ? (brandSettings.quotationDisclaimerEn || brandSettings.quotationDisclaimer) : brandSettings.quotationDisclaimer;
        const paymentDef = useEn ? (brandSettings.quotationPaymentTermsEn || brandSettings.quotationPaymentTerms) : brandSettings.quotationPaymentTerms;
        const closingDef = useEn ? (brandSettings.quotationClosingEn || brandSettings.quotationClosing) : brandSettings.quotationClosing;

        if (!prefilledRef.current.opening && !customOpeningText && openingDef) {
            setCustomOpeningText(openingDef);
            prefilledRef.current.opening = true;
        }
        if (!prefilledRef.current.disclaimer && !customDisclaimer && disclaimerDef) {
            setCustomDisclaimer(disclaimerDef);
            prefilledRef.current.disclaimer = true;
        }
        if (!prefilledRef.current.payment && !customPaymentTerms && paymentDef) {
            setCustomPaymentTerms(paymentDef);
            prefilledRef.current.payment = true;
        }
        if (!prefilledRef.current.closing && !customClosing && closingDef) {
            setCustomClosing(closingDef);
            prefilledRef.current.closing = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brandSettings, language]);

    /**
     * Pesan error verbose — dipakai oleh semua mutation di halaman ini.
     * Menampilkan status code + URL + response body supaya gampang di-diagnose saat user lapor bug.
     * Full error object juga di-log ke console.error untuk inspeksi lebih dalam.
     */
    const showErr = (label: string) => (err: any) => {
        // Selalu log full error ke console — termasuk stack trace, request config, response headers.
        console.error(`[${label}]`, err);

        const status = err?.response?.status;
        const statusText = err?.response?.statusText;
        const method = err?.config?.method?.toUpperCase();
        const url = err?.config?.url;
        const respData = err?.response?.data;
        // Coba ambil pesan dari berbagai bentuk response body (NestJS, plain string, dll).
        const bodyMessage = typeof respData === 'string'
            ? respData
            : Array.isArray(respData?.message)
                ? respData.message.join('; ')
                : respData?.message || respData?.error;
        const baseMsg = bodyMessage || err?.message || "gagal";

        const lines: string[] = [`❌ ${label}`, '', baseMsg];
        if (status) lines.push('', `Status: ${status}${statusText ? ' ' + statusText : ''}`);
        if (method && url) lines.push(`URL: ${method} ${url}`);
        // Hint untuk kasus paling sering (network / timeout / payload)
        if (!err?.response && err?.message?.toLowerCase().includes('network')) {
            lines.push('', 'Hint: jaringan terputus atau server sedang restart. Coba refresh & save ulang.');
        } else if (status === 413) {
            lines.push('', 'Hint: payload terlalu besar (>100kb). Coba hapus beberapa item atau perpendek catatan.');
        } else if (status === 504 || status === 502) {
            lines.push('', 'Hint: server timeout. Data mungkin sudah ter-save — refresh untuk konfirmasi sebelum save ulang.');
        }
        lines.push('', 'Lihat console (F12) untuk detail lengkap.');
        alert(lines.join('\n'));
    };

    const saveMut = useMutation({
        mutationFn: (payload: any) => updateQuotation(id, payload),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            // Refresh daftar /penawaran supaya kolom Total (yang dipotong DP) ikut update
            qc.invalidateQueries({ queryKey: ["quotations"] });
            qc.invalidateQueries({ queryKey: ["quotation-invoices"] });
            // Invalidate customer analytics — supaya histori penawaran muncul di /customers/[id]
            // Invalidate untuk customer baru (sekarang) dan customer lama (sebelum di-unlink/ganti)
            if (res?.customerId) {
                qc.invalidateQueries({ queryKey: ["customer-analytics", res.customerId] });
                qc.invalidateQueries({ queryKey: ["customer", res.customerId] });
            }
            if (data?.customerId && data.customerId !== res?.customerId) {
                qc.invalidateQueries({ queryKey: ["customer-analytics", data.customerId] });
                qc.invalidateQueries({ queryKey: ["customer", data.customerId] });
            }
            // Generic invalidation untuk semua customers-with-stats list
            qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
        },
        onError: showErr("Gagal simpan"),
    });
    const assignMut = useMutation({
        mutationFn: (opts: { mode?: 'auto' | 'manual'; customNumber?: string } = {}) =>
            assignQuotationNumber(id, opts),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            setShowAssignModal(false);
            alert(`Nomor resmi: ${q.invoiceNumber}`);
        },
        onError: showErr("Gagal assign nomor"),
    });
    /** Edit nomor (Penawaran atau Invoice) — koreksi typo / ganti format setelah di-assign. */
    const editNumberMut = useMutation({
        mutationFn: (newNumber: string) => editQuotationNumber(id, newNumber),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotation", id] }),
        onError: (err: any) => alert(`Gagal edit nomor: ${err?.response?.data?.message || err?.message}`),
    });
    const handleEditCurrentNumber = () => {
        if (!data) return;
        const docLabel = data.type === 'INVOICE' ? 'invoice' : 'penawaran';
        const exampleFormat = data.type === 'INVOICE' ? '1234/Xp/Inv/V/26' : '5260/Xp.Pnwr/V/26';
        const current = data.invoiceNumber;
        const next = window.prompt(
            `Edit nomor ${docLabel}:\n\nFormat bebas (mis. "${exampleFormat}").\nKosongkan untuk batal.`,
            current,
        );
        if (next === null) return;
        const trimmed = next.trim();
        if (!trimmed) return alert("Nomor tidak boleh kosong.");
        if (trimmed === current) return;
        if (!confirm(`Ubah nomor ${docLabel}:\n\nDari: ${current}\nKe:   ${trimmed}\n\nLanjutkan?`)) return;
        editNumberMut.mutate(trimmed);
    };
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    // List invoices "saudara" untuk hitung DP terbayar.
    // - Kalau dokumen ini PENAWARAN (induk) → ambil anak-anaknya (pakai id sendiri).
    // - Kalau dokumen ini INVOICE (anak) → ambil saudara via parentQuotationId,
    //   supaya invoice DP yang lunas ke-detect saat menghitung "DP Sudah Dibayar" auto.
    const dpSourceId = data?.type === "INVOICE" ? (data.parentQuotationId ?? id) : id;
    const { data: childInvoices = [] } = useQuery({
        queryKey: ["quotation-invoices", dpSourceId],
        queryFn: () => listInvoicesByQuotation(dpSourceId),
        enabled: !!data && !data?.invoiceNumber.startsWith("DRAFT-"),
    });

    const generateInvoiceMut = useMutation({
        mutationFn: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string; invoiceDate?: string }) =>
            generateInvoiceFromQuotation(id, input),
        onSuccess: (inv) => {
            qc.invalidateQueries({ queryKey: ["quotation-invoices", id] });
            setShowInvoiceModal(false);
            alert(`Invoice ${inv.invoiceNumber} dibuat`);
            window.location.href = `/penawaran/${inv.id}`;
        },
        onError: showErr("Gagal generate invoice"),
    });
    const reviseMut = useMutation({
        mutationFn: () => reviseQuotation(id),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
        onError: showErr("Gagal buat revisi"),
    });

    const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price || 0), 0);
    const grossAfterDiscount = subtotal - (discount || 0);

    // ─── DP Terbayar (info & customable) ─────────────────────────────────────
    // Auto: sum paidAmount dari invoice DP (saudara) yg sudah PAID/PARTIALLY_PAID.
    // Custom: user override manual (mis. DP dibayar di luar sistem / penyesuaian).
    // Mode & nominal custom DI-SAVE ke backend (dpPaidMode/dpPaidCustom).
    const autoDpPaid = useMemo(() => {
        return childInvoices
            .filter((inv) => inv.id !== id && inv.invoicePart === 'DP' && (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID'))
            .reduce((sum, inv) => sum + Number(inv.paidAmount ?? 0), 0);
    }, [childInvoices, id]);
    const dpPaidInvoiceCount = useMemo(() => {
        return childInvoices.filter((inv) => inv.id !== id && inv.invoicePart === 'DP' && (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID')).length;
    }, [childInvoices, id]);
    const [dpPaidMode, setDpPaidMode] = useState<'auto' | 'custom'>('auto');
    const [dpPaidCustom, setDpPaidCustom] = useState<string>("");
    const effectiveDpPaid = dpPaidMode === 'auto' ? autoDpPaid : (parseFloat(dpPaidCustom) || 0);

    // Gross-up factor — kalau ON dan PPh > 0, scale DPP supaya setelah PPh, net = target
    const effectivePphRateForGrossUp = pphMode === "percent" ? (pphRate || 0) : 0;
    const grossUpFactor = (grossUpPph && effectivePphRateForGrossUp > 0 && effectivePphRateForGrossUp < 100)
        ? 100 / (100 - effectivePphRateForGrossUp)
        : 1;

    // DPP & PPN tergantung mode pricing:
    //  Exclusive (default): DPP = (subtotal - discount) × grossUpFactor
    //  Inclusive: DPP = gross / (1 + rate%), PPN = gross - DPP (back-calc)
    let dpp: number;
    let computedTaxAmount: number;
    if (priceIncludesTax && (taxRate || 0) > 0 && taxMode === "percent") {
        const grossUpped = grossAfterDiscount * grossUpFactor;
        dpp = grossUpped / (1 + (taxRate || 0) / 100);
        computedTaxAmount = grossUpped - dpp;
    } else {
        dpp = grossAfterDiscount * grossUpFactor;
        computedTaxAmount = taxMode === "amount"
            ? (taxAmount || 0)
            : (dpp * (taxRate || 0)) / 100;
    }
    const effectiveTaxRate = taxMode === "amount"
        ? (dpp > 0 ? (computedTaxAmount / dpp) * 100 : 0)
        : (taxRate || 0);
    // PPh: mode percent → compute dari rate; mode amount → pakai nominal langsung
    const computedPphAmount = pphMode === "amount"
        ? (pphAmount || 0)
        : (dpp * (pphRate || 0)) / 100;
    // Effective PPh rate untuk display (kalau mode amount, hitung back-calculated %)
    const effectivePphRate = pphMode === "amount"
        ? (dpp > 0 ? (computedPphAmount / dpp) * 100 : 0)
        : (pphRate || 0);
    // Total = harga yang DITAGIH ke klien (DPP + PPN, sebelum potong PPh).
    // PPh = info potongan yang dilakukan klien saat bayar — TIDAK mengurangi total/DP/Pelunasan.
    //  Exclusive: DPP + PPN
    //  Inclusive: gross (PPN sudah didalam gross)
    const total = priceIncludesTax
        ? grossAfterDiscount
        : dpp + computedTaxAmount;
    const netReceived = total - computedPphAmount; // info: jumlah diterima setelah klien potong PPh
    const dpAmount = (total * dpPercent) / 100;

    const addItem = () =>
        setItems([
            ...items,
            { _key: `new-${Date.now()}`, description: "", unit: "", quantity: 1, price: 0 },
        ]);
    const updateItem = (k: string, patch: Partial<QuotationItem>) =>
        setItems(items.map((it) => (it._key === k ? { ...it, ...patch } : it)));
    const removeItem = (k: string) => setItems(items.filter((it) => it._key !== k));

    /** dnd-kit sensor — drag setelah pointer bergeser 6px supaya gak konflik dengan klik input. */
    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    function handleDragEnd(e: DragEndEvent) {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIdx = items.findIndex((it) => it._key === String(active.id));
        const newIdx = items.findIndex((it) => it._key === String(over.id));
        if (oldIdx < 0 || newIdx < 0) return;
        setItems(arrayMove(items, oldIdx, newIdx));
    }

    /** Duplicate item — copy semua field, generate _key baru, sisip setelah item asal. */
    const duplicateItem = (k: string) => {
        const idx = items.findIndex((it) => it._key === k);
        if (idx < 0) return;
        const src = items[idx];
        const copy: ItemRow = {
            ...src,
            id: undefined,  // server-side baru, gak inherit id lama
            _key: `dup-${Date.now()}-${Math.random()}`,
        };
        const next = [...items];
        next.splice(idx + 1, 0, copy);
        setItems(next);
    };

    const handleSave = () => {
        try {
            if (signedByWorkerId) localStorage.setItem("pospro:quotation:lastSignedBy", String(signedByWorkerId));
        } catch { /* ignore */ }
        saveMut.mutate({
            customerId,
            clientName,
            clientCompany,
            clientAddress,
            clientPhone,
            clientEmail,
            projectName,
            eventLocation,
            // Pakai null (bukan undefined) supaya backend tahu user mau CLEAR field.
            // `undefined` = "tidak diubah" → tanggal lama tetap (bug).
            // `null` = "clear ke kosong" → tanggal benar-benar di-reset.
            eventDateStart: eventDateStart || null,
            eventDateEnd: eventDateEnd || null,
            additionalEvents: additionalEvents
                .map((e) => ({
                    name: e.name.trim() || null,
                    location: e.location.trim() || null,
                    dateStart: e.dateStart || null,
                    dateEnd: e.dateEnd || null,
                }))
                .filter((e) => e.name || e.location || e.dateStart || e.dateEnd),
            validUntil: validUntil || null,
            // Jatuh tempo — kalau range mode, kirim keduanya. Kalau single, dueDateEnd=null
            ...(data?.type === "INVOICE" ? {
                dueDate: dueDate || null,
                dueDateEnd: dueDateMode === "range" && dueDateEnd ? dueDateEnd : null,
                // Sertakan reason kalau dueDate berubah dari original
                dueDateChangeReason: (
                    dueDate !== originalDueDate ||
                    (dueDateMode === "range" ? dueDateEnd : "") !== originalDueDateEnd
                ) ? (dueDateChangeReason.trim() || null) : null,
            } : {}),
            date: docDate || undefined,
            signCity: signCity.trim() || null,
            variantCode: variantCode || null,
            signedByWorkerId: signedByWorkerId ?? null,
            itemDisplayMode,
            bankAccountIds: bankAccountIds || undefined,
            // PPN: kirim sesuai mode + pricing mode (inclusive/exclusive)
            ...(taxMode === "amount"
                ? { taxRate: 0, taxAmount: taxAmount || 0 }
                : { taxRate, taxAmount: 0 }),
            priceIncludesTax,
            // PPh: kirim sesuai mode. Backend support kedua input.
            ...(pphMode === "amount"
                ? { pphRate: 0, pphAmount: pphAmount || 0 }
                : { pphRate, pphAmount: 0 }),
            grossUpPph,
            discount,
            dpPercent,
            // DP Sudah Dibayar — simpan mode + nominal custom (custom dikurangkan dari grand total)
            dpPaidMode,
            dpPaidCustom: dpPaidMode === 'custom' ? (parseFloat(dpPaidCustom) || 0) : null,
            notes,
            // Save apa adanya: nilai textarea = nilai tersimpan.
            // Kalau user mau revert ke brand default, klik tombol "✕ Reset" di tiap PrependAppendField
            // (clear textarea → save null → render fallback ke brand default + prepend/append).
            // CATATAN: dulu ada "smart save" yang auto-convert ke null kalau text match brand default,
            // tapi itu bikin bug: user edit kecil (whitespace) → match def → save null → PDF tidak update.
            // Sekarang predictable: WYSIWYG (what you see is what you save).
            customOpeningText: customOpeningText.trim() || null,
            customDisclaimer: customDisclaimer.trim() || null,
            customPaymentTerms: customPaymentTerms.trim() || null,
            customClosing: customClosing.trim() || null,
            disclaimerPrepend: disclaimerPrepend.trim() || null,
            disclaimerAppend: disclaimerAppend.trim() || null,
            paymentTermsPrepend: paymentTermsPrepend.trim() || null,
            paymentTermsAppend: paymentTermsAppend.trim() || null,
            closingPrepend: closingPrepend.trim() || null,
            closingAppend: closingAppend.trim() || null,
            // SPK-specific custom text
            customOpeningSpk: customOpeningSpk.trim() || null,
            customDisclaimerSpk: customDisclaimerSpk.trim() || null,
            spkPicName: spkPicName.trim() || null,
            spkPicPosition: spkPicPosition.trim() || null,
            spkPicPhone: spkPicPhone.trim() || null,
            spkPaymentDeadline: spkPaymentDeadline || null,
            invoicePicName: invoicePicName.trim() || null,
            invoicePicPosition: invoicePicPosition.trim() || null,
            invoicePicPhone: invoicePicPhone.trim() || null,
            customPaymentTermsSpk: customPaymentTermsSpk.trim() || null,
            customClosingSpk: customClosingSpk.trim() || null,
            // Invoice-specific custom text
            customOpeningInvoice: customOpeningInvoice.trim() || null,
            customDisclaimerInvoice: customDisclaimerInvoice.trim() || null,
            customPaymentTermsInvoice: customPaymentTermsInvoice.trim() || null,
            customClosingInvoice: customClosingInvoice.trim() || null,
            attachmentCount: attachmentCount && attachmentCount > 0 ? Math.floor(attachmentCount) : null,
            customAttachmentText: customAttachmentText.trim() || null,
            language,
            useUsdCurrency,
            // Field baru — multi-event/package support
            customSubject: customSubject.trim() || null,
            paymentSchedule: paymentSchedule
                .filter((s) => s.label.trim() && s.percent > 0)
                .map((s) => ({ label: s.label.trim(), percent: Number(s.percent) })),
            specifications: specifications
                .map((g) => ({
                    title: g.title.trim() || null,
                    items: g.items.map((s) => s.trim()).filter(Boolean),
                    packageGroup: (g.packageGroup ?? '').trim() || null,
                }))
                .filter((g) => g.items.length > 0),
            // rincianPekerjaanItems + tanggal pasang/bongkar dikelola di halaman /penawaran/[id]/rincian
            packagePrice: packagePrice > 0 ? packagePrice : null,
            showGrandTotal,
            showDiscount,
            showPph,
            showPackagePrice,
            brand,
            items: items.map((it, idx) => ({
                description: it.description,
                unit: it.unit || undefined,
                quantity: it.quantity,
                unitMultiplier: (it as any).unitMultiplier ?? null,
                price: it.price,
                orderIndex: idx,
                productVariantId: it.productVariantId ?? null,
                categoryName: it.categoryName ?? null,
                eventIndex: typeof (it as any).eventIndex === 'number' ? (it as any).eventIndex : null,
                packageGroup: ((it as any).packageGroup ?? '').toString().trim() || null,
            })),
        });
    };

    const handlePreview = async (type: "pdf" | "spk-pdf" | "rincian-pekerjaan-pdf" = "pdf") => {
        setPreviewType(type);
        setPreviewLoading(true);
        setPreviewOpen(true);
        try {
            const { blob } = await downloadQuotationExport(id, type, effectiveDpPaid);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (err: any) {
            alert("Gagal preview: " + (err?.response?.data?.message || err.message));
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    /** Switch antara preview Penawaran/Invoice dan SPK dalam modal yang sama. */
    const switchPreviewType = async (type: "pdf" | "spk-pdf" | "rincian-pekerjaan-pdf") => {
        if (type === previewType) return;
        setPreviewType(type);
        setPreviewLoading(true);
        try {
            const { blob } = await downloadQuotationExport(id, type, effectiveDpPaid);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal switch preview: " + (err?.response?.data?.message || err.message));
        } finally {
            setPreviewLoading(false);
        }
    };

    /**
     * Toggle item display mode dari dalam preview modal.
     * Save mode ke DB → re-fetch PDF → user langsung lihat hasilnya.
     */
    const togglePreviewMode = async (newMode: 'detailed' | 'category-summary') => {
        setItemDisplayMode(newMode);
        setPreviewLoading(true);
        try {
            // Save mode saja (tidak save semua field) lewat updateQuotation partial
            await updateQuotation(id, { itemDisplayMode: newMode });
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            // Re-fetch PDF (mengikuti type yang sedang di-preview)
            const { blob } = await downloadQuotationExport(id, previewType, effectiveDpPaid);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal switch mode: " + (err?.response?.data?.message || err.message));
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setPreviewOpen(false);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExport = async (format: "pdf" | "docx" | "spk-pdf" | "rincian-pekerjaan-pdf") => {
        try {
            const { blob, filename } = await downloadQuotationExport(id, format, effectiveDpPaid);
            const url = URL.createObjectURL(blob);
            // Pakai <a download> untuk PDF & DOCX supaya nama file dari server (Content-Disposition)
            // dipakai Windows/Save As dialog. window.open() bikin browser pakai blob UUID jadi nama.
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            if (format === "pdf" || format === "spk-pdf" || format === "rincian-pekerjaan-pdf") a.target = "_blank"; // PDF buka di tab baru
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err: any) {
            alert("Gagal export: " + (err?.response?.data?.message || err.message));
        }
    };

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const isDraft = data.invoiceNumber.startsWith("DRAFT-");

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header — title kiri, action toolbar kanan (rapih, grouped) */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div className="min-w-0">
                    <Link href="/penawaran" className="text-sm text-primary flex items-center gap-1 mb-2 hover:underline">
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap group">
                        <span>{data.type === "INVOICE" ? "Invoice" : "Penawaran"}</span>
                        <span className="font-mono text-xl text-foreground nums">{data.invoiceNumber}</span>
                        {/* Tombol edit nomor — muncul untuk dokumen yang sudah di-assign (bukan DRAFT) */}
                        {!data.invoiceNumber.startsWith("DRAFT-") && (
                            <button
                                type="button"
                                onClick={handleEditCurrentNumber}
                                disabled={editNumberMut.isPending}
                                title={`Edit nomor ${data.type === 'INVOICE' ? 'invoice' : 'penawaran'}`}
                                className="p-1.5 rounded text-muted-foreground hover:text-info hover:bg-info/10 transition disabled:opacity-50"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
                        {data.revisionNumber > 0 && (
                            <span className="text-xs bg-destructive/12 text-destructive px-2 py-0.5 rounded font-bold">Rev. {data.revisionNumber}</span>
                        )}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {(() => {
                            const cfg = variantCode ? variantConfigs.find((v) => v.code === variantCode) : null;
                            return cfg?.label
                                || (data.quotationVariant === "PENGADAAN_BOOTH" ? "Pengadaan Booth Special Design" : "Sewa Perlengkapan Event");
                        })()}
                    </p>

                    {/* Mode Toggle — kompak inline */}
                    <div className="mt-2 inline-flex items-center gap-1 p-0.5 bg-muted rounded-md border border-border text-xs">
                        <button
                            type="button"
                            onClick={() => setFormMode('simple')}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded transition ${formMode === 'simple'
                                ? 'bg-card text-success shadow-sm font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                            title="Mode mudah: cuma field penting"
                        >
                            <Minimize2 className="w-3 h-3" /> Sederhana
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormMode('advanced')}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded transition ${formMode === 'advanced'
                                ? 'bg-card text-primary shadow-sm font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                            title="Mode lengkap: semua fitur advanced"
                        >
                            <SlidersHorizontal className="w-3 h-3" /> Lengkap
                        </button>
                    </div>
                </div>

                {/* Toolbar: 2 grup (Actions + Export) dengan separator */}
                <div className="flex items-stretch gap-1.5 flex-wrap">
                    {/* === Group 1: Actions (Assign / Revisi / Invoice) === */}
                    {isDraft && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            disabled={assignMut.isPending}
                            title="Assign nomor resmi penawaran"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-success hover:bg-success/90 text-white rounded-md text-sm font-medium shadow-sm"
                        >
                            <Hash className="w-4 h-4" /> Assign Nomor
                        </button>
                    )}
                    {!isDraft && (
                        <button
                            onClick={() => reviseMut.mutate()}
                            disabled={reviseMut.isPending}
                            title="Buat revisi baru"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-warning hover:bg-warning/90 text-warning-foreground rounded-md text-sm font-medium shadow-sm"
                        >
                            <GitBranch className="w-4 h-4" /> Revisi
                        </button>
                    )}
                    {!isDraft && data.type !== "INVOICE" && (
                        <button
                            onClick={() => setShowInvoiceModal(true)}
                            title="Generate Invoice DP / Pelunasan"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium shadow-sm"
                        >
                            <Receipt className="w-4 h-4" /> Invoice
                        </button>
                    )}

                    {/* Vertical divider */}
                    <div className="w-px bg-muted mx-1" />

                    {/* === Group 2: Preview & Export — kompak, ikon-first === */}
                    <div className="inline-flex rounded-md border border-border overflow-hidden shadow-sm">
                        <button
                            onClick={() => handlePreview("pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium border-r border-primary"
                            title={data?.type === 'INVOICE' ? "Preview Invoice" : "Preview Penawaran"}
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden md:inline">Preview</span>
                        </button>
                        <button
                            onClick={() => handleExport("pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-destructive hover:bg-destructive/90 text-white text-sm font-medium border-r border-destructive"
                            title="Download PDF"
                        >
                            <FileDown className="w-4 h-4" />
                            <span className="hidden md:inline">PDF</span>
                        </button>
                        <button
                            onClick={() => handleExport("docx")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-info hover:bg-info/90 text-white text-sm font-medium"
                            title="Download DOCX"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden md:inline">DOCX</span>
                        </button>
                    </div>

                    {/* SPK group — terpisah, warna emerald biar jelas */}
                    <div className="inline-flex rounded-md border border-success/30 overflow-hidden shadow-sm">
                        <button
                            onClick={() => handlePreview("spk-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-success/10 hover:bg-success/20 text-success text-sm font-medium border-r border-success/30"
                            title="Preview SPK"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden md:inline">Preview</span>
                        </button>
                        <button
                            onClick={() => handleExport("spk-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-success hover:bg-success/90 text-white text-sm font-medium"
                            title="Download SPK"
                        >
                            <ScrollText className="w-4 h-4" />
                            <span className="hidden md:inline">SPK</span>
                        </button>
                    </div>

                    {/* Rincian Pekerjaan group — terpisah, warna amber/warning */}
                    <div className="inline-flex rounded-md border border-warning/30 overflow-hidden shadow-sm">
                        <button
                            onClick={() => handlePreview("rincian-pekerjaan-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-warning/10 hover:bg-warning/20 text-warning text-sm font-medium border-r border-warning/30"
                            title="Preview Rincian Pekerjaan"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden md:inline">Preview</span>
                        </button>
                        <button
                            onClick={() => handleExport("rincian-pekerjaan-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-warning hover:bg-warning/90 text-white text-sm font-medium"
                            title="Download Rincian Pekerjaan"
                        >
                            <List className="w-4 h-4" />
                            <span className="hidden md:inline">Rincian</span>
                        </button>
                    </div>
                </div>
            </div>

            {data.parent && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-md text-sm">
                    Dokumen ini revisi dari{" "}
                    <Link href={`/penawaran/${data.parent.id}`} className="text-info hover:underline font-medium">
                        {data.parent.invoiceNumber}
                    </Link>
                </div>
            )}

            {/* Banner kalau dokumen ini adalah INVOICE (di-generate dari quotation) */}
            {data.type === "INVOICE" && (
                <div className="mb-4 p-3 bg-primary/10 border-2 border-primary/30 rounded-md text-sm flex items-center justify-between">
                    <div>
                        <span className="font-bold text-primary inline-flex items-center gap-1.5"><Receipt className="w-4 h-4" /> Ini Invoice {data.invoicePart}</span>
                        {data.parentQuotationId && (
                            <> · dari penawaran <Link href={`/penawaran/${data.parentQuotationId}`} className="text-primary hover:underline font-medium">#{data.parentQuotationId}</Link></>
                        )}
                    </div>
                    {data.amountToPay && (
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-primary font-bold">Jumlah Tagihan</div>
                            {/* Live: kalau ada DP Sudah Dibayar, tagihan = Total − DP (= Grand Total).
                                Tanpa DP, pakai amountToPay (porsi DP/Pelunasan/Full) apa adanya. */}
                            <div className="font-bold text-lg text-primary font-mono nums">
                                {rp(effectiveDpPaid > 0 ? Math.max(0, total - effectiveDpPaid) : Number(data.amountToPay))}
                            </div>
                            {effectiveDpPaid > 0 && (
                                <div className="text-[10px] text-warning font-normal">
                                    DP dibayar: -{rp(effectiveDpPaid)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* List child invoices (kalau quotation ini sudah pernah di-generate invoice) */}
            {data.type !== "INVOICE" && childInvoices.length > 0 && (
                <div className="mb-4 rounded-md border-2 border-primary/30 bg-primary/10 p-3">
                    <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4" /> Invoice yang Sudah Dibuat ({childInvoices.length})
                    </div>
                    <div className="space-y-1.5">
                        {childInvoices.map((inv) => (
                            <Link
                                key={inv.id}
                                href={`/penawaran/${inv.id}`}
                                className="flex items-center justify-between gap-3 p-2 bg-card rounded border border-border hover:border-primary/50 hover:bg-primary/10 text-sm transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Receipt className="h-4 w-4 text-primary shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs text-primary nums">{inv.invoiceNumber}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {inv.invoicePart === "DP" && <span className="inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> Down Payment</span>}
                                            {inv.invoicePart === "PELUNASAN" && <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pelunasan</span>}
                                            {inv.invoicePart === "FULL" && "Full Payment"}
                                            · {dayjs(inv.date).format("DD MMM YYYY")}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-bold text-primary nums">
                                        {inv.amountToPay ? rp(inv.amountToPay) : rp(inv.total)}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[inv.status] || "bg-muted text-muted-foreground"}`}>
                                        {inv.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Brand picker — pilih brand untuk header surat & nomor seri */}
            <div className="mb-4 bg-card border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground">Brand:</span>
                {ACTIVE_BRANDS.map((b) => {
                    const meta = BRAND_META[b];
                    const active = brand === b;
                    return (
                        <button
                            key={b}
                            type="button"
                            onClick={() => setBrand(b)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition ${active
                                ? `${meta.bg} ${meta.text} ${meta.border}`
                                : "bg-card text-foreground border-border hover:border-border"
                                }`}
                        >
                            <span>{meta.emoji}</span>
                            {meta.short}
                        </button>
                    );
                })}
                {brand === null && (
                    <span className="text-xs text-warning bg-warning/15 border border-warning/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Belum di-tag — pilih agar surat penawaran pakai header &amp; nomor seri brand benar
                    </span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                    Brand menentukan kop surat & nomor seri saat assign nomor.
                </span>
            </div>

            {/* Varian Penawaran picker — dropdown dari config CRUD */}
            <div className="mb-4 bg-card border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground">Varian:</span>
                <select
                    value={variantCode ?? ""}
                    onChange={(e) => setVariantCode(e.target.value || null)}
                    className="border-2 rounded-md px-3 py-1.5 text-sm bg-card focus:border-primary outline-none min-w-[260px]"
                >
                    <option value="">— Pilih Varian —</option>
                    {variantConfigs.map((v) => (
                        <option key={v.code} value={v.code} disabled={!v.isActive}>
                            {v.label}{!v.isActive ? " (nonaktif)" : ""}
                        </option>
                    ))}
                </select>
                {variantCode && (() => {
                    const cfg = variantConfigs.find((v) => v.code === variantCode);
                    if (!cfg) return null;
                    return (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium"
                            style={{
                                backgroundColor: `${cfg.color || "#6366f1"}20`,
                                color: cfg.color || "#6366f1",
                                borderColor: `${cfg.color || "#6366f1"}40`,
                            }}
                        >
                            Template: <code className="font-mono">{cfg.templateKey}</code>
                        </span>
                    );
                })()}
                <Link href="/settings/quotation-variants" className="text-[11px] text-primary hover:underline ml-auto">
                    Atur varian →
                </Link>
            </div>

            {/* Penandatangan Surat — context-aware: marketing untuk penawaran, admin untuk invoice */}
            <div className="mb-4 bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                        Penandatangan:
                        {isInvoiceMode && <span className="ml-1 text-[11px] text-primary font-normal">(Admin biasanya TTD invoice)</span>}
                    </span>
                    <select
                        value={signedByWorkerId ?? ""}
                        onChange={(e) => setSignedByWorkerId(e.target.value ? Number(e.target.value) : null)}
                        className="border-2 rounded-md px-3 py-1.5 text-sm bg-card focus:border-info outline-none min-w-[260px]"
                    >
                        <option value="">— Pilih {isInvoiceMode ? "Admin/Marketing" : "Marketing/Sales"} —</option>
                        {marketers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}{w.position ? ` (${w.position})` : ""}
                                {!w.signatureImageUrl ? " ⚠ belum ada TTD" : ""}
                            </option>
                        ))}
                    </select>
                    <Link href="/settings/workers" className="text-[11px] text-info hover:underline ml-auto">
                        Kelola TTD & stempel →
                    </Link>
                </div>
                {/* Preview signature & stamp dari marketing terpilih */}
                {signedByWorkerId && (() => {
                    const w = marketers.find((m) => m.id === signedByWorkerId);
                    if (!w) return null;
                    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                    return (
                        <div className="mt-2 pt-2 border-t flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">Preview di surat:</span>
                            <div className="inline-flex items-center gap-3 p-2 bg-muted rounded">
                                {w.signatureImageUrl ? (
                                    <div className="relative h-16 w-32 bg-card rounded border flex items-center justify-center">
                                        {w.stampImageUrl && (
                                            <img
                                                src={`${apiBase}${w.stampImageUrl}`}
                                                alt="Stempel"
                                                className="absolute h-14 w-14 object-contain opacity-80"
                                                style={{ left: "8px", top: "1px", mixBlendMode: "multiply" }}
                                            />
                                        )}
                                        <img
                                            src={`${apiBase}${w.signatureImageUrl}`}
                                            alt="TTD"
                                            className="relative max-h-14 max-w-full object-contain z-10"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-16 w-32 bg-warning/10 border border-warning/30 rounded flex items-center justify-center text-[10px] text-warning px-2 text-center">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {w.name} belum upload TTD
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm font-bold underline">{w.name}</div>
                                    <div className="text-[11px] text-muted-foreground">{w.position || "Marketing"}</div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                {!signedByWorkerId && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                        <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Kalau dikosongkan, surat pakai nama direktur dari pengaturan brand.
                    </p>
                )}
            </div>

            {/* Bank picker — pilih rekening yang muncul di surat */}
            <div className="mb-4 bg-card border border-border rounded-xl p-3">
                {(() => {
                    const selectedIds = bankAccountIds.split(",").map((s) => s.trim()).filter(Boolean);
                    return (
                        <>
                            {/* Header: label + jumlah terpilih (kiri) · kelola (kanan) */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                                    <Wallet className="w-4 h-4 text-primary shrink-0" /> Rekening Bank
                                    {allBanks.length > 0 && (
                                        <span className="text-[11px] font-normal text-muted-foreground">
                                            ({selectedIds.length}/{allBanks.length} dipilih)
                                        </span>
                                    )}
                                </span>
                                <Link href="/settings/bank-accounts" className="text-[11px] text-info hover:underline shrink-0">
                                    Kelola Bank →
                                </Link>
                            </div>

                            {allBanks.length === 0 ? (
                                <div className="text-xs bg-warning/10 border border-warning/30 rounded-md p-2 text-warning inline-flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Belum ada bank account terdaftar.
                                    <Link href="/settings/bank-accounts" className="ml-1 text-warning font-semibold hover:underline">
                                        Tambah dulu di /settings/bank-accounts →
                                    </Link>
                                </div>
                            ) : (
                                // Grid responsif — memenuhi lebar & rapi saat banyak rekening.
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {allBanks.map((b) => {
                                        const checked = selectedIds.includes(String(b.id));
                                        return (
                                            <label
                                                key={b.id}
                                                className={`flex items-start gap-2 text-sm cursor-pointer rounded-lg border p-2.5 transition-colors ${checked
                                                    ? "border-primary/50 bg-primary/10"
                                                    : "border-border bg-card hover:bg-muted/60"
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...selectedIds, String(b.id)]
                                                            : selectedIds.filter((x) => x !== String(b.id));
                                                        setBankAccountIds(newIds.join(","));
                                                    }}
                                                    className="mt-0.5 shrink-0 accent-primary"
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-bold truncate">{b.bankName}</div>
                                                    <div className="font-mono text-xs truncate nums">{b.accountNumber}</div>
                                                    <div className="text-xs text-muted-foreground truncate">a.n. {b.accountOwner}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-2">
                                <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Pilih rekening yang ditampilkan di surat. Default: dari Brand Settings. Setting ini menimpa default per dokumen.
                            </p>
                        </>
                    );
                })()}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-card rounded-xl border border-border p-4 space-y-3">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4 text-primary shrink-0" /> Data Klien</h3>

                    {/* Tautkan ke Customer Database — supaya muncul di tab Penawaran customer */}
                    {linkedCustomer ? (
                        <div className="rounded-lg border-2 border-success/30 bg-success/10 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-semibold text-success inline-flex items-center gap-1.5 mb-0.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Ter-link ke Data Pelanggan
                                    </div>
                                    <Link
                                        href={`/customers/${linkedCustomer.id}`}
                                        className="text-sm font-semibold text-success hover:underline truncate block"
                                    >
                                        {linkedCustomer.companyName || linkedCustomer.name}
                                    </Link>
                                    <div className="text-[11px] text-success/80 truncate">
                                        {linkedCustomer.companyName && linkedCustomer.name && <span>{linkedCustomer.name}</span>}
                                        {linkedCustomer.companyPIC && <span> · PIC {linkedCustomer.companyPIC}</span>}
                                        {linkedCustomer.phone && <span> · {linkedCustomer.phone}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="text-[11px] px-2 py-1 rounded border bg-card hover:bg-muted"
                                    >
                                        Ganti
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setCustomerIdState(null); setLinkedCustomer(null); }}
                                        className="text-[11px] px-2 py-1 rounded text-destructive hover:bg-destructive/12"
                                        title="Lepas link customer (penawaran ini gak akan muncul di histori customer)"
                                    >
                                        Lepas
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border-2 border-dashed border-warning/40 bg-warning/10 p-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-warning inline-flex items-center gap-1.5 mb-1">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Belum Ter-link ke Data Pelanggan
                                    </div>
                                    <p className="text-[11px] text-warning mb-2">
                                        Penawaran ini <b>tidak akan muncul</b> di histori detail pelanggan.
                                        Klik tombol untuk pilih customer terdaftar atau tambah klien baru.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                                    >
                                        <Search className="h-3.5 w-3.5" />
                                        Pilih / Tambah Klien
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <Field label="Nama PIC" value={clientName} onChange={setClientName} />
                    <Field label="Perusahaan" value={clientCompany} onChange={setClientCompany} />
                    <Field label="Alamat" value={clientAddress} onChange={setClientAddress} multiline />
                    <Field label="Telepon" value={clientPhone} onChange={setClientPhone} />
                    <Field label="Email" value={clientEmail} onChange={setClientEmail} />
                </section>

                <section className="bg-card rounded-xl border border-border p-4 space-y-3">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary shrink-0" /> Event / Proyek</h3>
                    <Field label="Nama Proyek" value={projectName} onChange={setProjectName} />
                    <Field label="Lokasi" value={eventLocation} onChange={setEventLocation} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Tanggal Mulai" value={eventDateStart} onChange={setEventDateStart} type="date" />
                        <Field label="Tanggal Selesai" value={eventDateEnd} onChange={setEventDateEnd} type="date" />
                    </div>
                    <Field label="Berlaku Sampai" value={validUntil} onChange={setValidUntil} type="date" />

                    {/* Editable Jatuh Tempo (Invoice only) — support single date OR range mode + audit log */}
                    {data?.type === "INVOICE" && (
                        <DueDateEditor
                            invoiceId={data.id}
                            dueDate={dueDate}
                            setDueDate={setDueDate}
                            dueDateEnd={dueDateEnd}
                            setDueDateEnd={setDueDateEnd}
                            dueDateMode={dueDateMode}
                            setDueDateMode={setDueDateMode}
                            changeReason={dueDateChangeReason}
                            setChangeReason={setDueDateChangeReason}
                            originalDueDate={originalDueDate}
                            originalDueDateEnd={originalDueDateEnd}
                        />
                    )}

                    {/* Multi-event: event tambahan dengan tanggal beda */}
                    <div className="border-t border-dashed border-border pt-3 mt-2">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Event Tambahan</h4>
                                <p className="text-[10px] text-muted-foreground">
                                    Kalau penawaran cover beberapa event dengan tanggal berbeda.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setAdditionalEvents([
                                        ...additionalEvents,
                                        { name: "", location: "", dateStart: "", dateEnd: "" },
                                    ])
                                }
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-success/10 hover:bg-success/20 text-success border border-success/30 rounded font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Tambah Event
                            </button>
                        </div>

                        {additionalEvents.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">Belum ada event tambahan.</p>
                        ) : (
                            <div className="space-y-2">
                                {additionalEvents.map((ev, idx) => (
                                    <div
                                        key={idx}
                                        className="border border-border rounded-lg p-2.5 bg-muted/60 relative"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                Event #{idx + 2}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setAdditionalEvents(
                                                        additionalEvents.filter((_, i) => i !== idx),
                                                    )
                                                }
                                                className="text-destructive hover:bg-destructive/12 p-0.5 rounded"
                                                title="Hapus event"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Field
                                                label="Nama Event"
                                                value={ev.name}
                                                onChange={(v) =>
                                                    setAdditionalEvents(
                                                        additionalEvents.map((e, i) =>
                                                            i === idx ? { ...e, name: v } : e,
                                                        ),
                                                    )
                                                }
                                            />
                                            <Field
                                                label="Lokasi"
                                                value={ev.location}
                                                onChange={(v) =>
                                                    setAdditionalEvents(
                                                        additionalEvents.map((e, i) =>
                                                            i === idx ? { ...e, location: v } : e,
                                                        ),
                                                    )
                                                }
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <Field
                                                    label="Tgl Mulai"
                                                    type="date"
                                                    value={ev.dateStart}
                                                    onChange={(v) =>
                                                        setAdditionalEvents(
                                                            additionalEvents.map((e, i) =>
                                                                i === idx ? { ...e, dateStart: v } : e,
                                                            ),
                                                        )
                                                    }
                                                />
                                                <Field
                                                    label="Tgl Selesai"
                                                    type="date"
                                                    value={ev.dateEnd}
                                                    onChange={(v) =>
                                                        setAdditionalEvents(
                                                            additionalEvents.map((e, i) =>
                                                                i === idx ? { ...e, dateEnd: v } : e,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Header Surat — tanggal saja (kota opsional, ditambahkan via field di bawah kalau perlu) */}
            <section className="bg-card rounded-xl border border-border p-4 mt-6">
                <div className="mb-3">
                    <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary shrink-0" /> Header Surat (Tanggal Dibuat)</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Format di surat: <code className="bg-muted px-1 rounded">Tanggal : {signCity ? `${signCity}, ` : ""}{docDate ? new Date(docDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}</code>
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field
                        label="Tanggal Surat"
                        value={docDate}
                        onChange={setDocDate}
                        type="date"
                    />
                    <Field
                        label="Lokasi/Kota (opsional)"
                        value={signCity}
                        onChange={setSignCity}
                        placeholder="Kosongkan kalau tidak perlu"
                    />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> <b>Lokasi/Kota</b> opsional — kosongkan kalau tidak diperlukan. Yang muncul cuma tanggal saja.
                </p>
            </section>

            <section className="bg-card rounded-xl border border-border p-4 mt-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2"><List className="w-4 h-4 text-primary shrink-0" /> Rincian Item</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Item dengan <b>Kategori</b> sama otomatis dikelompokkan. Item tanpa kategori akan ikut grup atasnya. Klik <Calculator className="inline h-3 w-3" /> untuk hitung qty otomatis.
                        </p>
                    </div>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 px-3 py-1.5 bg-info hover:bg-info/90 text-white rounded-md text-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah Item
                    </button>
                </div>

                {/* Toggle Tampilan Item di PDF/DOCX */}
                <div className="mb-3 rounded-md border-2 border-border bg-muted p-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">Tampilan Item di PDF:</span>
                    <div className="inline-flex gap-0.5 bg-card p-0.5 rounded border border-border">
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('detailed')}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'detailed'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <List className="w-3 h-3" /> Detail (per item)
                        </button>
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('category-summary')}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'category-summary'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <BarChart2 className="w-3 h-3" /> Ringkas (total/kategori)
                        </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                        {itemDisplayMode === 'detailed'
                            ? 'Tampilkan qty + harga satuan + jumlah per item.'
                            : 'Sembunyikan harga & qty per item, hanya total per kategori.'}
                    </span>
                </div>
                <datalist id="quotation-category-list">
                    <option value="Konstruksi Utama Booth" />
                    <option value="Konstruksi Tambahan" />
                    <option value="Furniture" />
                    <option value="Lighting" />
                    <option value="Multimedia" />
                    <option value="Operasional" />
                    <option value="Mekanikal & Elektrikal" />
                    <option value="Grafis" />
                    <option value="Backwall" />
                    <option value="Stage" />
                </datalist>
                {(() => {
                    // Mode Sederhana: sembunyikan kolom Event & Paket biar form simpel.
                    // Mode Lengkap: tampilkan kalau multi-event aktif.
                    const eventOptions = formMode === 'advanced' && additionalEvents.length > 0
                        ? [
                            { index: 0, label: `0. ${projectName || 'Event Utama'}` },
                            ...additionalEvents.map((e, i) => ({
                                index: i + 1,
                                label: `${i + 1}. ${e.name || `Event ${i + 2}`}`,
                            })),
                          ]
                        : [];
                    const showPackageCol = formMode === 'advanced';
                    const colCount = 8 + (eventOptions.length > 0 ? 1 : 0) + (showPackageCol ? 1 : 0);
                    // Total lebar tabel = jumlah lebar kolom yang bisa di-resize + kolom tetap (drag & aksi).
                    const cw = itemColWidths;
                    const totalW = 32 + 100 + cw.kategori
                        + (eventOptions.length > 0 ? cw.event : 0)
                        + (showPackageCol ? cw.paket : 0)
                        + cw.uraian + cw.qty + cw.satuan + cw.harga + cw.subtotal;
                    return (
                <>
                <div className="flex items-center gap-2 mb-1">
                    <p className="lg:hidden text-[10px] text-muted-foreground">
                        Geser tabel ke samping untuk melihat semua kolom →
                    </p>
                    <p className="hidden lg:block text-[10px] text-muted-foreground">
                        Tarik garis pembatas di header untuk ubah lebar kolom.
                    </p>
                    <button
                        type="button"
                        onClick={resetItemColWidths}
                        className="hidden lg:inline-flex ml-auto items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Kembalikan lebar semua kolom ke default"
                    >
                        <History className="w-3 h-3" /> Reset lebar kolom
                    </button>
                </div>
                <div className="overflow-x-auto">
                {/* table-fixed + colgroup: lebar kolom dikontrol state → bisa di-resize via handle header */}
                <table className="text-sm table-fixed" style={{ width: totalW }}>
                    <colgroup>
                        <col style={{ width: 32 }} />
                        <col style={{ width: cw.kategori }} />
                        {eventOptions.length > 0 && <col style={{ width: cw.event }} />}
                        {showPackageCol && <col style={{ width: cw.paket }} />}
                        <col style={{ width: cw.uraian }} />
                        <col style={{ width: cw.qty }} />
                        <col style={{ width: cw.satuan }} />
                        <col style={{ width: cw.harga }} />
                        <col style={{ width: cw.subtotal }} />
                        <col style={{ width: 100 }} />
                    </colgroup>
                    <thead className="bg-muted text-left text-foreground">
                        <tr>
                            <th className="px-1"></th>
                            <th className="px-2 py-1.5 relative select-none">Kategori<ColResizeHandle onPointerDown={(e) => startColResize('kategori', e)} /></th>
                            {eventOptions.length > 0 && (
                                <th className="px-2 py-1.5 relative select-none" title="Link ke event lokasi">Event<ColResizeHandle onPointerDown={(e) => startColResize('event', e)} /></th>
                            )}
                            {showPackageCol && (
                                <th className="px-2 py-1.5 relative select-none" title="Nama paket (mode package)">Paket<ColResizeHandle onPointerDown={(e) => startColResize('paket', e)} /></th>
                            )}
                            <th className="px-2 py-1.5 relative select-none">Uraian<ColResizeHandle onPointerDown={(e) => startColResize('uraian', e)} /></th>
                            <th className="px-2 py-1.5 relative select-none">Qty<ColResizeHandle onPointerDown={(e) => startColResize('qty', e)} /></th>
                            <th className="px-2 py-1.5 relative select-none">Satuan<ColResizeHandle onPointerDown={(e) => startColResize('satuan', e)} /></th>
                            <th className="px-2 py-1.5 relative select-none">Harga Satuan<ColResizeHandle onPointerDown={(e) => startColResize('harga', e)} /></th>
                            <th className="px-2 py-1.5 relative select-none">Subtotal<ColResizeHandle onPointerDown={(e) => startColResize('subtotal', e)} /></th>
                            <th className="px-1 text-center text-[10px]">Aksi</th>
                        </tr>
                    </thead>
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={items.map((i) => i._key)} strategy={verticalListSortingStrategy}>
                            <tbody>
                                {items.map((it) => {
                                    const sub = Number(it.quantity || 0) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price || 0);
                                    return (
                                        <SortableItemRow
                                            key={it._key}
                                            it={it}
                                            sub={sub}
                                            updateItem={updateItem}
                                            duplicateItem={duplicateItem}
                                            removeItem={removeItem}
                                            setCalcOpenKey={setCalcOpenKey}
                                            rp={rp}
                                            eventOptions={eventOptions}
                                            showPackageCol={showPackageCol}
                                        />
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={colCount} className="text-center py-6 text-muted-foreground">
                                            Belum ada item. Klik &quot;Tambah Item&quot;.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </SortableContext>
                    </DndContext>
                </table>
                </div>
                </>
                    );
                })()}
            </section>

            {/* Layout 2 kolom masonry-manual: tiap kolom stack independen → hemat tempat
                tanpa celah kosong antar-baris (beda dengan grid biasa yang menyamakan tinggi baris). */}
            <div className="mt-6 grid md:grid-cols-2 gap-4 items-start">
                {/* ── Kolom kiri ── */}
                <div className="space-y-4">
                <section className="bg-card rounded-xl border border-border p-3 space-y-2">
                    <h3 className="font-semibold text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Pajak &amp; Pembayaran</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Diskon (Rp)" value={String(discount)} onChange={(v) => setDiscount(parseFloat(v) || 0)} type="number" />
                        <Field label="DP (%)" value={String(dpPercent)} onChange={(v) => setDpPercent(parseFloat(v) || 0)} type="number" />
                    </div>

                    {/* DP Sudah Dibayar — auto dari child invoice DP yang sudah PAID, bisa di-override custom */}
                    <div className="border-2 border-warning/30 bg-warning/10 rounded p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-warning inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> DP Sudah Dibayar</label>
                            <div className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-card p-0.5 text-[10px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setDpPaidMode('auto')}
                                    className={`px-2 py-0.5 rounded-full transition ${dpPaidMode === 'auto' ? 'bg-warning text-warning-foreground' : 'text-warning hover:bg-warning/20'}`}
                                >
                                    Auto
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDpPaidMode('custom')}
                                    className={`px-2 py-0.5 rounded-full transition ${dpPaidMode === 'custom' ? 'bg-warning text-warning-foreground' : 'text-warning hover:bg-warning/20'}`}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>
                        {dpPaidMode === 'auto' ? (
                            <div>
                                <div className="font-mono text-base font-bold text-warning nums">{rp(autoDpPaid)}</div>
                                <p className="text-[10px] text-warning">
                                    {dpPaidInvoiceCount === 0
                                        ? "Belum ada invoice DP yang sudah dibayar."
                                        : `Auto dari ${dpPaidInvoiceCount} invoice DP yang sudah ter-bayar.`}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-warning font-semibold text-xs">Rp</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={dpPaidCustom}
                                        onChange={(e) => setDpPaidCustom(e.target.value)}
                                        placeholder={`mis. ${(Number(data?.total ?? 0) * dpPercent / 100).toFixed(0)}`}
                                        inputMode="numeric"
                                        className="w-full border-2 border-warning/30 rounded pl-8 pr-2 py-1.5 text-sm font-mono text-right focus:border-warning outline-none bg-card"
                                    />
                                </div>
                                <p className="text-[10px] text-warning mt-0.5">
                                    Override manual untuk DP yang dibayar di luar sistem atau penyesuaian.
                                </p>
                            </div>
                        )}
                        {effectiveDpPaid > 0 && Number(data?.total ?? 0) > 0 && (
                            <div className="text-[11px] text-warning border-t border-warning/30 pt-1">
                                Sisa Pelunasan: <b className="font-mono">{rp(Number(data?.total ?? 0) - effectiveDpPaid)}</b>
                            </div>
                        )}
                    </div>

                    {/* PPN section dengan toggle mode % / Rp */}
                    <div className="border-2 border-info/30 bg-info/10 rounded p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <label className="text-xs font-bold text-info inline-flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> PPN (Pajak Pertambahan Nilai)</label>
                            <div className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-card p-0.5 text-[10px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => { setTaxMode("percent"); setTaxAmount(0); }}
                                    className={`px-2 py-0.5 rounded-full transition ${taxMode === "percent" ? "bg-info text-white" : "text-info hover:bg-info/15"}`}
                                >
                                    % Persen
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setTaxMode("amount"); setTaxRate(0); }}
                                    className={`px-2 py-0.5 rounded-full transition ${taxMode === "amount" ? "bg-info text-white" : "text-info hover:bg-info/15"}`}
                                >
                                    Rp Nominal
                                </button>
                            </div>
                        </div>

                        {/* Pricing mode toggle — harga belum / sudah termasuk PPN */}
                        <div className="bg-card border border-info/30 rounded p-1.5 space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-info">Mode Pricing</div>
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setPriceIncludesTax(false)}
                                    className={`text-[10px] px-2 py-1.5 rounded border-2 font-semibold transition ${!priceIncludesTax
                                        ? "bg-info text-white border-info"
                                        : "bg-card text-info border-info/30 hover:border-info/50"
                                        }`}
                                >
                                    <Plus className="w-3 h-3 inline" /> Harga belum termasuk PPN
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriceIncludesTax(true)}
                                    className={`text-[10px] px-2 py-1.5 rounded border-2 font-semibold transition ${priceIncludesTax
                                        ? "bg-info text-white border-info"
                                        : "bg-card text-info border-info/30 hover:border-info/50"
                                        }`}
                                >
                                    <Package className="w-3 h-3 inline" /> Harga sudah termasuk PPN
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                                {priceIncludesTax
                                    ? <><Package className="w-3 h-3 shrink-0 mt-0.5" /> <span>Harga item adalah GROSS (sudah include PPN). DPP &amp; PPN di-back-calc dari gross.</span></>
                                    : <><Plus className="w-3 h-3 shrink-0 mt-0.5" /> <span>Harga item adalah NET (belum include PPN). PPN ditambah di atas subtotal.</span></>}
                            </p>
                        </div>
                        {taxMode === "percent" ? (
                            <div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-20 border-2 border-info/30 rounded px-2 py-1.5 text-sm bg-card"
                                    />
                                    <span className="text-sm font-bold text-info">%</span>
                                    <span className="text-[11px] text-muted-foreground">
                                        ≈ <b className="font-mono text-info">Rp {Math.round(computedTaxAmount).toLocaleString("id-ID")}</b>
                                    </span>
                                </div>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {[0, 10, 11, 12].map((rate) => (
                                        <button
                                            key={rate}
                                            type="button"
                                            onClick={() => setTaxRate(rate)}
                                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${taxRate === rate ? "bg-info text-white border-info" : "bg-card text-info border-info/30 hover:bg-info/15"}`}
                                        >
                                            {rate}%{rate === 0 ? " (off)" : rate === 11 ? " (default)" : ""}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-info">Rp</span>
                                    <input
                                        type="number"
                                        value={taxAmount}
                                        onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="flex-1 border-2 border-info/30 rounded px-2 py-1.5 text-sm bg-card font-mono text-right"
                                    />
                                    {dpp > 0 && taxAmount > 0 && (
                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            ≈ <b className="text-info">{effectiveTaxRate.toFixed(2)}%</b>
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Input nominal Rp langsung — % auto-hitung dari DPP.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* PPh section dengan toggle mode % / Rp */}
                    <div className="border-2 border-destructive/30 bg-destructive/12 rounded p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-destructive inline-flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> PPh (Withholding Tax)</label>
                            <div className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-card p-0.5 text-[10px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => { setPphMode("percent"); setPphAmount(0); }}
                                    className={`px-2 py-0.5 rounded-full transition ${pphMode === "percent" ? "bg-destructive text-white" : "text-destructive hover:bg-destructive/15"}`}
                                >
                                    % Persen
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setPphMode("amount"); setPphRate(0); }}
                                    className={`px-2 py-0.5 rounded-full transition ${pphMode === "amount" ? "bg-destructive text-white" : "text-destructive hover:bg-destructive/15"}`}
                                >
                                    Rp Nominal
                                </button>
                            </div>
                        </div>
                        {pphMode === "percent" ? (
                            <div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={pphRate}
                                        onChange={(e) => setPphRate(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-20 border-2 border-destructive/30 rounded px-2 py-1.5 text-sm bg-card"
                                    />
                                    <span className="text-sm font-bold text-destructive">%</span>
                                    <span className="text-[11px] text-muted-foreground">
                                        ≈ <b className="font-mono text-destructive">Rp {Math.round(computedPphAmount).toLocaleString("id-ID")}</b>
                                    </span>
                                </div>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {[0, 0.5, 1.5, 2].map((rate) => (
                                        <button
                                            key={rate}
                                            type="button"
                                            onClick={() => setPphRate(rate)}
                                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${pphRate === rate ? "bg-destructive text-white border-destructive" : "bg-card text-destructive border-destructive/30 hover:bg-destructive/15"}`}
                                            title={rate === 0 ? "Tidak ada PPh" : rate === 0.5 ? "UMKM Final" : rate === 1.5 ? "Sewa / Jasa konstruksi" : "Jasa lain"}
                                        >
                                            {rate}%{rate === 0 ? " (off)" : rate === 0.5 ? " (UMKM)" : rate === 1.5 ? " (PPh 4(2))" : " (PPh 23)"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-destructive">Rp</span>
                                    <input
                                        type="number"
                                        value={pphAmount}
                                        onChange={(e) => setPphAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="flex-1 border-2 border-destructive/30 rounded px-2 py-1.5 text-sm bg-card font-mono text-right"
                                    />
                                    {dpp > 0 && pphAmount > 0 && (
                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            ≈ <b className="text-destructive">{effectivePphRate.toFixed(2)}%</b>
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Input nominal Rp langsung — % auto-hitung dari DPP.
                                </p>
                            </div>
                        )}
                        {(pphRate > 0 || pphAmount > 0) && (
                            <div className="text-[10px] text-destructive bg-card border border-destructive/30 rounded p-1.5">
                                <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> PPh ini akan <b>dipotong klien</b> dari pembayaran.
                                Net diterima = Total − Rp {Math.round(computedPphAmount).toLocaleString("id-ID")}
                                <br />
                                Preset: <b>0.5%</b> UMKM Final · <b>1.5%</b> PPh 4(2) sewa/konstruksi · <b>2%</b> PPh 23 jasa
                            </div>
                        )}

                        {/* AUTO GROSS-UP toggle — fitur paling sering dipakai marketing */}
                        {pphMode === "percent" && pphRate > 0 && (
                            <div className={`border-2 rounded p-2 space-y-1 transition ${grossUpPph ? "border-success/50 bg-success/10" : "border-border bg-muted"}`}>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={grossUpPph}
                                        onChange={(e) => setGrossUpPph(e.target.checked)}
                                        className="mt-0.5 w-4 h-4"
                                    />
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-foreground flex items-center gap-1">
                                            <Bot className="w-3.5 h-3.5" /> Auto Gross-Up PPh
                                            {grossUpPph && <span className="ml-1 text-success">✓ AKTIF</span>}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            Harga items dianggap <b>target net</b> yang ingin diterima vendor.
                                            Sistem auto gross-up DPP supaya setelah PPh dipotong klien,
                                            vendor terima persis sesuai target.
                                        </p>
                                    </div>
                                </label>
                                {grossUpPph && (
                                    <div className="bg-card border border-success/30 rounded p-2 mt-1 text-[10px] space-y-0.5">
                                        <div className="font-mono">
                                            Sum items: <b className="text-foreground">Rp {Math.round(subtotal).toLocaleString("id-ID")}</b>
                                            <span className="text-muted-foreground mx-1">→</span>
                                            DPP gross-up: <b className="text-success">Rp {Math.round(dpp).toLocaleString("id-ID")}</b>
                                            <span className="text-muted-foreground"> (× {grossUpFactor.toFixed(4)})</span>
                                        </div>
                                        <div className="text-success font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Setelah PPh {pphRate}% dipotong, vendor terima net = <b>Rp {Math.round(subtotal - (discount || 0)).toLocaleString("id-ID")}</b>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Gross-up PPh Calculator Helper — convert target net ke DPP yang harus dipasang */}
                        <GrossUpHelper effectivePphRate={effectivePphRate} />
                    </div>

                    <Field label="Catatan / Terms" value={notes} onChange={setNotes} multiline />
                </section>

                {/* === Section: Format Lanjutan (Subject + Harga Paket + Show Grand Total) === */}
                {formMode === 'advanced' && (
                <section className="bg-card rounded-xl border border-primary/30 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('format')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-primary/10 hover:bg-primary/15 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            <div>
                                <h3 className="font-semibold text-sm text-primary">Format Lanjutan</h3>
                                <p className="text-[10px] text-primary">Subject • Harga paket • Show total</p>
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-primary shrink-0 transition-transform ${openSections.format ? 'rotate-180' : ''}`} />
                    </button>
                    {openSections.format && (
                    <div className="p-3 space-y-2 border-t border-primary/30">
                        <Field
                            label='Hal: (Custom Subject)'
                            value={customSubject}
                            onChange={setCustomSubject}
                            placeholder="Otomatis dari variant kalau dikosongkan"
                        />
                        <Field
                            label="Harga Paket (Rp)"
                            value={packagePrice ? String(packagePrice) : ""}
                            onChange={(v) => setPackagePrice(parseFloat(v) || 0)}
                            type="number"
                            placeholder="Kosong = pakai grand total normal"
                        />
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showGrandTotal}
                                onChange={(e) => setShowGrandTotal(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span>Tampilkan Grand Total di footer <span className="text-muted-foreground">(uncheck untuk mode Package)</span></span>
                        </label>
                    </div>
                    )}
                </section>
                )}

                {/* === Section: Spesifikasi (PDF Nukahiji style) === */}
                {formMode === 'advanced' && (
                <section className="bg-card rounded-xl border border-success/30 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('spec')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-success/10 hover:bg-success/20 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <List className="w-4 h-4 text-success" />
                            <div>
                                <h3 className="font-semibold text-sm text-success flex items-center gap-1.5">
                                    Spesifikasi Detail
                                    {specifications.length > 0 && <span className="px-1.5 py-0.5 bg-success/20 rounded text-[10px] font-bold">{specifications.length}</span>}
                                </h3>
                                <p className="text-[10px] text-success">List spec per item (Booth/Stage/Totem)</p>
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-success shrink-0 transition-transform ${openSections.spec ? 'rotate-180' : ''}`} />
                    </button>
                    {openSections.spec && (
                    <div className="p-3 space-y-2 border-t border-success/30">
                        <button
                            type="button"
                            onClick={() => setSpecifications([...specifications, { title: "", items: [""] }])}
                            className="w-full px-2 py-1.5 text-xs bg-success hover:bg-success/90 text-white rounded font-medium"
                            title="Tambah group spec (mis. Booth, Stage, Totem)"
                        >
                            <Plus className="w-3.5 h-3.5 inline" /> Tambah Group Spesifikasi
                        </button>
                    {specifications.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Belum ada. Klik "+ Tambah Group" untuk mulai.</p>
                    ) : (
                        specifications.map((grp, gi) => (
                            <div key={gi} className="border border-border rounded-lg p-2.5 bg-muted/40 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={grp.title}
                                        onChange={(e) =>
                                            setSpecifications(
                                                specifications.map((g, i) =>
                                                    i === gi ? { ...g, title: e.target.value } : g,
                                                ),
                                            )
                                        }
                                        placeholder="Judul group (mis. Booth, Stage)"
                                        className="flex-1 border rounded px-2 py-1 text-xs font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSpecifications(specifications.filter((_, i) => i !== gi))
                                        }
                                        className="text-destructive hover:bg-destructive/12 p-1 rounded"
                                        title="Hapus group"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {/* Dropdown "Untuk paket" — auto-detect packages dari items.packageGroup */}
                                {(() => {
                                    const pkgList = Array.from(new Set(items
                                        .map((it: any) => (it.packageGroup ?? '').toString().trim())
                                        .filter((s) => s.length > 0)));
                                    if (pkgList.length === 0) return null; // tidak mode package, sembunyikan dropdown
                                    return (
                                        <div className="flex items-center gap-2 text-xs">
                                            <label className="text-muted-foreground whitespace-nowrap inline-flex items-center gap-1"><Package className="w-3 h-3" /> Untuk paket:</label>
                                            <select
                                                value={grp.packageGroup ?? ""}
                                                onChange={(e) =>
                                                    setSpecifications(
                                                        specifications.map((g, i) =>
                                                            i === gi ? { ...g, packageGroup: e.target.value } : g,
                                                        ),
                                                    )
                                                }
                                                className="flex-1 border rounded px-2 py-1 text-xs"
                                            >
                                                <option value="">— Global (semua paket) —</option>
                                                {pkgList.map((p) => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })()}
                                {grp.items.map((it, ii) => (
                                    <div key={ii} className="flex items-center gap-2">
                                        <span className="text-success text-xs">✓</span>
                                        <input
                                            type="text"
                                            value={it}
                                            onChange={(e) =>
                                                setSpecifications(
                                                    specifications.map((g, i) =>
                                                        i === gi
                                                            ? {
                                                                ...g,
                                                                items: g.items.map((s, j) =>
                                                                    j === ii ? e.target.value : s,
                                                                ),
                                                            }
                                                            : g,
                                                    ),
                                                )
                                            }
                                            placeholder="Mis. Ukuran (250 x 200) cm"
                                            className="flex-1 border rounded px-2 py-1 text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSpecifications(
                                                    specifications.map((g, i) =>
                                                        i === gi
                                                            ? { ...g, items: g.items.filter((_, j) => j !== ii) }
                                                            : g,
                                                    ),
                                                )
                                            }
                                            className="text-destructive hover:bg-destructive/12 p-0.5 rounded"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSpecifications(
                                            specifications.map((g, i) =>
                                                i === gi ? { ...g, items: [...g.items, ""] } : g,
                                            ),
                                        )
                                    }
                                    className="text-[10px] text-info hover:underline ml-5"
                                >
                                    + Tambah Item
                                </button>
                            </div>
                        ))
                    )}
                    </div>
                    )}
                </section>
                )}

                {/* === Section: Rincian Pekerjaan (dokumen terpisah — dikelola di halaman khusus) === */}
                {formMode === 'advanced' && (
                <section className="bg-card rounded-xl border border-warning/30 overflow-hidden">
                    <Link
                        href={`/penawaran/${id}/rincian`}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-warning/10 hover:bg-warning/20 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <List className="w-4 h-4 text-warning" />
                            <div>
                                <h3 className="font-semibold text-sm text-warning flex items-center gap-1.5">
                                    Rincian Pekerjaan
                                    {Array.isArray((data as any).rincianPekerjaanItems) && (data as any).rincianPekerjaanItems.length > 0 && (
                                        <span className="px-1.5 py-0.5 bg-warning/20 rounded text-[10px] font-bold">{(data as any).rincianPekerjaanItems.length} item</span>
                                    )}
                                </h3>
                                <p className="text-[10px] text-warning">Dokumen kerja untuk tim produksi — buka halaman khusus untuk edit item, tanggal pasang &amp; bongkar. Tidak mengubah penawaran.</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-warning text-xs font-medium whitespace-nowrap">Buka <ArrowUp className="w-3 h-3 rotate-90" /></span>
                    </Link>
                </section>
                )}
                </div>

                {/* ── Kolom kanan ── */}
                <div className="space-y-4">
                {/* === Section: Payment Schedule (Multi-step) === */}
                {formMode === 'advanced' && (
                <section className="bg-card rounded-xl border border-info/30 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('payment')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-info/10 hover:bg-info/15 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-info" />
                            <div>
                                <h3 className="font-semibold text-sm text-info flex items-center gap-1.5">
                                    Skema Pembayaran Bertahap
                                    {paymentSchedule.length > 0 && <span className="px-1.5 py-0.5 bg-info/20 rounded text-[10px] font-bold">{paymentSchedule.length}</span>}
                                </h3>
                                <p className="text-[10px] text-info">Multi-step DP — override DP {dpPercent}%</p>
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-info shrink-0 transition-transform ${openSections.payment ? 'rotate-180' : ''}`} />
                    </button>
                    {openSections.payment && (
                    <div className="p-3 space-y-2 border-t border-info/30">
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setPaymentSchedule([
                                        { label: "DP", percent: 50 },
                                        { label: "Pelunasan", percent: 50 },
                                    ])
                                }
                                className="flex-1 text-[11px] px-2 py-1 rounded bg-info/15 hover:bg-info/20 text-info border border-info/30 font-semibold"
                                title="Preset 50% DP + 50% Pelunasan"
                            >
                                <Zap className="w-3 h-3 inline" /> 50/50
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setPaymentSchedule([
                                        { label: "DP1", percent: 50 },
                                        { label: "DP2", percent: 30 },
                                        { label: "Pelunasan", percent: 20 },
                                    ])
                                }
                                className="flex-1 text-[11px] px-2 py-1 rounded bg-info/15 hover:bg-info/20 text-info border border-info/30 font-semibold"
                                title="Preset DP1 50% + DP2 30% + Pelunasan 20%"
                            >
                                <Zap className="w-3 h-3 inline" /> 50/30/20
                            </button>
                        </div>
                    {paymentSchedule.length > 0 && (
                        <>
                            {paymentSchedule.map((s, si) => (
                                <div key={si} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={s.label}
                                        onChange={(e) =>
                                            setPaymentSchedule(
                                                paymentSchedule.map((p, i) =>
                                                    i === si ? { ...p, label: e.target.value } : p,
                                                ),
                                            )
                                        }
                                        placeholder="Label (mis. DP1, Pelunasan)"
                                        className="flex-1 border rounded px-2 py-1 text-xs"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={s.percent}
                                        onChange={(e) =>
                                            setPaymentSchedule(
                                                paymentSchedule.map((p, i) =>
                                                    i === si ? { ...p, percent: parseFloat(e.target.value) || 0 } : p,
                                                ),
                                            )
                                        }
                                        className="w-16 border rounded px-2 py-1 text-xs text-right"
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPaymentSchedule(paymentSchedule.filter((_, i) => i !== si))
                                        }
                                        className="text-destructive hover:bg-destructive/12 p-0.5 rounded"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(() => {
                                const totalPct = paymentSchedule.reduce((sum, s) => sum + Number(s.percent || 0), 0);
                                const ok = Math.abs(totalPct - 100) < 0.01;
                                return (
                                    <p className={`text-[11px] font-bold ${ok ? "text-success" : "text-destructive"}`}>
                                        Total: {totalPct.toFixed(2)}% {ok ? "✓" : "(harus 100%)"}
                                    </p>
                                );
                            })()}
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => setPaymentSchedule([...paymentSchedule, { label: "", percent: 0 }])}
                        className="w-full text-sm px-3 py-2 bg-muted hover:bg-muted rounded font-medium border border-dashed border-border"
                    >
                        <Plus className="w-3.5 h-3.5 inline" /> Tambah Step Pembayaran
                    </button>
                    </div>
                    )}
                </section>
                )}

                {/* Bahasa & Mata Uang — compact section */}
                <section className="bg-card rounded-xl border border-info/30 overflow-hidden">
                    <div className="px-3 py-2 bg-gradient-to-r from-info/10 to-primary/10 border-b border-info/30 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-info" />
                        <div>
                            <h3 className="font-semibold text-sm text-info">Bahasa &amp; Mata Uang</h3>
                            <p className="text-[10px] text-info">Bahasa surat + toggle USD</p>
                        </div>
                    </div>
                    <div className="p-3 space-y-2">

                    {/* Language + USD toggle — kompak dalam 1 baris pill-style */}
                    <div className="flex gap-1.5">
                        {/* Language pills */}
                        <div className="flex gap-0.5 p-0.5 bg-muted rounded-md flex-1">
                            {([
                                { value: 'id' as const, label: '🇮🇩 ID' },
                                { value: 'en' as const, label: '🇬🇧 EN' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setLanguage(opt.value)}
                                    title={opt.value === 'id' ? 'Bahasa Indonesia' : 'English (international)'}
                                    className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${language === opt.value
                                        ? "bg-card text-info shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {/* USD toggle */}
                        <button
                            type="button"
                            onClick={() => setUseUsdCurrency((v) => !v)}
                            title={useUsdCurrency
                                ? "USD aktif — label di PDF pakai USD. Klik untuk balik ke Rp."
                                : "Klik untuk aktifkan USD (label Rp → USD, tanpa konversi kurs)"}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition border ${useUsdCurrency
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-card text-muted-foreground border-border hover:border-border"
                                }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <Wallet className="w-3 h-3" /> {useUsdCurrency ? "USD" : "Rp (default)"}
                            </span>
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <Lightbulb className="w-3 h-3 shrink-0 mt-0.5 text-warning" />
                        <span>
                            {language === 'en' && "Label header auto-translate (Nomor→Number, dll). "}
                            {useUsdCurrency
                                ? "Input nilai harga langsung dalam USD (tanpa konversi kurs)."
                                : "Default pakai Rp. Aktifkan USD untuk klien internasional."}
                        </span>
                    </p>
                    </div>
                </section>

                {/* Custom Text Surat — Mode Lengkap saja */}
                {formMode === 'advanced' && (
                <section className="bg-card rounded-xl border border-warning/30 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('customText')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-warning/10 hover:bg-warning/20 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-warning" />
                            <div>
                                <h3 className="font-semibold text-sm text-warning">Custom Text Surat</h3>
                                <p className="text-[10px] text-warning">Override Lampiran, Pembuka, Disclaimer, dst</p>
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-warning shrink-0 transition-transform ${openSections.customText ? 'rotate-180' : ''}`} />
                    </button>
                    {openSections.customText && (
                    <div className="p-3 space-y-2 border-t border-warning/30">
                    <div>
                        <label className="text-xs font-medium block mb-1 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Lampiran</label>
                        <textarea
                            value={customAttachmentText}
                            onChange={(e) => setCustomAttachmentText(e.target.value)}
                            rows={1}
                            placeholder='Default "1 (satu) berkas" — bisa ganti dengan dash atau list'
                            className="w-full border rounded px-2 py-1 text-xs font-sans"
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                            {[
                                { label: "1 (satu)", val: "1 (satu) berkas" },
                                { label: "2 (dua)", val: "2 (dua) berkas" },
                                { label: "3 (tiga)", val: "3 (tiga) berkas" },
                                { label: "—", val: "-" },
                                { label: "Tidak ada", val: "Tidak ada" },
                            ].map((opt) => (
                                <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => setCustomAttachmentText(opt.val)}
                                    className="px-1.5 py-0.5 rounded border text-[10px] bg-muted hover:bg-muted text-foreground border-border"
                                >
                                    {opt.label}
                                </button>
                            ))}
                            {customAttachmentText && (
                                <button
                                    type="button"
                                    onClick={() => setCustomAttachmentText("")}
                                    className="px-1.5 py-0.5 rounded border text-[10px] bg-warning/10 hover:bg-warning/20 text-warning border-warning/30"
                                >
                                    <X className="inline align-[-2px] w-3 h-3 mr-0.5" /> Reset
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Tab switcher — Penawaran / SPK / Invoice (per-doctype custom text) */}
                    <div className="border-b border-border -mx-4 px-4 pt-1">
                        <div className="flex items-center gap-0.5">
                            {([
                                { v: 'penawaran' as const, icon: <FileText className="w-3 h-3" />, label: 'Penawaran', color: 'violet' },
                                { v: 'spk' as const, icon: <ScrollText className="w-3 h-3" />, label: 'SPK', color: 'emerald' },
                                { v: 'invoice' as const, icon: <Receipt className="w-3 h-3" />, label: 'Invoice', color: 'red' },
                            ] as const).map((t) => (
                                <button
                                    key={t.v}
                                    type="button"
                                    onClick={() => setCustomTextTab(t.v)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-md border-b-2 transition ${customTextTab === t.v
                                        ? `border-${t.color}-600 text-${t.color}-700 bg-${t.color}-50`
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {t.icon}{t.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                            {customTextTab === 'penawaran' && 'Custom text khusus untuk surat Penawaran. Diisi di sini tidak pengaruh ke SPK & Invoice.'}
                            {customTextTab === 'spk' && 'Custom text khusus untuk SPK. Kalau kosong, fallback ke Penawaran. Diisi di sini tidak pengaruh ke Penawaran & Invoice.'}
                            {customTextTab === 'invoice' && 'Custom text khusus untuk Invoice. Kalau kosong, fallback ke Penawaran. Diisi di sini tidak pengaruh ke Penawaran & SPK.'}
                        </p>
                    </div>

                    {/* ====== TAB: PENAWARAN ====== */}
                    {customTextTab === 'penawaran' && (
                    <>
                    {/* Pembuka — full custom (replace template) */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium">
                                Pembuka Surat &quot;Dengan hormat...&quot;
                                <span className="text-[10px] text-muted-foreground font-normal ml-1">(full custom)</span>
                            </label>
                            {(() => {
                                const tmpl = language === 'en'
                                    ? (brandSettings?.openingTemplateEn || brandSettings?.openingTemplate)
                                    : brandSettings?.openingTemplate;
                                if (!tmpl) return null;
                                return (
                                    <button
                                        type="button"
                                        onClick={() => setCustomOpeningText(tmpl)}
                                        className="text-[10px] px-2 py-0.5 rounded bg-info/10 border border-info/30 text-info hover:bg-info/15"
                                        title="Salin template dari pengaturan brand"
                                    >
                                        <Copy className="w-3 h-3 inline" /> Salin Template Brand ({language === 'en' ? 'EN' : 'ID'})
                                    </button>
                                );
                            })()}
                        </div>
                        <textarea
                            value={customOpeningText}
                            onChange={(e) => setCustomOpeningText(e.target.value)}
                            rows={4}
                            placeholder={brandSettings?.openingTemplate
                                ? `Klik "Salin Template Brand" untuk auto-isi, atau ketik manual.`
                                : "Default: 'Dengan hormat, Bersama surat ini kami ... mengajukan penawaran...'"}
                            className="w-full border rounded px-3 py-2 text-sm font-sans"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Kalau diisi, REPLACE paragraf default. Kosongkan untuk pakai default sistem.
                        </p>
                    </div>

                    {/* Catatan Harga — custom override + append/prepend */}
                    <PrependAppendField
                        title={<span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {language === 'en' ? "Price Notes / Disclaimer" : "Catatan Harga / Disclaimer"}</span>}
                        prepend={disclaimerPrepend}
                        append={disclaimerAppend}
                        onPrepend={setDisclaimerPrepend}
                        onAppend={setDisclaimerAppend}
                        custom={customDisclaimer}
                        onCustom={setCustomDisclaimer}
                        brandDefault={(language === 'en'
                            ? (brandSettings?.quotationDisclaimerEn || brandSettings?.quotationDisclaimer)
                            : brandSettings?.quotationDisclaimer) ?? null}
                    />

                    {/* Sistem Pembayaran — custom override + append/prepend */}
                    <PrependAppendField
                        title={<span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> {language === 'en' ? "Payment Terms" : "Sistem Pembayaran"}</span>}
                        prepend={paymentTermsPrepend}
                        append={paymentTermsAppend}
                        onPrepend={setPaymentTermsPrepend}
                        onAppend={setPaymentTermsAppend}
                        custom={customPaymentTerms}
                        onCustom={setCustomPaymentTerms}
                        brandDefault={(language === 'en'
                            ? (brandSettings?.quotationPaymentTermsEn || brandSettings?.quotationPaymentTerms)
                            : brandSettings?.quotationPaymentTerms) ?? null}
                    />

                    {/* Penutup Surat — custom override + append/prepend */}
                    <PrependAppendField
                        title={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {language === 'en' ? "Closing" : "Penutup Surat"}</span>}
                        prepend={closingPrepend}
                        append={closingAppend}
                        onPrepend={setClosingPrepend}
                        onAppend={setClosingAppend}
                        custom={customClosing}
                        onCustom={setCustomClosing}
                        brandDefault={(language === 'en'
                            ? (brandSettings?.quotationClosingEn || brandSettings?.quotationClosing)
                            : brandSettings?.quotationClosing) ?? null}
                    />
                    </>
                    )}

                    {/* ====== TAB: SPK ====== */}
                    {customTextTab === 'spk' && (
                    <>
                    {/* Penanggung Jawab SPK — override clientName kalau berbeda dengan penawaran */}
                    <div className="border border-success/30 rounded-lg p-3 bg-success/10 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-success flex items-center gap-1.5">
                                <User className="w-4 h-4" /> Penanggung Jawab SPK
                            </h4>
                            <p className="text-[10px] text-success mt-0.5">
                                Kalau yang tandatangan SPK <strong>berbeda</strong> dengan PIC di Penawaran, isi di sini.
                                Kosongkan untuk pakai nama PIC dari Penawaran (<span className="font-mono">{clientName || '—'}</span>).
                            </p>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                Nama Penanggung Jawab
                            </label>
                            <input
                                type="text"
                                value={spkPicName}
                                onChange={(e) => setSpkPicName(e.target.value)}
                                placeholder={`Default: ${clientName || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicName.trim() ? 'border-success/50 bg-card' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                Jabatan <span className="font-normal text-muted-foreground">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={spkPicPosition}
                                onChange={(e) => setSpkPicPosition(e.target.value)}
                                placeholder="Mis. CEO, Direktur, Manager Operasional"
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicPosition.trim() ? 'border-success/50 bg-card' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                No. HP / Telp <span className="font-normal text-muted-foreground">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={spkPicPhone}
                                onChange={(e) => setSpkPicPhone(e.target.value)}
                                placeholder={`Default: ${clientPhone || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicPhone.trim() ? 'border-success/50 bg-card' : ''}`}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Akan tampil di baris &quot;No. Telp kantor&quot; di header SPK. Kosongkan untuk pakai No. Telp dari Penawaran.
                            </p>
                        </div>
                    </div>

                    {/* Batas Pelunasan SPK — tanggal "selambat-lambatnya pelunasan dibayarkan" */}
                    <div className="border border-success/30 rounded-lg p-3 bg-success/10 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-success flex items-center gap-1.5">
                                <CalendarDays className="w-4 h-4" /> Batas Pelunasan SPK
                            </h4>
                            <p className="text-[10px] text-success mt-0.5">
                                Tanggal &quot;selambat-lambatnya&quot; pelunasan harus dibayarkan oleh klien.
                                Tampil di kalimat bullet pembayaran SPK. Kosongkan untuk pakai &quot;Berlaku Sampai&quot; di Event/Proyek.
                            </p>
                        </div>
                        <input
                            type="date"
                            value={spkPaymentDeadline}
                            onChange={(e) => setSpkPaymentDeadline(e.target.value)}
                            className={`w-full border rounded px-2 py-1.5 text-sm ${spkPaymentDeadline.trim() ? 'border-success/50 bg-card' : ''}`}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Contoh hasil di SPK: <em>&quot;Pelunasan... dibayarkan pada saat booth berdiri atau selambat-lambatnya pada tanggal <strong>{spkPaymentDeadline ? new Date(spkPaymentDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : validUntil ? new Date(validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' (fallback dari Berlaku Sampai)' : '—'}</strong>.&quot;</em>
                        </p>
                    </div>

                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Pembuka SPK (Opsional)</span>}
                        value={customOpeningSpk}
                        onChange={setCustomOpeningSpk}
                        placeholder="Kosongkan untuk pakai default. Mis: 'Dengan hormat, Bersama Surat Perintah Kerja ini...'"
                        rows={3}
                        helpText="Override paragraf pembuka khusus SPK. Kosong = pakai pembuka default SPK (auto-generate)."
                    />
                    <SimpleCustomField
                        title="# Catatan / Disclaimer SPK"
                        value={customDisclaimerSpk}
                        onChange={setCustomDisclaimerSpk}
                        fallbackLabel="Penawaran"
                        fallbackValue={customDisclaimer}
                        brandDefault={brandSettings?.quotationDisclaimer ?? null}
                        placeholder="Kosong = fallback ke disclaimer Penawaran. Mis: '# Estimasi produksi 14 hari\n# Harga belum termasuk: management fee, deposit, dll'"
                    />
                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Sistem Pembayaran SPK</span>}
                        value={customPaymentTermsSpk}
                        onChange={setCustomPaymentTermsSpk}
                        fallbackLabel="Penawaran"
                        fallbackValue={customPaymentTerms}
                        brandDefault={brandSettings?.quotationPaymentTerms ?? null}
                    />
                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Penutup SPK</span>}
                        value={customClosingSpk}
                        onChange={setCustomClosingSpk}
                        fallbackLabel="Penawaran"
                        fallbackValue={customClosing}
                        brandDefault={brandSettings?.quotationClosing ?? null}
                    />
                    </>
                    )}

                    {/* ====== TAB: INVOICE ====== */}
                    {customTextTab === 'invoice' && (
                    <>
                    {/* Penanggung Jawab Invoice — override clientName kalau invoice ditujukan ke PIC berbeda (mis. Finance team) */}
                    <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/12 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                                <User className="w-4 h-4" /> Penanggung Jawab Invoice
                            </h4>
                            <p className="text-[10px] text-destructive mt-0.5">
                                Kalau invoice ditujukan ke PIC <strong>berbeda</strong> dengan PIC Penawaran (mis. ke Finance/Accounting team),
                                isi di sini. Kosongkan untuk pakai PIC dari Penawaran (<span className="font-mono">{clientName || '—'}</span>).
                            </p>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                Nama Penanggung Jawab
                            </label>
                            <input
                                type="text"
                                value={invoicePicName}
                                onChange={(e) => setInvoicePicName(e.target.value)}
                                placeholder={`Default: ${clientName || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicName.trim() ? 'border-destructive/50 bg-card' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                Jabatan <span className="font-normal text-muted-foreground">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={invoicePicPosition}
                                onChange={(e) => setInvoicePicPosition(e.target.value)}
                                placeholder="Mis. Finance Manager, Accounting Head"
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicPosition.trim() ? 'border-destructive/50 bg-card' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-foreground block mb-0.5">
                                No. HP / Telp <span className="font-normal text-muted-foreground">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={invoicePicPhone}
                                onChange={(e) => setInvoicePicPhone(e.target.value)}
                                placeholder={`Default: ${clientPhone || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicPhone.trim() ? 'border-destructive/50 bg-card' : ''}`}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Kalau diisi, akan muncul di Invoice PDF di section &quot;Kepada Yth&quot;. Kosongkan untuk pakai data dari Penawaran.
                            </p>
                        </div>
                    </div>

                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Pembuka Invoice (Opsional)</span>}
                        value={customOpeningInvoice}
                        onChange={setCustomOpeningInvoice}
                        placeholder="Kosongkan untuk pakai default. Mis: 'Dengan hormat, Bersama invoice ini kami menagihkan...'"
                        rows={3}
                        helpText="Override paragraf pembuka khusus Invoice. Kosong = pakai pembuka default Invoice (auto-generate)."
                    />
                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Catatan Harga / Disclaimer Invoice</span>}
                        value={customDisclaimerInvoice}
                        onChange={setCustomDisclaimerInvoice}
                        fallbackLabel="Penawaran"
                        fallbackValue={customDisclaimer}
                        brandDefault={brandSettings?.quotationDisclaimer ?? null}
                    />
                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Sistem Pembayaran Invoice</span>}
                        value={customPaymentTermsInvoice}
                        onChange={setCustomPaymentTermsInvoice}
                        fallbackLabel="Penawaran"
                        fallbackValue={customPaymentTerms}
                        brandDefault={brandSettings?.quotationPaymentTerms ?? null}
                    />
                    <SimpleCustomField
                        title={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Penutup / Nb Invoice</span>}
                        value={customClosingInvoice}
                        onChange={setCustomClosingInvoice}
                        fallbackLabel="Penawaran"
                        fallbackValue={customClosing}
                        brandDefault={brandSettings?.invoiceClosingText ?? null}
                    />
                    </>
                    )}
                    </div>
                    )}
                </section>
                )}

                <section className="bg-card rounded-xl border border-border p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary shrink-0" /> Ringkasan</h3>
                    {isInvoiceMode && (
                        <div className="flex flex-wrap gap-3 mb-3 p-2 bg-muted rounded text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showDiscount}
                                    onChange={(e) => setShowDiscount(e.target.checked)}
                                    className="w-3.5 h-3.5"
                                />
                                <span>Tampilkan Diskon</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showPph}
                                    onChange={(e) => setShowPph(e.target.checked)}
                                    className="w-3.5 h-3.5"
                                />
                                <span>Tampilkan PPh</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showPackagePrice}
                                    onChange={(e) => setShowPackagePrice(e.target.checked)}
                                    className="w-3.5 h-3.5"
                                />
                                <span>Tampilkan Harga Paket</span>
                            </label>
                            <span className="text-muted-foreground ml-auto">Toggle untuk PDF invoice</span>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <tbody>
                            <Row
                                label={grossUpPph ? "Target Net (sum items)" : priceIncludesTax ? "Subtotal (gross, termasuk PPN)" : "Subtotal"}
                                value={rp(subtotal)}
                            />
                            {discount > 0 && <Row label="Diskon" value={`- ${rp(discount)}`} />}
                            {grossUpPph && (
                                <tr className="text-success">
                                    <td className="py-1 text-xs">DPP gross-up (× {grossUpFactor.toFixed(4)})</td>
                                    <td className="py-1 text-right font-mono">{rp(dpp)}</td>
                                </tr>
                            )}
                            {priceIncludesTax && !grossUpPph && computedTaxAmount > 0 && (
                                <Row label="DPP (back-calc)" value={rp(dpp)} />
                            )}
                            {computedTaxAmount > 0 && (
                                <Row
                                    label={`PPN${effectiveTaxRate > 0 ? ` ${effectiveTaxRate.toFixed(2)}%` : ""}${priceIncludesTax ? " (sudah include)" : ""}`}
                                    value={rp(computedTaxAmount)}
                                />
                            )}
                            {computedPphAmount > 0 && (
                                <tr className="text-destructive">
                                    <td className="py-1">
                                        PPh{effectivePphRate > 0 ? ` ${effectivePphRate.toFixed(2)}%` : ""} (potong)
                                    </td>
                                    <td className="py-1 text-right font-mono">- {rp(computedPphAmount)}</td>
                                </tr>
                            )}
                            {effectiveDpPaid > 0 && (
                                <tr className="text-warning">
                                    <td className="py-1">DP Sudah Dibayar</td>
                                    <td className="py-1 text-right font-mono">- {rp(effectiveDpPaid)}</td>
                                </tr>
                            )}
                            <tr className="border-t font-bold text-lg">
                                <td className="py-2">Grand Total {computedTaxAmount > 0 && <span className="text-[10px] font-normal text-muted-foreground">(termasuk PPN)</span>}{effectiveDpPaid > 0 && <span className="text-[10px] font-normal text-warning"> (setelah DP)</span>}</td>
                                <td className="py-2 text-right nums">{rp(total - effectiveDpPaid)}</td>
                            </tr>
                            {effectiveDpPaid <= 0 && (
                                <>
                                    <Row label={`DP ${dpPercent}%`} value={rp(dpAmount)} />
                                    <Row label="Pelunasan" value={rp(total - dpAmount)} />
                                </>
                            )}
                            {computedPphAmount > 0 && (
                                <tr className="text-success border-t">
                                    <td className="py-1 text-xs">Jumlah diterima <span className="text-[10px] font-normal">(setelah klien potong PPh)</span></td>
                                    <td className="py-1 text-right font-mono text-xs">{rp(netReceived - effectiveDpPaid)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </section>
                </div>
            </div>

            {/* Spacer supaya konten terakhir tidak ketutup floating button */}
            <div className="h-24" />

            {/* Floating Save Button — selalu mengambang di kanan-bawah */}
            <button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-semibold shadow-2xl shadow-primary/40 ring-4 ring-white/60 disabled:opacity-60 transition-transform hover:scale-105 active:scale-95"
                title="Simpan Perubahan"
            >
                {saveMut.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Save className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">
                    {saveMut.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </span>
            </button>

            {/* ─── Generate Invoice Modal ─── */}
            {showInvoiceModal && (
                <GenerateInvoiceModal
                    quotation={data}
                    childInvoices={childInvoices}
                    onClose={() => setShowInvoiceModal(false)}
                    onSubmit={(input) => generateInvoiceMut.mutate(input)}
                    pending={generateInvoiceMut.isPending}
                />
            )}

            {/* ─── Assign Number Modal — pilih auto atau manual ─── */}
            {showAssignModal && (
                <AssignNumberModal
                    onClose={() => setShowAssignModal(false)}
                    onAuto={() => assignMut.mutate({ mode: "auto" })}
                    onManual={(customNumber) => assignMut.mutate({ mode: "manual", customNumber })}
                    pending={assignMut.isPending}
                />
            )}

            {/* ─── Calculator Modal — pop saat klik tombol kalkulator di row item ─── */}
            {calcOpenKey && (() => {
                const target = items.find((it) => it._key === calcOpenKey);
                if (!target) return null;
                return (
                    <QuotationItemCalculator
                        initialDescription={target.description}
                        initialUnit={target.unit ?? undefined}
                        initialQuantity={Number(target.quantity) || 0}
                        initialPrice={Number(target.price) || 0}
                        onApply={(r) => applyCalc(target._key, r)}
                        onCancel={() => setCalcOpenKey(null)}
                    />
                );
            })()}

            {/* ─── Preview Modal ─── */}
            {previewOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 flex flex-col"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closePreview();
                    }}
                >
                    {/* Header */}
                    <div className="bg-card border-b px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            {previewType === "spk-pdf" ? (
                                <ScrollText className="h-5 w-5 text-success" />
                            ) : previewType === "rincian-pekerjaan-pdf" ? (
                                <List className="h-5 w-5 text-warning" />
                            ) : (
                                <Eye className="h-5 w-5 text-primary" />
                            )}
                            <div>
                                <h2 className="font-bold text-foreground">
                                    {previewType === "spk-pdf"
                                        ? "Preview SPK"
                                        : previewType === "rincian-pekerjaan-pdf"
                                            ? "Preview Rincian Pekerjaan"
                                            : data.type === 'INVOICE'
                                                ? "Preview Invoice"
                                                : "Preview Penawaran"}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {data.invoiceNumber}
                                    {data.brand && <span> · Brand {data.brand}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Type switcher: Penawaran/Invoice ↔ SPK */}
                            <div className="inline-flex gap-0.5 bg-muted p-0.5 rounded-md border border-border" title="Pilih dokumen yang di-preview">
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("pdf")}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${previewType === 'pdf'
                                        ? 'bg-card text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {data.type === 'INVOICE' ? <><Receipt className="w-3.5 h-3.5" /> Invoice</> : <><FileText className="w-3.5 h-3.5" /> Penawaran</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("spk-pdf")}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${previewType === 'spk-pdf'
                                        ? 'bg-card text-success shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <ScrollText className="w-3.5 h-3.5" />SPK
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("rincian-pekerjaan-pdf")}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${previewType === 'rincian-pekerjaan-pdf'
                                        ? 'bg-card text-warning shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <List className="w-3.5 h-3.5" />Rincian
                                </button>
                            </div>

                            {/* Live toggle Tampilan Item — berlaku untuk Penawaran/Invoice & SPK.
                                Di SPK, mode Ringkas = 1 baris per kategori (nama + jumlah item). */}
                            <div className="inline-flex gap-0.5 bg-muted p-0.5 rounded-md border" title="Pilih tampilan item: detail per row atau ringkas per kategori">
                                <button
                                    type="button"
                                    onClick={() => itemDisplayMode !== 'detailed' && togglePreviewMode('detailed')}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'detailed'
                                        ? 'bg-card text-info shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <List className="w-3 h-3" /> Detail
                                </button>
                                <button
                                    type="button"
                                    onClick={() => itemDisplayMode !== 'category-summary' && togglePreviewMode('category-summary')}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'category-summary'
                                        ? 'bg-card text-info shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <BarChart2 className="w-3 h-3" /> Ringkas
                                </button>
                            </div>
                            <button
                                onClick={() => handleExport(previewType)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${previewType === 'spk-pdf' ? 'bg-success hover:bg-success/90' : previewType === 'rincian-pekerjaan-pdf' ? 'bg-warning hover:bg-warning/90' : 'bg-destructive hover:bg-destructive/90'} text-white rounded-md text-sm font-semibold`}
                                title={`Download ${previewType === 'spk-pdf' ? 'SPK' : previewType === 'rincian-pekerjaan-pdf' ? 'Rincian Pekerjaan' : 'PDF'}`}
                            >
                                <Download className="h-4 w-4" /> Download {previewType === 'spk-pdf' ? 'SPK' : previewType === 'rincian-pekerjaan-pdf' ? 'Rincian' : 'PDF'}
                            </button>
                            {previewType === "pdf" && (
                                <button
                                    onClick={() => handleExport("docx")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-info hover:bg-info/90 text-white rounded-md text-sm font-semibold"
                                >
                                    <FileText className="h-4 w-4" /> DOCX
                                </button>
                            )}
                            <button
                                onClick={closePreview}
                                className="p-2 rounded-md hover:bg-muted text-foreground"
                                aria-label="Tutup"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* PDF Body */}
                    <div className="flex-1 bg-muted overflow-hidden flex items-center justify-center">
                        {previewLoading ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-sm">Membuat preview PDF...</span>
                            </div>
                        ) : previewUrl ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full bg-card"
                                title="Preview PDF Penawaran"
                            />
                        ) : (
                            <div className="text-muted-foreground text-sm">Tidak ada preview</div>
                        )}
                    </div>
                </div>
            )}

            {/* Customer picker overlay — link/ganti customer */}
            {showCustomerPicker && (
                <CustomerPickerModal
                    onClose={() => setShowCustomerPicker(false)}
                    onPick={(c) => {
                        setCustomerIdState(c.id);
                        setLinkedCustomer(c);
                        // Auto-fill field klien yang masih kosong
                        if (!clientName) setClientName(c.companyPIC || c.name || "");
                        if (!clientCompany) setClientCompany(c.companyName || "");
                        if (!clientAddress) setClientAddress(c.address || "");
                        if (!clientPhone) setClientPhone(c.phone || "");
                        if (!clientEmail) setClientEmail(c.email || "");
                        setShowCustomerPicker(false);
                    }}
                />
            )}
        </div>
    );
}

function Field({
    label, value, onChange, type = "text", multiline, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={2}
                    placeholder={placeholder}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            )}
        </div>
    );
}

function GenerateInvoiceModal({
    quotation, childInvoices, onClose, onSubmit, pending,
}: {
    quotation: Quotation;
    childInvoices: Quotation[];
    onClose: () => void;
    onSubmit: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string; invoiceDate?: string }) => void;
    pending: boolean;
}) {
    const [part, setPart] = useState<'DP' | 'PELUNASAN' | 'FULL'>('DP');
    const total = Number(quotation.total ?? 0);
    const dpPercent = Number(quotation.dpPercent ?? 50);

    // Mode input: 'preset' (pakai DP/Pelunasan/Full default) | 'percent' (pilih %) | 'amount' (ketik Rp langsung)
    const [mode, setMode] = useState<'preset' | 'percent' | 'amount'>('preset');
    const [percentInput, setPercentInput] = useState<number>(50);
    const [amountInput, setAmountInput] = useState<string>("");
    const [dueDate, setDueDate] = useState<string>("");
    // Tanggal invoice — default hari ini, bisa diubah (mis. invoice terbit setelah event)
    const [invoiceDate, setInvoiceDate] = useState<string>(dayjs().format("YYYY-MM-DD"));

    // ─── DP yang sudah dibayar (untuk Pelunasan) ─────────────────────────
    // Auto: sum paidAmount dari child invoice DP yg sudah PAID atau PARTIALLY_PAID.
    // Custom: user input manual (kalau DP dibayar di luar sistem atau ada penyesuaian).
    const autoDpPaid = useMemo(() => {
        return childInvoices
            .filter((inv) =>
                inv.invoicePart === 'DP' &&
                (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID')
            )
            .reduce((sum, inv) => sum + Number(inv.paidAmount ?? 0), 0);
    }, [childInvoices]);
    const dpPaidCount = useMemo(() => {
        return childInvoices.filter((inv) =>
            inv.invoicePart === 'DP' &&
            (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID')
        ).length;
    }, [childInvoices]);
    const [dpPaidMode, setDpPaidMode] = useState<'auto' | 'custom'>('auto');
    const [customDpPaid, setCustomDpPaid] = useState<string>("");
    const effectiveDpPaid = dpPaidMode === 'auto'
        ? autoDpPaid
        : (parseFloat(customDpPaid) || 0);

    // Auto-amount per part di mode 'preset'
    // PELUNASAN: pakai (total - DP terbayar) kalau ada data DP, fallback ke dpPercent default
    const presetAmount =
        part === 'DP' ? (total * dpPercent) / 100 :
        part === 'PELUNASAN' ? (effectiveDpPaid > 0 ? total - effectiveDpPaid : total - (total * dpPercent) / 100) :
        total;

    const computedAmount = (() => {
        if (mode === 'preset') return presetAmount;
        if (mode === 'percent') return (total * percentInput) / 100;
        if (mode === 'amount') return parseFloat(amountInput) || 0;
        return 0;
    })();

    const computedPercent = total > 0 ? (computedAmount / total) * 100 : 0;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Buat Invoice
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Buat invoice dari penawaran <b className="font-mono">{quotation.invoiceNumber}</b>.
                    Total grand: <b>{rp(total)}</b>
                </p>

                {/* Tipe Invoice — label saja, untuk subject/heading di PDF */}
                <div>
                    <label className="block text-sm font-semibold mb-1.5">Tipe Invoice</label>
                    <div className="grid grid-cols-3 gap-2">
                        <PartBtn active={part === "DP"} onClick={() => setPart("DP")} label="DP" sub="Down Payment" />
                        <PartBtn active={part === "PELUNASAN"} onClick={() => setPart("PELUNASAN")} label="Pelunasan" sub="Final Payment" />
                        <PartBtn active={part === "FULL"} onClick={() => setPart("FULL")} label="Full" sub="Sekali Bayar" />
                    </div>
                </div>

                {/* DP yang sudah dibayar — cuma tampil saat part = PELUNASAN */}
                {part === 'PELUNASAN' && (
                    <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-warning inline-flex items-center gap-1">
                                <Wallet className="w-3.5 h-3.5" /> DP Sudah Dibayar
                            </label>
                            <div className="inline-flex gap-0.5 bg-card p-0.5 rounded border border-warning/30">
                                <button
                                    type="button"
                                    onClick={() => setDpPaidMode('auto')}
                                    className={`px-2 py-0.5 text-xs rounded font-semibold ${dpPaidMode === 'auto' ? 'bg-warning text-warning-foreground' : 'text-warning hover:bg-warning/10'}`}
                                >
                                    Otomatis
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDpPaidMode('custom')}
                                    className={`px-2 py-0.5 text-xs rounded font-semibold ${dpPaidMode === 'custom' ? 'bg-warning text-warning-foreground' : 'text-warning hover:bg-warning/10'}`}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>
                        {dpPaidMode === 'auto' ? (
                            <div>
                                <div className="text-2xl font-bold font-mono text-warning">
                                    {rp(autoDpPaid)}
                                </div>
                                <p className="text-[11px] text-warning mt-0.5">
                                    {dpPaidCount === 0
                                        ? "Belum ada invoice DP yang sudah dibayar. Kalau DP dibayar di luar sistem, pilih Custom & input manual."
                                        : `Auto dari ${dpPaidCount} invoice DP yang sudah ter-bayar (PAID/PARTIALLY_PAID).`}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warning font-semibold text-sm">Rp</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={customDpPaid}
                                        onChange={(e) => setCustomDpPaid(e.target.value)}
                                        placeholder={`contoh: ${(total * dpPercent / 100).toFixed(0)}`}
                                        inputMode="numeric"
                                        className="w-full border-2 border-warning/30 rounded-md pl-10 pr-3 py-2 text-base font-mono text-right focus:border-warning outline-none bg-card"
                                    />
                                </div>
                                <p className="text-[11px] text-warning mt-1">
                                    Override manual — pakai kalau DP dibayar di luar sistem atau ada penyesuaian.
                                </p>
                            </div>
                        )}
                        <div className="text-xs text-warning border-t border-warning/30 pt-2">
                            Pelunasan = Total ({rp(total)}) − DP ({rp(effectiveDpPaid)}) = <b className="font-mono">{rp(total - effectiveDpPaid)}</b>
                        </div>
                    </div>
                )}

                {/* Cara Tentukan Jumlah */}
                <div>
                    <label className="block text-sm font-semibold mb-1.5">Cara Tentukan Jumlah</label>
                    <div className="inline-flex gap-1 bg-muted p-1 rounded-md w-full">
                        <ModeBtn active={mode === 'preset'} onClick={() => setMode('preset')} label="Default" />
                        <ModeBtn active={mode === 'percent'} onClick={() => setMode('percent')} label="% Persen" />
                        <ModeBtn active={mode === 'amount'} onClick={() => setMode('amount')} label="Rp Custom" />
                    </div>
                </div>

                {/* Mode: Preset (default) */}
                {mode === 'preset' && (
                    <div className="rounded-lg bg-muted border p-3 text-xs text-foreground">
                        <Zap className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Pakai default sesuai tipe:
                        {part === "DP" && <> DP <b>{dpPercent}%</b> dari total</>}
                        {part === "PELUNASAN" && (
                            <> {effectiveDpPaid > 0
                                ? <>Total − DP terbayar (<b>{rp(effectiveDpPaid)}</b>)</>
                                : <>Sisa setelah DP {dpPercent}% (no DP record)</>}</>
                        )}
                        {part === "FULL" && <> Total grand</>}
                    </div>
                )}

                {/* Mode: Persentase dengan preset & slider */}
                {mode === 'percent' && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-1">
                            {[10, 25, 30, 50, 70].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPercentInput(p)}
                                    className={`px-2 py-1.5 rounded-md text-xs font-bold border-2 transition ${percentInput === p
                                        ? "bg-primary text-white border-primary"
                                        : "bg-card text-foreground border-border hover:border-primary/40"
                                        }`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={percentInput}
                                onChange={(e) => setPercentInput(parseFloat(e.target.value))}
                                className="flex-1"
                            />
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={percentInput}
                                    onChange={(e) => setPercentInput(parseFloat(e.target.value) || 0)}
                                    className="w-full border-2 rounded px-2 py-1 text-sm font-mono text-right focus:border-primary outline-none pr-7"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mode: Custom Rp */}
                {mode === 'amount' && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-1">
                            {[
                                { label: "DP %", value: presetAmount, hint: `${dpPercent}%` },
                                { label: "Pelunasan", value: total - presetAmount, hint: `${(100 - dpPercent).toFixed(0)}%` },
                                { label: "Full", value: total, hint: "100%" },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setAmountInput(String(preset.value))}
                                    className="px-2 py-1.5 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted text-left"
                                >
                                    <div>{preset.label}</div>
                                    <div className="font-mono text-primary">{rp(preset.value)}</div>
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Rp</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                placeholder="contoh: 5000000"
                                inputMode="numeric"
                                className="w-full border-2 rounded-md pl-11 pr-3 py-2.5 text-base font-mono text-right focus:border-primary outline-none"
                                autoFocus
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Ketik nominal langsung (mis. <code>5000000</code> untuk Rp 5 juta). Bisa untuk termin custom yang tidak persis persentase.
                        </p>
                    </div>
                )}

                {/* Hasil — selalu tampil prominent */}
                <div className="rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-destructive/12 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
                        Jumlah yang Akan Ditagihkan
                    </div>
                    <div className="text-3xl font-bold font-mono text-primary leading-tight">
                        {rp(computedAmount)}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="text-xs text-primary">
                            ≈ <b>{computedPercent.toFixed(1)}%</b> dari total
                        </div>
                        <div className="text-xs text-primary">
                            Sisa: <b className="font-mono">{rp(total - computedAmount)}</b>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-1.5">
                        Tanggal Invoice
                    </label>
                    <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Default hari ini. Ubah kalau invoice diterbitkan setelah event selesai.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-1.5">
                        Jatuh Tempo <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                </div>

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-muted"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => onSubmit({
                            part,
                            // Kalau mode != preset, kirim customAmount agar backend pakai nilai itu
                            customAmount: mode === 'preset' ? undefined : computedAmount,
                            dueDate: dueDate || undefined,
                            invoiceDate: invoiceDate || undefined,
                        })}
                        disabled={pending || computedAmount <= 0}
                        className="flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-bold disabled:opacity-50"
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                        Buat Invoice {rp(computedAmount)}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PartBtn({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-3 rounded-lg border-2 transition ${active ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-border"}`}
        >
            <div className="font-bold text-sm">{label}</div>
            <div className="text-[11px] text-muted-foreground">{sub}</div>
        </button>
    );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 px-3 py-1.5 rounded text-xs font-bold transition ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
        >
            {label}
        </button>
    );
}

function AssignNumberModal({
    onClose, onAuto, onManual, pending,
}: {
    onClose: () => void;
    onAuto: () => void;
    onManual: (customNumber: string) => void;
    pending: boolean;
}) {
    const [mode, setMode] = useState<"auto" | "manual">("auto");
    const [customNumber, setCustomNumber] = useState("");

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Hash className="h-5 w-5 text-success" />
                        Assign Nomor Resmi
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Pilih mode penomoran. Setelah assign, nomor draft akan diganti permanen.
                </p>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("auto")}
                        className={`p-3 rounded-lg border-2 text-left transition ${mode === "auto"
                            ? "border-success/50 bg-success/10"
                            : "border-border bg-card hover:border-border"
                            }`}
                    >
                        <div className="font-bold text-sm flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Auto</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Generate dari counter (ikut urutan brand & tahun)
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("manual")}
                        className={`p-3 rounded-lg border-2 text-left transition ${mode === "manual"
                            ? "border-info bg-info/10"
                            : "border-border bg-card hover:border-border"
                            }`}
                    >
                        <div className="font-bold text-sm flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Manual</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Ketik nomor sendiri (tidak increment counter)
                        </div>
                    </button>
                </div>

                {mode === "manual" && (
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                            Nomor Manual <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            value={customNumber}
                            onChange={(e) => setCustomNumber(e.target.value)}
                            placeholder="contoh: 100/Ep/Pnwr/V/26"
                            className="w-full border-2 rounded-md px-3 py-2 text-sm font-mono focus:border-info outline-none"
                            autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground">
                            <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Pakai format mirip auto biar konsisten. Sistem cek unique — kalau sudah dipakai, ditolak.
                        </p>
                    </div>
                )}

                {mode === "auto" && (
                    <div className="bg-success/10 border border-success/30 rounded-md p-3 text-xs text-success">
                        <Zap className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Sistem akan ambil nomor berikutnya dari counter (mis. <code className="bg-card px-1 rounded">42/Ep/Pnwr/IV/26</code> kalau sudah ada 41 quotation Exindo bulan ini).
                    </div>
                )}

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-muted"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => mode === "auto" ? onAuto() : onManual(customNumber)}
                        disabled={pending || (mode === "manual" && !customNumber.trim())}
                        className={`flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-md text-sm font-bold disabled:opacity-50 ${mode === "auto"
                            ? "bg-success hover:bg-success/90"
                            : "bg-info hover:bg-info/90"
                            }`}
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                        Assign {mode === "auto" ? "Auto" : "Manual"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td className="py-1 text-muted-foreground">{label}</td>
            <td className="py-1 text-right nums">{value}</td>
        </tr>
    );
}

/** Row item draggable — drag handle di kolom kiri, isinya sama persis dengan tr lama. */
function SortableItemRow({
    it, sub, updateItem, duplicateItem, removeItem, setCalcOpenKey, rp,
    eventOptions, showPackageCol,
}: {
    it: ItemRow;
    sub: number;
    updateItem: (k: string, patch: Partial<QuotationItem>) => void;
    duplicateItem: (k: string) => void;
    removeItem: (k: string) => void;
    setCalcOpenKey: (k: string | null) => void;
    rp: (v: string | number) => string;
    /** Pilihan event untuk dropdown event-grouped. Empty = sembunyikan kolom event. */
    eventOptions: Array<{ index: number; label: string }>;
    /** Tampilkan kolom Paket? False di Mode Sederhana. */
    showPackageCol: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it._key });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: isDragging ? "rgb(239 246 255)" : undefined,
    };
    return (
        <tr ref={setNodeRef} style={style} className="border-t [&>td]:align-top">
            <td className="px-1 py-1 text-center">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
                    title="Drag untuk mengurutkan"
                    aria-label="Drag handle"
                >
                    <GripVertical className="w-4 h-4" />
                </button>
            </td>
            <td className="px-2 py-1">
                <input
                    list="quotation-category-list"
                    value={it.categoryName ?? ""}
                    onChange={(e) => updateItem(it._key, { categoryName: e.target.value || null })}
                    placeholder="(opsional)"
                    className="w-full border rounded px-2 py-1 text-xs"
                />
            </td>
            {/* Kolom Event — hanya muncul kalau ada multi-event */}
            {eventOptions.length > 0 && (
                <td className="px-2 py-1">
                    <select
                        value={(it as any).eventIndex ?? ''}
                        onChange={(e) =>
                            updateItem(it._key, {
                                eventIndex: e.target.value === '' ? null : Number(e.target.value),
                            } as any)
                        }
                        className="w-full border rounded px-1 py-1 text-xs"
                        title="Link item ke event tertentu (pricing per lokasi)"
                    >
                        <option value="">— shared —</option>
                        {eventOptions.map((opt) => (
                            <option key={opt.index} value={opt.index}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </td>
            )}
            {/* Kolom Paket — input text untuk grouping package (Mode Lengkap saja) */}
            {showPackageCol && (
                <td className="px-2 py-1">
                    <input
                        type="text"
                        value={(it as any).packageGroup ?? ""}
                        onChange={(e) =>
                            updateItem(it._key, { packageGroup: e.target.value || null } as any)
                        }
                        placeholder="(opt) Pkg"
                        className="w-full border rounded px-1 py-1 text-xs"
                        title="Mode 'package': nama paket (mis. Package 1)"
                    />
                </td>
            )}
            <td className="px-2 py-1">
                <AutoGrowTextarea
                    value={it.description}
                    onChange={(v) => updateItem(it._key, { description: v })}
                    className="border rounded px-2 py-1"
                />
            </td>
            <td className="px-2 py-1">
                <input
                    type="number"
                    step="0.01"
                    value={Number(it.quantity)}
                    onChange={(e) => updateItem(it._key, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-2 py-1 text-right"
                />
            </td>
            <td className="px-2 py-1">
                <AutoGrowTextarea
                    value={it.unit ?? ""}
                    onChange={(v) => updateItem(it._key, { unit: v })}
                    placeholder="unit/hari"
                    className="border rounded px-2 py-1"
                />
            </td>
            <td className="px-2 py-1">
                <input
                    type="number"
                    value={Number(it.price)}
                    onChange={(e) => updateItem(it._key, { price: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-2 py-1 text-right"
                />
            </td>
            <td className="px-2 py-1 text-right font-mono truncate">{rp(sub)}</td>
            <td className="px-1 py-1 text-center">
                <div className="flex items-center justify-center gap-0.5">
                    <button
                        onClick={() => setCalcOpenKey(it._key)}
                        className="text-info hover:bg-info/10 p-1 rounded"
                        title="Kalkulator: Unit × Hari × Jam × m²"
                    >
                        <Calculator className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => duplicateItem(it._key)}
                        className="text-success hover:bg-success/10 p-1 rounded"
                        title="Duplikat item"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => removeItem(it._key)}
                        className="text-destructive hover:bg-destructive/12 p-1 rounded"
                        title="Hapus item"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

/**
 * Field custom text simpel — 1 textarea full override.
 * Dipakai di tab SPK & Invoice. Tampilkan info fallback (kalau kosong → fallback ke nilai lain).
 */
function SimpleCustomField({
    title, value, onChange, placeholder, rows, helpText, fallbackLabel, fallbackValue, brandDefault,
}: {
    title: ReactNode;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    helpText?: string;
    fallbackLabel?: string;        // mis. "Penawaran"
    fallbackValue?: string;         // value field penawaran (untuk "salin dari")
    brandDefault?: string | null;
}) {
    const hasFallback = Boolean(fallbackValue && fallbackValue.trim());
    const isActive = Boolean(value && value.trim());
    return (
        <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-foreground">{title}</label>
                <div className="flex items-center gap-1.5">
                    {fallbackLabel && hasFallback && !isActive && (
                        <button
                            type="button"
                            onClick={() => onChange(fallbackValue!)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 border border-info/30 text-info hover:bg-info/15"
                            title={`Salin nilai dari ${fallbackLabel}`}
                        >
                            <Copy className="w-3 h-3 inline" /> Salin dari {fallbackLabel}
                        </button>
                    )}
                    {brandDefault && !isActive && (
                        <button
                            type="button"
                            onClick={() => onChange(brandDefault)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20"
                            title="Salin dari pengaturan brand"
                        >
                            <Copy className="w-3 h-3 inline" /> Salin Brand
                        </button>
                    )}
                    {isActive && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="text-[10px] text-warning hover:underline"
                        >
                            <X className="inline align-[-2px] w-3 h-3 mr-0.5" /> Reset
                        </button>
                    )}
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows ?? 4}
                placeholder={placeholder ?? `Kosongkan untuk fallback ke ${fallbackLabel ?? 'default brand'}.`}
                className={`w-full border rounded px-2 py-1.5 text-xs font-sans ${isActive ? "border-success/30 bg-card ring-1 ring-success/30" : ""
                    }`}
            />
            {helpText && (
                <p className="text-[10px] text-muted-foreground">{helpText}</p>
            )}
            {!helpText && fallbackLabel && (
                <p className="text-[10px] text-muted-foreground">
                    {isActive ? (
                        <><CheckCircle2 className="inline align-[-2px] w-3 h-3 text-success mr-0.5" />Custom aktif — override {fallbackLabel}.</>
                    ) : (
                        <>Kosong → pakai dari {fallbackLabel}{hasFallback ? "" : " (juga kosong → pakai default brand)"}.</>
                    )}
                </p>
            )}
        </div>
    );
}

/** Field section dengan 2 textarea (prepend/append) yang sandwich brand default text. */
function PrependAppendField({
    title, prepend, append, onPrepend, onAppend, brandDefault,
    custom, onCustom,
}: {
    title: ReactNode;
    prepend: string;
    append: string;
    onPrepend: (v: string) => void;
    onAppend: (v: string) => void;
    brandDefault: string | null;
    /** Custom full-override teks. Kalau diisi, REPLACE default brand + abaikan prepend/append. */
    custom?: string;
    onCustom?: (v: string) => void;
}) {
    const [showDefault, setShowDefault] = useState(false);
    // "Tambah teks di atas/bawah" disembunyikan default — dibuka kalau perlu.
    // Auto-buka kalau sudah ada isinya supaya user gak kehilangan input lama.
    const [showAddons, setShowAddons] = useState(() => Boolean(prepend || append));
    const hasCustomOverride = Boolean(custom && custom.trim());
    return (
        <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-foreground">{title}</label>
                <div className="flex items-center gap-2">
                    {brandDefault && (
                        <button
                            type="button"
                            onClick={() => setShowDefault((v) => !v)}
                            className="text-[10px] text-info hover:underline inline-flex items-center gap-1"
                        >
                            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showDefault ? 'rotate-180' : ''}`} />
                            {showDefault ? "Sembunyikan" : "Lihat default brand"}
                        </button>
                    )}
                </div>
            </div>

            {/* Default brand preview (collapsible) */}
            {showDefault && (
                <div className="bg-warning/10 border border-warning/30 rounded p-2">
                    <div className="text-[10px] font-bold text-warning mb-0.5 flex items-center gap-1"><Pin className="w-3 h-3" /> Default dari pengaturan brand:</div>
                    <pre className="text-[10px] text-warning whitespace-pre-wrap font-sans">{brandDefault || "(belum di-set di pengaturan brand)"}</pre>
                </div>
            )}

            {/* Custom full-override — kalau diisi REPLACE default brand total */}
            {onCustom !== undefined && (
                <div>
                    <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-medium text-primary inline-flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Custom (override penuh — abaikan default brand)
                        </label>
                        {brandDefault && !hasCustomOverride && (
                            <button
                                type="button"
                                onClick={() => onCustom(brandDefault)}
                                className="text-[10px] text-info hover:underline"
                                title="Salin default brand sebagai starting point"
                            >
                                <Copy className="w-3 h-3 inline" /> Salin dari brand
                            </button>
                        )}
                        {hasCustomOverride && (
                            <button
                                type="button"
                                onClick={() => onCustom("")}
                                className="text-[10px] text-warning hover:underline"
                                title="Kosongkan untuk pakai default brand lagi"
                            >
                                <X className="inline align-[-2px] w-3 h-3 mr-0.5" /> Reset
                            </button>
                        )}
                    </div>
                    <textarea
                        value={custom ?? ""}
                        onChange={(e) => onCustom(e.target.value)}
                        rows={hasCustomOverride ? 5 : 2}
                        placeholder="Kosongkan untuk pakai default brand. Kalau diisi, REPLACE total — prepend/append di bawah juga di-skip."
                        className={`w-full border rounded px-2 py-1.5 text-xs font-sans ${hasCustomOverride
                            ? "border-primary/30 bg-primary/10 ring-1 ring-primary/30"
                            : ""
                            }`}
                    />
                    {hasCustomOverride && (
                        <p className="text-[10px] text-primary mt-1 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> Custom aktif — default brand &amp; tambahan teks di-skip total.
                        </p>
                    )}
                </div>
            )}

            {/* Toggle untuk menampilkan field "Tambah teks di atas/bawah" — disembunyikan default. Disable kalau custom aktif. */}
            {hasCustomOverride ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-1">
                    Tambahan teks dinonaktifkan saat custom override aktif.
                </p>
            ) : !showAddons ? (
                <button
                    type="button"
                    onClick={() => setShowAddons(true)}
                    className="w-full text-[11px] text-muted-foreground hover:text-info hover:bg-info/10 border border-dashed border-border hover:border-info/40 rounded py-1.5 transition"
                >
                    <Plus className="w-3 h-3 inline" /> Tambah teks di atas/bawah default brand (opsional)
                </button>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            Tambahan teks
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setShowAddons(false);
                                onPrepend("");
                                onAppend("");
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive hover:underline"
                            title="Sembunyikan & kosongkan kedua field"
                        >
                            <X className="inline align-[-2px] w-3 h-3 mr-0.5" /> Sembunyikan
                        </button>
                    </div>

                    {/* Prepend — di ATAS default brand */}
                    <div>
                        <label className="text-[10px] font-medium text-success inline-flex items-center gap-1 mb-0.5">
                            <ArrowUp className="w-3 h-3" /> Tambah di ATAS default brand
                        </label>
                        <textarea
                            value={prepend}
                            onChange={(e) => onPrepend(e.target.value)}
                            rows={2}
                            placeholder="Kosongkan kalau tidak perlu. Mis: 'Note khusus event ini:'"
                            className="w-full border rounded px-2 py-1.5 text-xs font-sans"
                        />
                    </div>

                    {/* Append — di BAWAH default brand */}
                    <div>
                        <label className="text-[10px] font-medium text-info inline-flex items-center gap-1 mb-0.5">
                            <ArrowDown className="w-3 h-3" /> Tambah di BAWAH default brand
                        </label>
                        <textarea
                            value={append}
                            onChange={(e) => onAppend(e.target.value)}
                            rows={2}
                            placeholder="Kosongkan kalau tidak perlu. Mis: 'Untuk event ini, harga sudah include logistic loading dock.'"
                            className="w-full border rounded px-2 py-1.5 text-xs font-sans"
                        />
                    </div>

                    <p className="text-[9px] text-muted-foreground italic">
                        Format final di PDF: [Atas] + [Default Brand] + [Bawah] (yang kosong di-skip).
                    </p>
                </>
            )}
        </div>
    );
}

/**
 * Helper "Gross-Up PPh" — kalkulator buat marketing yang punya target net
 * (mis. harga target marketing 47jt), dan butuh tahu berapa DPP yang harus dipasang
 * supaya setelah PPh dipotong, target tetap tercapai.
 *
 * Rumus: DPP gross-up = target × 100 / (100 − pphRate%)
 *  - PPh 2% → ÷ 0.98 (× 100/98)
 *  - PPh 1.5% → ÷ 0.985
 *  - PPh 0.5% → ÷ 0.995
 *
 * Tool ini info-only — tidak auto-apply ke item. Marketing pakai hasilnya sebagai
 * referensi untuk pasang harga item.
 */
function GrossUpHelper({ effectivePphRate }: { effectivePphRate: number }) {
    const [target, setTarget] = useState<string>("");
    const [open, setOpen] = useState(false);

    const targetNum = parseFloat(target) || 0;
    const rate = effectivePphRate || 0;
    const grossUp = rate > 0 && rate < 100
        ? targetNum * 100 / (100 - rate)
        : targetNum;
    const pphDeducted = grossUp - targetNum;

    return (
        <div className="bg-card border border-destructive/30 rounded">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full px-2 py-1.5 text-left text-[11px] font-semibold text-destructive hover:bg-destructive/12 flex items-center justify-between rounded"
            >
                <span className="inline-flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Helper Gross-Up dari Target Net</span>
                <ChevronDown className={`w-4 h-4 text-destructive shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-2 py-2 border-t border-destructive/30 space-y-2 text-[11px]">
                    <p className="text-foreground">
                        Marketing punya <b>target harga net</b> (yang ingin diterima setelah PPh)?
                        Tool ini ngitung DPP yang harus dipasang supaya net tetap sesuai target.
                    </p>
                    <div>
                        <label className="text-[10px] font-semibold text-destructive block mb-0.5">
                            Target net (Rp)
                        </label>
                        <input
                            type="number"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="mis. 47000000"
                            className="w-full px-2 py-1.5 text-xs border border-destructive/30 rounded font-mono"
                        />
                    </div>
                    {targetNum > 0 && rate > 0 && (
                        <div className="bg-destructive/12 border border-destructive/30 rounded p-2 space-y-1">
                            <div className="font-mono text-[10px] text-muted-foreground">
                                Rumus: {targetNum.toLocaleString("id-ID")} × 100 / {(100 - rate).toFixed(2)} = …
                            </div>
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="text-foreground">DPP yang harus dipasang:</span>
                                <span className="font-mono font-bold text-destructive">
                                    Rp {Math.round(grossUp).toLocaleString("id-ID")}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">PPh {rate.toFixed(1)}% yang dipotong:</span>
                                <span className="font-mono text-destructive">
                                    Rp {Math.round(pphDeducted).toLocaleString("id-ID")}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-destructive/30">
                                <span className="text-success font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Net yang diterima:</span>
                                <span className="font-mono font-bold text-success">
                                    Rp {Math.round(targetNum).toLocaleString("id-ID")}
                                </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground italic mt-1">
                                <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Pasang harga item total = <b>Rp {Math.round(grossUp).toLocaleString("id-ID")}</b> di tabel items
                                (boleh dipecah per-item, asal sum = nilai ini). Otomatis setelah PPh dipotong klien, vendor terima <b>Rp {Math.round(targetNum).toLocaleString("id-ID")}</b>.
                            </p>
                        </div>
                    )}
                    {targetNum > 0 && rate === 0 && (
                        <div className="text-[10px] text-warning italic flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> PPh rate = 0%. Set PPh rate dulu di atas untuk hitung gross-up.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Editor jatuh tempo invoice — support single date / range mode,
 * reason field saat perubahan, dan tampilkan audit log history extend.
 */
function DueDateEditor({
    invoiceId, dueDate, setDueDate, dueDateEnd, setDueDateEnd,
    dueDateMode, setDueDateMode, changeReason, setChangeReason,
    originalDueDate, originalDueDateEnd,
}: {
    invoiceId: number;
    dueDate: string; setDueDate: (v: string) => void;
    dueDateEnd: string; setDueDateEnd: (v: string) => void;
    dueDateMode: "single" | "range"; setDueDateMode: (v: "single" | "range") => void;
    changeReason: string; setChangeReason: (v: string) => void;
    originalDueDate: string; originalDueDateEnd: string;
}) {
    const [showHistory, setShowHistory] = useState(false);
    const { data: history = [], isLoading } = useQuery<DueDateHistoryEntry[]>({
        queryKey: ["duedate-history", invoiceId],
        queryFn: () => getDueDateHistory(invoiceId),
        enabled: !!invoiceId,
        staleTime: 30_000,
    });

    const isChanged = dueDate !== originalDueDate
        || (dueDateMode === "range" ? dueDateEnd : "") !== originalDueDateEnd;

    const formatDate = (s: string | null) => s
        ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
        : "—";

    return (
        <div className="border-2 border-warning/30 bg-warning/10 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-warning flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Jatuh Tempo Invoice
                </label>
                <div className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-card p-0.5 text-[10px] font-semibold">
                    <button
                        type="button"
                        onClick={() => { setDueDateMode("single"); setDueDateEnd(""); }}
                        className={`px-2.5 py-0.5 rounded-full transition ${dueDateMode === "single" ? "bg-warning text-warning-foreground" : "text-warning hover:bg-warning/20"}`}
                    >
                        <CalendarDays className="w-3 h-3 inline" /> 1 Tanggal
                    </button>
                    <button
                        type="button"
                        onClick={() => setDueDateMode("range")}
                        className={`px-2.5 py-0.5 rounded-full transition ${dueDateMode === "range" ? "bg-warning text-warning-foreground" : "text-warning hover:bg-warning/20"}`}
                    >
                        <CalendarRange className="w-3 h-3 inline" /> Range
                    </button>
                </div>
            </div>
            {dueDateMode === "single" ? (
                <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border-2 border-warning/30 rounded px-3 py-2 text-sm bg-card focus:border-warning outline-none"
                />
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-warning font-semibold uppercase">Dari</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full border-2 border-warning/30 rounded px-3 py-2 text-sm bg-card focus:border-warning outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-warning font-semibold uppercase">Sampai</label>
                        <input
                            type="date"
                            value={dueDateEnd}
                            onChange={(e) => setDueDateEnd(e.target.value)}
                            min={dueDate || undefined}
                            className="w-full border-2 border-warning/30 rounded px-3 py-2 text-sm bg-card focus:border-warning outline-none"
                        />
                    </div>
                </div>
            )}

            {/* Reason field — muncul kalau dueDate berubah dari original */}
            {isChanged && (
                <div className="bg-destructive/12 border-2 border-destructive/30 rounded p-2 space-y-1">
                    <label className="text-[11px] font-bold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" /> Alasan perubahan jatuh tempo <span className="text-destructive">(wajib untuk audit log)</span>
                    </label>
                    <textarea
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Mis. 'Klien belum ada uang, minta tunda 1 minggu' atau 'Cashflow klien telat, extend ke akhir bulan'"
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs border border-destructive/30 rounded bg-card resize-y"
                    />
                    <p className="text-[10px] text-destructive">
                        <Lightbulb className="inline align-[-2px] w-3.5 h-3.5 text-warning mr-0.5" /> Owner akan lihat alasan ini di history audit — untuk tracking kenapa pembayaran tertunda.
                    </p>
                </div>
            )}

            {dueDate && (
                <div className="text-[11px] bg-card border border-warning/30 rounded px-2 py-1 font-mono">
                    Display: <b>{dueDateMode === "range" && dueDateEnd
                        ? `${new Date(dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(dueDateEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
                        : new Date(dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</b>
                </div>
            )}

            {/* History toggle */}
            <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="w-full text-left text-[11px] font-semibold text-warning hover:text-warning flex items-center justify-between bg-card border border-warning/30 rounded px-2 py-1.5"
            >
                <span className="inline-flex items-center gap-1"><History className="w-3.5 h-3.5" /> History Perubahan Jatuh Tempo ({history.length})</span>
                <ChevronDown className={`w-4 h-4 text-warning shrink-0 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
                <div className="bg-card border border-warning/30 rounded p-2 space-y-1.5 max-h-64 overflow-y-auto">
                    {isLoading ? (
                        <div className="text-[11px] text-muted-foreground italic">Memuat history...</div>
                    ) : history.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic text-center py-2">
                            Belum ada perubahan tanggal. History akan muncul setelah dueDate di-edit.
                        </div>
                    ) : history.map((h) => (
                        <div key={h.id} className="border-l-2 border-warning/50 bg-warning/10 pl-2 py-1 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-warning">
                                    {new Date(h.changedAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            <div className="text-foreground mt-0.5">
                                <span className="text-muted-foreground">Dari: </span>
                                <span className="font-mono">{formatDate(h.oldDueDate)}{h.oldDueDateEnd ? ` – ${formatDate(h.oldDueDateEnd)}` : ""}</span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="font-mono font-semibold text-warning">{formatDate(h.newDueDate)}{h.newDueDateEnd ? ` – ${formatDate(h.newDueDateEnd)}` : ""}</span>
                            </div>
                            {h.reason && (
                                <div className="mt-1 bg-card border border-warning/30 rounded px-1.5 py-1 italic text-foreground text-[10px]">
                                    <MessageSquare className="inline align-[-2px] w-3.5 h-3.5 text-muted-foreground mr-0.5" /> &ldquo;{h.reason}&rdquo;
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
