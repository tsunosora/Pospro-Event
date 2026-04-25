# 🗺️ Peta Cuan Lokasi — Pospro Event

**Peta Cuan** = peta interaktif (Leaflet + OpenStreetMap) untuk visualisasi lokasi event/pameran, kompetitor vendor booth, dan supplier material — semua dalam satu view.

## Akses

Menu: **Analytics → Peta Cuan** (`/peta-cuan`).

## Layer Peta

| Layer | Marker | Sumber Data |
|---|---|---|
| 🎪 **Event Aktif** | Pin biru | `RabPlan` dengan `eventLocation` + `eventDate` |
| 📍 **Lokasi Pameran** | Pin ungu | Master `EventVenue` (custom) |
| 🏭 **Supplier** | Pin hijau | `Supplier` dengan koordinat |
| 🏢 **Kompetitor** | Pin merah | Custom mark via tombol "+ Kompetitor" |
| 👥 **Customer** | Pin abu | `Customer.address` (geocoded) |

Toggle layer di sidebar peta.

## Use Case Vendor Booth/Event

### 1. Plan Logistik Event

Klik event aktif (mis. "PT. JAPURA – Surabaya Juni 2026") → peta zoom ke lokasi → highlight:
- Supplier kayu/material **terdekat dari venue** (hemat ongkir)
- Customer lain di kota yang sama (potensi cross-sell)
- Akomodasi terdekat (hotel)

### 2. Mapping Pameran Tahunan

Pin semua venue pameran (JIExpo, ICE BSD, Grand City Surabaya, dll) → tracking:
- Pameran apa yang sudah pernah dikerjakan
- Pameran target yang belum
- Frequency per kota → tentukan kantor cabang berikutnya

### 3. Analisis Kompetitor

Tambah pin manual untuk vendor booth lain di kota target → tracking:
- Konsentrasi kompetitor per area
- Gap area yang masih sepi → potensi market

## Tools di Peta

- 🔍 **Pencarian alamat** (geocoding via Nominatim)
- 📐 **Ukur jarak** (klik 2 titik → distance km)
- 🎯 **Find nearby** — radius search (mis. supplier dalam 10 km dari venue)
- 📌 **Add custom mark** — tag bebas (kompetitor, lokasi survey, dll)
- 💾 **Save view** — bookmark area + zoom level favorit

## Geocoding

Address ke koordinat pakai **Nominatim** (OSM) — gratis, rate-limit 1 request/sec.

Untuk batch geocoding (mis. import 100 customer dengan address), backend punya queue:
```bash
POST /peta-cuan/geocode-batch
Body: { entityType: "customer", ids: [1,2,3,...] }
```

## Privacy

Pin custom (kompetitor, lokasi survey) tersimpan **per user** — admin lain tidak melihat. Pin entity (Event, Supplier, Customer) shared semua user.

## Lihat Juga

- [Suppliers](./suppliers.md) — sumber pin supplier
- [RAB Event](./rab-event.md) — sumber pin event aktif
