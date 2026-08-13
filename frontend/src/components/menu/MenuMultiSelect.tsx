"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Check } from "lucide-react";
import { getMenus, type MenuRow } from "@/lib/api/menu";

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export function MenuMultiSelect({ value, onChange, max = 5 }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [] } = useQuery({
    queryKey: ["menus", "active", debounced],
    queryFn: () => getMenus({ active: true, q: debounced || undefined }),
  });

  // Menu terpilih (untuk chip) — cari di hasil, fallback minimal id
  const selectedMenus: Pick<MenuRow, "id" | "name">[] = value.map(
    (id) => results.find((m) => m.id === id) ?? { id, name: `Menu #${id}` },
  );

  const full = value.length >= max;

  function toggle(id: number) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!full) onChange([...value, id]);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedMenus.map((m) => (
            <span key={m.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
              {m.name}
              <button type="button" onClick={() => toggle(m.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Cari menu… (maks ${max})`}
          className="w-full border border-border bg-background rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {results.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground text-center">Tidak ada menu.</div>
        ) : (
          results.map((m) => {
            const checked = value.includes(m.id);
            const disabled = !checked && full;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed ${checked ? "bg-primary/5" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{rp(m.estimatedCost)}</span>
              </button>
            );
          })
        )}
      </div>
      {full && <p className="text-[11px] text-muted-foreground">Maksimal {max} kandidat menu.</p>}
    </div>
  );
}
