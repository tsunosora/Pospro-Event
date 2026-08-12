// Latar ambient dekoratif — hanya sapuan cahaya melintas (blob besar dihapus).
// Dipasang di dalam container ber-`relative overflow-hidden`. pointer-events-none.
export function AmbientBg() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Sapuan cahaya diagonal — animasinya dimatikan di /jadwal (lihat globals.css)
               agar layar standby tenang; intensitas diturunkan agar band diam tak menyilaukan. */}
            <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent blur-2xl" />
        </div>
    );
}
