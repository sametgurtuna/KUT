import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import Map from "./components/Map";

interface Incident {
    id: number;
    type: string;
    severity: number;
    status: string;
    latitude: number;
    longitude: number;
    createdAt: string;
}

interface Vehicle {
    id: number;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
}

interface Recommendation {
    vehicleId: number;
    vehicleName: string;
    vehicleType: string;
    teamName: string | null;
    distanceKm: number;
}

function App() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

    useEffect(() => {
        fetch("http://localhost:5144/api/incidents")
            .then((response) => response.json())
            .then((data) => setIncidents(data));

        fetch("http://localhost:5144/api/vehicles")
            .then((response) => response.json())
            .then((data) => setVehicles(data));
    }, []);

    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5144/hub/kut")
            .withAutomaticReconnect()
            .build();

        connection.on("VehicleUpdated", (updatedVehicle: Vehicle) => {
            setVehicles((prev) =>
                prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
            );
        });

        connection.start().catch((err) => console.error("SignalR bağlantı hatası:", err));

        return () => {
            connection.stop();
        };
    }, []);

    const handleVehicleMoved = (id: number, latitude: number, longitude: number) => {
        fetch(`http://localhost:5144/api/vehicles/${id}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
        });
    };

    const handleIncidentClick = (incident: Incident) => {
        setSelectedIncident(incident);

        fetch(`http://localhost:5144/api/incidents/${incident.id}/recommendations`)
            .then((response) => response.json())
            .then((data) => setRecommendations(data));
    };

    return (
        <div style={{ display: "flex" }}>
            <div style={{ flex: 1 }}>
                <h1>KUT</h1>
                <Map
                    incidents={incidents}
                    vehicles={vehicles}
                    onVehicleMoved={handleVehicleMoved}
                    onIncidentClick={handleIncidentClick}
                />
            </div>

            {selectedIncident && (
                <div style={{ width: "300px", padding: "16px", borderLeft: "1px solid #ccc" }}>
                    <h2>{selectedIncident.type} - Severity {selectedIncident.severity}</h2>
                    <h3>Önerilen Araçlar</h3>
                    <ul>
                        {recommendations.map((r) => (
                            <li key={r.vehicleId}>
                                <strong>{r.vehicleName}</strong> ({r.vehicleType})
                                <br />
                                {r.teamName ?? "Ekip yok"} — {r.distanceKm} km
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;