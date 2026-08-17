import { useEffect, useState } from "react";

interface GraphNode { id: string; type: string; label: string; }
interface GraphEdge { from: string; to: string; relation: string; }
interface GraphResponse { nodes: GraphNode[]; edges: GraphEdge[]; }

interface Props {
    apiBase: string;
    refreshKey: number;
}

const COLS = ["Organization", "Team", "Vehicle", "Incident"];
const COL_LABEL = ["Org", "Ekip", "Araç", "İhbar"];

function GraphPanel({ apiBase, refreshKey }: Props) {
    const [data, setData] = useState<GraphResponse | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch(`${apiBase}/api/graph`)
            .then((r) => r.json())
            .then(setData)
            .catch(() => setError(true));
    }, [apiBase, refreshKey]);

    if (error) return <div className="empty">Graf yüklenemedi.</div>;
    if (!data) return <div className="empty">Yükleniyor…</div>;

    const byType: Record<string, GraphNode[]> = {};
    for (const c of COLS) byType[c] = [];
    for (const n of data.nodes) byType[n.type]?.push(n);

    const width = 330;
    const rowH = 19;
    const colW = width / COLS.length;
    const positions = new window.Map<string, { x: number; y: number }>();
    let maxRows = 0;

    COLS.forEach((type, ci) => {
        const list = byType[type];
        maxRows = Math.max(maxRows, list.length);
        list.forEach((n, ri) => {
            positions.set(n.id, { x: colW * ci + 10, y: 30 + ri * rowH });
        });
    });

    const height = Math.max(200, 30 + maxRows * rowH + 12);

    return (
        <div>
            <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`}>
                {COL_LABEL.map((label, ci) => (
                    <text key={label} x={colW * ci + 10} y={14}
                        style={{ fill: "var(--muted)", fontSize: 8, letterSpacing: "0.1em" }}>
                        {label.toUpperCase()}
                    </text>
                ))}
                {data.edges.map((e, i) => {
                    const a = positions.get(e.from);
                    const b = positions.get(e.to);
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2;
                    return (
                        <path key={i} className={`graph-edge ${e.relation}`}
                            d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`} />
                    );
                })}
                {data.nodes.map((n) => {
                    const p = positions.get(n.id);
                    if (!p) return null;
                    return (
                        <g key={n.id} className={`graph-node ${n.type.toLowerCase()}`}>
                            <title>{n.label}</title>
                            <circle cx={p.x} cy={p.y} r={3.5} />
                            <text x={p.x + 6} y={p.y + 3}>
                                {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div className="graph-legend">
                <span>{data.nodes.length} düğüm</span>
                <span>{data.edges.length} kenar</span>
                <span style={{ color: "var(--warn)" }}>╌ responds-to</span>
            </div>
        </div>
    );
}

export default GraphPanel;
