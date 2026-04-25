export function normalizePhone(raw: string | null | undefined): string {
    if (!raw) return '';
    let p = String(raw).replace(/\D/g, '');
    if (!p) return '';
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (p.startsWith('620')) p = '62' + p.slice(3);
    return p;
}

export function waLink(phone: string, text?: string): string {
    const n = normalizePhone(phone);
    const url = `https://wa.me/${n}`;
    return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}
