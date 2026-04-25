"use client";

import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/api/crm";

export function WaButton({ phone, text, label = "Chat WA", className = "" }: {
    phone: string;
    text?: string;
    label?: string;
    className?: string;
}) {
    if (!phone) return null;
    return (
        <a
            href={waLink(phone, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition " +
                className
            }
            title={`Chat ke ${phone}`}
        >
            <MessageCircle className="h-3.5 w-3.5" />
            {label}
        </a>
    );
}
