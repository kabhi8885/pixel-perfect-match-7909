import { useEffect, useRef } from "react";

export type MapPoint = { latitude: number; longitude: number };

declare global {
  interface Window {
    google?: any;
    __speedMapInit?: () => void;
  }
}

let mapsLoaderPromise: Promise<void> | null = null;

function loadMapsApi(): Promise<void> {
  if (mapsLoaderPromise) return mapsLoaderPromise;
  mapsLoaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    window.__speedMapInit = () => resolve();
    const script = document.createElement("script");
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__speedMapInit&channel=${channel}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoaderPromise;
}

function decodePolyline(encoded: string): MapPoint[] {
  const points: MapPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function RideMap({
  pickup,
  destination,
  polyline,
}: {
  pickup: MapPoint | null;
  destination: MapPoint | null;
  polyline: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pathRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat: 17.385, lng: 78.4867 }, // Hyderabad default
          zoom: 12,
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
        });
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    if (pathRef.current) {
      pathRef.current.setMap(null);
      pathRef.current = null;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoint = false;

    const addMarker = (p: MapPoint, color: string) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition());
      hasPoint = true;
    };

    if (pickup) addMarker(pickup, "#16a34a");
    if (destination) addMarker(destination, "#dc2626");

    if (polyline) {
      const path = decodePolyline(polyline).map((p) => ({ lat: p.latitude, lng: p.longitude }));
      pathRef.current = new window.google.maps.Polyline({
        map,
        path,
        strokeColor: "#2563eb",
        strokeWeight: 4,
        strokeOpacity: 0.9,
      });
      for (const pt of path) bounds.extend(pt);
      hasPoint = true;
    }

    if (hasPoint) {
      map.fitBounds(bounds, 60);
    }
  }, [pickup, destination, polyline]);

  return <div ref={containerRef} className="h-56 w-full rounded-2xl border border-border" />;
}
