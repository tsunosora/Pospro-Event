"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, User, Building2, MapPin } from "lucide-react";
import {
    getCustomers,
    lookupCustomerByPhone,
    type Customer,
    type PhoneLookupResult,
} from "@/lib/api/customers";

interface Props {
    /** Phone yang sedang di-type oleh user. Filter instan via cached customer list. */
    phone?: string;
    /** Nama yang sedang di-type — untuk match nama parsial. */
    name?: string;
    /**
     * Callback ketika user klik "Pakai data ini" — terima data customer existing.
     * Form harus auto-fill semua field yang relevan dari customer object.
     */
    onUseCustomer?: (customer: Customer) => void;
    /** Callback ketika user klik suggestion Lead. */
    onUseLead?: (lead: NonNullable<PhoneLookupResult["lead"]>) => void;
    /** Sembunyikan banner kalau user sudah pilih customer secara explicit (mis. via picker modal). */
    hidden?: boolean;
    /** Mode compact untuk dipakai di modal kecil. */
    compact?: boolean;
    /** Max berapa customer match yang ditampilkan (default 5). */
    maxResults?: number;
}

/** Normalize phone untuk perbandingan (lihat backend utils). */
function normalizePhoneClient(raw: string): string {
    if (!raw) return "";
    let p = String(raw).replace(/\D/g, "");
    if (!p) return "";
    if (p.startsWith("0")) p = "62" + p.slice(1);
    if (p.startsWith("620")) p = "62" + p.slice(3);
    return p;
}

/**
 * Banner instant lookup customer/lead — TANPA debounce.
 * Filter dari cached customer list (fetched 1x, cached 5 menit) supaya instan tiap keystroke.
 * Match: nama partial (case-insensitive) OR phone partial (normalized).
 * Lead lookup via API hanya saat phone >= 8 digit (untuk efisiensi — Lead table query terpisah).
 */
