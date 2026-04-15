import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import vShader from './shaders/vertex.glsl?raw';
import fShader from './shaders/fragment.glsl?raw';

const text = document.getElementById("text");
const background = document.getElementById("background");
const loader = document.getElementById("loader");

// ==================== CONFIG ====================
const shapeNames = [
  "Sphere", "Torus", "Cube", "Torus Knot",
  "Cylinder", "Icosahedron", "Octahedron", "Liquid Blob"
];

const shapeColors = [
  ["#00d4ff", "#0088ff", "#00ffd5"], // cyan / blue / aqua (Sphere)
  ["#ff2e63", "#ff006a", "#ff7a18"], // pink / red / orange (Torus)
  ["#ffd600", "#ffb300", "#ff6f00"], // yellow / amber / orange (Cube)
  ["#FF5A57", "#E02F75", "#6700A3"], // purple / violet (Knot)
  ["#0033FF", "#0600AB", "#00033D"], // teal / blue (Cylinder)
  ["#ff6bcb", "#ff3d81", "#7c4dff"], // pink / violet (Icosahedron)
  ["#8e7cff", "#4facfe", "#00f2fe"], // blue/purple/cyan (Octahedron)
  ["#E3EF26", "#076653", "#0C342C"]  // aqua / ocean blue (Blob)
];

const bgGlowColors = [
  "rgba(0, 15, 30, 0.95)",   // deep ocean
  "rgba(35, 0, 15, 0.95)",   // dark magenta
  "rgba(35, 25, 0, 0.95)",   // dark amber
  "rgba(15, 0, 35, 0.95)",   // deep purple
  "rgba(0, 25, 25, 0.95)",   // dark teal
  "rgba(35, 5, 25, 0.95)",   // pinkish dark
  "rgba(5, 10, 40, 0.95)",   // deep indigo
  "rgba(0, 25, 30, 0.95)"    // cyan dark
];

// ==================== THREE.JS SETUP ====================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000510, 0.08); // Underwater depth

const baseGeometry = new THREE.SphereGeometry(1, 128, 128);
const vertexCount = baseGeometry.attributes.position.count;

const targetPositions = [];

function createTargetGeometry(type) {
  let geo;
  switch (type) {
    case 0: geo = new THREE.SphereGeometry(1.35, 128, 128); break;
    case 1: geo = new THREE.TorusGeometry(1.25, 0.45, 64, 128); break;
    case 2: geo = new THREE.BoxGeometry(2.1, 2.1, 2.1, 64, 64, 64); break;
    case 3: geo = new THREE.TorusKnotGeometry(1.1, 0.35, 128, 32, 2, 3); break;
    case 4: geo = new THREE.CylinderGeometry(1.1, 1.4, 2.6, 128, 64); break;
    case 5: geo = new THREE.IcosahedronGeometry(1.5, 6); break;
    case 6: geo = new THREE.OctahedronGeometry(1.6, 5); break;
    case 7: 
      geo = new THREE.SphereGeometry(1.42, 128, 128);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const noise = Math.sin(x*4) * Math.cos(y*4) * Math.sin(z*3) * 0.28;
        pos.setXYZ(i, x + noise, y + noise, z + noise);
      }
      pos.needsUpdate = true;
      break;
  }

  // Ensure vertex count matches 128x128 sphere
  if (geo.attributes.position.count !== vertexCount) {
    const sampled = new Float32Array(vertexCount * 3);
    const srcPos = geo.attributes.position.array;
    const srcLen = geo.attributes.position.count;
    for (let i = 0; i < vertexCount; i++) {
      const t = i / (vertexCount - 1);
      const idx = Math.floor(t * (srcLen - 1)) * 3;
      sampled[i*3] = srcPos[idx];
      sampled[i*3+1] = srcPos[idx+1];
      sampled[i*3+2] = srcPos[idx+2];
    }
    return new THREE.BufferAttribute(sampled, 3);
  }
  return geo.attributes.position.clone();
}

for (let i = 0; i < 8; i++) {
  targetPositions.push(createTargetGeometry(i));
}

const geometry = baseGeometry.clone();
geometry.setAttribute('a_shapeCurrent', targetPositions[0].clone());
geometry.setAttribute('a_shapeNext', targetPositions[1].clone());

const material = new THREE.RawShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: vShader,
  fragmentShader: fShader,
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 }, // Used for shape morph
    uVortex: { value: 0 },   // Used for transition spin distortion
    uChaos: { value: 0 },    // Used for extra liquid noise during transition
    uColorA: { value: new THREE.Color(shapeColors[0][0]) },
    uColorB: { value: new THREE.Color(shapeColors[0][1]) },
    uColorC: { value: new THREE.Color(shapeColors[0][2]) }
  }
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.set(1.15, 1.15, 1.15);
scene.add(mesh);

// PARTICLE SYSTEM (Shining Stars)
const starCanvas = document.createElement('canvas');
starCanvas.width = 64;
starCanvas.height = 64;
const starCtx = starCanvas.getContext('2d');

// Create a glowing star gradient
const starGradient = starCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
starGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
starGradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
starGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
starGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

starCtx.fillStyle = starGradient;
starCtx.beginPath();
starCtx.arc(32, 32, 32, 0, Math.PI * 2);
starCtx.fill();

const starTexture = new THREE.CanvasTexture(starCanvas);

