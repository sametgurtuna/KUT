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

interface MapProps {
    incidents: Incident[];
}

function Map({ incidents }: MapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Harita bir kere kurulur
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        mapRef.current = new maplibregl.Map({
            container: mapContainer.current,
            style: "https://demotiles.maplibre.org/style.json",
            center: [28.9784, 41.0082], // İstanbul: [longitude, latitude]
            zoom: 10,
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    // incidents değiştikçe marker'ları güncelle
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

    return (
        <div
            ref={mapContainer}
            style={{ width: "100%", height: "500px" }}
        />
    );
}

export default Map;