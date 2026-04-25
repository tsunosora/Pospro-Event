"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, CalendarDays } from "lucide-react";
import { getEvent } from "@/lib/api/events";
import EventForm from "../../EventForm";

export default function EditEventPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);

    const { data: ev, isLoading } = useQuery({
        queryKey: ["event", id],
        queryFn: () => getEvent(id),
        enabled: Number.isFinite(id),
    });

    if (isLoading || !ev) {
        return <div className="text-sm text-muted-foreground py-10 text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Memuat…</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Link href={`/events/${id}`} className="p-1.5 hover:bg-muted rounded">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> Edit Event
                </h1>
                <span className="font-mono text-xs text-muted-foreground">{ev.code}</span>
            </div>
            <EventForm mode="edit" initial={ev} />
        </div>
    );
}
