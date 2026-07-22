"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, Loader2, FileText, Calculator } from "lucide-react";
import { getQuotations, type Quotation } from "@/lib/api/quotations";
import { getRabList, type RabPlan } from "@/lib/api/rab";

type Source = "quotation" | "rab";

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function BastSourcePicker({
    source,
    onPick,
    onClose,
}: {
    source: Source;
    onPick: (refId: number) => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState("");

    const quotationsQ = useQuery({
        queryKey: ["quotations", "picker"],
        queryFn: () => getQuotations({ type: "QUOTATION" }),
        enabled: source === "quotation",
    });
    const rabQ = useQuery({
        queryKey: ["rab", "picker"],
        queryFn: () => getRabList(),
        enabled: source === "rab",
    });

    const isLoading = source === "quotation" ? quotationsQ.isLoading : rabQ.isLoading;

    const term = q.trim().toLowerCase();

    const filteredQuotations: Quotation[] = useMemo(() => {
        const list = quotationsQ.data ?? [];
        if (!term) return list;
        return list.filter((it) =>
            [it.invoiceNumber, it.clientName, it.customer?.name, it.customer?.companyName, it.projectName]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(term)),
        );
    }, [quotationsQ.data, term]);

    const filteredRab: RabPlan[] = useMemo(() => {
        const list = rabQ.data ?? [];
        if (!term) return list;
        return list.filter((it) =>
            [it.code, it.title, it.projectName, it.customer?.name, it.customer?.companyName]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(term)),
        );
    }, [rabQ.data, term]);

    const title = source === "quotation" ? "Pilih Penawaran" : "Pilih RAB";
    const Icon = source === "quotation" ? FileText : Calculator;
    const count = source === "quotation" ? filteredQuotations.length : filteredRab.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-input bg-background shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-input px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                        <Icon className="h-4 w-4" /> {title}
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-input p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            autoFocus
                            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder={source === "quotation" ? "Cari nomor / klien / proyek…" : "Cari kode / judul / klien…"}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="min-h-[200px] flex-1 overflow-y-auto p-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
                        </div>
                    ) : count === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            Tidak ada {source === "quotation" ? "penawaran" : "RAB"} yang cocok.
                        </div>
                    ) : source === "quotation" ? (
                        <div className="space-y-2">
                            {filteredQuotations.map((it) => (
                                <button
                                    key={it.id}
                                    onClick={() => onPick(it.id)}
                                    className="w-full rounded-md border border-input p-3 text-left transition hover:border-primary hover:bg-muted/50"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{it.invoiceNumber}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {it.revisionNumber > 0 ? `Rev ${it.revisionNumber} · ` : ""}{it.items?.length ?? 0} item
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-sm">
                                        {it.customer?.name ?? it.clientName ?? "—"}
                                        {it.customer?.companyName ? ` · ${it.customer.companyName}` : ""}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {it.projectName ?? "Tanpa nama proyek"} · {fmtDate(it.date)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredRab.map((it) => (
                                <button
                                    key={it.id}
                                    onClick={() => onPick(it.id)}
                                    className="w-full rounded-md border border-input p-3 text-left transition hover:border-primary hover:bg-muted/50"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{it.code}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {it.itemCount ?? it.items?.length ?? 0} item
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-sm">{it.title}</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {it.projectName ?? it.customer?.name ?? "—"} · {fmtDate(it.createdAt)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
