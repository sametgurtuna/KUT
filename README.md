<div align="center">

<img src="docs/assets/hero.svg" alt="KUT, Operational Intelligence Platform" width="100%">

<br>

> **Türkiye'nin operasyonel istihbarat platformu** · An operational intelligence platform for real-time incident, resource, and event management.

[![Repo](https://img.shields.io/badge/GitHub-KUT-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/sametgurtuna/KUT)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?style=flat-square&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-JS-396CB2?style=flat-square&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![SignalR](https://img.shields.io/badge/SignalR-realtime-512BD4?style=flat-square)](https://learn.microsoft.com/aspnet/core/signalr/introduction)
[![OSRM](https://img.shields.io/badge/OSRM-routing-6EA4BF?style=flat-square)](http://project-osrm.org/)
[![Roadmap](https://img.shields.io/badge/roadmap-6%2F9%20milestones-22D3EE?style=flat-square)](#yol-haritası)
[![License](https://img.shields.io/badge/license-TBD-lightgrey?style=flat-square)](#lisans)

🌐 **Language / Dil:** [Türkçe](#türkçe) · [English](#english)

</div>

> [!NOTE]
> Bu README'deki arayüz ve mimari görselleri, projenin **hedeflenen (gelecek) halini** gösteriyor; bugünkü kod tabanının ekran görüntüleri değil. Şu an neyin hazır olduğunu [Yol Haritası](#yol-haritası) bölümünden takip edebilirsin.
> _The UI and architecture visuals in this README depict the **target (future) state** of the product, not screenshots of the current codebase. See the [Roadmap](#roadmap) for what ships today._

---

## Türkçe

### KUT Nedir?

KUT, gerçek dünyadaki operasyonel varlıkları (organizasyonlar, ekipler, araçlar, ihbarlar) tek bir canlı harita üzerinde modelleyen, olay tabanlı (event-driven) bir istihbarat/karar destek platformudur. Amaç, dağınık verileri (konum, durum, geçmiş) tek bir operasyonel görünüme (single pane of glass) dönüştürmektir.

|  | |
| :-- | :-- |
| 🗺️ **Tek operasyonel görünüm** | Organizasyon, ekip, araç ve ihbarlar aynı canlı harita üzerinde |
| ⚡ **Olay tabanlı çekirdek** | Her anlamlı değişiklik `Events` tablosuna denetim izi olarak düşer |
| 📡 **Gerçek zamanlı** | SignalR ile bağlı tüm istemciler aynı anda güncellenir |
| 🧭 **Karar desteği** | En yakın/uygun aracı gerçek yol mesafesi ve yetenek uyumuna göre önerir |
| 🚦 **Canlı sevkiyat simülasyonu** | Atanan araçlar gerçek yol rotası üzerinde otomatik ilerler, varınca ihbar kendiliğinden çözülür |
| ⏮️ **Geriye sarılabilir zaman şeridi** | Olay geçmişinden herhangi bir ana dönüp o anki operasyonel tabloyu görebilirsin |
| 🤖 **Doğrulanabilir AI** | Yapay zeka yalnızca veritabanındaki gerçek kayıtlara dayanır _(yol haritasında)_ |

### Operasyon Merkezi (bugünkü arayüz)

Sol panelde organizasyon → ekip → araç kaynak ağacı ve arama; ortada gerçek yol rotalarının animasyonla çizildiği koyu temalı canlı harita (şiddete göre renklenen ihbarlar, yön göstergeli araç ikonları, isteğe bağlı ısı haritası); sağ panelde sekmeli bir çalışma alanı — canlı olay akışı, en yakın araç önerileri (uyum rozetleriyle), aktif atamalar (ilerleme çubuğu + ETA) ve organizasyon grafiği; alt kısımda tüm oturumu geriye sarabileceğin bir zaman şeridi.

<div align="center">
<img src="docs/assets/ui-mockup.svg" alt="KUT operasyon merkezi arayüzü: canlı harita, kaynak ağacı, olay akışı ve asistan" width="100%">
</div>

> Yukarıdaki görsel hedeflenen nihai tasarımı gösterir; bugünkü arayüz aynı üç panelli yerleşimi kullanıyor ancak sağ panelde asistan yerine öneri/atama/grafik sekmeleri var (bkz. [Yol Haritası](#yol-haritası)).

### Mimari

Bugünkü çekirdek akış:

```
┌─────────────────────┐        HTTP / WebSocket        ┌──────────────────────────┐
│        KUT UI        │ ──────────────────────────────▶ │       KUT Backend         │
│  React + TypeScript  │ ◀────────────────────────────── │      ASP.NET Core         │
│      MapLibre GL      │          SignalR (realtime)     │      + SignalR Hub        │
└─────────────────────┘                                  └────────────┬─────────────┘
                                                                        │
                                             ┌──────────────────────────┼──────────────────────────┐
                                             │                          │                          │
                                     Entity Framework Core      RouteSimulationService      OSRM (public router)
                                             │                  (BackgroundService,          — gerçek yol geometrisi,
                                             ▼                   1.2 sn/tick araç ilerletir)  mesafe + süre
                                  ┌─────────────────────┐
                                  │      PostgreSQL       │
                                  │  Organizations         │
                                  │  Teams                 │
                                  │  Vehicles               │
                                  │  Incidents               │
                                  │  Assignments               │
                                  │  Events                     │
                                  └─────────────────────┘
```

<div align="center">
<img src="docs/assets/architecture.svg" alt="KUT hedef mimarisi: istemciler, uygulama katmanı, veri katmanı, event bus ve veri kaynakları" width="100%">
</div>

> Görsel, dağıtık mimariye (Redis, event bus, arama, graf veritabanı — Milestone 9) evrilmiş hedef durumu gösteriyor.

### Veri Modeli

```
Organization ──▶ Team ──▶ Vehicle ──(Assignment)──▶ Incident
Assignment   (araç ↔ ihbar ataması; rota geometrisi, ilerleme, ETA)
Event        (sistemdeki her önemli değişikliğin denetim izi — JSON payload)
```

<div align="center">
<img src="docs/assets/data-model.svg" alt="KUT veri modeli ve ontoloji: Organization, Team, Vehicle, Incident, Assignment, Event" width="100%">
</div>

`GET /api/graph` bu modeli `{nodes, edges}` şeklinde projekte eder (`owns`, `operates`, `responds-to` ilişkileri) — Milestone 6'nın ontoloji temeli.

### Teknoloji Yığını

| Katman             | Teknoloji                                                          |
| ------------------ | ------------------------------------------------------------------ |
| Backend            | ASP.NET Core (.NET 10), Entity Framework Core, SignalR             |
| Veritabanı         | PostgreSQL (Npgsql sürücüsü)                                       |
| Rota / mesafe       | OSRM (public routing API) — gerçek yol mesafesi, süre ve geometri |
| Frontend           | React 19, TypeScript, Vite                                         |
| Harita             | MapLibre GL JS (CARTO dark-matter basemap)                         |
| API Dokümantasyonu | Swagger / OpenAPI                                                   |
| Versiyon Kontrol   | Git                                                                 |

### Kurulum

**Gereksinimler:** .NET 10 SDK, Node.js (LTS), PostgreSQL, Git.

**1. Depoyu klonla**

```bash
git clone https://github.com/sametgurtuna/KUT.git
cd KUT
```

**2. Backend'i ayağa kaldır**

```bash
cd backend/KUT.Api
dotnet restore
```

`appsettings.json` içindeki `ConnectionStrings:DefaultConnection` alanını kendi PostgreSQL kullanıcı adı/şifrenle güncelle, sonra:

```bash
dotnet run
```

Uygulama açılışta migration'ları otomatik uygular (`Database.Migrate()`) ve veritabanı boşsa demo verisiyle tohumlar (2 organizasyon, 3 ekip, 6 araç, 4 ihbar — İstanbul içinde). Backend varsayılan olarak `http://localhost:5144` üzerinde ayağa kalkar (port farklı olabilir, konsol çıktısını kontrol et). Swagger arayüzü: `http://localhost:5144/swagger`.

**3. Frontend'i ayağa kaldır**

```bash
cd ../../frontend
npm install
npm run dev
```

Frontend `http://localhost:5173` adresinde çalışır.

> [!WARNING]
> `frontend/src/App.tsx` içindeki `API_BASE` sabitinin (`http://localhost:5144`) backend'in gerçek portuyla eşleştiğinden emin ol.

> [!NOTE]
> Rota hesaplama ve mesafe/süre bilgisi genel (public) OSRM demo sunucusunu kullanır — internet bağlantısı gerektirir ve nadiren yavaş/limitli olabilir. Ulaşılamazsa backend otomatik olarak kuş uçuşu (Haversine) mesafeye düşer.

### API Uç Noktaları

| Metod   | Endpoint                          | Açıklama                                                                                       |
| ------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/incidents`                   | Tüm ihbarları listeler                                                                          |
| `POST`  | `/api/incidents`                   | Yeni ihbar oluşturur, `INCIDENT_CREATED` olayı düşer                                            |
| `PATCH` | `/api/incidents/{id}/status`       | İhbar durumunu günceller (`Open` / `InProgress` / `Resolved`)                                   |
| `GET`   | `/api/incidents/{id}/recommendations` | İhbara en uygun araçları gerçek yol mesafesi + yetenek uyumuna göre sıralar                  |
| `GET`   | `/api/organizations`               | Organizasyonları ve bağlı ekiplerini listeler                                                   |
| `GET`   | `/api/teams`                       | Ekipleri ve bağlı araçlarını listeler                                                           |
| `GET`   | `/api/vehicles`                    | Araçları ve bağlı ekiplerini listeler                                                           |
| `POST`  | `/api/vehicles`                    | Yeni araç oluşturur, `VEHICLE_CREATED` olayı düşer                                              |
| `PATCH` | `/api/vehicles/{id}/location`      | Araç konumunu günceller; aktif ataması varsa rotayı yeni konumdan yeniden hesaplar               |
| `GET`   | `/api/assignments`                 | Aktif atamaları (araç ↔ ihbar) listeler                                                         |
| `POST`  | `/api/assignments`                 | Bir aracı ihbara atar, OSRM rotasını hesaplayıp saklar, aracı `Dispatched` yapar                |
| `POST`  | `/api/assignments/{id}/cancel`     | Atamayı iptal eder, aracı `Available`'a döndürür                                                |
| `POST`  | `/api/assignments/{id}/resolve`    | Atamayı ve ihbarı tamamlanmış olarak işaretler                                                  |
| `GET`   | `/api/events`                      | Denetim izi olaylarını (en yeniden eskiye, `limit` destekli) listeler                           |
| `GET`   | `/api/graph`                       | Tüm veri modelini `{nodes, edges}` graf yapısında döner                                         |

Tüm yazma işlemleri aynı deseni izler: varlığı güncelle → `Events` tablosuna kayıt düş → `IHubContext<KutHub>` üzerinden bağlı istemcilere SignalR ile yayınla.

### Öne Çıkan Davranışlar

- **Gerçek yol rotalama:** Bir araç bir ihbara atandığında OSRM'den tam sürüş geometrisi çekilir ve `Assignments` tablosunda saklanır; harita bu geometriyi eased-cubic animasyonla çizer, üstünde sürekli akan bir "chase" efekti gösterir.
- **Canlı sevkiyat simülasyonu:** `RouteSimulationService` (arka plan servisi) her ~1.2 saniyede atanmış araçları kayıtlı rota üzerinde ilerletir, `VEHICLE_MOVED` olayı üretir ve SignalR ile yayınlar; araç rotanın sonuna varınca atama ve ihbar otomatik `Resolved` olur.
- **Sürükle-bırak ile yeniden rotalama:** Bir aracı haritada elle sürüklersen ve aktif bir ataması varsa, backend rotayı yeni konumdan anında yeniden hesaplar.
- **Uyum tabanlı öneriler:** `CompatibilityMatrix`, ihbar tipini (`Yangın`, `Trafik Kazası`, `Bina Çökmesi`, `Su Baskını`) araç yeteneğiyle (`Vehicle.Capabilities`) eşleştirip önerileri uyum skoruna göre sıralar.
- **Geriye sarılabilir zaman şeridi:** Alt paneldeki kaydırıcı, olay geçmişinden herhangi bir ana gidip o andaki ihbar/araç/atama durumunu türeterek gösterir — canlı görünüme dönmek tek tıkla mümkün.

### Yol Haritası

<div align="center">
<img src="docs/assets/roadmap.svg" alt="KUT yol haritası, 9 milestone" width="100%">
</div>

- [x] **Milestone 1:** Temel varlıklar (Incident), ilk endpoint, ilk harita
- [x] **Milestone 2:** İlişkiler (Organization → Team → Vehicle), harita marker'ları
- [x] **Milestone 3:** Event sistemi (konum güncelleme + denetim izi + sürükle-bırak)
- [x] **Milestone 4:** Gerçek zamanlılık (SignalR ile çoklu istemci senkronizasyonu)
- [x] **Milestone 5:** Operasyonel karar desteği (gerçek yol mesafesi + uyum skoru ile araç önerisi, atama/iptal/çözüm akışı, canlı sevkiyat simülasyonu)
- [x] **Milestone 6:** Ontoloji / graf modeli (`/api/graph` + arayüzde graf görünümü)
- [ ] **Milestone 7:** Yapay zeka entegrasyonu (yalnızca gerçek veritabanı verisiyle)
- [ ] **Milestone 8:** Veri girişi (CSV, REST API'ler, IoT, hava durumu, trafik)
- [ ] **Milestone 9:** Dağıtık mimari (Redis, Event Bus, arama, graf veritabanı)

Sonraki adımlar için daha ayrıntılı bir liste: [`docs/next-steps.md`](docs/next-steps.md).

### Katkıda Bulunma

Proje şu an aktif geliştirme aşamasında, tek geliştirici tarafından adım adım inşa ediliyor. Katkı süreci ileride netleştirilecek.

### Lisans

Henüz belirlenmedi.

---

## English

### What is KUT?

KUT is an event-driven operational intelligence and decision-support platform that models real-world operational entities (organizations, teams, vehicles, and incidents) on a single live map. The goal is to turn scattered operational data (location, status, history) into one coherent operational picture ("single pane of glass").

|  | |
| :-- | :-- |
| 🗺️ **One operational picture** | Organizations, teams, vehicles and incidents on the same live map |
| ⚡ **Event-driven core** | Every meaningful change is written to `Events` as an audit trail |
| 📡 **Realtime** | All connected clients stay in sync over SignalR |
| 🧭 **Decision support** | Recommends the nearest/best-fit vehicle by real driving distance and capability match |
| 🚦 **Live dispatch simulation** | Assigned vehicles drive their real route automatically; the incident auto-resolves on arrival |
| ⏮️ **Scrubbable timeline** | Rewind to any past moment and see the operational picture as it was |
| 🤖 **Grounded AI** | The assistant answers strictly from real database facts _(on the roadmap)_ |

### Operations Center (today's UI)

Left: an organization → team → vehicle resource tree with search. Center: a dark-themed live map with animated real-road routes, severity-colored incidents, heading-aware vehicle markers, and an optional heatmap. Right: a tabbed workspace — live event feed, nearest-vehicle recommendations with compatibility badges, active assignments with progress bars and ETA, and a graph view. Bottom: a scrubbable timeline that rewinds the whole session.

<div align="center">
<img src="docs/assets/ui-mockup.svg" alt="KUT operations center: live map, resource tree, event feed and assistant" width="100%">
</div>

> The image above shows the intended end-state design; today's UI uses the same three-pane layout but the right panel currently has recommendation/assignment/graph tabs instead of the assistant (see [Roadmap](#roadmap)).

### Architecture

Today's core flow:

```
┌─────────────────────┐        HTTP / WebSocket        ┌──────────────────────────┐
│        KUT UI        │ ──────────────────────────────▶ │       KUT Backend         │
│  React + TypeScript  │ ◀────────────────────────────── │      ASP.NET Core         │
│      MapLibre GL      │          SignalR (realtime)     │      + SignalR Hub        │
└─────────────────────┘                                  └────────────┬─────────────┘
                                                                        │
                                             ┌──────────────────────────┼──────────────────────────┐
                                             │                          │                          │
                                     Entity Framework Core      RouteSimulationService      OSRM (public router)
                                             │                  (BackgroundService,          — real road geometry,
                                             ▼                   advances vehicles ~1.2s/tick) distance + duration
                                  ┌─────────────────────┐
                                  │      PostgreSQL       │
                                  │  Organizations         │
                                  │  Teams                 │
                                  │  Vehicles               │
                                  │  Incidents               │
                                  │  Assignments               │
                                  │  Events                     │
                                  └─────────────────────┘
```

<div align="center">
<img src="docs/assets/architecture.svg" alt="KUT target architecture: clients, application layer, data layer, event bus and data sources" width="100%">
</div>

> The diagram shows the distributed target architecture (Redis, event bus, search, graph store — Milestone 9).

### Data Model

```
Organization ──▶ Team ──▶ Vehicle ──(Assignment)──▶ Incident
Assignment   (vehicle ↔ incident pairing; route geometry, progress, ETA)
Event        (audit trail of every significant change — JSON payload)
```

<div align="center">
<img src="docs/assets/data-model.svg" alt="KUT data model and ontology: Organization, Team, Vehicle, Incident, Assignment, Event" width="100%">
</div>

`GET /api/graph` projects this model as `{nodes, edges}` (`owns`, `operates`, `responds-to` relations) — the ontology groundwork for Milestone 6.

### Tech Stack

| Layer           | Technology                                                       |
| --------------- | ------------------------------------------------------------------ |
| Backend         | ASP.NET Core (.NET 10), Entity Framework Core, SignalR             |
| Database        | PostgreSQL (via Npgsql driver)                                     |
| Routing         | OSRM (public routing API) — real driving distance, duration, geometry |
| Frontend        | React 19, TypeScript, Vite                                         |
| Mapping         | MapLibre GL JS (CARTO dark-matter basemap)                         |
| API Docs        | Swagger / OpenAPI                                                   |
| Version Control | Git                                                                 |

### Getting Started

**Prerequisites:** .NET 10 SDK, Node.js (LTS), PostgreSQL, Git.

**1. Clone the repo**

```bash
git clone https://github.com/sametgurtuna/KUT.git
cd KUT
```

**2. Run the backend**

```bash
cd backend/KUT.Api
dotnet restore
```

Update `ConnectionStrings:DefaultConnection` in `appsettings.json` with your PostgreSQL credentials, then:

```bash
dotnet run
```

The app auto-applies migrations on startup (`Database.Migrate()`) and seeds demo data if the database is empty (2 organizations, 3 teams, 6 vehicles, 4 incidents around Istanbul). The backend runs at `http://localhost:5144` by default (port may vary, check the console output). Swagger UI: `http://localhost:5144/swagger`.

**3. Run the frontend**

```bash
cd ../../frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

> [!WARNING]
> Make sure the `API_BASE` constant in `frontend/src/App.tsx` (`http://localhost:5144`) matches your backend's actual port.

> [!NOTE]
> Routing and distance/duration calculations use the public OSRM demo server — it requires internet access and can occasionally be slow or rate-limited. The backend automatically falls back to straight-line (Haversine) distance if it's unreachable.

### API Endpoints

| Method  | Endpoint                              | Description                                                                                  |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/incidents`                        | List all incidents                                                                              |
| `POST`  | `/api/incidents`                        | Create an incident, log an `INCIDENT_CREATED` event                                             |
| `PATCH` | `/api/incidents/{id}/status`            | Update incident status (`Open` / `InProgress` / `Resolved`)                                     |
| `GET`   | `/api/incidents/{id}/recommendations`   | Rank the best-fit vehicles for an incident by real driving distance + capability match          |
| `GET`   | `/api/organizations`                    | List organizations with their teams                                                             |
| `GET`   | `/api/teams`                            | List teams with their vehicles                                                                  |
| `GET`   | `/api/vehicles`                         | List vehicles with their team                                                                   |
| `POST`  | `/api/vehicles`                         | Create a vehicle, log a `VEHICLE_CREATED` event                                                 |
| `PATCH` | `/api/vehicles/{id}/location`           | Update a vehicle's location; recomputes its active route if one exists                          |
| `GET`   | `/api/assignments`                      | List active vehicle ↔ incident assignments                                                     |
| `POST`  | `/api/assignments`                      | Assign a vehicle to an incident, fetch and store the OSRM route, mark the vehicle `Dispatched`   |
| `POST`  | `/api/assignments/{id}/cancel`          | Cancel an assignment, return the vehicle to `Available`                                          |
| `POST`  | `/api/assignments/{id}/resolve`         | Mark the assignment and incident as resolved                                                    |
| `GET`   | `/api/events`                           | List audit-trail events (newest first, `limit` supported)                                       |
| `GET`   | `/api/graph`                            | Return the full data model as a `{nodes, edges}` graph                                          |

Every write follows the same pattern: update the entity → append an `Events` row → broadcast to connected clients via `IHubContext<KutHub>`.

### Notable Behaviors

- **Real road routing:** when a vehicle is assigned to an incident, the full driving geometry is fetched from OSRM and stored on the `Assignment`; the map draws it with an eased-cubic animation and a continuously flowing "chase" overlay.
- **Live dispatch simulation:** a background `RouteSimulationService` advances dispatched vehicles along their stored route roughly every 1.2 seconds, emitting `VEHICLE_MOVED` events over SignalR; reaching the end of the route auto-resolves the assignment and the incident.
- **Drag-to-reroute:** dragging a vehicle with an active assignment immediately recomputes its route from the new position.
- **Compatibility-aware recommendations:** a `CompatibilityMatrix` matches incident type (`Yangın`/Fire, `Trafik Kazası`/Traffic accident, `Bina Çökmesi`/Building collapse, `Su Baskını`/Flood) against vehicle capabilities and ranks recommendations by fit.
- **Scrubbable timeline:** the bottom panel lets you rewind to any moment in the event history and see the incident/vehicle/assignment state as it was then — one click returns to live.

### Roadmap

<div align="center">
<img src="docs/assets/roadmap.svg" alt="KUT roadmap, 9 milestones" width="100%">
</div>

- [x] **Milestone 1:** Core entities (Incident), first endpoint, first map
- [x] **Milestone 2:** Relationships (Organization → Team → Vehicle), map markers
- [x] **Milestone 3:** Event system (location updates + audit trail + drag-and-drop)
- [x] **Milestone 4:** Realtime (SignalR multi-client sync)
- [x] **Milestone 5:** Operational decision support (real-road distance + compatibility scoring, assign/cancel/resolve flow, live dispatch simulation)
- [x] **Milestone 6:** Ontology / graph model (`/api/graph` + an in-app graph view)
- [ ] **Milestone 7:** AI integration (grounded strictly in real database facts)
- [ ] **Milestone 8:** Data ingestion (CSV, REST APIs, IoT, weather, traffic)
- [ ] **Milestone 9:** Distributed architecture (Redis, event bus, search, graph store)

A more detailed backlog lives in [`docs/next-steps.md`](docs/next-steps.md).

### Contributing

The project is currently under active, solo development, built incrementally. Contribution guidelines will be defined later.

### License

Not yet decided.

<div align="center">
<br>
<sub>KUT · built step by step, one milestone at a time.</sub>
<br>
<sub><a href="https://github.com/sametgurtuna/KUT">github.com/sametgurtuna/KUT</a></sub>
</div>
