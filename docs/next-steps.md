# KUT — Bundan Sonrası

Son iterasyon sonrası (M1–M6 + assignment iptali + OSRM tabanlı gerçek mesafe + animasyonlu rota) durumu baz alınarak yazılmıştır. Öncelik sırası: **etkisi büyük + maliyeti düşük** üstte.

---

## 1. Hızlı kazanımlar (birkaç saatlik işler)

Şu anki iskelete oturuyorlar; büyük mimari kararı gerektirmezler.

### 1.1 Incident yaşam döngüsü
- `PATCH /api/incidents/{id}/status` (Open → InProgress → Resolved) + `INCIDENT_STATUS_CHANGED` event.
- Assignment `Resolve` aksiyonu — araç "vardı" dendiğinde `AssignmentsController` üzerinden `Status = "Resolved"`, araç tekrar `Available`, `VEHICLE_RELEASED` yerine `INCIDENT_RESOLVED` event.
- Sağ paneldeki `Atamalar` sekmesine **Vardı** butonu (Kaldır'ın yanına).
- Incident marker'ı `Resolved` olunca solar/griye döner.

### 1.2 Zoom-to-fit + harita ergonomisi
- Sayfa yüklenince tüm incident + vehicle marker'larını çerçeveleyen `fitBounds` (ilk load'da bir kez).
- Sol tree'de bir org/ekip'e tıklayınca sadece o kolun bounds'una zoom.
- Harita üstünde küçük legend (severity renkleri, vehicle status renkleri).

### 1.3 Layer toggle
Sağ üstte küçük control: `İhbarlar`, `Araçlar`, `Rotalar`, `Rota parlaması` açık/kapalı. Zaten MapLibre'de `setLayoutProperty('visibility')` yeterli.

### 1.4 ETA canlı geri sayım
Aktif assignment'ta OSRM `duration` var ama statik. Assignment satırında ve popup'ta `mm:ss` biçiminde geri sayan sayaç (client-side, `createdAt + duration` fark). Araç sürüklendiğinde OSRM yeniden çekiliyor → ETA sıfırlanır.

### 1.5 Reconnect sonrası state tazeleme
SignalR düşüp bağlanınca eksik event'ler var. `onreconnected` handler'ında `/api/incidents`, `/api/vehicles`, `/api/assignments`, `/api/events?limit=50` re-fetch — o an ekranı tutarlı hâle getirir.

### 1.6 Toast bildirimleri
Assignment oluştu / iptal edildi / SignalR düştü — sol alt köşede 3 saniyelik toast. Bağımlılık eklemeden basit bir `Toaster` komponenti yeter (state array + timer).

### 1.7 Kaynak ağacında arama
Tree başında bir input, girilen metne göre org/team/vehicle satırları filtrelenir (case-insensitive substring). 20+ araca çıkınca hayat kurtarır.

---

## 2. Orta vadeli özellikler (birkaç günlük)

Ürünü "gerçekten kullanılabilir" hissettiren adımlar.

### 2.1 Simüle edilmiş araç hareketi
Atanan araç düz durmasın — OSRM rota koordinatları boyunca **canlı** ilerlesin (backend'de arka plan `HostedService` her N saniyede vehicle konumunu bir sonraki route noktasına kaydırır, `UpdateLocation` pattern'inden geçer). Otomatik olarak `VEHICLE_MOVED` event'i ve SignalR yayını çıkar; ETA da doğal azalır. Hedefe varınca otomatik `Resolved`.
- Backend: `RouteSimulationService : BackgroundService`; assignment yaratılınca kuyruğa girer.
- Frontend değişmez — sadece marker akıp gider.

### 2.2 Incident heat layer
README hedef UI'sındaki "ihbar yoğunluğu" bu. MapLibre native `heatmap` layer'ı, `weight` olarak `severity` verilir. Ayrıca radius'u zoom'a bağla. Layer toggle ile aç/kapa.

