"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
    Bot, Save, Loader2, CheckCircle2, Plug, KeyRound, Sparkles,
    ShieldAlert, Info, Trash2, MessageCircle,
} from "lucide-react";

// Kontak developer untuk masukan fitur / laporan bug fitur AI Asisten.
const DEV_WA_DISPLAY = "0896-6918-0127";
const DEV_WA_LINK =
    "https://wa.me/6289669180127?text=" +
    encodeURIComponent("Halo, saya ingin melaporkan bug / menambahkan fitur untuk AI Asisten Pospro.");
import { getAiConfig, updateAiConfig, testAiConfig } from "@/lib/api/aiAgent";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
    );
}

function Section({ icon, iconClass, title, description, children }: {
    icon: React.ReactNode; iconClass: string; title: string; description: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-muted/40 border-b">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>{icon}</div>
                <div>
                    <h2 className="font-semibold text-sm">{title}</h2>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="p-5 space-y-4">{children}</div>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
    );
}

const inputCls =
    "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function AiAgentSettingsPage() {
    const { isManager, currentUser } = useCurrentUser();
    const queryClient = useQueryClient();
    const { data: cfg, isLoading } = useQuery({
        queryKey: ["ai-config"],
        queryFn: getAiConfig,
        enabled: isManager,
        retry: false,
    });

    const [form, setForm] = useState({
        enabled: false,
        chatEnabled: true,
        baseUrl: "",
        model: "",
        name: "",
        greeting: "",
    });
    const [apiKey, setApiKey] = useState("");
    const [clearApiKey, setClearApiKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (cfg) {
            setForm({
                enabled: cfg.enabled,
                chatEnabled: cfg.chatEnabled,
                baseUrl: cfg.baseUrl ?? "",
                model: cfg.model ?? "",
                name: cfg.name ?? "",
                greeting: cfg.greeting ?? "",
            });
        }
    }, [cfg]);

    const mutation = useMutation({
        mutationFn: () =>
            updateAiConfig({
                ...form,
                ...(clearApiKey ? { clearApiKey: true } : apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ai-config"] });
            queryClient.invalidateQueries({ queryKey: ["ai-status"] });
            setApiKey("");
            setClearApiKey(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await testAiConfig();
            setTestResult({ ok: true, msg: `Koneksi OK. Respons: "${res.sample}"` });
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? "Gagal menghubungi LLM. Periksa baseUrl/apiKey/model.";
            setTestResult({ ok: false, msg });
        } finally {
            setTesting(false);
        }
    };

    // ─── Guard owner-only ───────────────────────────────────────────────────
    if (currentUser && !isManager) {
        return (
            <div className="max-w-2xl p-8">
                <div className="flex flex-col items-center text-center gap-3 py-12">
                    <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <ShieldAlert className="w-7 h-7 text-destructive" />
                    </div>
                    <h1 className="text-lg font-bold">Akses Ditolak</h1>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        Konfigurasi Asisten AI hanya bisa diakses oleh Owner/Admin.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading || !cfg) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-6 p-1">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Bot className="w-6 h-6 text-primary" /> Asisten AI
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Chatbot internal yang menjawab dari data penawaran, event, RAB, & customer Anda.
                    </p>
                </div>
                <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</>
                    ) : saved ? (
                        <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                    ) : (
                        <><Save className="w-4 h-4" /> Simpan</>
                    )}
                </button>
            </div>

            {/* Aktivasi */}
            <Section
                icon={<Sparkles className="w-4 h-4 text-primary" />}
                iconClass="bg-primary/10"
                title="Aktivasi"
                description="Nyalakan asisten dan widget chat mengambang"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Aktifkan Asisten AI</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Master switch untuk seluruh fitur AI.</p>
                    </div>
                    <ToggleSwitch checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                </div>
                <div className="border-t border-dashed border-border" />
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Tampilkan Widget Chat</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Tombol chat mengambang di kanan-bawah.</p>
                    </div>
                    <ToggleSwitch checked={form.chatEnabled} onChange={(v) => setForm((f) => ({ ...f, chatEnabled: v }))} />
                </div>
            </Section>

            {/* Koneksi LLM */}
            <Section
                icon={<Plug className="w-4 h-4 text-info" />}
                iconClass="bg-info/15"
                title="Koneksi LLM (OpenAI-compatible)"
                description="OpenRouter, OpenAI, atau proxy lokal — apa pun yang bicara /chat/completions"
            >
                <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-xs text-info flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        Contoh: OpenRouter <code className="bg-background px-1 rounded">https://openrouter.ai/api/v1</code> dengan model{" "}
                        <code className="bg-background px-1 rounded">anthropic/claude-3.5-sonnet</code>. API key tidak pernah dikirim ke browser.
                    </div>
                </div>
                <Field label="Base URL">
                    <input
                        type="url"
                        value={form.baseUrl}
                        onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                        placeholder="https://openrouter.ai/api/v1"
                        className={`${inputCls} font-mono`}
                    />
                </Field>
                <Field label="Model">
                    <input
                        type="text"
                        value={form.model}
                        onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                        placeholder="anthropic/claude-3.5-sonnet"
                        className={`${inputCls} font-mono`}
                    />
                </Field>
                <Field
                    label="API Key"
                    hint={cfg.apiKeySet ? "Tersimpan. Kosongkan untuk membiarkan tetap sama." : "Belum ada API key tersimpan."}
                >
                    <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                            type="password"
                            value={apiKey}
                            disabled={clearApiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={cfg.apiKeySet ? cfg.apiKeyMasked : "sk-…"}
                            className={`${inputCls} font-mono disabled:opacity-50`}
                        />
                    </div>
                    {cfg.apiKeySet && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-destructive cursor-pointer">
                            <input type="checkbox" checked={clearApiKey} onChange={(e) => setClearApiKey(e.target.checked)} />
                            <Trash2 className="w-3.5 h-3.5" /> Hapus API key tersimpan
                        </label>
                    )}
                </Field>

                <div className="flex items-center gap-3 pt-1">
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-2 bg-info text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                        Test Koneksi
                    </button>
                    {testResult && (
                        <p className={`text-xs font-medium ${testResult.ok ? "text-success" : "text-destructive"}`}>
                            {testResult.msg}
                        </p>
                    )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Test memakai konfigurasi yang <strong>sudah tersimpan</strong> — simpan dulu jika baru mengubah key.
                </p>
            </Section>

            {/* Persona */}
            <Section
                icon={<Bot className="w-4 h-4 text-primary" />}
                iconClass="bg-primary/15"
                title="Persona"
                description="Nama & sapaan pembuka asisten"
            >
                <Field label="Nama Asisten">
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Asisten Pospro"
                        className={inputCls}
                    />
                </Field>
                <Field label="Sapaan Pembuka">
                    <textarea
                        value={form.greeting}
                        onChange={(e) => setForm((f) => ({ ...f, greeting: e.target.value }))}
                        rows={2}
                        placeholder="Halo! Ada yang bisa dibantu?"
                        className={inputCls}
                    />
                </Field>
            </Section>

            <div className="flex justify-end pb-4">
                <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</>
                    ) : saved ? (
                        <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                    ) : (
                        <><Save className="w-4 h-4" /> Simpan Pengaturan</>
                    )}
                </button>
            </div>

            {/* Kontak developer — masukan fitur / laporan bug AI Asisten */}
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-success" />
                </div>
                <div className="text-sm">
                    <p className="font-semibold">Ada masukan fitur atau menemukan bug?</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                        Hubungi developer untuk fitur AI Asisten via WhatsApp:{" "}
                        <a
                            href={DEV_WA_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-success hover:underline"
                        >
                            {DEV_WA_DISPLAY}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
