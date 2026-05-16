"use client";

import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Plus, Trash2, Save, Hash, GitBranch, FileDown, FileText, Loader2, ScrollText,
    Eye, X, Download, Calculator, Copy, GripVertical, Pencil,
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
    type Quotation, type QuotationItem,
} from "@/lib/api/quotations";
import { Receipt } from "lucide-react";
import { ACTIVE_BRANDS, BRAND_META, getBrand, type Brand } from "@/lib/api/brands";
import { listQuotationVariants } from "@/lib/api/quotation-variants";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { getBankAccounts } from "@/lib/api/transactions";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import type { Customer } from "@/lib/api/customers";
import { Users, Search } from "lucide-react";

dayjs.locale("id");

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    PAID: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-red-100 text-red-700",
    EXPIRED: "bg-yellow-100 text-yellow-700",
};

type ItemRow = QuotationItem & { _key: string };

function keyed(items: QuotationItem[]): ItemRow[] {
    return items.map((it, idx) => ({ ...it, _key: `${it.id ?? "new"}-${idx}-${Math.random()}` }));
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
    const [docDate, setDocDate] = useState("");
    const [signCity, setSignCity] = useState("");
    const [taxRate, setTaxRate] = useState(0);
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
    /** Harga paket — alternatif diskon dengan label "Harga Paket". 0 = pakai total normal. */
    const [packagePrice, setPackagePrice] = useState<number>(0);
    /** Tampilkan grand total di footer? Default true. False untuk mode 'package'. */
    const [showGrandTotal, setShowGrandTotal] = useState<boolean>(true);

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
    const [previewType, setPreviewType] = useState<"pdf" | "spk-pdf">("pdf");

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
        setDocDate(data.date ? data.date.slice(0, 10) : "");
        setSignCity(data.signCity ?? "");
        setTaxRate(Number(data.taxRate ?? 0));
        setDiscount(Number(data.discount ?? 0));
        setDpPercent(Number(data.dpPercent ?? 50));
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

    const showErr = (label: string) => (err: any) =>
        alert(`${label}: ${err?.response?.data?.message || err?.message || "gagal"}`);

    const saveMut = useMutation({
        mutationFn: (payload: any) => updateQuotation(id, payload),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
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

    // List invoices yang sudah di-generate dari quotation ini
    const { data: childInvoices = [] } = useQuery({
        queryKey: ["quotation-invoices", id],
        queryFn: () => listInvoicesByQuotation(id),
        enabled: !!data && !data?.invoiceNumber.startsWith("DRAFT-"),
    });

    const generateInvoiceMut = useMutation({
        mutationFn: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string }) =>
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
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount - (discount || 0);
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
            date: docDate || undefined,
            signCity: signCity.trim() || null,
            variantCode: variantCode || null,
            signedByWorkerId: signedByWorkerId ?? null,
            itemDisplayMode,
            bankAccountIds: bankAccountIds || undefined,
            taxRate,
            discount,
            dpPercent,
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
            packagePrice: packagePrice > 0 ? packagePrice : null,
            showGrandTotal,
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

    const handlePreview = async (type: "pdf" | "spk-pdf" = "pdf") => {
        setPreviewType(type);
        setPreviewLoading(true);
        setPreviewOpen(true);
        try {
            const { blob } = await downloadQuotationExport(id, type);
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
    const switchPreviewType = async (type: "pdf" | "spk-pdf") => {
        if (type === previewType) return;
        setPreviewType(type);
        setPreviewLoading(true);
        try {
            const { blob } = await downloadQuotationExport(id, type);
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
            const { blob } = await downloadQuotationExport(id, previewType);
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

    const handleExport = async (format: "pdf" | "docx" | "spk-pdf") => {
        try {
            const { blob, filename } = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            // Pakai <a download> untuk PDF & DOCX supaya nama file dari server (Content-Disposition)
            // dipakai Windows/Save As dialog. window.open() bikin browser pakai blob UUID jadi nama.
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            if (format === "pdf" || format === "spk-pdf") a.target = "_blank"; // PDF buka di tab baru
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
                    <Link href="/penawaran" className="text-sm text-blue-600 flex items-center gap-1 mb-2 hover:underline">
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap group">
                        <span>{data.type === "INVOICE" ? "Invoice" : "Penawaran"}</span>
                        <span className="font-mono text-xl text-slate-700">{data.invoiceNumber}</span>
                        {/* Tombol edit nomor — muncul untuk dokumen yang sudah di-assign (bukan DRAFT) */}
                        {!data.invoiceNumber.startsWith("DRAFT-") && (
                            <button
                                type="button"
                                onClick={handleEditCurrentNumber}
                                disabled={editNumberMut.isPending}
                                title={`Edit nomor ${data.type === 'INVOICE' ? 'invoice' : 'penawaran'}`}
                                className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
                        {data.revisionNumber > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Rev. {data.revisionNumber}</span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-600 mt-0.5">
                        {(() => {
                            const cfg = variantCode ? variantConfigs.find((v) => v.code === variantCode) : null;
                            return cfg?.label
                                || (data.quotationVariant === "PENGADAAN_BOOTH" ? "Pengadaan Booth Special Design" : "Sewa Perlengkapan Event");
                        })()}
                    </p>

                    {/* Mode Toggle — kompak inline */}
                    <div className="mt-2 inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200 text-xs">
                        <button
                            type="button"
                            onClick={() => setFormMode('simple')}
                            className={`px-2 py-1 rounded transition ${formMode === 'simple'
                                ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            title="Mode mudah: cuma field penting"
                        >
                            😊 Sederhana
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormMode('advanced')}
                            className={`px-2 py-1 rounded transition ${formMode === 'advanced'
                                ? 'bg-white text-violet-700 shadow-sm font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            title="Mode lengkap: semua fitur advanced"
                        >
                            🎛️ Lengkap
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
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium shadow-sm"
                        >
                            <Hash className="w-4 h-4" /> Assign Nomor
                        </button>
                    )}
                    {!isDraft && (
                        <button
                            onClick={() => reviseMut.mutate()}
                            disabled={reviseMut.isPending}
                            title="Buat revisi baru"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium shadow-sm"
                        >
                            <GitBranch className="w-4 h-4" /> Revisi
                        </button>
                    )}
                    {!isDraft && data.type !== "INVOICE" && (
                        <button
                            onClick={() => setShowInvoiceModal(true)}
                            title="Generate Invoice DP / Pelunasan"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md text-sm font-medium shadow-sm"
                        >
                            <Receipt className="w-4 h-4" /> Invoice
                        </button>
                    )}

                    {/* Vertical divider */}
                    <div className="w-px bg-slate-200 mx-1" />

                    {/* === Group 2: Preview & Export — kompak, ikon-first === */}
                    <div className="inline-flex rounded-md border border-slate-200 overflow-hidden shadow-sm">
                        <button
                            onClick={() => handlePreview("pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium border-r border-violet-700"
                            title={data?.type === 'INVOICE' ? "Preview Invoice" : "Preview Penawaran"}
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden md:inline">Preview</span>
                        </button>
                        <button
                            onClick={() => handleExport("pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium border-r border-red-700"
                            title="Download PDF"
                        >
                            <FileDown className="w-4 h-4" />
                            <span className="hidden md:inline">PDF</span>
                        </button>
                        <button
                            onClick={() => handleExport("docx")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                            title="Download DOCX"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden md:inline">DOCX</span>
                        </button>
                    </div>

                    {/* SPK group — terpisah, warna emerald biar jelas */}
                    <div className="inline-flex rounded-md border border-emerald-300 overflow-hidden shadow-sm">
                        <button
                            onClick={() => handlePreview("spk-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-medium border-r border-emerald-300"
                            title="Preview SPK"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden md:inline">Preview</span>
                        </button>
                        <button
                            onClick={() => handleExport("spk-pdf")}
                            className="inline-flex items-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
                            title="Download SPK"
                        >
                            <ScrollText className="w-4 h-4" />
                            <span className="hidden md:inline">SPK</span>
                        </button>
                    </div>
                </div>
            </div>

            {data.parent && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                    Dokumen ini revisi dari{" "}
                    <Link href={`/penawaran/${data.parent.id}`} className="text-blue-600 hover:underline font-medium">
                        {data.parent.invoiceNumber}
                    </Link>
                </div>
            )}

            {/* Banner kalau dokumen ini adalah INVOICE (di-generate dari quotation) */}
            {data.type === "INVOICE" && (
                <div className="mb-4 p-3 bg-pink-50 border-2 border-pink-200 rounded-md text-sm flex items-center justify-between">
                    <div>
                        <span className="font-bold text-pink-900">📑 Ini Invoice {data.invoicePart}</span>
                        {data.parentQuotationId && (
                            <> · dari penawaran <Link href={`/penawaran/${data.parentQuotationId}`} className="text-pink-700 hover:underline font-medium">#{data.parentQuotationId}</Link></>
                        )}
                    </div>
                    {data.amountToPay && (
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-pink-700 font-bold">Jumlah Tagihan</div>
                            <div className="font-bold text-lg text-pink-900 font-mono">{rp(data.amountToPay)}</div>
                        </div>
                    )}
                </div>
            )}

            {/* List child invoices (kalau quotation ini sudah pernah di-generate invoice) */}
            {data.type !== "INVOICE" && childInvoices.length > 0 && (
                <div className="mb-4 rounded-md border-2 border-pink-200 bg-pink-50/50 p-3">
                    <div className="text-xs font-bold text-pink-900 uppercase tracking-wide mb-2">
                        📑 Invoice yang Sudah Dibuat ({childInvoices.length})
                    </div>
                    <div className="space-y-1.5">
                        {childInvoices.map((inv) => (
                            <Link
                                key={inv.id}
                                href={`/penawaran/${inv.id}`}
                                className="flex items-center justify-between gap-3 p-2 bg-white rounded border hover:border-pink-400 hover:bg-pink-50 text-sm"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Receipt className="h-4 w-4 text-pink-600 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs text-pink-700">{inv.invoiceNumber}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {inv.invoicePart === "DP" && "💰 Down Payment"}
                                            {inv.invoicePart === "PELUNASAN" && "✅ Pelunasan"}
                                            {inv.invoicePart === "FULL" && "💯 Full Payment"}
                                            · {dayjs(inv.date).format("DD MMM YYYY")}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-bold text-pink-900">
                                        {inv.amountToPay ? rp(inv.amountToPay) : rp(inv.total)}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[inv.status] || "bg-gray-100"}`}>
                                        {inv.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Brand picker — pilih brand untuk header surat & nomor seri */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Brand:</span>
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
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                                }`}
                        >
                            <span>{meta.emoji}</span>
                            {meta.short}
                        </button>
                    );
                })}
                {brand === null && (
                    <span className="text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        ⚠ Belum di-tag — pilih agar surat penawaran pakai header & nomor seri brand benar
                    </span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                    Brand menentukan kop surat & nomor seri saat assign nomor.
                </span>
            </div>

            {/* Varian Penawaran picker — dropdown dari config CRUD */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Varian:</span>
                <select
                    value={variantCode ?? ""}
                    onChange={(e) => setVariantCode(e.target.value || null)}
                    className="border-2 rounded-md px-3 py-1.5 text-sm bg-white focus:border-violet-500 outline-none min-w-[260px]"
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
                <Link href="/settings/quotation-variants" className="text-[11px] text-violet-600 hover:underline ml-auto">
                    Atur varian →
                </Link>
            </div>

            {/* Penandatangan Surat — context-aware: marketing untuk penawaran, admin untuk invoice */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700">
                        Penandatangan:
                        {isInvoiceMode && <span className="ml-1 text-[11px] text-pink-600 font-normal">(Admin biasanya TTD invoice)</span>}
                    </span>
                    <select
                        value={signedByWorkerId ?? ""}
                        onChange={(e) => setSignedByWorkerId(e.target.value ? Number(e.target.value) : null)}
                        className="border-2 rounded-md px-3 py-1.5 text-sm bg-white focus:border-blue-500 outline-none min-w-[260px]"
                    >
                        <option value="">— Pilih {isInvoiceMode ? "Admin/Marketing" : "Marketing/Sales"} —</option>
                        {marketers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}{w.position ? ` (${w.position})` : ""}
                                {!w.signatureImageUrl ? " ⚠ belum ada TTD" : ""}
                            </option>
                        ))}
                    </select>
                    <Link href="/settings/workers" className="text-[11px] text-blue-600 hover:underline ml-auto">
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
                            <div className="inline-flex items-center gap-3 p-2 bg-slate-50 rounded">
                                {w.signatureImageUrl ? (
                                    <div className="relative h-16 w-32 bg-white rounded border flex items-center justify-center">
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
                                    <div className="h-16 w-32 bg-amber-50 border border-amber-300 rounded flex items-center justify-center text-[10px] text-amber-700 px-2 text-center">
                                        ⚠ {w.name} belum upload TTD
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
                        💡 Kalau dikosongkan, surat pakai nama direktur dari pengaturan brand.
                    </p>
                )}
            </div>

            {/* Bank picker — pilih rekening yang muncul di surat */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3">
                <div className="flex items-start gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700 mt-1">Rekening Bank:</span>
                    <div className="flex-1 min-w-[280px]">
                        {allBanks.length === 0 ? (
                            <div className="text-xs bg-amber-50 border border-amber-300 rounded-md p-2 text-amber-800">
                                ⚠ Belum ada bank account terdaftar.
                                <Link href="/settings/bank-accounts" className="ml-1 text-amber-900 font-semibold hover:underline">
                                    Tambah dulu di /settings/bank-accounts →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {allBanks.map((b) => {
                                    const ids = bankAccountIds.split(",").map((s) => s.trim()).filter(Boolean);
                                    const checked = ids.includes(String(b.id));
                                    return (
                                        <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...ids, String(b.id)]
                                                        : ids.filter((x) => x !== String(b.id));
                                                    setBankAccountIds(newIds.join(","));
                                                }}
                                            />
                                            <span className="font-bold">{b.bankName}</span>
                                            <span className="font-mono text-xs">{b.accountNumber}</span>
                                            <span className="text-xs text-muted-foreground">a.n. {b.accountOwner}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2">
                            💡 Pilih rekening yang ditampilkan di surat. Default: dari Brand Settings. Setting ini menimpa default per dokumen.
                        </p>
                    </div>
                    <Link href="/settings/bank-accounts" className="text-[11px] text-blue-600 hover:underline">
                        Kelola Bank →
                    </Link>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Data Klien</h3>

                    {/* Tautkan ke Customer Database — supaya muncul di tab Penawaran customer */}
                    {linkedCustomer ? (
                        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1.5 mb-0.5">
                                        <Users className="h-3.5 w-3.5" />
                                        ✅ Ter-link ke Data Pelanggan
                                    </div>
                                    <Link
                                        href={`/customers/${linkedCustomer.id}`}
                                        className="text-sm font-semibold text-emerald-900 hover:underline truncate block"
                                    >
                                        {linkedCustomer.companyName || linkedCustomer.name}
                                    </Link>
                                    <div className="text-[11px] text-emerald-700/80 truncate">
                                        {linkedCustomer.companyName && linkedCustomer.name && <span>{linkedCustomer.name}</span>}
                                        {linkedCustomer.companyPIC && <span> · PIC {linkedCustomer.companyPIC}</span>}
                                        {linkedCustomer.phone && <span> · {linkedCustomer.phone}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-muted"
                                    >
                                        Ganti
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setCustomerIdState(null); setLinkedCustomer(null); }}
                                        className="text-[11px] px-2 py-1 rounded text-red-600 hover:bg-red-50"
                                        title="Lepas link customer (penawaran ini gak akan muncul di histori customer)"
                                    >
                                        Lepas
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/40 p-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5 mb-1">
                                        ⚠️ Belum Ter-link ke Data Pelanggan
                                    </div>
                                    <p className="text-[11px] text-amber-700 mb-2">
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

                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Event / Proyek</h3>
                    <Field label="Nama Proyek" value={projectName} onChange={setProjectName} />
                    <Field label="Lokasi" value={eventLocation} onChange={setEventLocation} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Tanggal Mulai" value={eventDateStart} onChange={setEventDateStart} type="date" />
                        <Field label="Tanggal Selesai" value={eventDateEnd} onChange={setEventDateEnd} type="date" />
                    </div>
                    <Field label="Berlaku Sampai" value={validUntil} onChange={setValidUntil} type="date" />

                    {/* Multi-event: event tambahan dengan tanggal beda */}
                    <div className="border-t border-dashed border-slate-300 pt-3 mt-2">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">📅 Event Tambahan</h4>
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
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Tambah Event
                            </button>
                        </div>

                        {additionalEvents.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Belum ada event tambahan.</p>
                        ) : (
                            <div className="space-y-2">
                                {additionalEvents.map((ev, idx) => (
                                    <div
                                        key={idx}
                                        className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 relative"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold text-slate-600">
                                                Event #{idx + 2}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setAdditionalEvents(
                                                        additionalEvents.filter((_, i) => i !== idx),
                                                    )
                                                }
                                                className="text-red-600 hover:bg-red-50 p-0.5 rounded"
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
            <section className="bg-white rounded-lg border p-4 mt-6">
                <div className="mb-3">
                    <h3 className="font-semibold">Header Surat (Tanggal Dibuat)</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        💡 Format di surat: <code className="bg-slate-100 px-1 rounded">Tanggal : {signCity ? `${signCity}, ` : ""}{docDate ? new Date(docDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}</code>
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
                    💡 <b>Lokasi/Kota</b> opsional — kosongkan kalau tidak diperlukan. Yang muncul cuma tanggal saja.
                </p>
            </section>

            <section className="bg-white rounded-lg border p-4 mt-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                        <h3 className="font-semibold">Rincian Item</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            💡 Item dengan <b>Kategori</b> sama otomatis dikelompokkan. Item tanpa kategori akan ikut grup atasnya. Klik <Calculator className="inline h-3 w-3" /> untuk hitung qty otomatis.
                        </p>
                    </div>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah Item
                    </button>
                </div>

                {/* Toggle Tampilan Item di PDF/DOCX */}
                <div className="mb-3 rounded-md border-2 border-slate-200 bg-slate-50 p-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tampilan Item di PDF:</span>
                    <div className="inline-flex gap-0.5 bg-white p-0.5 rounded border">
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('detailed')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'detailed'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📋 Detail (per item)
                        </button>
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('category-summary')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'category-summary'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📊 Ringkas (total/kategori)
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
                    return (
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-700">
                        <tr>
                            <th className="w-6 px-1"></th>
                            <th className="px-2 py-1.5 w-40">Kategori</th>
                            {eventOptions.length > 0 && (
                                <th className="px-2 py-1.5 w-32" title="Link ke event lokasi">Event</th>
                            )}
                            {showPackageCol && (
                                <th className="px-2 py-1.5 w-20" title="Nama paket (mode package)">Paket</th>
                            )}
                            <th className="px-2 py-1.5">Uraian</th>
                            <th className="px-2 py-1.5 w-24">Qty</th>
                            <th className="px-2 py-1.5 w-24">Satuan</th>
                            <th className="px-2 py-1.5 w-32">Harga Satuan</th>
                            <th className="px-2 py-1.5 w-32 text-right">Subtotal</th>
                            <th className="w-12 text-center text-[10px]">Aksi</th>
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
                                        <td colSpan={colCount} className="text-center py-6 text-gray-400">
                                            Belum ada item. Klik &quot;Tambah Item&quot;.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </SortableContext>
                    </DndContext>
                </table>
                    );
                })()}
            </section>

            <div className="grid md:grid-cols-2 gap-6 mt-6 auto-rows-min items-start">
                <section className="bg-white rounded-lg border p-3 space-y-2">
                    <h3 className="font-semibold text-sm">💵 Pajak &amp; Pembayaran</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <Field label="PPN (%)" value={String(taxRate)} onChange={(v) => setTaxRate(parseFloat(v) || 0)} type="number" />
                        <Field label="Diskon (Rp)" value={String(discount)} onChange={(v) => setDiscount(parseFloat(v) || 0)} type="number" />
                        <Field label="DP (%)" value={String(dpPercent)} onChange={(v) => setDpPercent(parseFloat(v) || 0)} type="number" />
                    </div>
                    <Field label="Catatan / Terms" value={notes} onChange={setNotes} multiline />
                </section>

                {/* === Section: Format Lanjutan (Subject + Harga Paket + Show Grand Total) === */}
                {formMode === 'advanced' && (
                <section className="bg-white rounded-lg border border-violet-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('format')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 hover:bg-violet-100 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span>🎨</span>
                            <div>
                                <h3 className="font-semibold text-sm text-violet-900">Format Lanjutan</h3>
                                <p className="text-[10px] text-violet-700">Subject • Harga paket • Show total</p>
                            </div>
                        </div>
                        <span className="text-violet-700 text-xs">{openSections.format ? '▲' : '▼'}</span>
                    </button>
                    {openSections.format && (
                    <div className="p-3 space-y-2 border-t border-violet-200">
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
                            <span>Tampilkan Grand Total di footer <span className="text-slate-500">(uncheck untuk mode Package)</span></span>
                        </label>
                    </div>
                    )}
                </section>
                )}

                {/* === Section: Spesifikasi (PDF Nukahiji style) === */}
                {formMode === 'advanced' && (
                <section className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('spec')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50 hover:bg-emerald-100 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span>📋</span>
                            <div>
                                <h3 className="font-semibold text-sm text-emerald-900 flex items-center gap-1.5">
                                    Spesifikasi Detail
                                    {specifications.length > 0 && <span className="px-1.5 py-0.5 bg-emerald-200 rounded text-[10px] font-bold">{specifications.length}</span>}
                                </h3>
                                <p className="text-[10px] text-emerald-700">List spec per item (Booth/Stage/Totem)</p>
                            </div>
                        </div>
                        <span className="text-emerald-700 text-xs">{openSections.spec ? '▲' : '▼'}</span>
                    </button>
                    {openSections.spec && (
                    <div className="p-3 space-y-2 border-t border-emerald-200">
                        <button
                            type="button"
                            onClick={() => setSpecifications([...specifications, { title: "", items: [""] }])}
                            className="w-full px-2 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                            title="Tambah group spec (mis. Booth, Stage, Totem)"
                        >
                            ➕ Tambah Group Spesifikasi
                        </button>
                    {specifications.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada. Klik "+ Tambah Group" untuk mulai.</p>
                    ) : (
                        specifications.map((grp, gi) => (
                            <div key={gi} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/40 space-y-1.5">
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
                                        className="text-red-600 hover:bg-red-50 p-1 rounded"
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
                                            <label className="text-slate-600 whitespace-nowrap">📦 Untuk paket:</label>
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
                                        <span className="text-emerald-600 text-xs">✓</span>
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
                                            className="text-red-600 hover:bg-red-50 p-0.5 rounded"
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
                                    className="text-[10px] text-blue-600 hover:underline ml-5"
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

                {/* === Section: Payment Schedule (Multi-step) === */}
                {formMode === 'advanced' && (
                <section className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('payment')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span>💰</span>
                            <div>
                                <h3 className="font-semibold text-sm text-blue-900 flex items-center gap-1.5">
                                    Skema Pembayaran Bertahap
                                    {paymentSchedule.length > 0 && <span className="px-1.5 py-0.5 bg-blue-200 rounded text-[10px] font-bold">{paymentSchedule.length}</span>}
                                </h3>
                                <p className="text-[10px] text-blue-700">Multi-step DP — override DP {dpPercent}%</p>
                            </div>
                        </div>
                        <span className="text-blue-700 text-xs">{openSections.payment ? '▲' : '▼'}</span>
                    </button>
                    {openSections.payment && (
                    <div className="p-3 space-y-2 border-t border-blue-200">
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setPaymentSchedule([
                                        { label: "DP", percent: 50 },
                                        { label: "Pelunasan", percent: 50 },
                                    ])
                                }
                                className="flex-1 text-[11px] px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 font-semibold"
                                title="Preset 50% DP + 50% Pelunasan"
                            >
                                ⚡ 50/50
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
                                className="flex-1 text-[11px] px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 font-semibold"
                                title="Preset DP1 50% + DP2 30% + Pelunasan 20%"
                            >
                                ⚡ 50/30/20
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
                                    <span className="text-xs text-slate-500">%</span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPaymentSchedule(paymentSchedule.filter((_, i) => i !== si))
                                        }
                                        className="text-red-600 hover:bg-red-50 p-0.5 rounded"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(() => {
                                const totalPct = paymentSchedule.reduce((sum, s) => sum + Number(s.percent || 0), 0);
                                const ok = Math.abs(totalPct - 100) < 0.01;
                                return (
                                    <p className={`text-[11px] font-bold ${ok ? "text-emerald-700" : "text-red-700"}`}>
                                        Total: {totalPct.toFixed(2)}% {ok ? "✓" : "(harus 100%)"}
                                    </p>
                                );
                            })()}
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => setPaymentSchedule([...paymentSchedule, { label: "", percent: 0 }])}
                        className="w-full text-sm px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded font-medium border border-dashed border-slate-300"
                    >
                        ➕ Tambah Step Pembayaran
                    </button>
                    </div>
                    )}
                </section>
                )}

                {/* Bahasa & Mata Uang — compact section */}
                <section className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-violet-50 border-b border-blue-200 flex items-center gap-2">
                        <span>🌐</span>
                        <div>
                            <h3 className="font-semibold text-sm text-blue-900">Bahasa & Mata Uang</h3>
                            <p className="text-[10px] text-blue-700">Bahasa surat + toggle USD</p>
                        </div>
                    </div>
                    <div className="p-3 space-y-2">

                    {/* Language + USD toggle — kompak dalam 1 baris pill-style */}
                    <div className="flex gap-1.5">
                        {/* Language pills */}
                        <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-md flex-1">
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
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900"
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
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                                }`}
                        >
                            {useUsdCurrency ? "💵 USD ✓" : "💴 Rp (default)"}
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        {language === 'en' && "📖 Label header auto-translate (Nomor→Number, dll). "}
                        {useUsdCurrency
                            ? "💡 Input nilai harga langsung dalam USD (tanpa konversi kurs)."
                            : "💡 Default pakai Rp. Aktifkan USD untuk klien internasional."}
                    </p>
                    </div>
                </section>

                {/* Custom Text Surat — Mode Lengkap saja */}
                {formMode === 'advanced' && (
                <section className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleSection('customText')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span>✍️</span>
                            <div>
                                <h3 className="font-semibold text-sm text-amber-900">Custom Text Surat</h3>
                                <p className="text-[10px] text-amber-700">Override Lampiran, Pembuka, Disclaimer, dst</p>
                            </div>
                        </div>
                        <span className="text-amber-700 text-xs">{openSections.customText ? '▲' : '▼'}</span>
                    </button>
                    {openSections.customText && (
                    <div className="p-3 space-y-2 border-t border-amber-200">
                    <div>
                        <label className="text-xs font-medium block mb-1">📎 Lampiran</label>
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
                                    className="px-1.5 py-0.5 rounded border text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                                >
                                    {opt.label}
                                </button>
                            ))}
                            {customAttachmentText && (
                                <button
                                    type="button"
                                    onClick={() => setCustomAttachmentText("")}
                                    className="px-1.5 py-0.5 rounded border text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300"
                                >
                                    ✕ Reset
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Tab switcher — Penawaran / SPK / Invoice (per-doctype custom text) */}
                    <div className="border-b border-slate-200 -mx-4 px-4 pt-1">
                        <div className="flex items-center gap-0.5">
                            {([
                                { v: 'penawaran' as const, label: '📄 Penawaran', color: 'violet' },
                                { v: 'spk' as const, label: '📜 SPK', color: 'emerald' },
                                { v: 'invoice' as const, label: '🧾 Invoice', color: 'red' },
                            ]).map((t) => (
                                <button
                                    key={t.v}
                                    type="button"
                                    onClick={() => setCustomTextTab(t.v)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-t-md border-b-2 transition ${customTextTab === t.v
                                        ? `border-${t.color}-600 text-${t.color}-700 bg-${t.color}-50`
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                            {customTextTab === 'penawaran' && '📄 Custom text khusus untuk surat Penawaran. Diisi di sini tidak pengaruh ke SPK & Invoice.'}
                            {customTextTab === 'spk' && '📜 Custom text khusus untuk SPK. Kalau kosong, fallback ke Penawaran. Diisi di sini tidak pengaruh ke Penawaran & Invoice.'}
                            {customTextTab === 'invoice' && '🧾 Custom text khusus untuk Invoice. Kalau kosong, fallback ke Penawaran. Diisi di sini tidak pengaruh ke Penawaran & SPK.'}
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
                                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                                        title="Salin template dari pengaturan brand"
                                    >
                                        📋 Salin Template Brand ({language === 'en' ? 'EN' : 'ID'})
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
                        title={language === 'en' ? "📝 Price Notes / Disclaimer" : "📝 Catatan Harga / Disclaimer"}
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
                        title={language === 'en' ? "💳 Payment Terms" : "💳 Sistem Pembayaran"}
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
                        title={language === 'en' ? "✉️ Closing" : "✉️ Penutup Surat"}
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
                    <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                                👤 Penanggung Jawab SPK
                            </h4>
                            <p className="text-[10px] text-emerald-700 mt-0.5">
                                Kalau yang tandatangan SPK <strong>berbeda</strong> dengan PIC di Penawaran, isi di sini.
                                Kosongkan untuk pakai nama PIC dari Penawaran (<span className="font-mono">{clientName || '—'}</span>).
                            </p>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                Nama Penanggung Jawab
                            </label>
                            <input
                                type="text"
                                value={spkPicName}
                                onChange={(e) => setSpkPicName(e.target.value)}
                                placeholder={`Default: ${clientName || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicName.trim() ? 'border-emerald-400 bg-white' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                Jabatan <span className="font-normal text-slate-500">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={spkPicPosition}
                                onChange={(e) => setSpkPicPosition(e.target.value)}
                                placeholder="Mis. CEO, Direktur, Manager Operasional"
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicPosition.trim() ? 'border-emerald-400 bg-white' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                No. HP / Telp <span className="font-normal text-slate-500">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={spkPicPhone}
                                onChange={(e) => setSpkPicPhone(e.target.value)}
                                placeholder={`Default: ${clientPhone || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${spkPicPhone.trim() ? 'border-emerald-400 bg-white' : ''}`}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                💡 Akan tampil di baris &quot;No. Telp kantor&quot; di header SPK. Kosongkan untuk pakai No. Telp dari Penawaran.
                            </p>
                        </div>
                    </div>

                    {/* Batas Pelunasan SPK — tanggal "selambat-lambatnya pelunasan dibayarkan" */}
                    <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                                📅 Batas Pelunasan SPK
                            </h4>
                            <p className="text-[10px] text-emerald-700 mt-0.5">
                                Tanggal &quot;selambat-lambatnya&quot; pelunasan harus dibayarkan oleh klien.
                                Tampil di kalimat bullet pembayaran SPK. Kosongkan untuk pakai &quot;Berlaku Sampai&quot; di Event/Proyek.
                            </p>
                        </div>
                        <input
                            type="date"
                            value={spkPaymentDeadline}
                            onChange={(e) => setSpkPaymentDeadline(e.target.value)}
                            className={`w-full border rounded px-2 py-1.5 text-sm ${spkPaymentDeadline.trim() ? 'border-emerald-400 bg-white' : ''}`}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            💡 Contoh hasil di SPK: <em>&quot;Pelunasan... dibayarkan pada saat booth berdiri atau selambat-lambatnya pada tanggal <strong>{spkPaymentDeadline ? new Date(spkPaymentDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : validUntil ? new Date(validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' (fallback dari Berlaku Sampai)' : '—'}</strong>.&quot;</em>
                        </p>
                    </div>

                    <SimpleCustomField
                        title="📝 Pembuka SPK (Opsional)"
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
                        title="💳 Sistem Pembayaran SPK"
                        value={customPaymentTermsSpk}
                        onChange={setCustomPaymentTermsSpk}
                        fallbackLabel="Penawaran"
                        fallbackValue={customPaymentTerms}
                        brandDefault={brandSettings?.quotationPaymentTerms ?? null}
                    />
                    <SimpleCustomField
                        title="✉️ Penutup SPK"
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
                    <div className="border border-red-200 rounded-lg p-3 bg-red-50/40 space-y-2">
                        <div>
                            <h4 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                                👤 Penanggung Jawab Invoice
                            </h4>
                            <p className="text-[10px] text-red-700 mt-0.5">
                                Kalau invoice ditujukan ke PIC <strong>berbeda</strong> dengan PIC Penawaran (mis. ke Finance/Accounting team),
                                isi di sini. Kosongkan untuk pakai PIC dari Penawaran (<span className="font-mono">{clientName || '—'}</span>).
                            </p>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                Nama Penanggung Jawab
                            </label>
                            <input
                                type="text"
                                value={invoicePicName}
                                onChange={(e) => setInvoicePicName(e.target.value)}
                                placeholder={`Default: ${clientName || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicName.trim() ? 'border-red-400 bg-white' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                Jabatan <span className="font-normal text-slate-500">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={invoicePicPosition}
                                onChange={(e) => setInvoicePicPosition(e.target.value)}
                                placeholder="Mis. Finance Manager, Accounting Head"
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicPosition.trim() ? 'border-red-400 bg-white' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                                No. HP / Telp <span className="font-normal text-slate-500">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={invoicePicPhone}
                                onChange={(e) => setInvoicePicPhone(e.target.value)}
                                placeholder={`Default: ${clientPhone || '(belum diisi di penawaran)'}`}
                                className={`w-full border rounded px-2 py-1.5 text-sm ${invoicePicPhone.trim() ? 'border-red-400 bg-white' : ''}`}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                💡 Kalau diisi, akan muncul di Invoice PDF di section &quot;Kepada Yth&quot;. Kosongkan untuk pakai data dari Penawaran.
                            </p>
                        </div>
                    </div>

                    <SimpleCustomField
                        title="📝 Pembuka Invoice (Opsional)"
                        value={customOpeningInvoice}
                        onChange={setCustomOpeningInvoice}
                        placeholder="Kosongkan untuk pakai default. Mis: 'Dengan hormat, Bersama invoice ini kami menagihkan...'"
                        rows={3}
                        helpText="Override paragraf pembuka khusus Invoice. Kosong = pakai pembuka default Invoice (auto-generate)."
                    />
                    <SimpleCustomField
                        title="📝 Catatan Harga / Disclaimer Invoice"
                        value={customDisclaimerInvoice}
                        onChange={setCustomDisclaimerInvoice}
                        fallbackLabel="Penawaran"
                        fallbackValue={customDisclaimer}
                        brandDefault={brandSettings?.quotationDisclaimer ?? null}
                    />
                    <SimpleCustomField
                        title="💳 Sistem Pembayaran Invoice"
                        value={customPaymentTermsInvoice}
                        onChange={setCustomPaymentTermsInvoice}
                        fallbackLabel="Penawaran"
                        fallbackValue={customPaymentTerms}
                        brandDefault={brandSettings?.quotationPaymentTerms ?? null}
                    />
                    <SimpleCustomField
                        title="✉️ Penutup / Nb Invoice"
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

                <section className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Ringkasan</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <Row label="Subtotal" value={rp(subtotal)} />
                            {discount > 0 && <Row label="Diskon" value={`- ${rp(discount)}`} />}
                            <Row label={`PPN ${taxRate}%`} value={rp(taxAmount)} />
                            <tr className="border-t font-bold text-lg">
                                <td className="py-2">Grand Total</td>
                                <td className="py-2 text-right">{rp(total)}</td>
                            </tr>
                            <Row label={`DP ${dpPercent}%`} value={rp(dpAmount)} />
                            <Row label="Pelunasan" value={rp(total - dpAmount)} />
                        </tbody>
                    </table>
                </section>
            </div>

            {/* Spacer supaya konten terakhir tidak ketutup floating button */}
            <div className="h-24" />

            {/* Floating Save Button — selalu mengambang di kanan-bawah */}
            <button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold shadow-2xl shadow-blue-600/40 ring-4 ring-white/60 disabled:opacity-60 transition-transform hover:scale-105 active:scale-95"
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
                    <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            {previewType === "spk-pdf" ? (
                                <ScrollText className="h-5 w-5 text-emerald-600" />
                            ) : (
                                <Eye className="h-5 w-5 text-violet-600" />
                            )}
                            <div>
                                <h2 className="font-bold text-slate-900">
                                    {previewType === "spk-pdf"
                                        ? "Preview SPK"
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
                            <div className="inline-flex gap-0.5 bg-slate-100 p-0.5 rounded-md border" title="Pilih dokumen yang di-preview">
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("pdf")}
                                    disabled={previewLoading}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${previewType === 'pdf'
                                        ? 'bg-white text-violet-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    {data.type === 'INVOICE' ? '🧾 Invoice' : '📄 Penawaran'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("spk-pdf")}
                                    disabled={previewLoading}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${previewType === 'spk-pdf'
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    📜 SPK
                                </button>
                            </div>

                            {/* Live toggle Tampilan Item — cuma untuk Penawaran/Invoice, hide saat SPK */}
                            {previewType === "pdf" && (
                                <div className="inline-flex gap-0.5 bg-slate-100 p-0.5 rounded-md border" title="Pilih tampilan item: detail per row atau ringkas per kategori">
                                    <button
                                        type="button"
                                        onClick={() => itemDisplayMode !== 'detailed' && togglePreviewMode('detailed')}
                                        disabled={previewLoading}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'detailed'
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        📋 Detail
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => itemDisplayMode !== 'category-summary' && togglePreviewMode('category-summary')}
                                        disabled={previewLoading}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'category-summary'
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        📊 Ringkas
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => handleExport(previewType)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${previewType === 'spk-pdf' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-md text-sm font-semibold`}
                                title={`Download ${previewType === 'spk-pdf' ? 'SPK' : 'PDF'}`}
                            >
                                <Download className="h-4 w-4" /> Download {previewType === 'spk-pdf' ? 'SPK' : 'PDF'}
                            </button>
                            {previewType === "pdf" && (
                                <button
                                    onClick={() => handleExport("docx")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold"
                                >
                                    <FileText className="h-4 w-4" /> DOCX
                                </button>
                            )}
                            <button
                                onClick={closePreview}
                                className="p-2 rounded-md hover:bg-slate-100 text-slate-700"
                                aria-label="Tutup"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* PDF Body */}
                    <div className="flex-1 bg-slate-200 overflow-hidden flex items-center justify-center">
                        {previewLoading ? (
                            <div className="flex flex-col items-center gap-2 text-slate-600">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-sm">Membuat preview PDF...</span>
                            </div>
                        ) : previewUrl ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full bg-white"
                                title="Preview PDF Penawaran"
                            />
                        ) : (
                            <div className="text-slate-500 text-sm">Tidak ada preview</div>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
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
    quotation, onClose, onSubmit, pending,
}: {
    quotation: Quotation;
    onClose: () => void;
    onSubmit: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string }) => void;
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

    // Auto-amount per part di mode 'preset'
    const presetAmount =
        part === 'DP' ? (total * dpPercent) / 100 :
        part === 'PELUNASAN' ? total - (total * dpPercent) / 100 :
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
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-pink-600" />
                        Buat Invoice
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded">
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
                        <PartBtn active={part === "DP"} onClick={() => setPart("DP")} label="💰 DP" sub="Down Payment" />
                        <PartBtn active={part === "PELUNASAN"} onClick={() => setPart("PELUNASAN")} label="✅ Pelunasan" sub="Final Payment" />
                        <PartBtn active={part === "FULL"} onClick={() => setPart("FULL")} label="💯 Full" sub="Sekali Bayar" />
                    </div>
                </div>

                {/* Cara Tentukan Jumlah */}
                <div>
                    <label className="block text-sm font-semibold mb-1.5">Cara Tentukan Jumlah</label>
                    <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-md w-full">
                        <ModeBtn active={mode === 'preset'} onClick={() => setMode('preset')} label="⚡ Default" />
                        <ModeBtn active={mode === 'percent'} onClick={() => setMode('percent')} label="% Persen" />
                        <ModeBtn active={mode === 'amount'} onClick={() => setMode('amount')} label="Rp Custom" />
                    </div>
                </div>

                {/* Mode: Preset (default) */}
                {mode === 'preset' && (
                    <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-700">
                        ⚡ Pakai default sesuai tipe:
                        {part === "DP" && <> DP <b>{dpPercent}%</b> dari total</>}
                        {part === "PELUNASAN" && <> Sisa setelah DP {dpPercent}%</>}
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
                                        ? "bg-pink-500 text-white border-pink-500"
                                        : "bg-white text-slate-700 border-slate-200 hover:border-pink-300"
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
                                    className="w-full border-2 rounded px-2 py-1 text-sm font-mono text-right focus:border-pink-500 outline-none pr-7"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
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
                                    className="px-2 py-1.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-left"
                                >
                                    <div>{preset.label}</div>
                                    <div className="font-mono text-pink-700">{rp(preset.value)}</div>
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">Rp</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                placeholder="contoh: 5000000"
                                inputMode="numeric"
                                className="w-full border-2 rounded-md pl-11 pr-3 py-2.5 text-base font-mono text-right focus:border-pink-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            💡 Ketik nominal langsung (mis. <code>5000000</code> untuk Rp 5 juta). Bisa untuk termin custom yang tidak persis persentase.
                        </p>
                    </div>
                )}

                {/* Hasil — selalu tampil prominent */}
                <div className="rounded-lg border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-pink-700 mb-1">
                        Jumlah yang Akan Ditagihkan
                    </div>
                    <div className="text-3xl font-bold font-mono text-pink-900 leading-tight">
                        {rp(computedAmount)}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="text-xs text-pink-700">
                            ≈ <b>{computedPercent.toFixed(1)}%</b> dari total
                        </div>
                        <div className="text-xs text-pink-700">
                            Sisa: <b className="font-mono">{rp(total - computedAmount)}</b>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-1.5">
                        Jatuh Tempo <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-pink-500 outline-none"
                    />
                </div>

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => onSubmit({
                            part,
                            // Kalau mode != preset, kirim customAmount agar backend pakai nilai itu
                            customAmount: mode === 'preset' ? undefined : computedAmount,
                            dueDate: dueDate || undefined,
                        })}
                        disabled={pending || computedAmount <= 0}
                        className="flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md text-sm font-bold disabled:opacity-50"
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
            className={`p-3 rounded-lg border-2 transition ${active ? "border-pink-500 bg-pink-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
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
            className={`flex-1 px-3 py-1.5 rounded text-xs font-bold transition ${active ? "bg-white text-pink-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
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
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Hash className="h-5 w-5 text-green-600" />
                        Assign Nomor Resmi
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded">
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
                            ? "border-green-500 bg-green-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                    >
                        <div className="font-bold text-sm">⚡ Auto</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Generate dari counter (ikut urutan brand & tahun)
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("manual")}
                        className={`p-3 rounded-lg border-2 text-left transition ${mode === "manual"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                    >
                        <div className="font-bold text-sm">✍️ Manual</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Ketik nomor sendiri (tidak increment counter)
                        </div>
                    </button>
                </div>

                {mode === "manual" && (
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                            Nomor Manual <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={customNumber}
                            onChange={(e) => setCustomNumber(e.target.value)}
                            placeholder="contoh: 100/Ep/Pnwr/V/26"
                            className="w-full border-2 rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 outline-none"
                            autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground">
                            💡 Pakai format mirip auto biar konsisten. Sistem cek unique — kalau sudah dipakai, ditolak.
                        </p>
                    </div>
                )}

                {mode === "auto" && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs text-green-900">
                        ⚡ Sistem akan ambil nomor berikutnya dari counter (mis. <code className="bg-white px-1 rounded">42/Ep/Pnwr/IV/26</code> kalau sudah ada 41 quotation Exindo bulan ini).
                    </div>
                )}

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => mode === "auto" ? onAuto() : onManual(customNumber)}
                        disabled={pending || (mode === "manual" && !customNumber.trim())}
                        className={`flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-md text-sm font-bold disabled:opacity-50 ${mode === "auto"
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-blue-600 hover:bg-blue-700"
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
            <td className="py-1 text-gray-600">{label}</td>
            <td className="py-1 text-right">{value}</td>
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
        <tr ref={setNodeRef} style={style} className="border-t">
            <td className="px-1 py-1 text-center">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 p-1"
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
                <input
                    value={it.description}
                    onChange={(e) => updateItem(it._key, { description: e.target.value })}
                    className="w-full border rounded px-2 py-1"
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
                <input
                    value={it.unit ?? ""}
                    onChange={(e) => updateItem(it._key, { unit: e.target.value })}
                    placeholder="unit/hari"
                    className="w-full border rounded px-2 py-1"
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
            <td className="px-2 py-1 text-right font-mono">{rp(sub)}</td>
            <td className="px-2 py-1 text-center">
                <div className="flex items-center justify-center gap-0.5">
                    <button
                        onClick={() => setCalcOpenKey(it._key)}
                        className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                        title="Kalkulator: Unit × Hari × Jam × m²"
                    >
                        <Calculator className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => duplicateItem(it._key)}
                        className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"
                        title="Duplikat item"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => removeItem(it._key)}
                        className="text-red-600 hover:bg-red-50 p-1 rounded"
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
    title: string;
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
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">{title}</label>
                <div className="flex items-center gap-1.5">
                    {fallbackLabel && hasFallback && !isActive && (
                        <button
                            type="button"
                            onClick={() => onChange(fallbackValue!)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                            title={`Salin nilai dari ${fallbackLabel}`}
                        >
                            📋 Salin dari {fallbackLabel}
                        </button>
                    )}
                    {brandDefault && !isActive && (
                        <button
                            type="button"
                            onClick={() => onChange(brandDefault)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                            title="Salin dari pengaturan brand"
                        >
                            📋 Salin Brand
                        </button>
                    )}
                    {isActive && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="text-[10px] text-amber-700 hover:underline"
                        >
                            ✕ Reset
                        </button>
                    )}
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows ?? 4}
                placeholder={placeholder ?? `Kosongkan untuk fallback ke ${fallbackLabel ?? 'default brand'}.`}
                className={`w-full border rounded px-2 py-1.5 text-xs font-sans ${isActive ? "border-emerald-300 bg-white ring-1 ring-emerald-200" : ""
                    }`}
            />
            {helpText && (
                <p className="text-[10px] text-muted-foreground">{helpText}</p>
            )}
            {!helpText && fallbackLabel && (
                <p className="text-[10px] text-muted-foreground">
                    {isActive
                        ? `✅ Custom aktif — override ${fallbackLabel}.`
                        : `⏭️ Kosong → pakai dari ${fallbackLabel}${hasFallback ? "" : " (juga kosong → pakai default brand)"}.`
                    }
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
    title: string;
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
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">{title}</label>
                <div className="flex items-center gap-2">
                    {brandDefault && (
                        <button
                            type="button"
                            onClick={() => setShowDefault((v) => !v)}
                            className="text-[10px] text-blue-600 hover:underline"
                        >
                            {showDefault ? "▲ Sembunyikan" : "▼ Lihat default brand"}
                        </button>
                    )}
                </div>
            </div>

            {/* Default brand preview (collapsible) */}
            {showDefault && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <div className="text-[10px] font-bold text-amber-800 mb-0.5">📌 Default dari pengaturan brand:</div>
                    <pre className="text-[10px] text-amber-900 whitespace-pre-wrap font-sans">{brandDefault || "(belum di-set di pengaturan brand)"}</pre>
                </div>
            )}

            {/* Custom full-override — kalau diisi REPLACE default brand total */}
            {onCustom !== undefined && (
                <div>
                    <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-medium text-purple-700 block">
                            ✏️ Custom (override penuh — abaikan default brand)
                        </label>
                        {brandDefault && !hasCustomOverride && (
                            <button
                                type="button"
                                onClick={() => onCustom(brandDefault)}
                                className="text-[10px] text-blue-600 hover:underline"
                                title="Salin default brand sebagai starting point"
                            >
                                📋 Salin dari brand
                            </button>
                        )}
                        {hasCustomOverride && (
                            <button
                                type="button"
                                onClick={() => onCustom("")}
                                className="text-[10px] text-amber-700 hover:underline"
                                title="Kosongkan untuk pakai default brand lagi"
                            >
                                ✕ Reset
                            </button>
                        )}
                    </div>
                    <textarea
                        value={custom ?? ""}
                        onChange={(e) => onCustom(e.target.value)}
                        rows={hasCustomOverride ? 5 : 2}
                        placeholder="Kosongkan untuk pakai default brand. Kalau diisi, REPLACE total — prepend/append di bawah juga di-skip."
                        className={`w-full border rounded px-2 py-1.5 text-xs font-sans ${hasCustomOverride
                            ? "border-purple-300 bg-purple-50/40 ring-1 ring-purple-200"
                            : ""
                            }`}
                    />
                    {hasCustomOverride && (
                        <p className="text-[10px] text-purple-700 mt-1 font-medium">
                            ⚠️ Custom aktif — default brand &amp; tambahan teks di-skip total.
                        </p>
                    )}
                </div>
            )}

            {/* Toggle untuk menampilkan field "Tambah teks di atas/bawah" — disembunyikan default. Disable kalau custom aktif. */}
            {hasCustomOverride ? (
                <p className="text-[10px] text-slate-400 italic text-center py-1">
                    Tambahan teks dinonaktifkan saat custom override aktif.
                </p>
            ) : !showAddons ? (
                <button
                    type="button"
                    onClick={() => setShowAddons(true)}
                    className="w-full text-[11px] text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-slate-300 hover:border-blue-300 rounded py-1.5 transition"
                >
                    ➕ Tambah teks di atas/bawah default brand (opsional)
                </button>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            Tambahan teks
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setShowAddons(false);
                                onPrepend("");
                                onAppend("");
                            }}
                            className="text-[10px] text-slate-500 hover:text-red-600 hover:underline"
                            title="Sembunyikan & kosongkan kedua field"
                        >
                            ✕ Sembunyikan
                        </button>
                    </div>

                    {/* Prepend — di ATAS default brand */}
                    <div>
                        <label className="text-[10px] font-medium text-emerald-700 block mb-0.5">
                            ⬆️ Tambah di ATAS default brand
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
                        <label className="text-[10px] font-medium text-blue-700 block mb-0.5">
                            ⬇️ Tambah di BAWAH default brand
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
