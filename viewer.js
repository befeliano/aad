/* ============================================================
   ANATOLIA AERO DESIGN — 3D VIEWER (Three.js, ES Modules)
   STL, OBJ, GLB/GLTF dosyalarını döndürülebilir 3D olarak gösterir.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader }     from 'three/addons/loaders/STLLoader.js';
import { OBJLoader }     from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';

const canvas       = document.getElementById('viewerCanvas');
const placeholder  = document.getElementById('viewerPlaceholder');
const loadingEl    = document.getElementById('viewerLoading');
const infoEl       = document.getElementById('viewerInfo');
const titleEl      = document.getElementById('viewerTitle');
const controlsHint = document.getElementById('viewerControls');
const resetBtn     = document.getElementById('viewerReset');
const fullscreenBtn= document.getElementById('viewerFullscreen');
const wireBtn      = document.getElementById('viewerWireframe');

let renderer, scene, camera, controls;
let currentMesh = null;
let isWireframe = false;
let animationId = null;

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bg: isDark ? 0x0a0808 : 0xfaf5f5,
    fog: isDark ? 0x0a0808 : 0xfaf5f5,
    grid: isDark ? 0x2a2020 : 0xebe2dd,
    gridCenter: isDark ? 0x442020 : 0xc02828,
    meshColor: isDark ? 0xd4cfc8 : 0x2a2424,
    accentLight: isDark ? 0xff6470 : 0xc0202c
  };
}

function initViewer() {
  if (renderer) return; // already initialized

  const c = getThemeColors();

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(c.bg);
  scene.fog = new THREE.Fog(c.fog, 200, 600);

  // Camera
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
  camera.position.set(80, 60, 100);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(120, 180, 80);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 600;
  keyLight.shadow.camera.left = -150;
  keyLight.shadow.camera.right = 150;
  keyLight.shadow.camera.top = 150;
  keyLight.shadow.camera.bottom = -150;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc0d0ff, 0.35);
  fillLight.position.set(-100, 80, -60);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(c.accentLight, 0.4);
  rimLight.position.set(0, 50, -150);
  scene.add(rimLight);

  // Grid
  const grid = new THREE.GridHelper(400, 40, c.gridCenter, c.grid);
  grid.position.y = -0.01;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  scene.add(grid);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.7;
  controls.minDistance = 1;
  controls.maxDistance = 1500;

  // Resize handling
  const ro = new ResizeObserver(() => {
    if (canvas.hidden) return;
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  ro.observe(canvas.parentElement);

  // Animate loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function clearMesh() {
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    currentMesh = null;
  }
}

function showCanvas() {
  placeholder.hidden = true;
  canvas.hidden = false;
  controlsHint.hidden = false;
  resetBtn.disabled = false;
  fullscreenBtn.disabled = false;
  wireBtn.disabled = false;
}

function showPlaceholder() {
  placeholder.hidden = false;
  canvas.hidden = true;
  controlsHint.hidden = true;
  infoEl.hidden = true;
  resetBtn.disabled = true;
  fullscreenBtn.disabled = true;
  wireBtn.disabled = true;
  titleEl.textContent = '3D Görüntüleyici';
  if (renderer) clearMesh();
}

function showNoViewer(part) {
  const hint = `
    <div class="viewer-no3d">
      <div class="viewer-no3d__icon">📦</div>
      <h3>${escapeHtmlLocal(part.name)}</h3>
      <p>
        <strong>${part.file_ext.toUpperCase()}</strong> formatı tarayıcıda 3D olarak görüntülenemez.
        ${part.file_ext === 'sldprt' || part.file_ext === 'ipt'
          ? 'SolidWorks/Inventor\'da açıp <strong>File → Save As → STL</strong> ile dışa aktarıp tekrar yükleyebilirsin.'
          : 'STL, OBJ veya GLB formatına dönüştürerek tekrar yükleyebilirsin.'}
      </p>
      <button class="btn btn--primary" id="dlNonViewable">Dosyayı İndir</button>
    </div>`;
  placeholder.innerHTML = hint;
  placeholder.hidden = false;
  canvas.hidden = true;
  controlsHint.hidden = true;
  resetBtn.disabled = true;
  fullscreenBtn.disabled = true;
  wireBtn.disabled = true;

  document.getElementById('dlNonViewable').addEventListener('click', async () => {
    try {
      const url = await window._getPartUrl(part.file_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = part.file_name;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert('İndirme başarısız: ' + e.message); }
  });
}

function escapeHtmlLocal(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function frameObject(object) {
  // Compute bounding box
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Re-center the object
  object.position.sub(center);

  // Drop to ground
  const newBox = new THREE.Box3().setFromObject(object);
  object.position.y -= newBox.min.y;

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.8;

  camera.position.set(dist * 0.7, dist * 0.6, dist * 0.9);
  camera.lookAt(0, size.y / 2, 0);
  camera.near = Math.max(0.01, dist / 1000);
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  controls.target.set(0, size.y / 2, 0);
  controls.minDistance = dist * 0.1;
  controls.maxDistance = dist * 10;
  controls.update();

  return { size, dimensions: `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}` };
}

function makeStandardMaterial() {
  const c = getThemeColors();
  return new THREE.MeshStandardMaterial({
    color: c.meshColor,
    roughness: 0.5,
    metalness: 0.15,
    flatShading: false
  });
}

function setWireframe(on) {
  if (!currentMesh) return;
  currentMesh.traverse(obj => {
    if (obj.isMesh && obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.wireframe = on);
      } else {
        obj.material.wireframe = on;
      }
    }
  });
  isWireframe = on;
  wireBtn.style.background = on ? 'var(--accent)' : '';
  wireBtn.style.color = on ? '#fff' : '';
  wireBtn.style.borderColor = on ? 'var(--accent)' : '';
}

async function loadPart(part) {
  initViewer();

  if (!part.is_viewable || !['stl','obj','glb','gltf'].includes(part.file_ext)) {
    showNoViewer(part);
    return;
  }

  titleEl.textContent = part.name;
  loadingEl.hidden = false;
  infoEl.hidden = true;

  try {
    const url = await window._getPartUrl(part.file_path);
    clearMesh();

    let object;
    const ext = part.file_ext;

    if (ext === 'stl') {
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);
      geometry.computeVertexNormals();
      const material = makeStandardMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      object = mesh;
    } else if (ext === 'obj') {
      const loader = new OBJLoader();
      object = await loader.loadAsync(url);
      const mat = makeStandardMaterial();
      object.traverse(child => {
        if (child.isMesh) {
          child.material = mat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      object = gltf.scene;
      object.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }

    if (!object) throw new Error('Yüklenemedi');

    scene.add(object);
    currentMesh = object;
    isWireframe = false;
    wireBtn.style.background = '';
    wireBtn.style.color = '';

    const { dimensions } = frameObject(object);

    // Triangle count
    let triCount = 0;
    object.traverse(child => {
      if (child.isMesh && child.geometry) {
        const idx = child.geometry.index;
        triCount += idx ? idx.count / 3 : child.geometry.attributes.position.count / 3;
      }
    });

    showCanvas();
    infoEl.innerHTML = `
      <strong>${escapeHtmlLocal(part.name)}</strong>
      <code>${ext.toUpperCase()}</code> · ${(part.file_size / 1048576).toFixed(2)} MB<br>
      Boyut: ${dimensions}<br>
      ${Math.round(triCount).toLocaleString('tr-TR')} üçgen
    `;
    infoEl.hidden = false;

  } catch (err) {
    console.error('3D load error:', err);
    placeholder.innerHTML = `
      <div class="viewer-no3d">
        <div class="viewer-no3d__icon">⚠️</div>
        <h3>Yükleme Hatası</h3>
        <p>${escapeHtmlLocal(err.message || 'Dosya yüklenemedi')}</p>
      </div>`;
    placeholder.hidden = false;
    canvas.hidden = true;
  } finally {
    loadingEl.hidden = true;
  }
}

// Reset view
resetBtn.addEventListener('click', () => {
  if (currentMesh) frameObject(currentMesh);
});

// Wireframe toggle
wireBtn.addEventListener('click', () => {
  setWireframe(!isWireframe);
});

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
  const el = document.querySelector('.parts-viewer-panel');
  if (!document.fullscreenElement) {
    el.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

// React to theme changes
const themeObserver = new MutationObserver(() => {
  if (!renderer) return;
  const c = getThemeColors();
  scene.background = new THREE.Color(c.bg);
  scene.fog = new THREE.Fog(c.fog, 200, 600);
  // Update grid colors
  scene.traverse(obj => {
    if (obj.isGridHelper) {
      scene.remove(obj);
      const newGrid = new THREE.GridHelper(400, 40, c.gridCenter, c.grid);
      newGrid.position.y = -0.01;
      newGrid.material.opacity = 0.5;
      newGrid.material.transparent = true;
      scene.add(newGrid);
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Listen to events from script.js
window.addEventListener('load-part', (e) => {
  loadPart(e.detail);
});
window.addEventListener('clear-viewer', () => {
  showPlaceholder();
});