import { useEffect, useMemo, useState } from "react";

export interface TreeVehicle {
    id: number;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
}

interface RawTeam {
    id: number;
    name: string;
    organizationId: number;
    vehicles?: TreeVehicle[];
}

interface RawOrg {
    id: number;
    name: string;
}

interface Props {
    apiBase: string;
    /** Live vehicle state from App — the tree merges it over the fetched snapshot. */
    vehicles: TreeVehicle[];
    selectedVehicleId: number | null;
    onVehicleFocus: (v: TreeVehicle) => void;
    refreshKey: number;
}

function ResourceTree({ apiBase, vehicles, selectedVehicleId, onVehicleFocus, refreshKey }: Props) {
    const [orgs, setOrgs] = useState<RawOrg[]>([]);
    const [teams, setTeams] = useState<RawTeam[]>([]);
    const [collapsedOrgs, setCollapsedOrgs] = useState<Record<number, boolean>>({});
    const [collapsedTeams, setCollapsedTeams] = useState<Record<number, boolean>>({});
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);

    // Structure (org → team membership) is fetched; vehicle state comes live.
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch(`${apiBase}/api/organizations`).then((r) => r.json()),
            fetch(`${apiBase}/api/teams`).then((r) => r.json()),
        ]).then(([o, t]: [RawOrg[], RawTeam[]]) => {
            setOrgs(o);
            setTeams(t);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [apiBase, refreshKey]);

    const tree = useMemo(() => {
        // Map vehicle id → team id from the fetched snapshot, then hydrate each
        // entry from the live `vehicles` array so status dots stay current.
        const teamOfVehicle = new window.Map<number, number>();
        for (const t of teams) {
            for (const v of t.vehicles ?? []) teamOfVehicle.set(v.id, t.id);
        }
        const byTeam = new window.Map<number, TreeVehicle[]>();
        for (const v of vehicles) {
            const tid = teamOfVehicle.get(v.id);
            if (tid == null) continue;
            const list = byTeam.get(tid) ?? [];
            list.push(v);
            byTeam.set(tid, list);
        }
        return orgs.map((o) => ({
            ...o,
            teams: teams
                .filter((t) => t.organizationId === o.id)
                .map((t) => ({
                    ...t,
                    vehicles: (byTeam.get(t.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
                })),
        }));
    }, [orgs, teams, vehicles]);

    const q = query.trim().toLocaleLowerCase("tr");
    const filtered = useMemo(() => {
        if (!q) return tree;
        const hit = (s: string) => s.toLocaleLowerCase("tr").includes(q);
        return tree
            .map((org) => {
                if (hit(org.name)) return org;
                const ts = org.teams
                    .map((t) => {
                        if (hit(t.name)) return t;
                        const vs = t.vehicles.filter((v) => hit(v.name) || hit(v.type));
                        return vs.length ? { ...t, vehicles: vs } : null;
                    })
                    .filter((t): t is (typeof org.teams)[number] => t !== null);
                return ts.length ? { ...org, teams: ts } : null;
            })
            .filter((o): o is (typeof tree)[number] => o !== null);
    }, [tree, q]);

    const totalVehicles = vehicles.length;
    const availableCount = vehicles.filter((v) => v.status === "Available").length;

    return (
        <div>
            <div className="tree-search">
                <input
                    type="text"
                    placeholder="Ara: araç, ekip, organizasyon…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            {loading && <div className="empty">Yükleniyor…</div>}

            {!loading && filtered.length === 0 && (
                <div className="empty">
                    <span className="empty-icon">🔍</span>
                    {q ? `"${query}" için sonuç yok.` : "Kayıt yok."}
                </div>
            )}

            {filtered.map((org) => {
                const orgOpen = !collapsedOrgs[org.id];
                const orgVehicles = org.teams.reduce((n, t) => n + t.vehicles.length, 0);
                return (
                    <div key={org.id}>
                        <div
                            className="tree-node tree-org"
                            onClick={() => setCollapsedOrgs((s) => ({ ...s, [org.id]: orgOpen }))}
                        >
                            <span className="caret">{orgOpen ? "▾" : "▸"}</span>
                            <span className="tree-label">{org.name}</span>
                            <span className="tree-count">{orgVehicles}</span>
                        </div>
                        {orgOpen && org.teams.map((team) => {
                            const teamOpen = !collapsedTeams[team.id];
                            return (
                                <div key={team.id}>
                                    <div
                                        className="tree-node tree-team"
                                        onClick={() => setCollapsedTeams((s) => ({ ...s, [team.id]: teamOpen }))}
                                    >
                                        <span className="caret">{teamOpen ? "▾" : "▸"}</span>
                                        <span className="tree-label">{team.name}</span>
                                        <span className="tree-count">{team.vehicles.length}</span>
                                    </div>
                                    {teamOpen && team.vehicles.length === 0 && (
                                        <div className="tree-node tree-vehicle" style={{ cursor: "default", opacity: 0.6 }}>
                                            <span className="tree-label">araç yok</span>
                                        </div>
                                    )}
                                    {teamOpen && team.vehicles.map((v) => (
                                        <div
                                            key={v.id}
                                            className={`tree-node tree-vehicle ${selectedVehicleId === v.id ? "selected" : ""}`}
                                            onClick={() => onVehicleFocus(v)}
                                            title={`${v.type} · ${v.status}`}
                                        >
                                            <span className={`status-dot ${v.status.toLowerCase()}`} />
                                            <span className="tree-label">{v.name}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {!loading && filtered.length > 0 && (
                <div style={{
                    padding: "8px 10px", fontSize: 10.5, color: "var(--muted)",
                    borderTop: "1px solid var(--border)", marginTop: 4,
                }}>
                    {availableCount}/{totalVehicles} araç müsait
                </div>
            )}
        </div>
    );
}

export default ResourceTree;
