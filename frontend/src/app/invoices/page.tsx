"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Eye, Loader2, CheckCircle2, X, Trash2,
    Pencil, FileText, ClipboardList, ArrowRight, AlertCircle,
    Building2, Phone, Mail, MapPin, Printer, Package, Search
} from "lucide-react";
import {
    getInvoices, createInvoice, updateInvoice, updateInvoiceStatus,
    deleteInvoice, convertQuotationToInvoice, getSettings, getProducts
} from "@/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
dayjs.extend(relativeTime);
dayjs.locale("id");

// ---------- Types ----------
type DocType = "INVOICE" | "QUOTATION";
type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED" | "ACCEPTED" | "REJECTED" | "EXPIRED";

type InvoiceItem = {
    id?: number;
    description: string;
    unit: string;
    quantity: number;
    price: number;
    // Area-based (banner/spanduk): quantity = width × height
    isAreaBased?: boolean;
    width?: number;
    height?: number;
};

type Invoice = {
    id: number;
    invoiceNumber: string;
    type: DocType;
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;
    date: string;
    dueDate?: string;
    validUntil?: string;
    status: InvoiceStatus;
    subtotal: string;
    taxRate: string;
    taxAmount: string;
    discount: string;
    total: string;
    notes?: string;
    items: InvoiceItem[];
};

// ---------- Helpers ----------
const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
    DRAFT:     { label: "Draft",      className: "bg-muted text-muted-foreground" },
    SENT:      { label: "Terkirim",   className: "bg-blue-500/10 text-blue-500" },
    PAID:      { label: "Lunas",      className: "bg-emerald-500/10 text-emerald-600" },
    CANCELLED: { label: "Dibatalkan", className: "bg-destructive/10 text-destructive" },
    ACCEPTED:  { label: "Diterima",   className: "bg-emerald-500/10 text-emerald-600" },
    REJECTED:  { label: "Ditolak",    className: "bg-destructive/10 text-destructive" },
    EXPIRED:   { label: "Kedaluarsa", className: "bg-orange-500/10 text-orange-500" },
};

const INVOICE_NEXT_STATUSES: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    DRAFT: ["SENT"],
    SENT:  ["PAID", "CANCELLED"],
};

const QUOTATION_NEXT_STATUSES: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    DRAFT: ["SENT"],
    SENT:  ["ACCEPTED", "REJECTED"],
};