### 2.3 Vehicle–incident tipi eşleştirme
Şu an `Available` filtresi ham. Öneri motoruna basit bir uyumluluk tablosu:
```
Yangın        → Yangın, Merdivenli
Trafik Kazası → Kurtarma, Merdivenli, Arama-Kurtarma
Bina Çökmesi  → Arama-Kurtarma, Merdivenli
Su Baskını    → Kurtarma, Arama-Kurtarma
```
`Recommendation` cevabına `compatibilityScore` ekle, sıralama `(uyumluluk desc, distance asc)`. `Vehicle.Capabilities` alanı (string[]) ile veri modelinde persist et.

### 2.4 Timeline (geriye sarma)
Sağ alt köşede yatay bir zaman şeridi. `Events` tablosundaki tüm timestamp'leri tick olarak göster; kullanıcı bir noktaya kaydırınca "o an" görünümü: `t < now` filtresi ile o zamana kadar oluşmuş incident/assignment/vehicle konumları hesaplanıp haritada gösterilir. Read-only "instant replay" — event-sourced modelin tam ödülü.

### 2.5 Multi-vehicle assignment
Bir incident'a birden çok araç ata. `Assignment` modeli zaten n-n destekliyor (composite key değil, ayrı satırlar). UI'da öneri satırında checkbox + "Seçilenleri Ata" butonu. Harita'da o incident için birden çok cyan rota yan yana.

### 2.6 Graph görselleştirme (M6'yı frontend'e)
`/api/graph` bekliyor. Sol panele "Ağaç / Graf" toggle: Graf modunda `cytoscape.js` (küçük, MIT) ile organizasyon → ekip → araç → (responds-to) → incident düğümlerini göster. Filtre + arama.

### 2.7 Vehicle marker'da yön ve tip ikonu
Araç marker'ı şu an baklava; öncesi/sonrası konumdan bearing hesaplanıp ok yönü verilir (`rotate(bearing)`). Ayrıca `Vehicle.Type`'a göre ikon (SVG data URI): itfaiye/ambulans/arama-kurtarma.

---

## 3. Yol haritasındaki M7–M9 için zemin

### 3.1 M7 — Grounded AI asistan
- Backend: `POST /api/ask` — LLM istemcisi (Claude API veya OpenAI). System prompt'a `KutDbContext` şeması + read-only örnek EF sorguları ver. LLM çıktı olarak yalnızca **tool call** üretsin (`get_incidents`, `find_nearest_vehicle`, `list_events_between`, `explain_assignment`). Sunucu bu tool'ları veritabanı üzerinde çalıştırıp sonucu geri döner. "Hallucination-proof" davranış, README'nin sözü.
- Frontend: sağ paneli 4. tab "Asistan" — chat UI, sonuçlar hem metin hem harita üzerinde vurgu (LLM ilgili incident id'lerini döndürünce marker'lar highlight).
- Cache & rate limit backend'de.

### 3.2 M8 — Veri girişi
- **CSV**: `POST /api/incidents/import` multipart, mevcut controller pattern'i + `CsvHelper`.
- **Hava durumu**: OpenWeather / MGM açık veri; günün başlığında incident'a metadata ekle (risk uyarısı).
- **Trafik**: TomTom / HERE traffic flow — OSRM sonrası ETA'yı trafik faktörüyle çarp.
- **IoT / webhook**: `POST /api/telemetry/vehicle/{id}` endpoint'i (device secret ile), gerçek araç GPS'i beslesin.

### 3.3 M9 — Dağıtık mimari
Bugünkü tekil `KutHub` + tek Postgres iyi bir başlangıç; ölçek gerekince:
- SignalR **Redis backplane** — yatay backend ölçekle canlı senkronizasyon.
- **RabbitMQ / NATS** event bus — event yazımını controller'dan ayırıp async consumer'lara dağıt.
- **OpenSearch / Elastic** — event ve incident arama, timeline sorguları.
- **Neo4j / Memgraph** — `/api/graph`'ı türev değil kaynak yap; sorgu dili Cypher.

---

## 4. Kalite / Operasyon

Şu an sıfır olan, ilk fırsatta doldurulması iyi olan kalemler.

