"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import EventForm from "../EventForm";
import type { EventBrand, EventRecord } from "@/lib/api/events";

export default function NewEventPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat…</div>}>
            <NewEventInner />
        </Suspense>
    );
}

function NewEventInner() {
    const sp = useSearchParams();

    // Prefill dari URL query — biar bisa dipanggil dari CRM "Jadikan Event" dll.
    // Contoh: /events/new?customerId=12&customerName=PT.Foo&name=IIFEX&venue=GrandCity&eventStart=2026-05-18&eventEnd=2026-05-21
    const customerIdParam = sp.get("customerId");
    const initial: Partial<EventRecord> = {
        name: sp.get("name") || "",
        venue: sp.get("venue") || "",
        customerId: customerIdParam ? Number(customerIdParam) : null,
        customerName: sp.get("customerName") || "",
        picName: sp.get("picName") || "",
        notes: sp.get("notes") || "",
        brand: ((sp.get("brand") as EventBrand) || undefined),
        eventStart: sp.get("eventStart") || null,
        eventEnd: sp.get("eventEnd") || null,
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/events" className="p-1.5 hover:bg-muted rounded">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> Event Baru
                </h1>
            </div>
            <EventForm mode="create" initial={initial as EventRecord} />
        </div>
    );
}
