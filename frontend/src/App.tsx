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

function App() {
    const [incidents, setIncidents] = useState<Incident[]>([]);

    useEffect(() => {
        fetch("http://localhost:5144/api/incidents")
            .then((response) => response.json())
            .then((data) => setIncidents(data));
    }, []);

    return (
        <div>
            <h1>KUT</h1>
            <Map incidents={incidents} />
        </div>
    );
}

export default App;