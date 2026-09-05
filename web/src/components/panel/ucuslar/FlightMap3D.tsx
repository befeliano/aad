"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  type FlightSession,
  type TelemetryPoint,
  TEAM_COLORS,
  pointAt,
  trailUpTo,
} from "@/lib/flight-db";

/* Cesium'un Worker/Asset dosyaları public/cesium'dan servis edilir
   (scripts/copy-cesium.mjs build öncesi kopyalar). */
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}
if (typeof window !== "undefined") {
  window.CESIUM_BASE_URL = "/cesium/";
}

const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;

/** Takım sırasına göre 3D model — arkadaş ekibin hazırladığı .glb'ler */
const MODELS = [
  {
    uri: "/models/Shadowmk.glb",
    scale: 0.005,
    /* .glb'nin ileri ekseni Cesium'un beklediği yöne göre 90° dönük;
       düzeltilmezse uçak yandan uçuyormuş gibi görünür.
       Ters yöne dönmüşse buradaki işareti (+/-) çevirmek yeterli. */
    heading: -Cesium.Math.PI_OVER_TWO,
    pitch: 0,
    roll: 0,
  },
  {
    uri: "/models/kartal.glb",
    scale: 0.005,
    heading: -Cesium.Math.PI_OVER_TWO,
    pitch: 0,
    roll: Cesium.Math.PI_OVER_TWO,
  },
  {
    uri: "/models/dorje.glb",
    scale: 0.005,
    heading: 0,
    pitch: -Cesium.Math.PI_OVER_TWO,
    roll: 0,
  },
];

interface Props {
  session: FlightSession;
  time: number;
  trailSec: number;
  showGhost: boolean;
  selectedTeam: number | null;
  /** Kamerayı seçili uçağa kilitle (TPS) */
  follow: boolean;
}

/** Telemetriden Cesium yönelimi (heading/pitch/roll → quaternion) */
function orientationOf(
  pos: Cesium.Cartesian3,
  p: TelemetryPoint,
  cfg: (typeof MODELS)[number]
) {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(p.yaw) + cfg.heading,
    Cesium.Math.toRadians(p.pitch) + cfg.pitch,
    Cesium.Math.toRadians(p.roll) + cfg.roll
  );
  return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
}