const particleGeo = new THREE.BufferGeometry();
const particleCount = 400;
const particlePos = new Float32Array(particleCount * 3);
// Provide a random size for each star to make it twinkle better
const particleSizes = new Float32Array(particleCount);
for(let i=0; i<particleCount*3; i++) {
  particlePos[i] = (Math.random() - 0.5) * 15;
}
for(let i=0; i<particleCount; i++) {
  particleSizes[i] = Math.random();
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
particleGeo.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));

// Use standard PointsMaterial with our texture map
const particleMat = new THREE.PointsMaterial({
  size: 0.25,
  map: starTexture,
  color: 0xffffff,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// CAMERA
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 4.2;

const canvas = document.getElementById("canvas") || document.querySelector(".draw");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableZoom = false;

// ==================== SCROLL SYSTEM ====================
const totalShapes = 8;
let virtualScroll = 0;
let scrollVelocity = 0;
let baseSpinAccumulator = 0;

// Intercept scroll using wheel and touch instead of native DOM scrolling
window.addEventListener('wheel', (e) => {
  scrollVelocity += e.deltaY * 0.0006;
}, { passive: true });

let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  let dy = touchStartY - e.touches[0].clientY;
  scrollVelocity += dy * 0.003;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

// UI Sync
let currentUIIndex = 0;
text.innerHTML = shapeNames[0];
text.style.setProperty('--text-color', shapeColors[0][0]);
background.style.background = bgGlowColors[0];

function updateUIAndColors(targetSection) {
  if (targetSection !== currentUIIndex) {
    currentUIIndex = targetSection;

    // Exit animation
    text.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease";
    text.style.transform = "translateX(-120px)";
    text.style.opacity = "0";

    // Set colors immediately on transition peak for visual impact
    material.uniforms.uColorA.value.set(shapeColors[currentUIIndex][0]);
    material.uniforms.uColorB.value.set(shapeColors[currentUIIndex][1]);
    material.uniforms.uColorC.value.set(shapeColors[currentUIIndex][2]);

    setTimeout(() => {
      text.innerHTML = shapeNames[currentUIIndex];
      text.style.setProperty('--text-color', shapeColors[currentUIIndex][0]);
      background.style.background = bgGlowColors[currentUIIndex];

      text.style.transition = "none";
      text.style.transform = "translateX(120px)";
      text.style.opacity = "0";

      void text.offsetWidth; // force reflow

      text.style.transition = "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease";
      text.style.transform = "translateX(0)";
      text.style.opacity = "0.95";
    }, 400); // Trigger in the middle of vortex
  }
}

let lastBaseIndex = -1;

function updateGeometryBuffers(baseIdx, nextIdx) {
  if (lastBaseIndex !== baseIdx) {
    geometry.attributes.a_shapeCurrent.copyArray(targetPositions[baseIdx].array);
    geometry.attributes.a_shapeNext.copyArray(targetPositions[nextIdx].array);
    geometry.attributes.a_shapeCurrent.needsUpdate = true;
    geometry.attributes.a_shapeNext.needsUpdate = true;
    lastBaseIndex = baseIdx;
  }
}

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Scroll dynamics
  virtualScroll += scrollVelocity;
  scrollVelocity *= 0.88; // Dampening
  
  if (virtualScroll < 0) virtualScroll += totalShapes * 1000;
  virtualScroll = virtualScroll % totalShapes; // 0 to 8

  const baseIndex = Math.floor(virtualScroll);
  const nextIndex = (baseIndex + 1) % totalShapes;
  const decimal = virtualScroll % 1; // 0.0 to 1.0

  // Upload buffers if phase changes
  updateGeometryBuffers(baseIndex, nextIndex);

  // Transition Map Math
  let vortexIntensity = 0;
  let morphProgress = 0;

  // Window map: 0.15 to 0.85
  if (decimal > 0.15 && decimal < 0.85) {
    let t = (decimal - 0.15) / 0.7; // mapped 0 to 1
    // Smooth bell curve for vortex intensity
    vortexIntensity = Math.sin(t * Math.PI);
    vortexIntensity = Math.pow(vortexIntensity, 1.5); // Sharpens peak
  }
  
  // Morph happens fully within the peak of the vortex (0.35 to 0.65)
  morphProgress = THREE.MathUtils.clamp((decimal - 0.35) / 0.3, 0.0, 1.0);
  morphProgress = THREE.MathUtils.smoothstep(morphProgress, 0, 1);

  // Sync UI based on which shape is mostly visible
  const dominantShape = decimal < 0.5 ? baseIndex : nextIndex;
  updateUIAndColors(dominantShape);

  // Spin speeds
  const calmSpinSpeed = 0.08;
  const transitionSpinSpeed = 10.0; // Fast vortex spin
  const currentSpinSpeed = calmSpinSpeed + (transitionSpinSpeed * vortexIntensity);

  baseSpinAccumulator += currentSpinSpeed * 0.016; // Roughly 60fps delta

  // Apply to Shader
  material.uniforms.uTime.value = time;
  material.uniforms.uProgress.value = morphProgress;
  material.uniforms.uVortex.value = vortexIntensity;
  material.uniforms.uChaos.value = vortexIntensity;

  // Apply visual rotation to the mesh
  mesh.rotation.y = baseSpinAccumulator;
  mesh.rotation.z = Math.sin(time * 0.5) * 0.05; // Base passive wobble

  // Particle gentle motion
  particles.rotation.y = time * 0.04 - (virtualScroll * 0.2);
  particles.position.y = Math.sin(time*0.5) * 0.2;

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Loading
window.addEventListener('load', () => {
  setTimeout(() => {
    if(loader) loader.style.opacity = '0';
    setTimeout(() => { if(loader) loader.style.display = 'none'; }, 1200);
  }, 800);
});