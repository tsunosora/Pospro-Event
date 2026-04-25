"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Save, ChevronUp, ChevronDown } from "lucide-react";
import {
    listStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    type LeadStage,
} from "@/lib/api/crm";

export default function CrmStagesPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["crm-stages"], queryFn: listStages });

    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#94a3b8");

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["crm-stages"] });
        qc.invalidateQueries({ queryKey: ["crm-board"] });
    };

    const createMut = useMutation({
        mutationFn: () => createStage({ name: newName.trim(), color: newColor }),
        onSuccess: () => {
            setNewName("");
            invalidate();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: Partial<LeadStage> }) =>
            updateStage(id, patch),
        onSuccess: invalidate,
    });

    const deleteMut = useMutation({
        mutationFn: (id: number) => deleteStage(id),
        onSuccess: invalidate,
    });

    const reorderMut = useMutation({
        mutationFn: (orderedIds: number[]) => reorderStages(orderedIds),
        onSuccess: invalidate,
    });

    function move(idx: number, dir: -1 | 1) {
        if (!data) return;
        const next = [...data];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        reorderMut.mutate(next.map((s) => s.id));
    }

    return (
        <div className="p-4 max-w-4xl mx-auto space-y-4">
            <Link
                href="/crm"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali
            </Link>

            <div>
                <h1 className="text-xl font-bold">Kelola Stage Pipeline</h1>
                <p className="text-xs text-muted-foreground">
                    Atur urutan kolom kanban. Stage <em>terminal</em> disembunyikan dari board (Closed Deal / Lost). Stage <em>win</em> meng-unlock tombol Convert.
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
                    <label className="text-[11px] text-muted-foreground">Nama Stage</label>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        placeholder="Site Survey"
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

            <div className="rounded-lg border border-border bg-card overflow-hidden">
                {isLoading && <div className="p-4 text-sm text-muted-foreground">Memuat...</div>}
                {data?.map((s, idx) => (
                    <StageRow
                        key={s.id}
                        stage={s}
                        first={idx === 0}
                        last={idx === (data?.length ?? 0) - 1}
                        onUp={() => move(idx, -1)}
                        onDown={() => move(idx, 1)}
                        onSave={(patch) => updateMut.mutate({ id: s.id, patch })}
                        onDelete={() => {
                            if (confirm(`Hapus stage "${s.name}"? Tidak bisa dihapus jika masih ada lead di stage ini.`)) {
                                deleteMut.mutate(s.id);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function StageRow({
    stage,
    first,
    last,
    onUp,
    onDown,
    onSave,
    onDelete,
}: {
    stage: LeadStage;
    first: boolean;
    last: boolean;
    onUp: () => void;
    onDown: () => void;
    onSave: (patch: Partial<LeadStage>) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(stage.name);
    const [color, setColor] = useState(stage.color);
    const [isTerminal, setIsTerminal] = useState(stage.isTerminal);
    const [isWinStage, setIsWinStage] = useState(stage.isWinStage);
    const dirty =
        name !== stage.name ||
        color !== stage.color ||
        isTerminal !== stage.isTerminal ||
        isWinStage !== stage.isWinStage;

    return (
        <div className="flex items-center gap-2 p-2.5 border-b border-border last:border-b-0">
            <div className="flex flex-col">
                <button
                    onClick={onUp}
                    disabled={first}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Naik"
                >
                    <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={onDown}
                    disabled={last}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Turun"
                >
                    <ChevronDown className="h-3.5 w-3.5" />
                </button>
            </div>

            <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
            />

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

            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                    type="checkbox"
                    checked={isTerminal}
                    onChange={(e) => setIsTerminal(e.target.checked)}
                />
                Terminal
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                    type="checkbox"
                    checked={isWinStage}
                    onChange={(e) => setIsWinStage(e.target.checked)}
                />
                Win
            </label>

            <button
                onClick={() => onSave({ name: name.trim(), color, isTerminal, isWinStage })}
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