export default function FlightMap3D({
  session,
  time,
  trailSec,
  showGhost,
  selectedTeam,
  follow,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entsRef = useRef<{
    planes: Record<number, Cesium.Entity>;
    ghosts: Record<number, Cesium.Entity>;
    trails: Record<number, Cesium.Entity>;
  }>({ planes: {}, ghosts: {}, trails: {} });

  /* Cesium render döngüsünün okuduğu güncel değerler.
     Ref kullanıyoruz ki her zaman değişiminde viewer yeniden kurulmasın;
     güncellemeyi render sırasında değil effect içinde yapıyoruz. */
  const stateRef = useRef({ time, trailSec, showGhost, selectedTeam, follow });
  useEffect(() => {
    stateRef.current = { time, trailSec, showGhost, selectedTeam, follow };
  });

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /* Token eksikliği modül sabitinden türetilir — state'e gerek yok */
  const tokenMissing = !ION_TOKEN;
  const shownError = tokenMissing
    ? "Cesium Ion token tanımlı değil. NEXT_PUBLIC_CESIUM_ION_TOKEN ekleyip sunucuyu yeniden başlatın — 2D görünüm çalışmaya devam eder."
    : error;

  useEffect(() => {
    const el = elRef.current;
    if (!el || !ION_TOKEN) return;

    let viewer: Cesium.Viewer | null = null;
    let cancelled = false;
    /** Zeminden bağımsız sabit taban yükseklik (telemetri irtifası göreli) */
    let baseHeight = 785;

    (async () => {
      try {
        Cesium.Ion.defaultAccessToken = ION_TOKEN;

        const imagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          { enablePickFeatures: false }
        );
        const terrain = await Cesium.createWorldTerrainAsync({
          requestVertexNormals: true,
        });
        if (cancelled) return;

        viewer = new Cesium.Viewer(el, {
          baseLayer: new Cesium.ImageryLayer(imagery),
          terrainProvider: terrain,
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        viewerRef.current = viewer;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.cesiumWidget.creditContainer.setAttribute("style", "display:none");

        /* 3D binalar (Cesium OSM Buildings).
           Arazi zaten yüksekliğe sahipti ama binalar yalnızca uydu
           görüntüsünde düz doku olarak görünüyordu; bu katman uçuş
           sahasındaki yapıları gerçek hacimli hâle getirir.
           Yüklenemezse harita çalışmaya devam eder. */
        try {
          const binalar = await Cesium.createOsmBuildingsAsync();
          if (!cancelled && viewer) viewer.scene.primitives.add(binalar);
        } catch {
          /* bina katmanı isteğe bağlı */
        }

        const [clat, clon] = session.center;

        /* Zemin yüksekliği — sahnedeki HER ŞEYİN referansı.
           ESKİ HATA: globe.getHeight() arazi karoları daha yüklenmemişken
           elipsoide düşüp 0 döndürüyordu ve `?? 785` ifadesi 0'ı yakalamıyor
           (?? yalnızca null/undefined için çalışır). baseHeight 0 olunca
           58 m irtifadaki uçak gerçek zeminin ~730 m ALTINA yerleşiyor,
           kamera da toprağın içine giriyordu: ekran siyah, yalnız ufuk.
           Çözüm: araziyi asenkron örnekle ve saçma değeri kabul etme. */
        try {
          const [ornek] = await Cesium.sampleTerrainMostDetailed(terrain, [
            Cesium.Cartographic.fromDegrees(clon, clat),
          ]);
          const h = ornek?.height;
          if (typeof h === "number" && Number.isFinite(h) && h > 1) {
            baseHeight = h;
          }
        } catch {
          /* örnekleme başarısızsa 785 m varsayılanı kalır */
        }
        if (cancelled) return;

        /* --- Uçak, iz ve hayalet varlıkları --- */
        session.teams.forEach((team, i) => {
          const color = Cesium.Color.fromCssColorString(
            TEAM_COLORS[i % TEAM_COLORS.length]
          );
          const cfg = MODELS[i % MODELS.length];
          const startPos = Cesium.Cartesian3.fromDegrees(clon, clat, baseHeight + 100);

          entsRef.current.planes[team] = viewer!.entities.add({
            position: startPos,
            model: {
              uri: cfg.uri,
              scale: cfg.scale,
              minimumPixelSize: 20,
              maximumScale: 2,
              runAnimations: false,
            },
            label: {
              text: `T${team}`,
              font: "600 12px Inter, sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -20),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });

          /* İz — her karede yeniden hesaplanır */
          entsRef.current.trails[team] = viewer!.entities.add({
            polyline: {
              positions: new Cesium.CallbackProperty(() => {
                const s = stateRef.current;
                const pts = trailUpTo(
                  session.tracks[team] || [],
                  s.time,
                  s.trailSec
                );
                if (pts.length < 2) return [];
                const src = session.tracks[team] || [];
                return pts.map(([la, lo], idx) => {
                  const alt = src[idx]?.alt ?? 5;
                  return Cesium.Cartesian3.fromDegrees(
                    lo,
                    la,
                    baseHeight + Math.max(alt, 2)
                  );
                });
              }, false),
              width: 3,
              material: color,
            },
          });

          /* RK4 hayalet uçak */
          if (session.rk4[team]?.length) {
            entsRef.current.ghosts[team] = viewer!.entities.add({
              position: startPos,
              model: {
                uri: cfg.uri,
                scale: cfg.scale,
                minimumPixelSize: 16,
                color: Cesium.Color.WHITE.withAlpha(0.35),
                colorBlendMode: Cesium.ColorBlendMode.MIX,
                colorBlendAmount: 0.8,
              },
              show: false,
            });
          }
        });

        /* Başlangıç kamerası */
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            clon,
            clat - 0.004,
            baseHeight + 400
          ),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-25),
            roll: 0,
          },
          duration: 1.2,
        });

        /* --- Kare başı güncelleme --- */
        viewer.scene.preRender.addEventListener(() => {
          const v = viewerRef.current;
          if (!v) return;
          const s = stateRef.current;

          session.teams.forEach((team, i) => {
            const cfg = MODELS[i % MODELS.length];
            const p = pointAt(session.tracks[team] || [], s.time);
            const ent = entsRef.current.planes[team];
            if (!ent || !p || Math.abs(p.lat) < 0.0001) return;

            const pos = Cesium.Cartesian3.fromDegrees(
              p.lon,
              p.lat,
              baseHeight + Math.max(p.alt, 2)
            );
            ent.position = new Cesium.ConstantPositionProperty(pos);
            ent.orientation = new Cesium.ConstantProperty(
              orientationOf(pos, p, cfg)
            );

            /* Hayalet */
            const g = entsRef.current.ghosts[team];
            if (g) {
              const gp = pointAt(session.rk4[team] || [], s.time);
              const visible = s.showGhost && !!gp && Math.abs(gp.lat) > 0.0001;
              g.show = visible;
              if (visible && gp) {
                const gpos = Cesium.Cartesian3.fromDegrees(
                  gp.lon,
                  gp.lat,
                  baseHeight + Math.max(gp.alt, 2)
                );
                g.position = new Cesium.ConstantPositionProperty(gpos);
                g.orientation = new Cesium.ConstantProperty(
                  orientationOf(gpos, gp, cfg)
                );
              }
            }
          });

          /* TPS kamera — seçili uçağın arkasından takip */
          const target = s.selectedTeam ?? session.teams[0];
          if (s.follow && target !== undefined) {
            const p = pointAt(session.tracks[target] || [], s.time);
            if (p && Math.abs(p.lat) > 0.0001) {
              const center = Cesium.Cartesian3.fromDegrees(
                p.lon,
                p.lat,
                baseHeight + Math.max(p.alt, 2)
              );
              const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
              /* Cesium kamerayı hedefin (heading + 180°) yönüne yerleştirir.
                 Dolayısıyla heading olarak uçağın yaw'ını verince kamera tam
                 ARKASINA geçer ve uçuşla aynı yöne bakar (flight-sim TPS).
                 Önceki "yaw - 90" değeri kamerayı yan tarafta bırakıyordu.
                 cfg.heading burada KULLANILMAZ: o, .glb modelinin ileri
                 ekseni için bir düzeltme, gerçek rota yönü değil. */
              v.camera.lookAtTransform(
                transform,
                new Cesium.HeadingPitchRange(
                  Cesium.Math.toRadians(p.yaw),
                  Cesium.Math.toRadians(-20),
                  130
                )
              );
            }
          }
        });

        if (!cancelled) setReady(true);
      } catch (ex) {
        if (!cancelled) {
          setError("3D görünüm başlatılamadı: " + (ex as Error).message);
        }
      }
    })();

    return () => {
      cancelled = true;
      const v = viewerRef.current;
      viewerRef.current = null;
      entsRef.current = { planes: {}, ghosts: {}, trails: {} };
      if (v && !v.isDestroyed()) v.destroy();
    };
  }, [session]);

  /* Takip kapatılınca kamerayı serbest bırak */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || follow) return;
    v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }, [follow]);

  if (shownError) {
    return (
      <div className="flex size-full items-center justify-center bg-bg-2 p-6">
        <p className="max-w-sm rounded-xl border border-warn/30 bg-warn/10 p-4 text-center text-sm leading-relaxed text-warn">
          {shownError}
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <div ref={elRef} className="size-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-2 text-sm text-ink-3">
          3D arazi yükleniyor…
        </div>
      )}
    </div>
  );
}
