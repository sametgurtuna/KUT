import { useEffect, useState } from "react";
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

    useEffect(() => {
        fetch("http://localhost:5144/api/incidents")
            .then((response) => response.json())
            .then((data) => setIncidents(data));

        fetch("http://localhost:5144/api/vehicles")
            .then((response) => response.json())
            .then((data) => setVehicles(data));
    }, []);

    return (
        <div>
            <h1>KUT</h1>
            <Map incidents={incidents} vehicles={vehicles} />
        </div>
    );
}

export default App;