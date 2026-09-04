"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Grid3x3,
  Loader2,
  Box as BoxIcon,
  X,
} from "lucide-react";
import type { Part } from "@/lib/types";

/** 3D olarak açılabilen uzantılar */
export const VIEWABLE_EXTS = ["stl", "obj", "glb", "gltf"];

interface ModelInfo {
  dimensions: string;
  triangles: number;
}

function themeColors() {
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  const isDark =
    attr === "dark" ||
    (attr !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return {
    bg: isDark ? 0x0d1119 : 0xf7f8fb,
    grid: isDark ? 0x2a3140 : 0xd9dee8,
    gridCenter: isDark ? 0x7e94c4 : 0x1b2a4e,
    mesh: isDark ? 0xc9cfda : 0x36405a,
    rim: isDark ? 0xf0323f : 0xd11a25,
    isDark,
  };
}

export function PartViewer({
  part,
  getUrl,
  onClose,
}: {
  part: Part | null;
  /** İmzalı indirme URL'i üretir (Supabase Storage) */
  getUrl: (path: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const rafRef = useRef(0);
  const homeRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* Desteklenmeyen dosya türü — state değil, doğrudan türetilir */
  const unsupported =
    !!part && !VIEWABLE_EXTS.includes((part.file_ext || "").toLowerCase());
  const shownError = unsupported
    ? "Bu dosya türü 3D olarak görüntülenemez. STL, OBJ, GLB veya GLTF yükleyin."
    : error;

  /* ---------- sahneyi kur ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const c = themeColors();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(c.bg);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(80, 60, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    /* Işıklar */
    scene.add(new THREE.AmbientLight(0xffffff, c.isDark ? 0.5 : 0.75));

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(60, 90, 70);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc0d0ff, 0.6);
    fill.position.set(-70, 40, -50);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(c.rim, 0.8);
    rim.position.set(-40, 30, 90);
    scene.add(rim);

    /* Zemin ızgarası */
    const grid = new THREE.GridHelper(400, 40, c.gridCenter, c.grid);
    const gm = grid.material as THREE.Material;
    gm.transparent = true;
    gm.opacity = 0.42;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controlsRef.current = controls;

    /* Konteyner boyutunu izle — 0 boyutla başlarsa görüntü bozulur */
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;
    };
  }, []);

  /* ---------- modeli temizle ---------- */
  const clearModel = useCallback(() => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    scene.remove(model);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    modelRef.current = null;
  }, []);

  /* ---------- modeli kadraja al ---------- */
  const frameModel = useCallback((object: THREE.Object3D): ModelInfo => {
    const camera = cameraRef.current!;
    const controls = controlsRef.current!;

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Merkeze al, sonra zemine indir
    object.position.sub(center);
    const box2 = new THREE.Box3().setFromObject(object);
    object.position.y -= box2.min.y;

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.9;

    const pos = new THREE.Vector3(dist * 0.7, dist * 0.6, dist * 0.9);
    const target = new THREE.Vector3(0, size.y / 2, 0);

    camera.position.copy(pos);
    camera.near = Math.max(0.01, dist / 1000);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();

    controls.target.copy(target);
    controls.minDistance = dist * 0.08;
    controls.maxDistance = dist * 12;
    controls.update();

    homeRef.current = { pos: pos.clone(), target: target.clone() };

    let triangles = 0;
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const g = m.geometry as THREE.BufferGeometry;
        triangles += g.index
          ? g.index.count / 3
          : (g.attributes.position?.count ?? 0) / 3;
      }
    });

    return {
      dimensions: `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(
        1
      )}`,
      triangles: Math.round(triangles),
    };
  }, []);

  /* ---------- parça değişince yükle ---------- */
  useEffect(() => {
    if (!part) return;
    const ext = (part.file_ext || "").toLowerCase();
    // Desteklenmeyen uzantı render sırasında türetilir (bkz. `unsupported`);
    // burada yükleme yapmadan çıkıyoruz.
    if (!VIEWABLE_EXTS.includes(ext)) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setWireframe(false);

      try {
        const url = await getUrl(part.file_path);
        if (!url) throw new Error("Dosya bağlantısı alınamadı.");
        if (cancelled) return;

        const material = new THREE.MeshStandardMaterial({
          color: themeColors().mesh,
          roughness: 0.5,
          metalness: 0.15,
        });

        let object: THREE.Object3D;
        if (ext === "stl") {
          const geometry = await new STLLoader().loadAsync(url);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, material);
        } else if (ext === "obj") {
          object = await new OBJLoader().loadAsync(url);
          object.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) m.material = material;
          });
        } else {
          const gltf = await new GLTFLoader().loadAsync(url);
          object = gltf.scene;
        }

        if (cancelled || !sceneRef.current) return;

        clearModel();
        sceneRef.current.add(object);
        modelRef.current = object;
        setInfo(frameModel(object));
      } catch (ex) {
        if (!cancelled) {
          setError(
            "Model yüklenemedi: " + ((ex as Error).message || "bilinmeyen hata")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [part, getUrl, clearModel, frameModel]);

  /* ---------- tel kafes ---------- */
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
      });
    });
  }, [wireframe, info]);

  /* ---------- tam ekranda ESC ---------- */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  function resetView() {
    const home = homeRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!home || !camera || !controls) return;
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    controls.update();
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[95] flex flex-col bg-bg p-4"
          : "flex flex-col"
      }
    >
      {/* Başlık çubuğu */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <BoxIcon size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
          {part ? part.name : "3D Görüntüleyici"}
        </span>

        <div className="flex items-center gap-1">
          <IconBtn onClick={resetView} label="Görünümü sıfırla" disabled={!info}>
            <RotateCcw size={15} />
          </IconBtn>
          <IconBtn
            onClick={() => setWireframe((v) => !v)}
            label="Tel kafes"
            active={wireframe}
            disabled={!info}
          >
            <Grid3x3 size={15} />
          </IconBtn>
          <IconBtn
            onClick={() => setFullscreen((v) => !v)}
            label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </IconBtn>
          <IconBtn onClick={onClose} label="Kapat">
            <X size={15} />
          </IconBtn>
        </div>
      </div>

      {/* Tuval */}
      <div
        ref={wrapRef}
        className={`relative overflow-hidden rounded-xl border border-line bg-bg-2 ${
          fullscreen ? "flex-1" : "h-[420px]"
        }`}
      >
        <canvas ref={canvasRef} className="block size-full" />

        {!part && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <BoxIcon size={28} className="text-ink-3" />
            <p className="text-sm text-ink-3">
              Görüntülemek için bir parça seçin
            </p>
          </div>
        )}

        {loading && !unsupported && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-2/80 backdrop-blur-sm">
            <Loader2 size={26} className="animate-spin text-accent" />
            <p className="text-sm text-ink-2">Model yükleniyor…</p>
          </div>
        )}

        {shownError && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-xs rounded-xl border border-bad/30 bg-bad/10 p-4 text-center text-sm text-bad">
              {shownError}
            </p>
          </div>
        )}

        {info && !loading && !shownError && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-line bg-bg/85 px-3 py-2 backdrop-blur-sm">
            <div className="tabular text-[11.5px] text-ink-2">
              {info.dimensions}
            </div>
            <div className="tabular text-[11px] text-ink-3">
              {info.triangles.toLocaleString("tr-TR")} üçgen
            </div>
          </div>
        )}

        {info && !loading && (
          <div className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-ink-3">
            Sürükle: döndür · Sağ tık: kaydır · Tekerlek: yakınlaştır
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
        active
          ? "border-accent bg-accent text-white"
          : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
