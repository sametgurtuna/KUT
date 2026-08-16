# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KUT is an event-driven operational intelligence platform: organizations → teams → vehicles plus incidents, all rendered on a live map. Backend is ASP.NET Core (.NET 10) + EF Core + PostgreSQL + SignalR; frontend is React 19 + TypeScript + Vite + MapLibre GL. The README is bilingual (TR/EN) and depicts a target UI — the shipping surface is what's in `frontend/src` and `backend/KUT.Api`. Current milestones landed: M1–M5 (M5 = nearest-vehicle recommendation).

## Commands

Backend (from `backend/KUT.Api`):
- `dotnet run` — starts the API (default `http://localhost:5144`; check console). Swagger at `/swagger` in Development.
- `dotnet ef database update` — apply EF Core migrations to the Postgres in `appsettings.json` → `ConnectionStrings:DefaultConnection`.
- `dotnet ef migrations add <Name>` — new migration after model changes.
- `dotnet build` / `dotnet restore`.

Frontend (from `frontend`):
- `npm run dev` — Vite dev server on `http://localhost:5173`.
- `npm run build` — `tsc -b && vite build`.
- `npm run lint` — oxlint (this project uses oxlint, not ESLint).
- `npm run preview`.

No test suite exists yet — do not fabricate test commands.

## Architecture

**Three-tier, event-sourced-lite.** React SPA talks to the ASP.NET Core API over HTTP for reads/writes and holds a SignalR connection to `/hub/kut` (`KutHub`) for realtime pushes. EF Core (`KutDbContext`) persists to PostgreSQL via Npgsql.

**Domain model** (`backend/KUT.Api/Models`): `Organization 1—* Team 1—* Vehicle`; `Incident` is standalone (lat/lon/type/severity); `Event` is the append-only audit trail. Every mutating operation must (1) update the entity, (2) append an `Event` row with `EventType` / `EntityType` / `EntityId` / `Timestamp` / JSON `Payload`, and (3) broadcast via `IHubContext<KutHub>` so connected clients update without polling. `VehiclesController.UpdateLocation` is the reference pattern for this trio — mirror it when adding new mutations.

**Cross-cutting wiring** lives in `Program.cs`:
- JSON is configured with `ReferenceHandler.IgnoreCycles` — navigation properties serialize freely, don't add `[JsonIgnore]` to break the graph unless you know why.
- CORS policy `Frontend` hard-codes origin `http://localhost:5173` with `AllowCredentials` (required by SignalR). Update here if the frontend port moves.
- SignalR hub is mapped at `/hub/kut`; the frontend URL in `frontend/src/App.tsx` must match the backend port.

**GraphController** (`/api/graph`) projects the relational data into a `{nodes, edges}` shape (`org-<id>`, `team-<id>`, `vehicle-<id>`, `incident-<id>`) — the seed of the M6 ontology work. Keep node id prefixes stable; the frontend will key off them.

**Services** (`backend/KUT.Api/Services/DistanceCalculator.cs`) hosts Haversine-style geo math used by the M5 nearest-vehicle recommendation — reuse it rather than reimplementing distance.

**Frontend** is intentionally flat right now: `App.tsx` owns the API base URL and the SignalR connection; `components/` holds the map + panels. When adding a realtime feature, subscribe to the hub event in `App.tsx` (or lift the connection into a context) rather than opening a second connection.

## Conventions worth preserving

- Mutations always write an `Event` — treat the events table as source of truth for "what happened", not just a log.
- Broadcast entity payloads on SignalR after `SaveChangesAsync`, not before.
- Migration files under `backend/KUT.Api/Migrations` are checked in; regenerate rather than hand-edit.
