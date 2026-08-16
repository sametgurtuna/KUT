import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Incident {
    id: number;
    type: string;
    severity: number;
    latitude: number;
    longitude: number;
}

interface Vehicle {
    id: number;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
}

interface MapProps {
    incidents: Incident[];
    vehicles: Vehicle[];
}

function Map({ incidents, vehicles }: MapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        mapRef.current = new maplibregl.Map({
            container: mapContainer.current,
            style: "https://demotiles.maplibre.org/style.json",
            center: [28.9784, 41.0082],
            zoom: 10,
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    // Incident marker'ları (kırmızı)
    useEffect(() => {
        if (!mapRef.current) return;

        const markers: maplibregl.Marker[] = [];

        incidents.forEach((incident) => {
            const marker = new maplibregl.Marker({ color: "red" })
                .setLngLat([incident.longitude, incident.latitude])
                .setPopup(
                    new maplibregl.Popup().setText(
                        `${incident.type} - Severity ${incident.severity}`
                    )
                )
                .addTo(mapRef.current!);

            markers.push(marker);
        });

        return () => {
            markers.forEach((m) => m.remove());
        };
    }, [incidents]);

    // Vehicle marker'ları (mavi)
    useEffect(() => {
        if (!mapRef.current) return;

        const markers: maplibregl.Marker[] = [];

        vehicles.forEach((vehicle) => {
            const marker = new maplibregl.Marker({ color: "blue" })
                .setLngLat([vehicle.longitude, vehicle.latitude])
                .setPopup(
                    new maplibregl.Popup().setText(
                        `${vehicle.name} - ${vehicle.status}`
                    )
                )
                .addTo(mapRef.current!);

            markers.push(marker);
        });

        return () => {
            markers.forEach((m) => m.remove());
        };
    }, [vehicles]);

    return (
        <div
            ref={mapContainer}
            style={{ width: "100%", height: "500px" }}
        />
    );
}

export default Map;