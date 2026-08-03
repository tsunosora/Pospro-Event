// Badge "Berlangsung" dengan titik ping — dipakai saat event sedang IN_PROGRESS.
export function LiveBadge({ className = "" }: { className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 ${className}`}>
            <span className="relative flex h-2 w-2">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Berlangsung
        </span>
    );
}
