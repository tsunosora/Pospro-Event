"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { importLeadsXlsx } from "@/lib/api/crm";

type ImportResult = {
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
    preview?: any[];
};

export default function CrmImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [mode, setMode] = useState<"dry" | "commit" | null>(null);

    const mut = useMutation({
        mutationFn: async ({ f, dry }: { f: File; dry: boolean }) => importLeadsXlsx(f, dry),
        onSuccess: (data) => setResult(data),
    });

    function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        setResult(null);
        setMode(null);
    }

    function run(dry: boolean) {
        if (!file) return;
        setMode(dry ? "dry" : "commit");
        setResult(null);
        mut.mutate({ f: file, dry });
    }

    return (
        <div className="p-4 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
                <Link
                    href="/crm/board"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Pipeline
                </Link>
            </div>

            <div>
                <h1 className="text-xl font-bold">Import Lead dari XLSX</h1>
                <p className="text-sm text-muted-foreground">
                    Upload file export dari tool CRM lama (mis.{" "}
                    <code className="text-xs">contacts-export-*.xlsx</code>). Dedupe otomatis berdasarkan nomor HP.
                </p>
            </div>

            <div className="glass rounded-xl p-4 space-y-3">
                <label className="block">
                    <span className="text-sm font-medium">File XLSX</span>
                    <div className="mt-1 flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background cursor-pointer hover:bg-muted text-sm">
                            <FileSpreadsheet className="h-4 w-4" />
                            Pilih file
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={onPick}
                                className="hidden"
                            />
                        </label>
                        {file && (
                            <span className="text-sm text-muted-foreground truncate">
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                        )}
                    </div>
                </label>

                <div className="flex gap-2">
                    <button
                        onClick={() => run(true)}
                        disabled={!file || mut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {mut.isPending && mode === "dry" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Dry-run (preview saja)
                    </button>
                    <button
                        onClick={() => run(false)}
                        disabled={!file || mut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {mut.isPending && mode === "commit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Commit Import
                    </button>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>• Header XLSX yang dikenali: Name, Phone, Product Category, Organization, Lead Level, Lead Source, Assigned Staff, Follow-up Date, Status, Order Description, Project Value Est., Notes, Created At, Last Contacted.</p>
                    <p>• Lead dengan status <code>CLOSED_DEAL</code> tidak akan ditimpa saat update.</p>
                    <p>• Worker yang belum ada akan dibuat otomatis.</p>
                </div>
            </div>

            {mut.isPending && (
                <div className="glass rounded-xl p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Memproses file...
                </div>
            )}

            {mut.isError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Import gagal</p>
                        <p className="text-xs mt-1">{(mut.error as any)?.response?.data?.message || (mut.error as any)?.message}</p>
                    </div>
                </div>
            )}

            {result && (
                <div className="glass rounded-xl p-4 space-y-3 animate-in">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <h2 className="font-semibold">
                            {mode === "dry" ? "Hasil Dry-run" : "Import Selesai"}
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat label="Parsed" value={result.parsed} />
                        <Stat label="Created" value={result.created} tone="success" />
                        <Stat label="Updated" value={result.updated} tone="info" />
                        <Stat label="Skipped" value={result.skipped} tone="zinc" />
                    </div>

                    {result.errors?.length > 0 && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs">
                            <p className="font-medium text-warning mb-1">
                                {result.errors.length} baris error:
                            </p>
                            <ul className="space-y-0.5 max-h-40 overflow-auto">
                                {result.errors.slice(0, 50).map((e, i) => (
                                    <li key={i} className="text-warning">
                                        Baris {e.row}: {e.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {mode === "dry" && result.parsed > 0 && (
                        <button
                            onClick={() => run(false)}
                            disabled={mut.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Lanjut Commit ({result.parsed} baris)
                        </button>
                    )}

                    {mode === "commit" && (
                        <Link
                            href="/crm/board"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted transition-colors"
                        >
                            Buka Pipeline →
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
    const toneCls =
        tone === "success"
            ? "text-success bg-success/15 border-success/30"
            : tone === "info"
                ? "text-info bg-info/15 border-info/30"
                : tone === "zinc"
                    ? "text-muted-foreground bg-muted/40 border-border"
                    : "text-foreground bg-muted/40 border-border";
    return (
        <div className={`rounded-lg border p-2 ${toneCls}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
            <div className="text-xl font-bold nums">{value}</div>
        </div>
    );
}
