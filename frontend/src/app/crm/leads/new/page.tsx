"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import {
    createLead,
    listStages,
    listLabels,
    type LeadLevel,
    type LeadSource,
} from "@/lib/api/crm";

const LEVELS: LeadLevel[] = ["HOT", "WARM", "COLD", "UNQUALIFIED"];
const SOURCES: LeadSource[] = ["META_ADS", "WHATSAPP", "WEBSITE", "REFERRAL", "WALK_IN", "OTHER"];

export default function NewLeadPage() {
    const router = useRouter();
    const { data: stages } = useQuery({ queryKey: ["crm-stages"], queryFn: listStages });
    const { data: labels } = useQuery({ queryKey: ["crm-labels"], queryFn: listLabels });

    const [form, setForm] = useState({
        name: "",
        phone: "",
        organization: "",
        productCategory: "",
        level: "" as LeadLevel | "",
        source: "OTHER" as LeadSource,
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

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-4">
            <Link
                href="/crm/board"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Pipeline
            </Link>

            <h1 className="text-xl font-bold">Tambah Lead Baru</h1>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.phone.trim()) return;
                    mut.mutate();
                }}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
                <Field label="Nama">
                    <input
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        className="input"
                        placeholder="Boleh kosong (lead anonim)"
                    />
                </Field>

                <Field label="Nomor HP" required>
                    <input
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        className="input"
                        placeholder="08xx atau +62xx"
                        required
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Organisasi">
                        <input
                            value={form.organization}
                            onChange={(e) => set("organization", e.target.value)}
                            className="input"
                        />
                    </Field>
                    <Field label="Product Category">
                        <input
                            value={form.productCategory}
                            onChange={(e) => set("productCategory", e.target.value)}
                            className="input"
                            placeholder="Special Design Kayu, dll"
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <Field label="Stage">
                        <select
                            value={form.stageId}
                            onChange={(e) => set("stageId", Number(e.target.value))}
                            className="input"
                        >
                            <option value={0}>(Default: Lead Masuk)</option>
                            {stages?.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Level">
                        <select
                            value={form.level}
                            onChange={(e) => set("level", e.target.value as LeadLevel | "")}
                            className="input"
                        >
                            <option value="">—</option>
                            {LEVELS.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Source">
                        <select
                            value={form.source}
                            onChange={(e) => set("source", e.target.value as LeadSource)}
                            className="input"
                        >
                            {SOURCES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>

                <Field label="Source Detail">
                    <input
                        value={form.sourceDetail}
                        onChange={(e) => set("sourceDetail", e.target.value)}
                        className="input"
                        placeholder="META ads – Halo Exindo, ..."
                    />
                </Field>

                <Field label="Deskripsi Order">
                    <textarea
                        value={form.orderDescription}
                        onChange={(e) => set("orderDescription", e.target.value)}
                        className="input min-h-[60px]"
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Tanggal Event">
                        <input
                            type="date"
                            value={form.eventDate}
                            onChange={(e) => set("eventDate", e.target.value)}
                            className="input"
                        />
                    </Field>
                    <Field label="Lokasi Event">
                        <input
                            value={form.eventLocation}
                            onChange={(e) => set("eventLocation", e.target.value)}
                            className="input"
                        />
                    </Field>
                </div>

                <Field label="Catatan">
                    <textarea
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        className="input min-h-[60px]"
                    />
                </Field>

                {labels && labels.length > 0 && (
                    <Field label="Labels">
                        <div className="flex flex-wrap gap-1.5">
                            {labels.map((l) => {
                                const on = form.labelIds.includes(l.id);
                                return (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => toggleLabel(l.id)}
                                        className="px-2 py-0.5 rounded text-xs font-medium border transition"
                                        style={{
                                            backgroundColor: on ? l.color : `${l.color}15`,
                                            borderColor: l.color,
                                            color: on ? "#fff" : l.color,
                                        }}
                                    >
                                        {l.name}
                                    </button>
                                );
                            })}
                        </div>
                    </Field>
                )}

                {mut.isError && (
                    <div className="text-xs text-destructive">
                        {(mut.error as any)?.response?.data?.message || (mut.error as any)?.message}
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    <button
                        type="submit"
                        disabled={mut.isPending || !form.phone.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {mut.isPending ? "Menyimpan..." : "Simpan Lead"}
                    </button>
                    <Link
                        href="/crm/board"
                        className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted"
                    >
                        Batal
                    </Link>
                </div>
            </form>

            <style jsx>{`
                .input {
                    width: 100%;
                    border: 1px solid hsl(var(--border));
                    background: hsl(var(--background));
                    border-radius: 0.375rem;
                    padding: 0.375rem 0.625rem;
                    font-size: 0.875rem;
                }
                .input:focus {
                    outline: 2px solid hsl(var(--ring));
                    outline-offset: -1px;
                }
            `}</style>
        </div>
    );
}

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </span>
            <div className="mt-1">{children}</div>
        </label>
    );
}