function calcTotals(items: InvoiceItem[], taxRate: number, discount: number) {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const taxAmount = Math.round(subtotal * taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
}

// ---------- Print Modal ----------
function PrintModal({ doc, settings, onClose }: { doc: Invoice; settings: any; onClose: () => void }) {
    const printRef = useRef<HTMLDivElement>(null);
    const isQuotation = doc.type === "QUOTATION";
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    const subtotal = parseFloat(doc.subtotal);
    const taxAmount = parseFloat(doc.taxAmount);
    const discount = parseFloat(doc.discount);
    const total = parseFloat(doc.total);
    const taxRate = parseFloat(doc.taxRate);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML ?? "";
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>${doc.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }
  .page { padding: 32px; max-width: 800px; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; font-size: 10pt; padding: 8px; text-align: left; border: 1px solid #e5e7eb; }
  td { padding: 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
  .text-right { text-align: right; }
  @media print { @page { margin: 20mm; } }
</style></head><body><div class="page">${content}</div></body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-4xl rounded-xl border border-border shadow-lg flex flex-col max-h-[95vh]">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                    <h3 className="font-semibold text-foreground">Preview {isQuotation ? "Penawaran Harga" : "Invoice"}</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                            <Printer className="h-4 w-4" /> Cetak / PDF
                        </button>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2"><X className="h-4 w-4" /></button>
                    </div>
                </div>
                <div className="overflow-y-auto grow p-8">
                    <div ref={printRef} className="bg-white text-gray-900 p-8 rounded-lg max-w-2xl mx-auto shadow-sm">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                {logoUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt="Logo" className="h-12 w-auto mb-2 object-contain" />
                                )}
                                <p className="text-lg font-bold text-gray-800">{settings?.storeName ?? "Nama Toko"}</p>
                                {settings?.address && <p className="text-sm text-gray-600 mt-0.5">{settings.address}</p>}
                                {settings?.phone && <p className="text-sm text-gray-600">{settings.phone}</p>}
                            </div>
                            <div className="text-right">
                                <h1 className="text-2xl font-bold text-gray-800">{isQuotation ? "PENAWARAN HARGA" : "INVOICE"}</h1>
                                <p className="text-base font-semibold text-blue-700 mt-1">{doc.invoiceNumber}</p>
                                <p className="text-sm text-gray-600 mt-1">Tanggal: {dayjs(doc.date).format("DD MMMM YYYY")}</p>
                                {doc.dueDate && <p className="text-sm text-gray-600">Jatuh Tempo: {dayjs(doc.dueDate).format("DD MMMM YYYY")}</p>}
                                {doc.validUntil && <p className="text-sm text-gray-600">Berlaku s/d: {dayjs(doc.validUntil).format("DD MMMM YYYY")}</p>}
                            </div>
                        </div>

                        {/* Divider */}
                        <hr className="border-gray-200 mb-6" />

                        {/* Client + Status */}
                        <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kepada Yth.</p>
                                <p className="font-bold text-gray-900">{doc.clientName}</p>
                                {doc.clientCompany && <p className="text-sm font-medium text-gray-700">{doc.clientCompany}</p>}
                                {doc.clientAddress && <p className="text-sm text-gray-600 mt-1">{doc.clientAddress}</p>}
                                {doc.clientPhone && <p className="text-sm text-gray-600 mt-0.5">📞 {doc.clientPhone}</p>}
                                {doc.clientEmail && <p className="text-sm text-gray-600">✉ {doc.clientEmail}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
                                <span className="inline-block px-3 py-1 rounded text-sm font-semibold" style={{
                                    background: doc.status === "PAID" || doc.status === "ACCEPTED" ? "#d1fae5" :
                                        doc.status === "SENT" ? "#dbeafe" :
                                        doc.status === "REJECTED" || doc.status === "CANCELLED" ? "#fee2e2" : "#f3f4f6",
                                    color: doc.status === "PAID" || doc.status === "ACCEPTED" ? "#065f46" :
                                        doc.status === "SENT" ? "#1d4ed8" :
                                        doc.status === "REJECTED" || doc.status === "CANCELLED" ? "#991b1b" : "#374151"
                                }}>{STATUS_CONFIG[doc.status].label}</span>
                            </div>
                        </div>

                        {/* Items */}
                        <table className="w-full border-collapse mb-4 text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-200 p-2 text-left w-8 text-gray-700">No</th>
                                    <th className="border border-gray-200 p-2 text-left text-gray-700">Deskripsi Pekerjaan / Produk</th>
                                    <th className="border border-gray-200 p-2 text-center w-16 text-gray-700">Sat.</th>
                                    <th className="border border-gray-200 p-2 text-center w-16 text-gray-700">Qty</th>
                                    <th className="border border-gray-200 p-2 text-right w-32 text-gray-700">Harga Satuan</th>
                                    <th className="border border-gray-200 p-2 text-right w-32 text-gray-700">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doc.items.map((item, i) => (
                                    <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{i + 1}</td>
                                        <td className="border border-gray-200 p-2 text-gray-800">{item.description}</td>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{item.unit || "-"}</td>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{item.quantity}</td>
                                        <td className="border border-gray-200 p-2 text-right text-gray-700">{fmt(Number(item.price))}</td>
                                        <td className="border border-gray-200 p-2 text-right font-medium text-gray-800">{fmt(item.quantity * Number(item.price))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end mb-6">
                            <div className="w-64 text-sm space-y-1.5">
                                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
                                {discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>− {fmt(discount)}</span></div>}
                                {taxRate > 0 && <div className="flex justify-between text-gray-600"><span>PPN {taxRate}%</span><span className="font-medium">{fmt(taxAmount)}</span></div>}
                                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t-2 border-gray-300"><span>TOTAL</span><span>{fmt(total)}</span></div>
                            </div>
                        </div>

                        {/* Notes */}
                        {doc.notes && (
                            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200 mb-4">
                                <p className="font-semibold text-gray-800 mb-1">Catatan &amp; Syarat:</p>
                                <p className="whitespace-pre-wrap">{doc.notes}</p>
                            </div>
                        )}

                        <p className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
                            {isQuotation
                                ? "Dokumen ini adalah penawaran harga yang tidak mengikat hingga dikonfirmasi secara tertulis."
                                : "Terima kasih atas kepercayaan Anda. Mohon segera lakukan pembayaran sebelum jatuh tempo."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------- Form Modal ----------
const UNITS = ["pcs", "lembar", "set", "m²", "m", "kg", "liter", "box", "roll", "unit", "jam", "hari"];

type CatalogItem = {
    label: string;
    description: string;
    unit: string;
    price: number;
    type: string;        // SELLABLE | SERVICE | RAW_MATERIAL
    pricingMode: string; // UNIT | AREA_BASED
};

function FormModal({
    mode, docType, initial, onClose, onSave, isPending
}: {
    mode: "create" | "edit";
    docType: DocType;
    initial?: Invoice;
    onClose: () => void;
    onSave: (data: any) => void;
    isPending: boolean;
}) {
    const isQuotation = docType === "QUOTATION";

    const [clientName, setClientName] = useState(initial?.clientName ?? "");
    const [clientCompany, setClientCompany] = useState(initial?.clientCompany ?? "");
    const [clientAddress, setClientAddress] = useState(initial?.clientAddress ?? "");
    const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
    const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
    const [dueDate, setDueDate] = useState(initial?.dueDate ? dayjs(initial.dueDate).format("YYYY-MM-DD") : "");
    const [validUntil, setValidUntil] = useState(initial?.validUntil ? dayjs(initial.validUntil).format("YYYY-MM-DD") : "");
    const [taxRate, setTaxRate] = useState(String(parseFloat(initial?.taxRate ?? "0")));
    const [discount, setDiscount] = useState(String(parseFloat(initial?.discount ?? "0")));
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [items, setItems] = useState<InvoiceItem[]>(
        initial?.items?.length
            ? initial.items.map(i => ({ description: i.description, unit: i.unit ?? "pcs", quantity: i.quantity, price: Number(i.price), isAreaBased: false }))
            : [{ description: "", unit: "pcs", quantity: 1, price: 0, isAreaBased: false }]
    );

    // Catalog picker state
    const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const pickerRef = useRef<HTMLDivElement>(null);

    // Load products catalog
    const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: getProducts, staleTime: 5 * 60 * 1000 });

    // Build flat catalog list from products + variants
    const catalogItems: CatalogItem[] = useMemo(() => {
        if (!productsData) return [];
        const list: CatalogItem[] = [];
        for (const product of productsData) {
            const unitName: string = product.unit?.name ?? "pcs";
            const type: string = product.productType ?? "SELLABLE";
            const pricingMode: string = product.pricingMode ?? "UNIT";
            if (product.variants?.length > 0) {
                for (const v of product.variants) {
                    const variantSuffix = v.variantName ? ` (${v.variantName})` : v.size || v.color ? ` (${[v.size, v.color].filter(Boolean).join(", ")})` : "";
                    list.push({
                        label: `${product.name}${variantSuffix}`,
                        description: `${product.name}${variantSuffix}`,
                        unit: pricingMode === "AREA_BASED" ? "m²" : unitName,
                        price: Number(v.price),
                        type,
                        pricingMode,
                    });
                }
            } else {
                list.push({
                    label: product.name,
                    description: product.name,
                    unit: pricingMode === "AREA_BASED" ? "m²" : unitName,
                    price: Number(product.pricePerUnit ?? 0),
                    type,
                    pricingMode,
                });
            }
        }
        return list;
    }, [productsData]);

    const filteredCatalog = useMemo(() => {
        if (!pickerSearch.trim()) return catalogItems.slice(0, 30);
        const q = pickerSearch.toLowerCase();
        return catalogItems.filter(c => c.label.toLowerCase().includes(q)).slice(0, 20);
    }, [catalogItems, pickerSearch]);

    const selectCatalogItem = (idx: number, cat: CatalogItem) => {
        const isAreaBased = cat.pricingMode === "AREA_BASED";
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const w = item.width ?? 1;
            const h = item.height ?? 1;
            return {
                ...item,
                description: cat.description,
                unit: isAreaBased ? "m²" : cat.unit,
                price: cat.price,
                isAreaBased,
                width: isAreaBased ? w : undefined,
                height: isAreaBased ? h : undefined,
                quantity: isAreaBased ? Math.round(w * h * 100) / 100 : item.quantity,
            };
        }));
        setOpenPickerIdx(null);
        setPickerSearch("");
    };

    // Toggle area-based mode per row
    const toggleAreaMode = (idx: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const on = !item.isAreaBased;
            return {
                ...item,
                isAreaBased: on,
                unit: on ? "m²" : "pcs",
                width: on ? 1 : undefined,
                height: on ? 1 : undefined,
                quantity: on ? 1 : item.quantity,
            };
        }));
    };

    // Handle width/height change and recalculate area
    const handleDimensionChange = (idx: number, field: "width" | "height", value: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const w = field === "width" ? value : (item.width ?? 1);
            const h = field === "height" ? value : (item.height ?? 1);
            return { ...item, [field]: value, quantity: Math.round(w * h * 100) / 100 };
        }));
    };

    // Close picker on outside click
    const handlePickerBlur = () => {
        setTimeout(() => setOpenPickerIdx(null), 150);
    };

    const handleItemChange = (idx: number, field: keyof InvoiceItem, value: string | number) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };
    const addItem = () => setItems(prev => [...prev, { description: "", unit: "pcs", quantity: 1, price: 0, isAreaBased: false }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

    const taxRateNum = parseFloat(taxRate) || 0;
    const discountNum = parseFloat(discount) || 0;
    const { subtotal, taxAmount, total } = calcTotals(items, taxRateNum, discountNum);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const seq = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        const dateStr = dayjs().format("YYYYMMDD");
        const prefix = isQuotation ? "SPH" : "INV";
        const number = initial?.invoiceNumber ?? `${prefix}-${dateStr}-${seq}`;

        onSave({
            invoiceNumber: number,
            type: docType,
            clientName, clientCompany, clientAddress, clientPhone, clientEmail,
            dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
            validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
            taxRate: taxRateNum,
            taxAmount,
            discount: discountNum,
            subtotal,
            total,
            notes,
            items: items.map(i => ({
                description: i.isAreaBased && i.width && i.height
                    ? `${i.description} (${i.width}m × ${i.height}m)`
                    : i.description,
                unit: i.unit,
                quantity: Number(i.quantity),
                price: Number(i.price),
            })),
        });
    };

    const TYPE_BADGE: Record<string, string> = {
        SELLABLE: "bg-emerald-500/10 text-emerald-600",
        SERVICE: "bg-violet-500/10 text-violet-600",
        RAW_MATERIAL: "bg-amber-500/10 text-amber-600",
    };
    const TYPE_LABEL: Record<string, string> = {
        SELLABLE: "Produk",
        SERVICE: "Jasa",
        RAW_MATERIAL: "Bahan",
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-lg flex flex-col max-h-[95vh]">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                    <h3 className="font-semibold text-foreground">
                        {mode === "create" ? "Buat" : "Edit"} {isQuotation ? "Penawaran Harga (SPH)" : "Invoice"}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col grow min-h-0">
                    <div className="overflow-y-auto grow p-6 space-y-6">
                        {/* Client info */}
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" /> Informasi Klien
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Nama PIC / Kontak *</label>
                                    <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama narahubung" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Nama Perusahaan / Brand / Event</label>
                                    <input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="PT. ABC / Event XYZ" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><Phone className="h-3 w-3 inline mr-1" />No. Telepon</label>
                                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><Mail className="h-3 w-3 inline mr-1" />Email</label>
                                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@perusahaan.com" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="col-span-1 sm:col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><MapPin className="h-3 w-3 inline mr-1" />Alamat Lengkap</label>
                                    <textarea rows={2} value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Jl. ..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                                </div>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="grid grid-cols-2 gap-3">
                            {!isQuotation ? (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Jatuh Tempo</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Berlaku Hingga *</label>
                                    <input required type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" /> Item / Deskripsi Pekerjaan
                                </h4>
                                <button type="button" onClick={addItem} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Tambah Baris
                                </button>
                            </div>

                            {/* Hints */}
                            <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Package className="h-3 w-3" /> Ikon katalog → pilih dari inventori</span>
                                <span className="flex items-center gap-1">📐 Ikon ukuran → mode lebar × tinggi (banner, spanduk, dll.)</span>
                                <span className="flex items-center gap-1">✏️ Semua field bisa diedit bebas untuk item custom</span>
                            </div>

                            <div className="space-y-3">
                                {/* Header - hidden on mobile */}
                                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                                    <span className="col-span-5">Deskripsi / Nama Produk</span>
                                    <span className="col-span-2">Satuan</span>
                                    <span className="col-span-1 text-center">Qty</span>
                                    <span className="col-span-2 text-right">Harga/Satuan</span>
                                    <span className="col-span-2 text-right">Subtotal</span>
                                </div>

                                {items.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        {/* Main row */}
                                        <div className="grid grid-cols-12 gap-2 items-center">
                                            {/* Description + catalog picker */}
                                            <div className="col-span-12 sm:col-span-5 relative" ref={openPickerIdx === idx ? pickerRef : null}>
                                                <div className="flex gap-1">
                                                    <input
                                                        required
                                                        value={item.description}
                                                        onChange={e => handleItemChange(idx, "description", e.target.value)}
                                                        onBlur={handlePickerBlur}
                                                        placeholder="Ketik bebas atau pilih dari katalog..."
                                                        className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-0"
                                                    />
                                                    {/* Catalog picker toggle */}
                                                    <button
                                                        type="button"
                                                        title="Pilih dari katalog produk/jasa"
                                                        onClick={() => { setOpenPickerIdx(openPickerIdx === idx ? null : idx); setPickerSearch(""); }}
                                                        className={`shrink-0 p-2 rounded-lg border transition-colors ${openPickerIdx === idx ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-primary hover:border-primary/50"}`}
                                                    >
                                                        <Package className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                {/* Dropdown picker */}
                                                {openPickerIdx === idx && (
                                                    <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                                                        onMouseDown={e => e.preventDefault()}>
                                                        <div className="p-2 border-b border-border">
                                                            <div className="flex items-center gap-2 bg-background border border-input rounded-lg px-2 py-1.5">
                                                                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                <input
                                                                    autoFocus
                                                                    value={pickerSearch}
                                                                    onChange={e => setPickerSearch(e.target.value)}
                                                                    placeholder="Cari produk atau jasa..."
                                                                    className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
                                                                />
                                                                {pickerSearch && <button type="button" onClick={() => setPickerSearch("")} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
                                                            </div>
                                                        </div>
                                                        <div className="max-h-56 overflow-y-auto">
                                                            {filteredCatalog.length === 0 ? (
                                                                <p className="p-3 text-sm text-muted-foreground text-center">Tidak ditemukan.</p>
                                                            ) : filteredCatalog.map((cat, ci) => (
                                                                <button key={ci} type="button" onMouseDown={() => selectCatalogItem(idx, cat)}
                                                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border/50 last:border-0">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <p className="text-sm font-medium text-foreground truncate">{cat.label}</p>
                                                                            {cat.pricingMode === "AREA_BASED" && (
                                                                                <span className="shrink-0 text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full">per m²</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">{cat.unit} · {fmt(cat.price)}</p>
                                                                    </div>
                                                                    <span className={`ml-2 shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGE[cat.type] ?? "bg-muted text-muted-foreground"}`}>
                                                                        {TYPE_LABEL[cat.type] ?? cat.type}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Unit — locked to m² when area mode */}
                                            {item.isAreaBased ? (
                                                <div className="col-span-4 sm:col-span-2 flex items-center justify-center h-9 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-600">m²</div>
                                            ) : (
                                                <select value={item.unit} onChange={e => handleItemChange(idx, "unit", e.target.value)} className="col-span-4 sm:col-span-2 bg-background border border-input rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    {item.unit && !UNITS.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
                                                </select>
                                            )}

                                            {/* Qty — shows calculated area when area mode */}
                                            {item.isAreaBased ? (
                                                <div className="col-span-2 sm:col-span-1 flex items-center justify-center h-9 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-600">
                                                    {item.quantity}
                                                </div>
                                            ) : (
                                                <input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)} className="col-span-2 sm:col-span-1 bg-background border border-input rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                            )}

                                            {/* Price */}
                                            <input required type="number" min="0" value={item.price} onChange={e => handleItemChange(idx, "price", e.target.value)} placeholder="0" className="col-span-4 sm:col-span-2 bg-background border border-input rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />

                                            {/* Subtotal + area toggle + delete */}
                                            <div className="col-span-2 flex items-center justify-end gap-1">
                                                <span className="hidden sm:inline text-xs text-muted-foreground mr-1">{fmt(item.quantity * item.price)}</span>
                                                {/* Area mode toggle */}
                                                <button type="button" onClick={() => toggleAreaMode(idx)}
                                                    title={item.isAreaBased ? "Kembali ke mode qty normal" : "Aktifkan mode ukuran (m²)"}
                                                    className={`p-1.5 rounded-lg border text-xs transition-colors ${item.isAreaBased ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "border-input text-muted-foreground hover:text-blue-600 hover:border-blue-500/30"}`}>
                                                    📐
                                                </button>
                                                {items.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><X className="h-3.5 w-3.5" /></button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Area dimension sub-row */}
                                        {item.isAreaBased && (
                                            <div className="ml-1 flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                                                <span className="text-xs text-blue-600 font-medium shrink-0">📐 Ukuran:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number" min="0.01" step="0.01"
                                                        value={item.width ?? 1}
                                                        onChange={e => handleDimensionChange(idx, "width", parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-background border border-blue-500/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                    <span className="text-xs text-muted-foreground">m</span>
                                                    <span className="text-xs text-muted-foreground">×</span>
                                                    <input
                                                        type="number" min="0.01" step="0.01"
                                                        value={item.height ?? 1}
                                                        onChange={e => handleDimensionChange(idx, "height", parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-background border border-blue-500/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                    <span className="text-xs text-muted-foreground">m</span>
                                                    <span className="text-xs text-blue-600 font-semibold ml-1">
                                                        = {item.quantity} m²
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-2">→</span>
                                                    <span className="text-xs font-medium text-foreground">{fmt(item.quantity * item.price)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tax / Discount */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Diskon (Rp)</label>
                                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">PPN (%)</label>
                                <select value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="0">Tanpa PPN</option>
                                    <option value="11">PPN 11%</option>
                                    <option value="12">PPN 12%</option>
                                </select>
                            </div>
                        </div>

                        {/* Totals preview */}
                        <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1.5">
                            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                            {discountNum > 0 && <div className="flex justify-between text-destructive"><span>Diskon</span><span>− {fmt(discountNum)}</span></div>}
                            {taxRateNum > 0 && <div className="flex justify-between text-muted-foreground"><span>PPN {taxRateNum}%</span><span>{fmt(taxAmount)}</span></div>}
                            <div className="flex justify-between font-bold text-foreground text-base pt-2 border-t border-border"><span>Total</span><span className="text-primary">{fmt(total)}</span></div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Catatan / Syarat &amp; Ketentuan</label>
                            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder={isQuotation ? "Misal: Penawaran berlaku 14 hari. Harga belum termasuk ongkos kirim..." : "Misal: Pembayaran via transfer ke BCA 123-456-789..."}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                        </div>
                    </div>
                    <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isPending ? "Menyimpan..." : mode === "create" ? `Simpan ${isQuotation ? "Penawaran" : "Invoice"}` : "Update"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------- Main Page ----------
export default function InvoicesPage() {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<DocType>("INVOICE");
    const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
    const [editDoc, setEditDoc] = useState<Invoice | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Invoice | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: invoiceData, isLoading: loadingInvoices } = useQuery({ queryKey: ["invoices", "INVOICE"], queryFn: () => getInvoices("INVOICE") });
    const { data: quotationData, isLoading: loadingQuotations } = useQuery({ queryKey: ["invoices", "QUOTATION"], queryFn: () => getInvoices("QUOTATION") });
    const { data: settings } = useQuery({ queryKey: ["store-settings"], queryFn: getSettings, staleTime: 5 * 60 * 1000 });

    const invoices: Invoice[] = invoiceData ?? [];
    const quotations: Invoice[] = quotationData ?? [];
    const docs = activeTab === "INVOICE" ? invoices : quotations;
    const isLoading = activeTab === "INVOICE" ? loadingInvoices : loadingQuotations;

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["invoices", "INVOICE"] });
        queryClient.invalidateQueries({ queryKey: ["invoices", "QUOTATION"] });
    };

    const createMutation = useMutation({ mutationFn: createInvoice, onSuccess: () => { invalidate(); setFormMode(null); } });
    const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => updateInvoice(id, data), onSuccess: () => { invalidate(); setFormMode(null); setEditDoc(null); } });
    const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => updateInvoiceStatus(id, status), onSuccess: invalidate });
    const deleteMutation = useMutation({ mutationFn: deleteInvoice, onSuccess: () => { invalidate(); setDeleteId(null); } });
    const convertMutation = useMutation({ mutationFn: convertQuotationToInvoice, onSuccess: () => { invalidate(); } });

    const handleSave = (data: any) => {
        if (formMode === "edit" && editDoc) {
            updateMutation.mutate({ id: editDoc.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const invoiceSummary = useMemo(() => ({
        total: invoices.length,
        totalValue: invoices.reduce((s, i) => s + parseFloat(i.total), 0),
        unpaid: invoices.filter(i => i.status === "SENT").length,
        unpaidValue: invoices.filter(i => i.status === "SENT").reduce((s, i) => s + parseFloat(i.total), 0),
        overdue: invoices.filter(i => i.status === "SENT" && i.dueDate && dayjs(i.dueDate).isBefore(dayjs())).length,
    }), [invoices]);

    const quotationSummary = useMemo(() => ({
        total: quotations.length,
        pending: quotations.filter(q => q.status === "SENT").length,
        accepted: quotations.filter(q => q.status === "ACCEPTED").length,
        acceptedValue: quotations.filter(q => q.status === "ACCEPTED").reduce((s, q) => s + parseFloat(q.total), 0),
    }), [quotations]);

    const nextStatuses = activeTab === "INVOICE" ? INVOICE_NEXT_STATUSES : QUOTATION_NEXT_STATUSES;
    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Invoice &amp; Penawaran</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Kelola faktur tagihan dan surat penawaran harga untuk klien B2B.</p>
                </div>
                <button onClick={() => { setEditDoc(null); setFormMode("create"); }}
                    className="mt-4 sm:mt-0 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <Plus className="h-4 w-4" />
                    Buat {activeTab === "INVOICE" ? "Invoice" : "Penawaran Harga"}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
                <button onClick={() => setActiveTab("INVOICE")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "INVOICE" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <FileText className="h-4 w-4" /> Invoice
                    <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{invoices.length}</span>
                </button>
                <button onClick={() => setActiveTab("QUOTATION")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "QUOTATION" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <ClipboardList className="h-4 w-4" /> Penawaran Harga (SPH)
                    <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{quotations.length}</span>
                </button>
            </div>

            {/* Summary cards */}
            {activeTab === "INVOICE" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-xl border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total Invoice</p>
                        <p className="text-xl font-bold text-foreground">{invoiceSummary.total}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(invoiceSummary.totalValue)} total nilai</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-blue-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Menunggu Pembayaran</p>
                        <p className="text-xl font-bold text-blue-500">{invoiceSummary.unpaid} invoice</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(invoiceSummary.unpaidValue)}</p>
                    </div>
                    <div className={`glass p-4 rounded-xl border ${invoiceSummary.overdue > 0 ? "border-destructive/30" : "border-border"}`}>
                        <p className="text-xs text-muted-foreground mb-1">Overdue</p>
                        <p className={`text-xl font-bold ${invoiceSummary.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {invoiceSummary.overdue} invoice
                        </p>
                        {invoiceSummary.overdue > 0 && (
                            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Melewati jatuh tempo
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-xl border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total Penawaran</p>
                        <p className="text-xl font-bold text-foreground">{quotationSummary.total}</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-blue-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Menunggu Konfirmasi</p>
                        <p className="text-xl font-bold text-blue-500">{quotationSummary.pending} SPH</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-emerald-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Diterima → Jadi Invoice</p>
                        <p className="text-xl font-bold text-emerald-600">{quotationSummary.accepted} SPH</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(quotationSummary.acceptedValue)}</p>
                    </div>
                </div>
            )}

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="glass rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Memuat data...</span>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="glass rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
                        Belum ada {activeTab === "INVOICE" ? "invoice" : "penawaran harga"}. Klik tombol di atas untuk membuat.
                    </div>
                ) : docs.map((doc) => {
                    const dateField = activeTab === "INVOICE" ? doc.dueDate : doc.validUntil;
                    const isOverdue = dateField && dayjs(dateField).isBefore(dayjs()) && doc.status === "SENT";
                    const nextSts = nextStatuses[doc.status] ?? [];
                    return (
                        <div key={doc.id} className="glass rounded-xl border border-border p-4 space-y-3">
                            {/* Top row: number + status + total */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-mono font-bold text-primary text-sm">{doc.invoiceNumber}</p>
                                    <p className="font-semibold text-foreground">{doc.clientName}</p>
                                    {doc.clientCompany && <p className="text-xs text-muted-foreground">{doc.clientCompany}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_CONFIG[doc.status].className}`}>
                                        {STATUS_CONFIG[doc.status].label}
                                    </span>
                                    <p className="font-bold text-foreground mt-1">{fmt(parseFloat(doc.total))}</p>
                                </div>
                            </div>

                            {/* Date info */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Dibuat: {dayjs(doc.date).format("DD MMM YYYY")}</span>
                                {dateField && (
                                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                        {activeTab === "INVOICE" ? "Jatuh Tempo" : "Berlaku s/d"}: {dayjs(dateField).format("DD MMM YYYY")}
                                        {isOverdue && " ⚠ Overdue"}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 flex-wrap">
                                {nextSts.map(ns => (
                                    <button key={ns} onClick={() => statusMutation.mutate({ id: doc.id, status: ns })}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ns === "PAID" || ns === "ACCEPTED" ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : ns === "CANCELLED" || ns === "REJECTED" ? "border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/20 text-primary bg-primary/5 hover:bg-primary/10"}`}>
                                        {ns === "PAID" || ns === "ACCEPTED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                        {STATUS_CONFIG[ns].label}
                                    </button>
                                ))}
                                {activeTab === "QUOTATION" && doc.status === "ACCEPTED" && (
                                    <button onClick={() => convertMutation.mutate(doc.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                                        <FileText className="h-3.5 w-3.5" /> Jadi Invoice
                                    </button>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                    <button onClick={() => setPreviewDoc(doc)} title="Preview & Cetak"
                                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    {doc.status === "DRAFT" && (
                                        <button onClick={() => { setEditDoc(doc); setFormMode("edit"); }} title="Edit"
                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => setDeleteId(doc.id)} title="Hapus"
                                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nomor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Klien / Perusahaan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Dibuat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{activeTab === "INVOICE" ? "Jatuh Tempo" : "Berlaku s/d"}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                            ) : docs.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                    Belum ada {activeTab === "INVOICE" ? "invoice" : "penawaran harga"}. Klik tombol di atas untuk membuat.
                                </td></tr>
                            ) : docs.map((doc) => {
                                const dateField = activeTab === "INVOICE" ? doc.dueDate : doc.validUntil;
                                const isOverdue = dateField && dayjs(dateField).isBefore(dayjs()) && doc.status === "SENT";
                                const nextSts = nextStatuses[doc.status] ?? [];
                                return (
                                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-primary">{doc.invoiceNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-semibold text-foreground">{doc.clientName}</p>
                                            {doc.clientCompany && <p className="text-xs text-muted-foreground">{doc.clientCompany}</p>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{dayjs(doc.date).format("DD MMM YYYY")}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {dateField ? (
                                                <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                                    {dayjs(dateField).format("DD MMM YYYY")}
                                                    {isOverdue && <span className="block text-xs">Overdue</span>}
                                                </span>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_CONFIG[doc.status].className}`}>
                                                {STATUS_CONFIG[doc.status].label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground text-right">
                                            {fmt(parseFloat(doc.total))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end items-center gap-1 text-muted-foreground">
                                                {nextSts.map(ns => (
                                                    <button key={ns} onClick={() => statusMutation.mutate({ id: doc.id, status: ns })}
                                                        title={`Tandai: ${STATUS_CONFIG[ns].label}`}
                                                        className={`p-1.5 rounded hover:bg-muted transition-colors ${ns === "PAID" || ns === "ACCEPTED" ? "hover:text-emerald-600" : ns === "CANCELLED" || ns === "REJECTED" ? "hover:text-destructive" : "hover:text-primary"}`}>
                                                        {ns === "PAID" || ns === "ACCEPTED" ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                                    </button>
                                                ))}
                                                {activeTab === "QUOTATION" && doc.status === "ACCEPTED" && (
                                                    <button onClick={() => convertMutation.mutate(doc.id)} title="Konversi ke Invoice"
                                                        className="p-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors">
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => setPreviewDoc(doc)} title="Preview & Cetak"
                                                    className="p-1.5 rounded hover:bg-muted hover:text-primary transition-colors">
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {doc.status === "DRAFT" && (
                                                    <button onClick={() => { setEditDoc(doc); setFormMode("edit"); }} title="Edit"
                                                        className="p-1.5 rounded hover:bg-muted hover:text-primary transition-colors">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => setDeleteId(doc.id)} title="Hapus"
                                                    className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form */}
            {formMode && (
                <FormModal
                    mode={formMode}
                    docType={activeTab}
                    initial={editDoc ?? undefined}
                    onClose={() => { setFormMode(null); setEditDoc(null); }}
                    onSave={handleSave}
                    isPending={isSaving}
                />
            )}

            {/* Print Preview */}
            {previewDoc && <PrintModal doc={previewDoc} settings={settings} onClose={() => setPreviewDoc(null)} />}

            {/* Delete confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-lg p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="font-semibold text-foreground mb-2">Hapus Dokumen?</h3>
                        <p className="text-sm text-muted-foreground mb-6">Data tidak dapat dipulihkan setelah dihapus.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                            <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                                {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
