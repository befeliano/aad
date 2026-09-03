"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  type FlightSession,
  type TelemetryPoint,
  TEAM_COLORS,
  pointAt,
  trailUpTo,
} from "@/lib/flight-db";

interface Props {
  session: FlightSession;
  time: number;
  trailSec: number;
  showGhost: boolean;
  selectedTeam: number | null;
}

/** Uçak ikonu — yönelmeye (yaw) göre döner */
function planeIcon(color: string, yaw: number, dim = false) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="transform:rotate(${yaw}deg);width:30px;height:30px;opacity:${
      dim ? 0.55 : 1
    }">
      <svg viewBox="0 0 24 24" width="30" height="30">
        <path d="M12 2 L14.5 9 L22 12 L22 13.5 L14.5 12.5 L13.5 18 L16 20 L16 21.5 L12 20.5 L8 21.5 L8 20 L10.5 18 L9.5 12.5 L2 13.5 L2 12 L9.5 9 Z"
          fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="0.8" stroke-linejoin="round"/>
      </svg>
    </div>`,
  });
}

export default function FlightMap({
  session,
  time,
  trailSec,
  showGhost,
  selectedTeam,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    trails: Record<number, L.Polyline>;
    ghosts: Record<number, L.Polyline>;
    markers: Record<number, L.Marker>;
    nfz: L.Circle[];
  }>({ trails: {}, ghosts: {}, markers: {}, nfz: [] });

  /* ---------- harita kurulumu ---------- */
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const map = L.map(elRef.current, {
      center: session.center,
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Esri · World Imagery",
      }
    ).addTo(map);

    // HSS bölgeleri
    session.nfz.forEach((z) => {
      const c = L.circle([z.lat, z.lon], {
        radius: z.radius,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
      layersRef.current.nfz.push(c);
    });

    // Tüm rotayı kapsayacak sınırlar
    const all: [number, number][] = [];
    Object.values(session.tracks).forEach((pts) =>
      pts.forEach((p) => {
        if (Math.abs(p.lat) > 0.0001) all.push([p.lat, p.lon]);
      })
    );
    const bounds = all.length > 1 ? L.latLngBounds(all) : null;

    /* Konteyner ölçüsü değişince haritayı yeniden ölçmek ŞART:
       aksi halde Leaflet sıfır boyutla başlar ve tüm vektör
       katmanlarını görünmez bir alana kırpar. */
    const fit = () => {
      map.invalidateSize({ animate: false });
      if (bounds) map.fitBounds(bounds, { padding: [40, 40], animate: false });
    };
    fit();
    const raf = requestAnimationFrame(fit);

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(elRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = { trails: {}, ghosts: {}, markers: {}, nfz: [] };
    };
  }, [session]);

  /* ---------- zaman değişince katmanları güncelle ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L_ = layersRef.current;

    session.teams.forEach((team, i) => {
      const color = TEAM_COLORS[i % TEAM_COLORS.length];
      const pts = session.tracks[team] || [];
      const dim = selectedTeam !== null && selectedTeam !== team;

      /* İz */
      const trail = trailUpTo(pts, time, trailSec);
      if (!L_.trails[team]) {
        // smoothFactor: 0 — uçuş rotası sadeleştirilmeden, birebir çizilir
        L_.trails[team] = L.polyline(trail, {
          color,
          weight: 3,
          opacity: 0.9,
          smoothFactor: 0,
        }).addTo(map);
      } else {
        L_.trails[team].setLatLngs(trail);
      }
      L_.trails[team].setStyle({ opacity: dim ? 0.35 : 0.9 });

      /* Anlık konum */
      const cur: TelemetryPoint | null = pointAt(pts, time);
      if (cur && Math.abs(cur.lat) > 0.0001) {
        const icon = planeIcon(color, cur.yaw, dim);
        if (!L_.markers[team]) {
          L_.markers[team] = L.marker([cur.lat, cur.lon], { icon })
            .addTo(map)
            .bindTooltip(`Takım ${team}`, {
              direction: "top",
              offset: [0, -16],
            });
        } else {
          L_.markers[team].setLatLng([cur.lat, cur.lon]);
          L_.markers[team].setIcon(icon);
        }
      }

      /* RK4 hayalet iz */
      const ghostPts = session.rk4[team] || [];
      if (showGhost && ghostPts.length) {
        const g = trailUpTo(ghostPts, time, Math.min(trailSec, 10));
        if (!L_.ghosts[team]) {
          L_.ghosts[team] = L.polyline(g, {
            color,
            weight: 2,
            opacity: 0.5,
            dashArray: "5,6",
          }).addTo(map);
        } else {
          L_.ghosts[team].setLatLngs(g);
        }
        L_.ghosts[team].setStyle({ opacity: dim ? 0.2 : 0.5 });
      } else if (L_.ghosts[team]) {
        L_.ghosts[team].setLatLngs([]);
      }
    });
  }, [session, time, trailSec, showGhost, selectedTeam]);

  return <div ref={elRef} className="size-full" />;
}
