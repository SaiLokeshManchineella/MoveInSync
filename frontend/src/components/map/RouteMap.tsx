import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Stop } from "@/types";

interface RouteMapProps {
  stops: Stop[];
  routeName?: string;
  className?: string;
}

// Mapbox configuration for map tiles only
// Road routing is handled by OSRM (Open Source Routing Machine)
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Disable Mapbox telemetry to prevent ad blocker issues
if (mapboxgl.prewarm) {
  mapboxgl.prewarm();
}
if (mapboxgl.clearPrewarmedResources) {
  mapboxgl.clearPrewarmedResources();
}

// Fetch route from OSRM (Open Source Routing Machine)
// Benefits: Free, no API key required, accurate road routing
// Using public OSRM demo server - for production, consider hosting your own OSRM instance
// See: https://github.com/Project-OSRM/osrm-backend
async function fetchOSRMRoute(stops: Stop[]): Promise<GeoJSON.Feature<GeoJSON.LineString> | null> {
  if (stops.length < 2) return null;

  try {
    const coordinates = stops
      .map((stop) => `${stop.longitude},${stop.latitude}`)
      .join(";");

    // Using public OSRM demo server
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      console.error("OSRM API error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.code === "Ok" && data.routes && data.routes[0]) {
      return {
        type: "Feature",
        properties: {
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
        },
        geometry: data.routes[0].geometry,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching OSRM route:", error);
    return null;
  }
}

export function RouteMap({ stops, routeName, className = "" }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize map only once

    // Default center: Bangalore
    const center: [number, number] = stops.length > 0
      ? [stops[0].longitude, stops[0].latitude]
      : [77.5946, 12.9716];

    // Initialize Mapbox map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: 12,
      trackResize: true,
      preserveDrawingBuffer: false,
      // Disable telemetry to prevent ERR_BLOCKED_BY_CLIENT errors from ad blockers
      collectResourceTiming: false,
      fadeDuration: 0,
      transformRequest: (url: string) => {
        // Block telemetry requests
        if (url.includes('events.mapbox.com')) {
          return { url: '' };
        }
        return { url };
      },
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || stops.length === 0) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add markers for each stop
    stops.forEach((stop, index) => {
      const isStart = index === 0;
      const isEnd = index === stops.length - 1;

      // Create custom marker colors
      let color = "#3b82f6"; // blue
      
      if (isStart) {
        color = "#10b981"; // green
      } else if (isEnd) {
        color = "#ef4444"; // red
      }

      // Create popup HTML
      const popupHTML = `
        <div style="padding: 8px; min-width: 150px;">
          <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">
            ${isStart ? "🚦 Start: " : isEnd ? "🏁 End: " : `Stop ${index}: `}${stop.name}
          </h3>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">
            Lat: ${stop.latitude.toFixed(6)}
          </p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">
            Lng: ${stop.longitude.toFixed(6)}
          </p>
          ${routeName ? `<p style="font-size: 12px; color: #3b82f6; font-weight: 600; margin-top: 4px;">Route: ${routeName}</p>` : ""}
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);

      // Create marker
      const marker = new mapboxgl.Marker({ color })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (stops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach((stop) => {
        bounds.extend([stop.longitude, stop.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }

    // Fetch and display route using OSRM
    if (stops.length >= 2) {
      setLoadingRoute(true);
      
      fetchOSRMRoute(stops).then((routeGeoJSON) => {
        setLoadingRoute(false);

        if (!map.current || !routeGeoJSON) return;

        // Remove existing route layer if present
        if (map.current.getLayer("route")) {
          map.current.removeLayer("route");
        }
        if (map.current.getSource("route")) {
          map.current.removeSource("route");
        }

        // Add route source and layer
        map.current.addSource("route", {
          type: "geojson",
          data: routeGeoJSON,
        });

        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#10b981", // green color for route
            "line-width": 5,
            "line-opacity": 0.75,
          },
        });

        // Log route info if available
        if (routeGeoJSON.properties) {
          const distance = routeGeoJSON.properties.distance;
          const duration = routeGeoJSON.properties.duration;
          if (distance && duration) {
            console.log(`Route: ${(distance / 1000).toFixed(2)} km, ${(duration / 60).toFixed(0)} min`);
          }
        }
      });
    }
  }, [stops, routeName]);

  if (stops.length === 0) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <p className="text-muted-foreground">No stops available to display route</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-border relative ${className}`}>
      {loadingRoute && (
        <div className="absolute top-4 right-4 z-10 bg-white px-3 py-2 rounded shadow-lg text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          Loading road route via OSRM...
        </div>
      )}
      <div
        ref={mapContainer}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
      />
    </div>
  );
}
