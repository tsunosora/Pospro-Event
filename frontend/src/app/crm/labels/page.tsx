"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import {
    listLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    type LeadLabel,
} from "@/lib/api/crm";

export default function CrmLabelsPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["crm-labels"], queryFn: listLabels });

    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#ef4444");

    const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-labels"] });

    const createMut = useMutation({
        mutationFn: () => createLabel({ name: newName.trim(), color: newColor }),
        onSuccess: () => {
            setNewName("");
            invalidate();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: Partial<LeadLabel> }) =>
            updateLabel(id, patch),
        onSuccess: invalidate,
    });

    const deleteMut = useMutation({
        mutationFn: (id: number) => deleteLabel(id),
        onSuccess: invalidate,
    });

    return (
        <div className="p-4 max-w-3xl mx-auto space-y-4">
            <Link
                href="/crm"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali
            </Link>

            <div>
                <h1 className="text-xl font-bold">Kelola Label</h1>
                <p className="text-xs text-muted-foreground">
                    Tag custom (Hot / Warm / Cold / Tidak Merespon, dll) untuk klasifikasi lead.
                </p>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!newName.trim()) return;
                    createMut.mutate();
                }}
                className="rounded-lg border border-border bg-card p-3 flex items-end gap-2"
            >
                <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground">Nama Label</label>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        placeholder="Booth F&B"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-muted-foreground">Warna</label>
                    <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="mt-1 h-8 w-12 rounded border border-border"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!newName.trim() || createMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                    Tambah
                </button>
            </form>

            <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {isLoading && (
                    <div className="p-4 text-sm text-muted-foreground">Memuat...</div>
                )}
                {data?.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">Belum ada label.</div>
                )}
                {data?.map((l) => (
                    <LabelRow
                        key={l.id}
                        label={l}
                        onSave={(patch) => updateMut.mutate({ id: l.id, patch })}
                        onDelete={() => {
                            if (confirm(`Hapus label "${l.name}"? Lead yang sudah pakai label ini akan kehilangan tag.`)) {
                                deleteMut.mutate(l.id);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function LabelRow({
    label,
    onSave,
    onDelete,
}: {
    label: LeadLabel;
    onSave: (patch: Partial<LeadLabel>) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(label.name);
    const [color, setColor] = useState(label.color);
    const dirty = name !== label.name || color !== label.color;

    return (
        <div className="flex items-center gap-2 p-2.5">
            <span
                className="px-2 py-0.5 rounded text-xs font-medium border"
                style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                    color,
                }}
            >
                {name || "—"}
            </span>
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background"
            />
            <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-10 rounded border border-border"
            />
            <button
                onClick={() => onSave({ name: name.trim(), color })}
                disabled={!dirty || !name.trim()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-background text-xs hover:bg-muted disabled:opacity-40"
            >
                <Save className="h-3 w-3" />
                Simpan
            </button>
            <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-destructive/40 bg-destructive/5 text-destructive text-xs hover:bg-destructive/10"
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}