### 4.1 Testler
- Backend: `Microsoft.AspNetCore.Mvc.Testing` + `Testcontainers.PostgreSql`. Öncelik: `AssignmentsController.Create/Cancel` (event yazımı + vehicle status geçişi + broadcast'ler), `IncidentsController.GetRecommendations` (OSRM null → Haversine fallback).
- Frontend: `vitest` + `@testing-library/react`. Öncelik: `sliceLine` (Map.tsx içinde, dışarı export edilebilir), `EventFeed` render, tab geçişleri.

### 4.2 CI (GitHub Actions)
`.github/workflows/ci.yml`: `dotnet build`, `dotnet test`, `npm ci && npm run lint && npx tsc -b && npm run build`. PR'larda otomatik.

### 4.3 Docker
`docker-compose.yml` şu an muhtemelen sadece Postgres. Ekle:
- `backend` service (multi-stage Dockerfile, `dotnet publish` → `mcr.microsoft.com/dotnet/aspnet:10.0`).
- `frontend` service (nginx serve build çıktısı).
- `adminer` — hızlı DB inceleme.

Tek `docker compose up` ile tam ortam.

### 4.4 Yapılandırma & güvenlik
- `appsettings.json` içindeki connection string'i User Secrets / env var'a taşı (`__` ile nested override).
- API'ye kimlik doğrulama: tek kullanıcı bile olsa JWT + basit login. Assignment/PATCH endpoint'leri auth gerektirsin.
- CORS origin'i env'den oku (`ALLOWED_ORIGIN`).
- Rate limit middleware (özellikle `/api/incidents/{id}/recommendations` OSRM çağırıyor).

### 4.5 Gözlemlenebilirlik
- **Serilog** + `Enrichers.CorrelationId`. Console dev'de, Seq/OTLP prod'da.
- OpenTelemetry — trace: HTTP → EF → SignalR. Grafana Tempo / Jaeger.
- Frontend: `window.onerror` + `unhandledrejection` → backend `/api/log/frontend`.

### 4.6 API tip üretimi
Frontend'de her endpoint için elle interface yazıyoruz (drift kaynağı). `Swashbuckle` zaten OpenAPI üretiyor; `openapi-typescript` ile `types/api.ts` otomatik. TS tarafı tek kaynaklı.

### 4.7 Migration stratejisi
`Program.cs` boot'ta `Database.Migrate()` çağırıyor — geliştirme için pratik, prod için tehlikeli. Prod'da ayrı bir migration job (CI adımı veya init container) yapılmalı.

### 4.8 Frontend paket & performans
- `@microsoft/signalr` 10.x — kullanılan MessagePack yok, sorun değil ama bundle boyutu izlensin (`vite-bundle-visualizer`).
- OSRM cache'i şu an in-memory Map; tab yenileyince ısınıyor. `sessionStorage`'a serialize.
- Map component'inde marker'lar her `vehicles` değişikliğinde tamamen recreate; 100+ araçta göze batar. `id → marker` map tutup diff'li güncelleme.

### 4.9 i18n
UI şu an TR+EN karışık. `react-intl` veya minimal kendi `t()` — string tablosu tek dosyada; TR default, EN alternatif. README zaten çift dilli, ürün de olsun.

---

## 5. "Yapmayacağız" listesi (bilinçli)

Kapsam açık tutulsun diye kaydediyorum:
- Kullanıcı yönetim panosu, RBAC matrisi (M7 sonrası gelir).
- Native mobil app; PWA yeterli (M8'de responsive layout).
- Kendi harita tile servisi — CARTO dark-matter demo yeterli, gerekince Protomaps self-host.
- Kendi routing servisi — OSRM public → docker OSRM (M8) → alternatif olarak Valhalla; kendi router yazmak yok.

---

## Öncelik önerim

Sırayla giderek her adım ürünü hissedilir şekilde iyileştirir:

1. **1.1 + 1.5 + 1.6** — yaşam döngüsü + reconnect + toast. Bir günden az.
2. **2.1 (simüle araç hareketi)** — demo etkisi maksimum, backend'de küçük bir background service.
3. **2.3 (tip eşleştirme)** — öneri motorunu "akıllı" gösterir.
4. **4.1 + 4.2 (test + CI)** — buradan sonrası regresyon üretmesin.
5. **2.4 (timeline)** — event-sourced modelin görsel ödülü, M7 asistanına da hazırlık.
6. **3.1 (M7 asistan)** — README hedef UI'ının son büyük eksik parçası.
