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

function App() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);

    // İlk veri çekme
    useEffect(() => {
        fetch("http://localhost:5144/api/incidents")
            .then((response) => response.json())
            .then((data) => setIncidents(data));

        fetch("http://localhost:5144/api/vehicles")
            .then((response) => response.json())
            .then((data) => setVehicles(data));
    }, []);

    // SignalR bağlantısı
    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5144/hub/kut")
            .withAutomaticReconnect()
            .build();

        connection.on("VehicleUpdated", (updatedVehicle: Vehicle) => {
            console.log("VehicleUpdated mesajı geldi:", updatedVehicle);
            setVehicles((prev) =>
                prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
            );
        });

        connection.onclose((err) => console.log("SignalR bağlantısı kapandı:", err));

        connection
            .start()
            .then(() => console.log("SignalR bağlantısı kuruldu ✅"))
            .catch((err) => console.error("SignalR bağlantı hatası:", err));

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
        // Not: burada artık manuel setVehicles yapmıyoruz.
        // Güncelleme SignalR'dan "VehicleUpdated" mesajıyla otomatik gelecek.
    };

    return (
        <div>
            <h1>KUT</h1>
            <Map
                incidents={incidents}
                vehicles={vehicles}
                onVehicleMoved={handleVehicleMoved}
            />
        </div>
    );
}

export default App;