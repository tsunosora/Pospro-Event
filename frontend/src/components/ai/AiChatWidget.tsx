"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
    Bot, X, Send, Loader2, FileText, CalendarDays,
    ClipboardList, Building2, Sparkles,
} from "lucide-react";
import { getAiStatus, sendAiChat, type AiEntity } from "@/lib/api/aiAgent";
import { useAiStore } from "@/store/ai-store";

// ─── Render markdown ringan: **bold** + baris/bullet (tanpa tabel) ──────────
function renderInline(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p)
            ? <strong key={i}>{p.slice(2, -2)}</strong>
            : <span key={i}>{p}</span>,
    );
}

function RenderLite({ text }: { text: string }) {
    const lines = (text ?? "").split("\n");
    return (
        <>
            {lines.map((line, i) => {
                const bullet = line.match(/^\s*[-*]\s+(.*)$/);
                if (bullet) {
                    return (
                        <div key={i} className="flex gap-1.5 pl-1">
                            <span className="text-primary shrink-0">•</span>
                            <span>{renderInline(bullet[1])}</span>
                        </div>
                    );
                }
                if (line.trim() === "") return <div key={i} className="h-1.5" />;
                return <div key={i}>{renderInline(line)}</div>;
            })}
        </>
    );
}

const ENTITY_ICON: Record<AiEntity["kind"], typeof FileText> = {
    quotation: FileText,
    event: CalendarDays,
    rab: ClipboardList,
    customer: Building2,
};

function EntityCard({ e }: { e: AiEntity }) {
    const Icon = ENTITY_ICON[e.kind] ?? FileText;
    return (
        <Link
            href={e.href}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
        >
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
                <div className="font-semibold truncate">{e.label}</div>
                {e.sublabel && (
                    <div className="text-[10px] text-muted-foreground truncate">{e.sublabel}</div>
                )}
            </div>
        </Link>
    );
}

export function AiChatWidget() {
    const { data: status } = useQuery({
        queryKey: ["ai-status"],
        queryFn: getAiStatus,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const { isOpen, messages, loading, toggle, close, push, setLoading } = useAiStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    if (!status?.enabled || !status?.chatEnabled) return null;

    const handleSend = async () => {
        const text = inputRef.current?.value.trim();
        if (!text || loading) return;
        if (inputRef.current) inputRef.current.value = "";

        push({ role: "user", content: text });
        const history = useAiStore
            .getState()
            .messages.slice(-8)
            .map((m) => ({ role: m.role, content: m.content }));
        setLoading(true);
        try {
            const res = await sendAiChat(text, history);
            push({ role: "assistant", content: res.reply, entities: res.entities, refused: res.refused });
        } catch {
            push({
                role: "assistant",
                content: "Maaf, terjadi kendala menghubungi asisten. Coba lagi sebentar.",
                refused: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 print:hidden">
            {/* Panel */}
            {isOpen && (
                <div className="mb-3 w-[min(92vw,22rem)] h-[min(70vh,32rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{status.name}</div>
                            <div className="text-[10px] text-muted-foreground">Asisten Pospro Event</div>
                        </div>
                        <button
                            onClick={close}
                            aria-label="Tutup"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 [scrollbar-width:thin]">
                        {messages.length === 0 && (
                            <div className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-3 flex gap-2">
                                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{status.greeting}</span>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-foreground"
                                        }`}
                                >
                                    {m.role === "assistant" ? <RenderLite text={m.content} /> : m.content}
                                    {m.entities && m.entities.length > 0 && (
                                        <div className="mt-2 flex flex-col gap-1.5">
                                            {m.entities.map((e) => (
                                                <EntityCard key={`${e.kind}-${e.id}`} e={e} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-2xl px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Mengetik…
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="border-t border-border p-2 flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Tanya soal penawaran, event, RAB…"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                            className="flex-1 bg-muted/50 rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            aria-label="Kirim"
                            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Floating button */}
            <button
                onClick={toggle}
                aria-label={isOpen ? "Tutup asisten AI" : "Buka asisten AI"}
                className="ml-auto flex w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg items-center justify-center hover:bg-primary/90 transition-colors"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </button>
        </div>
    );
}
