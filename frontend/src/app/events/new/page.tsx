"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import EventForm from "../EventForm";

export default function NewEventPage() {
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
            <EventForm mode="create" />
        </div>
    );
}
