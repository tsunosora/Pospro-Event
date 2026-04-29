"use client";

import { cloneElement, isValidElement, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    ArrowLeft, Save, User, Phone, Building2, Tag,
    Calendar, MapPin, AlignLeft, Layers, Globe, UserCog,
} from "lucide-react";
import {
    createLead,
    listStages,
    listLabels,
    getDistinctValues,
    type LeadLevel,
    type LeadSource,
} from "@/lib/api/crm";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { getWorkers, MARKETER_POSITIONS, getPositionMeta } from "@/lib/api/workers";

const LEVELS: { value: LeadLevel; label: string; emoji: string; cls: string }[] = [
    { value: "HOT", label: "Hot", emoji: "🔥", cls: "bg-red-50 text-red-700 border-red-300 hover:bg-red-100" },
    { value: "WARM", label: "Warm", emoji: "🟡", cls: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100" },
    { value: "COLD", label: "Cold", emoji: "🔵", cls: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" },
    { value: "UNQUALIFIED", label: "Unqualified", emoji: "⚫", cls: "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100" },
];

const SOURCES: { value: LeadSource; label: string; emoji: string }[] = [
    { value: "META_ADS", label: "META Ads", emoji: "📱" },
    { value: "WHATSAPP", label: "WhatsApp", emoji: "💬" },
    { value: "WEBSITE", label: "Website", emoji: "🌐" },
    { value: "REFERRAL", label: "Referral", emoji: "👥" },
    { value: "WALK_IN", label: "Walk-in", emoji: "🚶" },
    { value: "OTHER", label: "Lainnya", emoji: "📌" },
];

export default function NewLeadPage() {
    const router = useRouter();
    const { data: stages } = useQuery({ queryKey: ["crm-stages"], queryFn: listStages });
    const { data: labels } = useQuery({ queryKey: ["crm-labels"], queryFn: listLabels });
    const { data: cityOptions } = useQuery({
        queryKey: ["crm-distinct", "city"],
        queryFn: () => getDistinctValues("city"),
    });
    const { data: productOptions } = useQuery({
        queryKey: ["crm-distinct", "productCategory"],
        queryFn: () => getDistinctValues("productCategory"),
    });
    // Marketing yang available — filter Worker dengan posisi MARKETING/SALES
    const { data: marketers } = useQuery({
        queryKey: ["workers", "marketers"],
        queryFn: () => getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
    });

    // Default brand: ambil last-used dari localStorage
    const [defaultBrand] = useState<Brand>(() => {
        try {
            const v = localStorage.getItem("pospro:lead:lastBrand");
            if (v === "EXINDO" || v === "XPOSER") return v;
        } catch { /* ignore */ }
        return "EXINDO";
    });
    // Default marketing handler: ambil last-used dari localStorage
    const [defaultMarketerId] = useState<number | "">(() => {
        try {
            const v = localStorage.getItem("pospro:lead:lastMarketerId");
            const n = v ? Number(v) : NaN;
            return Number.isFinite(n) && n > 0 ? n : "";
        } catch { /* ignore */ }
        return "";
    });
    const [form, setForm] = useState({
        name: "",
        phone: "",
        organization: "",
        productCategory: "",
        city: "",
        brand: defaultBrand as Brand,
        assignedWorkerId: defaultMarketerId as number | "",
        level: "" as LeadLevel | "",
        source: "WHATSAPP" as LeadSource,
        sourceDetail: "",
        stageId: 0,
        orderDescription: "",
        eventDate: "",
        eventLocation: "",
        notes: "",
        labelIds: [] as number[],
    });

    const mut = useMutation({
        mutationFn: () =>
            createLead({
                name: form.name || null,
                phone: form.phone,
                organization: form.organization || null,
                productCategory: form.productCategory || null,
                city: form.city || null,
                brand: form.brand,
                assignedWorkerId: form.assignedWorkerId === "" ? null : form.assignedWorkerId,
                level: form.level || null,
                source: form.source,
                sourceDetail: form.sourceDetail || null,
                stageId: form.stageId || (stages?.[0]?.id ?? 0),
                orderDescription: form.orderDescription || null,
                eventDate: form.eventDate || null,
                eventLocation: form.eventLocation || null,
                notes: form.notes || null,
                labelIds: form.labelIds,
            }),
        onSuccess: (lead) => {
            // Ingat brand & marketing last-used untuk default lead berikutnya
            try {
                localStorage.setItem("pospro:lead:lastBrand", form.brand);
                if (form.assignedWorkerId !== "") {
                    localStorage.setItem("pospro:lead:lastMarketerId", String(form.assignedWorkerId));
                }
            } catch { /* ignore */ }
            router.push(`/crm/board?focus=${lead.id}`);
        },
    });

    function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
        setForm((s) => ({ ...s, [k]: v }));
    }

    function toggleLabel(id: number) {
        setForm((s) => ({
            ...s,
            labelIds: s.labelIds.includes(id) ? s.labelIds.filter((x) => x !== id) : [...s.labelIds, id],
        }));
    }

    const phoneValid = form.phone.trim().length >= 8;

    return (
        <div className="max-w-3xl mx-auto pb-24 sm:pb-8">
            {/* Header sticky */}
            <div className="sticky top-0 z-30 bg-background border-b border-border px-4 sm:px-0 py-3 sm:py-4">
                <Link
                    href="/crm/board"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Pipeline
                </Link>
                <h1 className="text-2xl font-bold mt-2">Tambah Lead Baru</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Wajib isi <strong>Nomor HP</strong>. Field lain bisa dilengkapi nanti.
                </p>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!phoneValid) return;
                    mut.mutate();
                }}
                className="px-4 sm:px-0 py-4 space-y-6"
            >
                {/* ── Section: Brand ── */}
                <Section
                    title="Brand / Perusahaan"
                    desc="Lead ini akan masuk ke surat penawaran brand mana?"
                    icon={<Building2 className="h-4 w-4" />}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ACTIVE_BRANDS.map((b) => {
                            const meta = BRAND_META[b];
                            const active = form.brand === b;
                            return (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => set("brand", b)}
                                    className={`p-4 rounded-xl border-2 transition flex items-center gap-3 text-left ${active
                                        ? `${meta.bg} ${meta.border} shadow-sm`
                                        : "bg-white border-slate-200 hover:border-slate-300"
                                        }`}
                                >
                                    <span className={`text-3xl`}>{meta.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold ${active ? meta.text : "text-slate-800"}`}>
                                            {meta.short}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{meta.label}</div>
                                    </div>
                                    {active && <span className={`${meta.text} font-bold`}>✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </Section>

                {/* ── Section: Marketing Handler ── */}
                <Section
                    title="Marketing Handler"
                    desc="Siapa yang menghandle lead ini di awal? (tim marketing/sales)"
                    icon={<UserCog className="h-4 w-4" />}
                >
                    {(marketers ?? []).length === 0 ? (
                        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            ⚠️ Belum ada karyawan dengan posisi <b>Marketing</b> atau <b>Sales</b>.
                            Tambahkan dulu di <Link href="/workers" className="underline font-medium">halaman Karyawan</Link>.
                        </div>
                    ) : (
                        <Field label="Pilih Marketing" hint="Bisa diisi nanti / dipindah ke marketing lain">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => set("assignedWorkerId", "")}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition text-left ${form.assignedWorkerId === ""
                                        ? "border-slate-400 bg-slate-100"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                        ?
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-700">Belum di-assign</div>
                                        <div className="text-[11px] text-muted-foreground">Bisa diisi nanti</div>
                                    </div>
                                    {form.assignedWorkerId === "" && <span className="text-slate-700 font-bold">✓</span>}
                                </button>
                                {(marketers ?? []).map((w) => {
                                    const active = form.assignedWorkerId === w.id;
                                    const meta = getPositionMeta(w.position);
                                    return (
                                        <button
                                            key={w.id}
                                            type="button"
                                            onClick={() => set("assignedWorkerId", w.id)}
                                            className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition text-left ${active
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                }`}
                                        >
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                                                {w.photoUrl ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img src={w.photoUrl} alt={w.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold">
                                                        {w.name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-semibold truncate ${active ? "text-primary" : "text-slate-800"}`}>
                                                    {w.name}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                                    {meta?.emoji} {meta?.label ?? w.position ?? "—"}
                                                </div>
                                            </div>
                                            {active && <span className="text-primary font-bold">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                    )}
                </Section>

                {/* ── Section: Info Kontak ── */}
                <Section
                    title="Info Kontak"
                    desc="Identitas dasar calon klien"
                    icon={<User className="h-4 w-4" />}
                >
                    <Field label="Nama" hint="Boleh kosong kalau lead anonim (mis. dari META Ads)">
                        <InputWithIcon icon={<User className="h-4 w-4" />}>
                            <input
                                value={form.name}
                                onChange={(e) => set("name", e.target.value)}
                                className="form-input"
                                placeholder="Bp. Ivan / Mba Sari / dll"
                                autoFocus
                            />
                        </InputWithIcon>
                    </Field>

                    <Field label="Nomor HP" required error={form.phone && !phoneValid ? "Minimal 8 digit" : undefined}>
                        <InputWithIcon icon={<Phone className="h-4 w-4" />}>
                            <input
                                type="tel"
                                inputMode="tel"
                                value={form.phone}
                                onChange={(e) => set("phone", e.target.value)}
                                className="form-input"
                                placeholder="08123456789 atau +6281234567890"
                                required
                            />
                        </InputWithIcon>
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Perusahaan / Instansi">
                            <InputWithIcon icon={<Building2 className="h-4 w-4" />}>
                                <input
                                    value={form.organization}
                                    onChange={(e) => set("organization", e.target.value)}
                                    className="form-input"
                                    placeholder="PT JAPURA / CV ..."
                                />
                            </InputWithIcon>
                        </Field>
                        <Field label="Kategori Produk" hint="Booth jenis apa?">
                            <InputWithIcon icon={<Tag className="h-4 w-4" />}>
                                <input
                                    list="product-options"
                                    value={form.productCategory}
                                    onChange={(e) => set("productCategory", e.target.value)}
                                    className="form-input"
                                    placeholder="Special Design Kayu, Sewa Booth"
                                />
                            </InputWithIcon>
                            <datalist id="product-options">
                                {(productOptions ?? []).map((p) => (
                                    <option key={p} value={p} />
                                ))}
                            </datalist>
                        </Field>
                        <Field label="Kota" hint="Kota klien / lokasi proyek (untuk filter & laporan)">
                            <InputWithIcon icon={<MapPin className="h-4 w-4" />}>
                                <input
                                    list="city-options"
                                    value={form.city}
                                    onChange={(e) => set("city", e.target.value)}
                                    className="form-input"
                                    placeholder="Jakarta, Surabaya, Bandung, ..."
                                />
                            </InputWithIcon>
                            <datalist id="city-options">
                                {(cityOptions ?? []).map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                        </Field>
                    </div>
                </Section>

                {/* ── Section: Klasifikasi Lead ── */}
                <Section
                    title="Klasifikasi"
                    desc="Tahap pipeline, level potensi, sumber lead"
                    icon={<Layers className="h-4 w-4" />}
                >
                    <Field label="Tahap Pipeline">
                        <select
                            value={form.stageId}
                            onChange={(e) => set("stageId", Number(e.target.value))}
                            className="form-input"
                        >
                            <option value={0}>Lead Masuk (default)</option>
                            {stages?.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Level Potensi">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {LEVELS.map((l) => {
                                const active = form.level === l.value;
                                return (
                                    <button
                                        key={l.value}
                                        type="button"
                                        onClick={() => set("level", active ? "" : l.value)}
                                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border text-sm font-medium transition ${
                                            active
                                                ? l.cls + " ring-2 ring-offset-1"
                                                : "border-border bg-background hover:bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        <span>{l.emoji}</span>
                                        <span>{l.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    <Field label="Sumber Lead">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {SOURCES.map((s) => {
                                const active = form.source === s.value;
                                return (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => set("source", s.value)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition ${
                                            active
                                                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                                                : "border-border bg-background hover:bg-muted text-foreground/80"
                                        }`}
                                    >
                                        <span>{s.emoji}</span>
                                        <span>{s.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    <Field label="Detail Sumber" hint="Catatan tambahan tentang sumber (opsional)">
                        <InputWithIcon icon={<Globe className="h-4 w-4" />}>
                            <input
                                value={form.sourceDetail}
                                onChange={(e) => set("sourceDetail", e.target.value)}
                                className="form-input"
                                placeholder='Mis. "META ads — Halo Exindo, kebutuhan booth"'
                            />
                        </InputWithIcon>
                    </Field>
                </Section>

                {/* ── Section: Detail Project (opsional) ── */}
                <Section
                    title="Detail Project (Opsional)"
                    desc="Info kalau klien sudah cerita kebutuhan event-nya"
                    icon={<Calendar className="h-4 w-4" />}
                >
                    <Field label="Deskripsi Order">
                        <textarea
                            value={form.orderDescription}
                            onChange={(e) => set("orderDescription", e.target.value)}
                            className="form-input min-h-[80px] resize-y"
                            placeholder="Mis. Booth 3x3 untuk pameran F&B di Jakarta, butuh lighting set"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Tanggal Event">
                            <InputWithIcon icon={<Calendar className="h-4 w-4" />}>
                                <input
                                    type="date"
                                    value={form.eventDate}
                                    onChange={(e) => set("eventDate", e.target.value)}
                                    className="form-input"
                                />
                            </InputWithIcon>
                        </Field>
                        <Field label="Lokasi Event">
                            <InputWithIcon icon={<MapPin className="h-4 w-4" />}>
                                <input
                                    value={form.eventLocation}
                                    onChange={(e) => set("eventLocation", e.target.value)}
                                    className="form-input"
                                    placeholder="JIExpo Kemayoran, ICE BSD, dll"
                                />
                            </InputWithIcon>
                        </Field>
                    </div>
                </Section>

                {/* ── Section: Catatan & Label ── */}
                <Section
                    title="Catatan & Label (Opsional)"
                    desc="Tag visual + catatan internal"
                    icon={<AlignLeft className="h-4 w-4" />}
                >
                    <Field label="Catatan Internal">
                        <textarea
                            value={form.notes}
                            onChange={(e) => set("notes", e.target.value)}
                            className="form-input min-h-[80px] resize-y"
                            placeholder="Catatan untuk tim internal (tidak terlihat klien)"
                        />
                    </Field>

                    {labels && labels.length > 0 && (
                        <Field label="Label" hint="Klik untuk tag/untag">
                            <div className="flex flex-wrap gap-2">
                                {labels.map((l) => {
                                    const on = form.labelIds.includes(l.id);
                                    return (
                                        <button
                                            key={l.id}
                                            type="button"
                                            onClick={() => toggleLabel(l.id)}
                                            className="px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-all"
                                            style={{
                                                backgroundColor: on ? l.color : "transparent",
                                                borderColor: l.color,
                                                color: on ? "#fff" : l.color,
                                            }}
                                        >
                                            {on ? "✓ " : ""}{l.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                    )}
                </Section>

                {mut.isError && (
                    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                        ❌ {(mut.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (mut.error as Error)?.message}
                    </div>
                )}
            </form>

            {/* Sticky bottom action bar */}
            <div className="fixed sm:sticky bottom-0 left-0 right-0 sm:bottom-4 bg-background border-t sm:border sm:rounded-lg sm:shadow-lg border-border p-3 sm:p-4 z-30 sm:max-w-3xl sm:mx-auto">
                <div className="flex gap-2 sm:gap-3 max-w-3xl mx-auto">
                    <Link
                        href="/crm/board"
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        onClick={(e) => {
                            e.preventDefault();
                            if (!phoneValid) return;
                            mut.mutate();
                        }}
                        disabled={mut.isPending || !phoneValid}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Save className="h-4 w-4" />
                        {mut.isPending ? "Menyimpan..." : "Simpan Lead"}
                    </button>
                </div>
                {!phoneValid && form.phone && (
                    <p className="text-xs text-amber-600 mt-2 text-center sm:text-left max-w-3xl mx-auto">
                        ⚠️ Nomor HP minimal 8 digit
                    </p>
                )}
            </div>

            {/* Form input styles — pakai Tailwind class agar konsisten dengan theme */}
            <style jsx>{`
                :global(.form-input) {
                    width: 100%;
                    border: 1px solid rgb(229 231 235);
                    background: white;
                    border-radius: 0.5rem;
                    padding: 0.625rem 0.875rem;
                    font-size: 0.9375rem;
                    line-height: 1.5;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                :global(.dark .form-input) {
                    background: rgb(31 41 55);
                    border-color: rgb(75 85 99);
                    color: white;
                }
                :global(.form-input:focus) {
                    outline: none;
                    border-color: rgb(99 102 241);
                    box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
                }
                :global(.form-input:hover:not(:focus):not(:disabled)) {
                    border-color: rgb(156 163 175);
                }
                :global(.form-input::placeholder) {
                    color: rgb(156 163 175);
                }
                :global(.dark .form-input::placeholder) {
                    color: rgb(107 114 128);
                }
            `}</style>
        </div>
    );
}

// ─── Components ──────────────────────────────────────────────────────────

function Section({
    title, desc, icon, children,
}: {
    title: string;
    desc?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-muted-foreground">{icon}</span>}
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                </div>
                {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
            </div>
            <div className="p-4 sm:p-5 space-y-4">{children}</div>
        </section>
    );
}

function Field({
    label, required, hint, error, children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                {hint && !error && (
                    <span className="text-xs text-muted-foreground font-normal">— {hint}</span>
                )}
            </label>
            {children}
            {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {error}
                </p>
            )}
        </div>
    );
}

function InputWithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    // Inject paddingLeft inline ke input child supaya menang specificity battle
    // dengan padding shorthand di .form-input class
    let injected: React.ReactNode = children;
    if (isValidElement(children)) {
        const el = children as ReactElement<{ style?: React.CSSProperties }>;
        injected = cloneElement(el, {
            style: { paddingLeft: "2.5rem", ...(el.props.style ?? {}) },
        });
    }
    return (
        <div className="relative">
            <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center"
                aria-hidden="true"
            >
                {icon}
            </span>
            {injected}
        </div>
    );
}
