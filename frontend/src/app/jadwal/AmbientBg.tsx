// Latar ambient dekoratif — blob besar mengorbit + sapuan cahaya melintas.
// Dipasang di dalam container ber-`relative overflow-hidden`. pointer-events-none.
export function AmbientBg() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-orbit absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
            <div className="animate-orbit-rev absolute top-1/3 -right-28 h-[30rem] w-[30rem] rounded-full bg-primary/25 blur-3xl" />
            <div className="animate-orbit absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-primary/20 blur-3xl" style={{ animationDelay: "-6s" }} />
            {/* Sapuan cahaya diagonal melintas layar */}
            <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl" />
        </div>
    );
}