export function PhoneDuplicateBanner({
    phone = "",
    name = "",
    onUseCustomer,
    onUseLead,
    hidden,
    compact,
    maxResults = 5,
}: Props) {
    // Fetch all customers — cached lama supaya filter instan tiap keystroke
    const { data: allCustomers = [] } = useQuery({
        queryKey: ["customers-all"],
        queryFn: getCustomers,
        staleTime: 5 * 60 * 1000, // 5 menit
        enabled: !hidden,
    });

    // Filter client-side — instant tanpa debounce
    const matchingCustomers = useMemo(() => {
        if (hidden) return [];
        const phoneNorm = normalizePhoneClient(phone);
        const nameQ = name.trim().toLowerCase();

        if (!phoneNorm && !nameQ) return [];

        const hasPhoneFilter = phoneNorm.length >= 3;
        const hasNameFilter = nameQ.length >= 1;

        return allCustomers.filter((c) => {
            const phoneMatch = hasPhoneFilter && c.phone
                ? normalizePhoneClient(c.phone).includes(phoneNorm)
                : false;
            const nameMatch = hasNameFilter
                ? (c.name?.toLowerCase().includes(nameQ) ||
                   c.companyName?.toLowerCase().includes(nameQ) ||
                   c.companyPIC?.toLowerCase().includes(nameQ))
                : false;
            // Tampilkan kalau ada match di SALAH SATU kriteria yang di-filter
            return phoneMatch || nameMatch;
        }).slice(0, maxResults);
    }, [allCustomers, phone, name, hidden, maxResults]);

    // Lead lookup via API — hanya kalau phone >= 8 digit (Lead query lebih berat)
    const phoneDigits = phone.replace(/\D/g, "");
    const leadEnabled = !hidden && phoneDigits.length >= 8;

    const { data: phoneLookup } = useQuery({
        queryKey: ["lead-phone-lookup", phoneDigits],
        queryFn: () => lookupCustomerByPhone(phone),
        enabled: leadEnabled,
        staleTime: 30_000,
    });

    const lead = phoneLookup?.lead ?? null;

    if (hidden) return null;
    const hasCustomers = matchingCustomers.length > 0;
    const hasLead = !!lead;
    const hasAny = hasCustomers || hasLead;
    const hasInput = phone.trim() || name.trim();

    if (!hasInput) return null;

    const textSize = compact ? "text-[11px]" : "text-xs";

    // No match — tampilkan hint hijau (gak intrusif)
    if (!hasAny) {
        // Hanya tampilkan hint kalau input sudah cukup panjang (>=3 char)
        const phoneLen = phone.replace(/\D/g, "").length;
        const nameLen = name.trim().length;
        if (phoneLen < 3 && nameLen < 2) return null;
        return (
            <div className={`flex items-center gap-1.5 text-emerald-600 ${textSize}`}>
                <CheckCircle2 className="h-3 w-3" />
                Belum ada di database — akan tersimpan sebagai customer baru.
            </div>
        );
    }

    const padding = compact ? "p-2" : "p-2.5";

    return (
        <div className={`bg-amber-50 border-l-4 border-amber-500 rounded ${padding} space-y-1.5`}>
            <div className="flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className={`font-bold text-amber-900 ${textSize}`}>
                        💡 {hasCustomers && hasLead
                            ? "Match ditemukan di Customer & Lead"
                            : hasCustomers
                                ? `${matchingCustomers.length} customer cocok`
                                : "Match ditemukan di Lead CRM"}
                    </div>
                    <div className={`text-amber-700 ${compact ? "text-[10px]" : "text-[11px]"}`}>
                        Klik untuk pakai data existing & hindari duplikat:
                    </div>
                </div>
            </div>

            {/* Customer matches (multiple, auto-suggest) */}
            {matchingCustomers.map((c) => (
                <button
                    key={c.id}
                    type="button"
                    onClick={() => onUseCustomer?.(c)}
                    disabled={!onUseCustomer}
                    className={`w-full text-left ${padding} bg-white border-2 border-emerald-300 rounded hover:bg-emerald-50 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 transition`}
                >
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded ${compact ? "text-[9px]" : "text-[10px]"} font-bold bg-emerald-100 text-emerald-800 border border-emerald-300`}>
                            👤 CUSTOMER
                        </span>
                        <span className={`font-bold text-slate-900 truncate ${textSize}`}>
                            {c.companyName || c.name}
                        </span>
                        {c.companyName && c.name && (
                            <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-500`}>
                                ({c.name})
                            </span>
                        )}
                    </div>
                    <div className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5`}>
                        {c.phone && (
                            <span className="font-mono">📞 {c.phone}</span>
                        )}
                        {c.companyPIC && (
                            <span><User className="h-2.5 w-2.5 inline mr-0.5" />{c.companyPIC}</span>
                        )}
                        {c.address && (
                            <span><MapPin className="h-2.5 w-2.5 inline mr-0.5" />{c.address}</span>
                        )}
                    </div>
                </button>
            ))}

            {/* Lead match — extra info kalau lead phone match */}
            {lead && (
                <button
                    type="button"
                    onClick={() => onUseLead?.(lead)}
                    disabled={!onUseLead}
                    className={`w-full text-left ${padding} bg-white border-2 border-blue-300 rounded hover:bg-blue-50 hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition`}
                >
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded ${compact ? "text-[9px]" : "text-[10px]"} font-bold bg-blue-100 text-blue-800 border border-blue-300`}>
                            🎯 LEAD CRM
                        </span>
                        <span className={`font-bold text-slate-900 truncate ${textSize}`}>
                            {lead.name || "(belum dinamai)"}
                        </span>
                        {lead.stageName && (
                            <span className={`px-1.5 py-0.5 rounded ${compact ? "text-[9px]" : "text-[10px]"} font-medium bg-slate-100 text-slate-700 border border-slate-300`}>
                                {lead.stageName}
                            </span>
                        )}
                        {lead.convertedCustomerId && (
                            <span className={`px-1.5 py-0.5 rounded ${compact ? "text-[9px]" : "text-[10px]"} font-medium bg-emerald-100 text-emerald-700 border border-emerald-300`}>
                                ✓ Customer
                            </span>
                        )}
                    </div>
                    <div className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5`}>
                        <span className="font-mono">📞 {lead.phone}</span>
                        {lead.organization && (
                            <span><Building2 className="h-2.5 w-2.5 inline mr-0.5" />{lead.organization}</span>
                        )}
                        {lead.city && (
                            <span><MapPin className="h-2.5 w-2.5 inline mr-0.5" />{lead.city}</span>
                        )}
                    </div>
                </button>
            )}
        </div>
    );
}
