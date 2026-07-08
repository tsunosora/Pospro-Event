"use client";

import { useEffect } from "react";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// ---------- Types ----------
export type Branch = {
    id: number;
    name: string;
    address?: string;
    latitude: number | string;
    longitude: number | string;
    omset?: number | string;
    margin?: number | string;
};

export type Competitor = {
    id: number;
    name: string;
    type?: string;
    address?: string;
    latitude: number | string;
    longitude: number | string;
    notes?: string;
};

export type SearchResult = {
    id: string;
    name: string;
    address?: string;
    lat: number;
    lon: number;
};

export type Layers = {
    branches: boolean;
    competitors: boolean;
    searchResults: boolean;
};

interface Props {
    branches: Branch[];
    competitors: Competitor[];
    searchResults: SearchResult[];
    layers: Layers;
    addingMode: "branch" | "competitor" | null;
    onMapClick: (lat: number, lng: number) => void;
    onBoundsChange: (bounds: { south: number; west: number; north: number; east: number }) => void;
}

// ---------- Helper: color by margin ----------
const getColorByMargin = (margin: number) => {
    if (margin > 35) return "#22c55e";
    if (margin >= 15) return "#f59e0b";
    return "#ef4444";
};

// ---------- Custom DivIcons ----------
const makeBranchIcon = (color: string) =>
    L.divIcon({
        html: `<div style="width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: "",
        iconAnchor: [9, 9],
        iconSize: [18, 18],
    });

const competitorIcon = L.divIcon({
    html: `<div style="width:16px;height:16px;background:#ef4444;border:3px solid white;border-radius:3px;box-shadow:0 2px 5px rgba(0,0,0,0.35);transform:rotate(45deg)"></div>`,
    className: "",
    iconAnchor: [8, 8],
    iconSize: [16, 16],
});

const searchResultIcon = L.divIcon({
    html: `<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);opacity:0.85"></div>`,
    className: "",
    iconAnchor: [7, 7],
    iconSize: [14, 14],
});

const crosshairIcon = L.divIcon({
    html: `<div style="width:24px;height:24px;border:3px solid #7c3aed;border-radius:50%;background:rgba(124,58,237,0.2);box-shadow:0 0 0 3px rgba(124,58,237,0.3)"></div>`,
    className: "",
    iconAnchor: [12, 12],
    iconSize: [24, 24],
});

// ---------- Map event handler ----------
function MapEventHandler({ addingMode, onMapClick, onBoundsChange }: {
    addingMode: "branch" | "competitor" | null;
    onMapClick: (lat: number, lng: number) => void;
    onBoundsChange: (b: { south: number; west: number; north: number; east: number }) => void;
}) {
    const map = useMapEvents({
        click(e) {
            if (addingMode) onMapClick(e.latlng.lat, e.latlng.lng);
        },
        moveend() {
            const b = map.getBounds();
            onBoundsChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        },
        zoomend() {
            const b = map.getBounds();
            onBoundsChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        },
    });
    return null;
}

// Emit initial bounds after mount
function InitialBoundsEmitter({ onBoundsChange }: { onBoundsChange: (b: any) => void }) {
    const map = useMap();
    useEffect(() => {
        const b = map.getBounds();
        onBoundsChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    }, [map, onBoundsChange]);
    return null;
}

// ---------- MapComponent ----------
export default function MapComponent({ branches, competitors, searchResults, layers, addingMode, onMapClick, onBoundsChange }: Props) {
    const center: [number, number] =
        branches.length > 0 && branches[0].latitude && branches[0].longitude
            ? [Number(branches[0].latitude), Number(branches[0].longitude)]
            : [-6.2000, 106.8167]; // Default: Jakarta

    const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

    return (
        <MapContainer
            center={center}
            zoom={12}
            className="w-full h-full z-0"
            scrollWheelZoom
            style={{ cursor: addingMode ? "crosshair" : "grab" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapEventHandler addingMode={addingMode} onMapClick={onMapClick} onBoundsChange={onBoundsChange} />
            <InitialBoundsEmitter onBoundsChange={onBoundsChange} />

            {/* Own branches */}
            {layers.branches && branches.map(b => {
                const lat = Number(b.latitude);
                const lng = Number(b.longitude);
                const omset = Number(b.omset ?? 0);
                const margin = Number(b.margin ?? 0);
                if (!lat || !lng) return null;
                return (
                    <Marker key={`branch-${b.id}`} position={[lat, lng]} icon={makeBranchIcon(getColorByMargin(margin))}>
                        <Popup>
                            <div className="text-sm font-sans min-w-[180px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: getColorByMargin(margin), display: "inline-block" }} />
                                    <p className="font-bold text-foreground">{b.name}</p>
                                </div>
                                {b.address && <p className="text-xs text-muted-foreground mb-2">{b.address}</p>}
                                <div className="space-y-0.5 text-xs">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Omset:</span><span className="font-medium nums">{fmt(omset)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Margin:</span><span className="nums font-semibold" style={{ color: getColorByMargin(margin) }}>{margin}%</span></div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-border">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${margin > 35 ? "bg-success/15 text-success" : margin >= 15 ? "bg-warning/15 text-warning" : "bg-destructive/12 text-destructive"}`}>
                                        {margin > 35 ? "Profit Tinggi" : margin >= 15 ? "Profit Sedang" : "Profit Rendah"}
                                    </span>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* Competitors */}
            {layers.competitors && competitors.map(c => {
                const lat = Number(c.latitude);
                const lng = Number(c.longitude);
                if (!lat || !lng) return null;
                return (
                    <Marker key={`comp-${c.id}`} position={[lat, lng]} icon={competitorIcon}>
                        <Popup>
                            <div className="text-sm font-sans min-w-[160px]">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2, transform: "rotate(45deg)", display: "inline-block" }} />
                                    <p className="font-bold text-foreground">{c.name}</p>
                                </div>
                                {c.type && <span className="inline-block text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full mb-1">{c.type}</span>}
                                {c.address && <p className="text-xs text-muted-foreground mt-1">{c.address}</p>}
                                {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* Search results */}
            {layers.searchResults && searchResults.map(r => (
                <Marker key={`search-${r.id}`} position={[r.lat, r.lon]} icon={searchResultIcon}>
                    <Popup>
                        <div className="text-sm font-sans min-w-[160px]">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span style={{ width: 10, height: 10, background: "#3b82f6", borderRadius: "50%", display: "inline-block" }} />
                                <p className="font-bold text-foreground">{r.name}</p>
                            </div>
                            {r.address && <p className="text-xs text-muted-foreground">{r.address}</p>}
                            <p className="flex items-center gap-1 text-xs text-info mt-1"><MapPin className="w-3 h-3" /> Hasil pencarian</p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
