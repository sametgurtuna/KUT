# KUT — Operational Intelligence Platform

> **Türkiye'nin operasyonel istihbarat platformu** · An operational intelligence platform for real-time incident, resource, and event management.

[![.NET](https://img.shields.io/badge/.NET-10-512BD4)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-Unlicensed-lightgrey)](https://claude.ai/chat/1dbbc5d2-9cd6-415f-9020-c60dbbfc4468)

🌐 **Language / Dil:** [Türkçe](https://claude.ai/chat/1dbbc5d2-9cd6-415f-9020-c60dbbfc4468#t%C3%BCrk%C3%A7e) · [English](https://claude.ai/chat/1dbbc5d2-9cd6-415f-9020-c60dbbfc4468#english)

---

## Türkçe

### KUT Nedir?

KUT, gerçek dünyadaki operasyonel varlıkları (organizasyonlar, ekipler, araçlar, ihbarlar) tek bir canlı harita üzerinde modelleyen, olay tabanlı (event-driven) bir istihbarat/karar destek platformudur. Amaç, dağınık verileri (konum, durum, geçmiş) tek bir operasyonel görünüme (single pane of glass) dönüştürmektir.

### Mimari

```
┌─────────────────────┐        HTTP / WebSocket        ┌─────────────────────┐
│       KUT UI         │ ──────────────────────────────▶ │     KUT Backend      │
│  React + TypeScript  │ ◀────────────────────────────── │    ASP.NET Core      │
│      MapLibre GL      │          SignalR (realtime)     │      + SignalR       │
└─────────────────────┘                                  └──────────┬──────────┘
                                                                     │
                                                              Entity Framework Core
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │      PostgreSQL      │
                                                          │  Organizations       │
                                                          │  Teams               │
                                                          │  Vehicles            │
                                                          │  Incidents           │
                                                          │  Events              │
                                                          └─────────────────────┘
```

**Veri modeli mantığı:**

```
Organization ──▶ Team ──▶ Vehicle
Incident                          (konum + tip + önem derecesi)
Event        (sistemdeki her önemli değişikliğin denetim izi)
```

### Teknoloji Yığını

| Katman             | Teknoloji                                              |
| ------------------ | ------------------------------------------------------ |
| Backend            | ASP.NET Core (.NET 10), Entity Framework Core, SignalR |
| Veritabanı         | PostgreSQL (Npgsql sürücüsü)                           |
| Frontend           | React 19, TypeScript, Vite                             |
| Harita             | MapLibre GL JS                                         |
| API Dokümantasyonu | Swagger / OpenAPI                                      |
| Versiyon Kontrol   | Git                                                    |

### Kurulum

**Gereksinimler:** .NET 8+ SDK, Node.js (LTS), PostgreSQL, Git.

**1. Depoyu klonla**

```bash
git clone <repo-url>
cd KUT
```

**2. Backend'i ayağa kaldır**

```bash
cd backend/KUT.Api
dotnet restore
```

`appsettings.json` içindeki `ConnectionStrings:DefaultConnection` alanını kendi PostgreSQL kullanıcı adı/şifrenle güncelle, sonra:

```bash
dotnet ef database update
dotnet run
```

Backend varsayılan olarak `http://localhost:5144` üzerinde ayağa kalkar (port farklı olabilir, konsol çıktısını kontrol et). Swagger arayüzü: `http://localhost:5144/swagger`.

**3. Frontend'i ayağa kaldır**

```bash
cd ../../frontend
npm install
npm run dev
```

Frontend `http://localhost:5173` adresinde çalışır.

> ⚠️ `frontend/src/App.tsx` içindeki API adresinin (`http://localhost:5144`) backend'in gerçek portuyla eşleştiğinden emin ol.

### API Uç Noktaları

| Metod   | Endpoint                      | Açıklama                                                                                           |
| ------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/incidents`              | Tüm ihbarları listeler                                                                             |
| `GET`   | `/api/organizations`          | Organizasyonları ve bağlı ekiplerini listeler                                                      |
| `GET`   | `/api/teams`                  | Ekipleri ve bağlı araçlarını listeler                                                              |
| `GET`   | `/api/vehicles`               | Araçları ve bağlı ekiplerini listeler                                                              |
| `PATCH` | `/api/vehicles/{id}/location` | Araç konumunu günceller, `Events` tablosuna kayıt düşer, bağlı istemcilere SignalR ile yayın yapar |

### Yol Haritası

- [x] **Milestone 1** — Temel varlıklar (Incident), ilk endpoint, ilk harita
- [x] **Milestone 2** — İlişkiler (Organization → Team → Vehicle), harita marker'ları
- [x] **Milestone 3** — Event sistemi (konum güncelleme + denetim izi + sürükle-bırak)
- [ ] **Milestone 4** — Gerçek zamanlılık (SignalR ile çoklu istemci senkronizasyonu)
- [ ] **Milestone 5** — Operasyonel karar desteği (en yakın/uygun araç önerisi)
- [ ] **Milestone 6** — Ontoloji / graf modeli
- [ ] **Milestone 7** — Yapay zekâ entegrasyonu (yalnızca gerçek veritabanı verisiyle)
- [ ] **Milestone 8** — Veri girişi (CSV, REST API'ler, IoT, hava durumu, trafik)
- [ ] **Milestone 9** — Dağıtık mimari (Redis, Event Bus, arama, graf veritabanı)

### Katkıda Bulunma

Proje şu an aktif geliştirme aşamasında, tek geliştirici tarafından adım adım inşa ediliyor. Katkı süreci ileride netleştirilecek.

### Lisans

Henüz belirlenmedi.

---

## English

### What is KUT?

KUT is an event-driven operational intelligence and decision-support platform that models real-world operational entities — organizations, teams, vehicles, and incidents — on a single live map. The goal is to turn scattered operational data (location, status, history) into one coherent operational picture ("single pane of glass").

### Architecture

```
┌─────────────────────┐        HTTP / WebSocket        ┌─────────────────────┐
│       KUT UI          │ ──────────────────────────────▶ │     KUT Backend      │
│  React + TypeScript  │ ◀────────────────────────────── │    ASP.NET Core      │
│      MapLibre GL       │          SignalR (realtime)     │      + SignalR        │
└─────────────────────┘                                  └──────────┬──────────┘
                                                                     │
                                                              Entity Framework Core
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │      PostgreSQL      │
                                                          │  Organizations       │
                                                          │  Teams               │
                                                          │  Vehicles            │
                                                          │  Incidents            │
                                                          │  Events               │
                                                          └─────────────────────┘
```

**Data model logic:**

```
Organization ──▶ Team ──▶ Vehicle
Incident                          (location + type + severity)
Event        (audit trail of every significant change in the system)
```

### Tech Stack

| Layer           | Technology                                             |
| --------------- | ------------------------------------------------------ |
| Backend         | ASP.NET Core (.NET 10), Entity Framework Core, SignalR |
| Database        | PostgreSQL (via Npgsql driver)                         |
| Frontend        | React 19, TypeScript, Vite                             |
| Mapping         | MapLibre GL JS                                         |
| API Docs        | Swagger / OpenAPI                                      |
| Version Control | Git                                                    |

### Getting Started

**Prerequisites:** .NET 8+ SDK, Node.js (LTS), PostgreSQL, Git.

**1. Clone the repo**

```bash
git clone <repo-url>
cd KUT
```

**2. Run the backend**

```bash
cd backend/KUT.Api
dotnet restore
```

Update `ConnectionStrings:DefaultConnection` in `appsettings.json` with your PostgreSQL credentials, then:

```bash
dotnet ef database update
dotnet run
```

The backend runs at `http://localhost:5144` by default (port may vary — check the console output). Swagger UI: `http://localhost:5144/swagger`.

**3. Run the frontend**

```bash
cd ../../frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

> ⚠️ Make sure the API base URL in `frontend/src/App.tsx` (`http://localhost:5144`) matches your backend's actual port.

### API Endpoints

| Method  | Endpoint                      | Description                                                                                            |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/incidents`              | List all incidents                                                                                     |
| `GET`   | `/api/organizations`          | List organizations with their teams                                                                    |
| `GET`   | `/api/teams`                  | List teams with their vehicles                                                                         |
| `GET`   | `/api/vehicles`               | List vehicles with their team                                                                          |
| `PATCH` | `/api/vehicles/{id}/location` | Update a vehicle's location, log an `Event`, and broadcast the change to connected clients via SignalR |

### Roadmap

- [x] **Milestone 1** — Core entities (Incident), first endpoint, first map
- [x] **Milestone 2** — Relationships (Organization → Team → Vehicle), map markers
- [x] **Milestone 3** — Event system (location updates + audit trail + drag-and-drop)
- [ ] **Milestone 4** — Realtime (SignalR multi-client sync)
- [ ] **Milestone 5** — Operational decision support (nearest/available vehicle recommendations)
- [ ] **Milestone 6** — Ontology / graph model
- [ ] **Milestone 7** — AI integration (grounded strictly in real database facts)
- [ ] **Milestone 8** — Data ingestion (CSV, REST APIs, IoT, weather, traffic)
- [ ] **Milestone 9** — Distributed architecture (Redis, event bus, search, graph store)

### Contributing

The project is currently under active, solo development, built incrementally. Contribution guidelines will be defined later.

### License

Not yet decided.
