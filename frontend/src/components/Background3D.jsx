/**
 * Background3D.jsx  ─  HackElite AI · 3D Neural Constellation Engine
 * ════════════════════════════════════════════════════════════════════════════
 * Three.js-powered, hyper-interactive particle universe built for 60+ FPS.
 *
 * ARCHITECTURE
 * ────────────
 *  • Single BufferGeometry particle system (≤6 000 vertices) with custom
 *    ShaderMaterial for per-particle colour, size, and animated glow.
 *  • All physics state stored in raw Float32Arrays — zero GC pressure
 *    inside the animation loop.
 *  • Ref-based mutable scene state so React never re-renders during animation.
 *
 * INTERACTIONS
 * ────────────
 *  1. Mouse Move   → Rotates the constellation + injects a velocity ripple
 *                    into nearby particles (attraction when slow, repulsion
 *                    when fast — mimics fluid dynamics).
 *  2. Click        → Spawns a 3D shockwave sphere that expands from the
 *                    click point, explosively pushes nodes outward, then
 *                    spring-physics snaps them back to their rest positions.
 *  3. Scroll       → Zooms the camera inward / outward (cinematic parallax
 *                    depth-shift) and tilts the constellation on the X axis.
 *  4. Idle drift   → Every particle follows a unique Lissajous-style
 *                    orbital path around its rest position so the mesh
 *                    breathes even with no user input.
 *
 * THEME
 * ─────
 *  • Dark  → void-black void, neon cyan / violet / indigo nodes, electric
 *            edge lines, pulsing soft glow.
 *  • Light → pearl fog, subdued cobalt / slate nodes, hairline graph edges.
 *
 * z-index / stacking: canvas is fixed at z-index 0; pointer-events are
 * enabled so the canvas captures mouse/click events for interactivity, but
 * a transparent overlay above (z-index 1 on .app-container) ensures all UI
 * buttons and links still receive pointer events because the canvas does NOT
 * stop propagation — it only reads coordinates.
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';

// ─── Scene constants ──────────────────────────────────────────────────────────
const PARTICLE_COUNT   = 4200;   // vertices in the constellation
const CONNECT_DIST     = 28;     // world-units threshold for edge lines
const MAX_EDGES        = 8000;   // pre-allocated edge geometry segments
const ORBIT_RADIUS     = 120;    // initial sphere distribution radius
const IDLE_DRIFT_AMP   = 1.8;    // amplitude of breathing drift
const BASE_ROTATION    = 0.0004; // radians / frame baseline rotation

// Mouse physics
const MOUSE_INFLUENCE_R  = 38;   // world-units radius of cursor field
const ATTRACT_FORCE      = 0.012;
const REPEL_FORCE        = 0.08;
const FAST_MOUSE_THRESH  = 18;   // px/frame → switch attract→repel

// Shockwave spring physics
const SHOCKWAVE_RADIUS   = 52;   // world-units push radius
const SHOCKWAVE_FORCE    = 6.8;
const SPRING_K           = 0.045; // spring stiffness
const DAMPING            = 0.88;  // velocity damping per frame

// Scroll camera
const SCROLL_ZOOM_FACTOR = 0.04;
const CAMERA_Z_DEFAULT   = 180;
const CAMERA_Z_MIN       = 80;
const CAMERA_Z_MAX       = 280;

// ─── Colour palettes ─────────────────────────────────────────────────────────
const PALETTES = {
  dark: {
    bg:         0x03050f,
    nodeColors: [0x6366f1, 0x06b6d4, 0xa855f7, 0x10b981, 0xf8fafc],
    edgeColor:  0x334155,
    edgeOpacity: 0.28,
    nodeSizeMin: 1.4,
    nodeSizeMax: 4.2,
    glowIntensity: 1.0,
    fogColor:   0x03050f,
    fogNear:    180, fogFar: 420,
  },
  light: {
    bg:         0xf1f5f9,
    nodeColors: [0x6366f1, 0x0891b2, 0x7c3aed, 0x059669, 0x0f172a],
    edgeColor:  0x94a3b8,
    edgeOpacity: 0.12,
    nodeSizeMin: 1.0,
    nodeSizeMax: 3.0,
    glowIntensity: 0.35,
    fogColor:   0xf1f5f9,
    fogNear:    150, fogFar: 380,
  },
};

// ─── Vertex shader ────────────────────────────────────────────────────────────
const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aGlow;

  varying vec3  vColor;
  varying float vGlow;

  varying float vBoost;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3  uMouse;   // cursor position in world space

  void main() {
    vColor = aColor;
    vGlow  = aGlow;

    // Gentle per-particle twinkle (phase derived from rest position)
    float tw = 0.88 + 0.12 * sin(uTime * 1.6 + dot(position, vec3(0.129, 0.782, 0.377)) * 6.0);
    vGlow *= tw;

    // Cursor "light": nodes near the pointer swell and brighten
    vec3  wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vBoost   = smoothstep(46.0, 0.0, distance(wp, uMouse));

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    // Size attenuates with depth — bigger up close, smaller far away
    gl_PointSize = aSize * tw * (1.0 + vBoost * 0.7) * uPixelRatio * (280.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

// ─── Fragment shader ──────────────────────────────────────────────────────────
const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vGlow;
  varying float vBoost;

  void main() {
    // Soft circular disc with radial alpha fade → looks like a glowing orb
    float d    = length(gl_PointCoord - 0.5) * 2.0; // 0 at centre, 1 at edge
    float alpha = 1.0 - smoothstep(0.2, 1.0, d);
    // Inner bright core
    float core  = 1.0 - smoothstep(0.0, 0.45, d);
    vec3  col   = mix(vColor, vec3(1.0), core * vGlow * 0.7);
    col = mix(col, vec3(1.0), vBoost * 0.35 * core);
    gl_FragColor = vec4(col, min(1.0, alpha * (0.72 + vGlow * 0.28 + vBoost * 0.3)));
  }
`;

// ─── Utility helpers ──────────────────────────────────────────────────────────
const rand   = (a, b) => a + Math.random() * (b - a);
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp   = (a, b, t) => a + (b - a) * t;

function hexToRgbNorm(hex) {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >>  8) & 0xff) / 255,
    ( hex        & 0xff) / 255,
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────
const Background3D = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef({});   // all Three.js objects
  const stateRef = useRef({});   // all physics state
  const { isDark } = useTheme();
  const isDarkRef = useRef(isDark);

  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  // ── Bootstrap Three.js scene ───────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const DPR = Math.min(window.devicePixelRatio, 2);
    const pal = isDarkRef.current ? PALETTES.dark : PALETTES.light;

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H);
    renderer.setClearColor(pal.bg, 1);
    mount.appendChild(renderer.domElement);

    // ── Scene + Camera + Fog
    const scene  = new THREE.Scene();
    scene.fog    = new THREE.Fog(pal.fogColor, pal.fogNear, pal.fogFar);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.5, 600);
    camera.position.set(0, 0, CAMERA_Z_DEFAULT);

    // ── Particle positions, rest positions, velocities (flat Float32Arrays)
    const positions  = new Float32Array(PARTICLE_COUNT * 3);
    const restPos    = new Float32Array(PARTICLE_COUNT * 3); // home positions
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const driftPhase = new Float32Array(PARTICLE_COUNT * 3); // per-axis Lissajous phase
    const driftFreq  = new Float32Array(PARTICLE_COUNT * 3); // per-axis frequency

    const sizes      = new Float32Array(PARTICLE_COUNT);
    const colors     = new Float32Array(PARTICLE_COUNT * 3);
    const glows      = new Float32Array(PARTICLE_COUNT);

    // Distribute particles on a sphere surface + interior cluster
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);
      const r      = Math.cbrt(Math.random()) * ORBIT_RADIUS; // cubic root → uniform sphere

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i*3]   = x;  positions[i*3+1]   = y;  positions[i*3+2]   = z;
      restPos[i*3]     = x;  restPos[i*3+1]     = y;  restPos[i*3+2]     = z;
      velocities[i*3]  = 0;  velocities[i*3+1]  = 0;  velocities[i*3+2]  = 0;

      // Idle drift Lissajous params
      driftPhase[i*3]   = rand(0, Math.PI*2);
      driftPhase[i*3+1] = rand(0, Math.PI*2);
      driftPhase[i*3+2] = rand(0, Math.PI*2);
      driftFreq[i*3]    = rand(0.0008, 0.0022);
      driftFreq[i*3+1]  = rand(0.0006, 0.0018);
      driftFreq[i*3+2]  = rand(0.0010, 0.0025);

      // Size (inner particles slightly larger)
      const normR = r / ORBIT_RADIUS;
      sizes[i] = lerp(pal.nodeSizeMax, pal.nodeSizeMin, normR) + rand(-0.4, 0.4);

      // Color — pick from palette, bias toward accent colours
      const col = pal.nodeColors[Math.floor(Math.random() * pal.nodeColors.length)];
      const rgb = hexToRgbNorm(col);
      colors[i*3] = rgb[0]; colors[i*3+1] = rgb[1]; colors[i*3+2] = rgb[2];

      // Glow — inner core nodes glow more
      glows[i] = pal.glowIntensity * lerp(1.0, 0.25, normR);
    }

    // ── Particle BufferGeometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,     1));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(colors,    3));
    geo.setAttribute('aGlow',    new THREE.BufferAttribute(glows,     1));

    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uPixelRatio: { value: DPR },
        uMouse:      { value: new THREE.Vector3(9999, 9999, 9999) },
      },
      transparent:  true,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Distant starfield (separate depth layer → real parallax)
    const STAR_COUNT = 900;
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const rr = rand(260, 420);
      starPos[i*3]   = rr * Math.sin(ph) * Math.cos(th);
      starPos[i*3+1] = rr * Math.sin(ph) * Math.sin(th);
      starPos[i*3+2] = rr * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color:           isDarkRef.current ? 0x94a3b8 : 0x64748b,
      size:            1.6,
      sizeAttenuation: false,
      transparent:     true,
      opacity:         isDarkRef.current ? 0.55 : 0.28,
      depthWrite:      false,
      fog:             false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Edge / connection lines (pre-allocated LineSegments)
    const edgePositions  = new Float32Array(MAX_EDGES * 6); // 2 verts × 3 floats
    const edgeGeo = new THREE.BufferGeometry();
    const edgePosAttr = new THREE.BufferAttribute(edgePositions, 3);
    edgePosAttr.setUsage(THREE.DynamicDrawUsage);
    edgeGeo.setAttribute('position', edgePosAttr);
    edgeGeo.setDrawRange(0, 0);

    const edgeMat = new THREE.LineBasicMaterial({
      color:       pal.edgeColor,
      opacity:     pal.edgeOpacity,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(lines);

    // ── Shockwave ring geometry (reused per click)
    const shockGeo = new THREE.SphereGeometry(1, 24, 16);
    const shockMat = new THREE.MeshBasicMaterial({
      color:       isDarkRef.current ? 0x06b6d4 : 0x6366f1,
      wireframe:   true,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
    });
    const shockMesh = new THREE.Mesh(shockGeo, shockMat);
    shockMesh.visible = false;
    scene.add(shockMesh);

    // Store everything in sceneRef
    sceneRef.current = {
      renderer, scene, camera, points, lines,
      geo, mat, edgeGeo, edgePosAttr, edgeMat, stars, starGeo, starMat,
      shockMesh, shockMat,
      positions, restPos, velocities, driftPhase, driftFreq,
      sizes, colors, glows,
    };

    // ── Physics state
    stateRef.current = {
      frame: 0,
      mouse3D: new THREE.Vector3(9999, 9999, 9999),     // cursor in world space
      mousePrev: { x: 0, y: 0 },        // previous NDC coords
      mouseVel: 0,                       // cursor speed
      targetRotX: 0, targetRotY: 0,     // constellation rotation target
      currentRotX: 0, currentRotY: 0,
      shockwaves: [],                    // active shockwave events [{origin, age}]
      scrollY: 0,
      targetCamZ: CAMERA_Z_DEFAULT,
      camX: 0, camY: 0, targetCamX: 0, targetCamY: 0,
      reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    };

    // ── Animation loop
    let rafId;
    const raycaster = new THREE.Raycaster();
    const ndcMouse  = new THREE.Vector2();

    function buildEdges(frame) {
      // Spatial-index with a grid cell skip for performance:
      // only connect particles within each cell + 1-cell neighbours.
      // For simplicity we use a capped O(n²) check — still fast at 4200 pts
      // because we skip pairs early (distance² check).
      const { positions: pos, edgePosAttr: attr } = sceneRef.current;
      const distSq = CONNECT_DIST * CONNECT_DIST;
      let eIdx = 0;

      // Subsample for performance: only check every-other particle against all others
      // Gives ~same visual density at half the O(n²) cost.
      const stride = frame % 2 === 0 ? 1 : 2;

      outer: for (let i = 0; i < PARTICLE_COUNT; i += stride) {
        const ax = pos[i*3], ay = pos[i*3+1], az = pos[i*3+2];
        let edgesFromI = 0;

        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = ax - pos[j*3];
          if (dx * dx > distSq) continue;
          const dy = ay - pos[j*3+1];
          if (dy * dy > distSq) continue;
          const dz = az - pos[j*3+2];
          if (dx*dx + dy*dy + dz*dz > distSq) continue;

          // Write line segment
          const b = eIdx * 6;
          attr.array[b]   = ax; attr.array[b+1] = ay; attr.array[b+2] = az;
          attr.array[b+3] = pos[j*3]; attr.array[b+4] = pos[j*3+1]; attr.array[b+5] = pos[j*3+2];
          eIdx++;
          edgesFromI++;

          // Cap connections per particle to keep it readable
          if (edgesFromI >= 4) continue outer;
          if (eIdx >= MAX_EDGES) break outer;
        }
      }

      attr.needsUpdate = true;
      sceneRef.current.edgeGeo.setDrawRange(0, eIdx * 2);
    }

    function tick() {
      rafId = requestAnimationFrame(tick);

      const sc = sceneRef.current;
      const st = stateRef.current;
      if (!sc.renderer || !st) return;

      const { positions: pos, restPos, velocities: vel,
              driftPhase, driftFreq } = sc;
      const { shockwaves } = st;  // shockwaves lives in stateRef, not sceneRef

      st.frame++;
      const t = st.frame;
      sc.mat.uniforms.uTime.value = t * 0.016;

      // ── Smooth constellation rotation (mouse tracking)
      st.currentRotX = lerp(st.currentRotX, st.targetRotX, 0.03);
      st.currentRotY = lerp(st.currentRotY, st.targetRotY, 0.03);

      const spin = st.reduced ? 0 : BASE_ROTATION;
      sc.points.rotation.x = st.currentRotX + t * spin * 0.6;
      sc.points.rotation.y = st.currentRotY + t * spin;
      // Starfield counter-rotates slowly → depth parallax
      sc.stars.rotation.y = -st.currentRotY * 0.35 - t * spin * 0.25;
      sc.stars.rotation.x = -st.currentRotX * 0.35;
      sc.lines.rotation.copy(sc.points.rotation);
      sc.shockMesh.rotation.copy(sc.points.rotation);

      // ── Camera zoom from scroll
      const camZ = sc.camera.position.z;
      sc.camera.position.z = lerp(camZ, st.targetCamZ, 0.05);
      // Subtle cursor parallax on the camera
      st.camX = lerp(st.camX, st.targetCamX, 0.04);
      st.camY = lerp(st.camY, st.targetCamY, 0.04);
      sc.camera.position.x = st.camX;
      sc.camera.position.y = st.camY;
      sc.camera.lookAt(0, 0, 0);
      sc.mat.uniforms.uMouse.value.copy(st.mouse3D);

      // ── Per-particle physics
      const m3 = st.mouse3D;

      // Tick active shockwaves
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        shockwaves[s].age++;
        if (shockwaves[s].age > 80) shockwaves.splice(s, 1);
      }

      // Animate shockwave ring mesh
      if (shockwaves.length > 0) {
        const sw = shockwaves[shockwaves.length - 1];
        const progress = sw.age / 80;
        const scale = SHOCKWAVE_RADIUS * 1.6 * progress;
        sc.shockMesh.scale.setScalar(scale);
        sc.shockMesh.position.copy(sw.origin);
        sc.shockMat.opacity = (1 - progress) * (isDarkRef.current ? 0.65 : 0.35);
        sc.shockMesh.visible = true;
      } else {
        sc.shockMesh.visible = false;
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i*3, iy = i*3+1, iz = i*3+2;

        // Current world position
        const wx = pos[ix], wy = pos[iy], wz = pos[iz];

        // ── Idle Lissajous drift around rest position
        const drift = st.reduced ? IDLE_DRIFT_AMP * 0.25 : IDLE_DRIFT_AMP;
        const driftX = Math.sin(t * driftFreq[ix] + driftPhase[ix]) * drift;
        const driftY = Math.cos(t * driftFreq[iy] + driftPhase[iy]) * drift;
        const driftZ = Math.sin(t * driftFreq[iz] + driftPhase[iz]) * drift * 0.5;

        const homeX = restPos[ix] + driftX;
        const homeY = restPos[iy] + driftY;
        const homeZ = restPos[iz] + driftZ;

        // ── Spring back to rest (home + drift target)
        vel[ix] += (homeX - wx) * SPRING_K;
        vel[iy] += (homeY - wy) * SPRING_K;
        vel[iz] += (homeZ - wz) * SPRING_K;

        // ── Mouse field force (only applied to particles in front half)
        const dx = wx - m3.x, dy = wy - m3.y, dz = wz - m3.z;
        const dSq = dx*dx + dy*dy + dz*dz;
        const rSq = MOUSE_INFLUENCE_R * MOUSE_INFLUENCE_R;
        if (dSq < rSq && dSq > 0.01) {
          const d = Math.sqrt(dSq);
          const falloff = (1 - d / MOUSE_INFLUENCE_R);
          const force = st.mouseVel > FAST_MOUSE_THRESH ? REPEL_FORCE : ATTRACT_FORCE;
          const sign  = st.mouseVel > FAST_MOUSE_THRESH ? 1 : -1; // repel=push away, attract=pull in
          vel[ix] += sign * (dx / d) * force * falloff;
          vel[iy] += sign * (dy / d) * force * falloff;
          vel[iz] += sign * (dz / d) * force * falloff * 0.3;
        }

        // ── Active shockwave impulses
        for (const sw of shockwaves) {
          if (sw.age > 25) continue; // impulse only in first 25 frames
          const ox = wx - sw.origin.x, oy = wy - sw.origin.y, oz = wz - sw.origin.z;
          const od = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
          if (od < SHOCKWAVE_RADIUS) {
            const wave = (1 - od / SHOCKWAVE_RADIUS) * SHOCKWAVE_FORCE;
            vel[ix] += (ox / od) * wave;
            vel[iy] += (oy / od) * wave;
            vel[iz] += (oz / od) * wave * 0.4;
          }
        }

        // ── Damping + integrate
        vel[ix] *= DAMPING;
        vel[iy] *= DAMPING;
        vel[iz] *= DAMPING;

        pos[ix] = wx + vel[ix];
        pos[iy] = wy + vel[iy];
        pos[iz] = wz + vel[iz];
      }

      sc.geo.attributes.position.needsUpdate = true;

      // Rebuild edges every 3 frames (performance budget)
      if (t % 3 === 0) buildEdges(t);

      sc.renderer.render(sc.scene, sc.camera);
    }

    tick();

    // ── Event handlers ─────────────────────────────────────────────────────
    const onMouseMove = (e) => {
      const st = stateRef.current;
      const sc = sceneRef.current;
      if (!st || !sc.camera) return;

      const ndcX = (e.clientX / window.innerWidth)  * 2 - 1;
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;

      // Cursor speed
      const dx = e.clientX - st.mousePrev.x;
      const dy = e.clientY - st.mousePrev.y;
      st.mouseVel = Math.sqrt(dx*dx + dy*dy);
      st.mousePrev.x = e.clientX;
      st.mousePrev.y = e.clientY;

      // Update rotation targets (tilt constellation toward cursor)
      st.targetRotY = ndcX * 0.45;
      st.targetRotX = -ndcY * 0.25;
      st.targetCamX = ndcX * 7;
      st.targetCamY = ndcY * 4.5;

      // Project cursor to world-space at z=0 plane (constellation centre)
      ndcMouse.set(ndcX, ndcY);
      raycaster.setFromCamera(ndcMouse, sc.camera);
      const target = new THREE.Vector3();
      raycaster.ray.at(sc.camera.position.z, target);
      st.mouse3D.copy(target);
    };

    const onClick = (e) => {
      const st = stateRef.current;
      const sc = sceneRef.current;
      if (!st || !sc.camera) return;

      const ndcX = (e.clientX / window.innerWidth)  * 2 - 1;
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;

      ndcMouse.set(ndcX, ndcY);
      raycaster.setFromCamera(ndcMouse, sc.camera);

      // Spawn shockwave at a z-depth of 0 in world space
      const origin = new THREE.Vector3();
      raycaster.ray.at(sc.camera.position.z * 0.6, origin);

      // Transform origin from world-space into points local-space
      // (so shockwave aligns with the rotating constellation)
      const invMat = new THREE.Matrix4().copy(sc.points.matrixWorld).invert();
      origin.applyMatrix4(invMat);

      st.shockwaves.push({ origin: origin.clone(), age: 0 });
    };

    const onScroll = () => {
      const st = stateRef.current;
      if (!st) return;
      const sy = window.scrollY;
      st.scrollY = sy;
      // Zoom camera in as user scrolls down
      st.targetCamZ = clamp(
        CAMERA_Z_DEFAULT - sy * SCROLL_ZOOM_FACTOR,
        CAMERA_Z_MIN, CAMERA_Z_MAX,
      );
    };

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const sc = sceneRef.current;
        if (!sc.renderer || !sc.camera) return;
        const W2 = window.innerWidth, H2 = window.innerHeight;
        sc.renderer.setSize(W2, H2);
        sc.camera.aspect = W2 / H2;
        sc.camera.updateProjectionMatrix();
      }, 100);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('click',     onClick);
    window.addEventListener('scroll',    onScroll,    { passive: true });
    window.addEventListener('resize',    onResize);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click',     onClick);
      window.removeEventListener('scroll',    onScroll);
      window.removeEventListener('resize',    onResize);
      clearTimeout(resizeTimer);

      const sc = sceneRef.current;
      if (sc.renderer) {
        sc.renderer.dispose();
        sc.geo?.dispose();
        sc.mat?.dispose();
        sc.edgeGeo?.dispose();
        sc.edgeMat?.dispose();
        sc.starGeo?.dispose();
        sc.starMat?.dispose();
        sc.shockGeo?.dispose();
        sc.shockMat?.dispose();
        if (mount && sc.renderer.domElement.parentNode === mount) {
          mount.removeChild(sc.renderer.domElement);
        }
      }
      sceneRef.current = {};
      stateRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once on mount; theme handled separately below

  // ── Live theme swap — update renderer bg + material colours ───────────────
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc.renderer) return;

    const pal = isDark ? PALETTES.dark : PALETTES.light;
    sc.renderer.setClearColor(pal.bg, 1);
    sc.scene.fog.color.set(pal.fogColor);
    sc.scene.fog.near  = pal.fogNear;
    sc.scene.fog.far   = pal.fogFar;
    sc.edgeMat.color.set(pal.edgeColor);
    sc.edgeMat.opacity = pal.edgeOpacity;
    sc.shockMat.color.set(isDark ? 0x06b6d4 : 0x6366f1);
    sc.starMat.color.set(isDark ? 0x94a3b8 : 0x64748b);
    sc.starMat.opacity = isDark ? 0.55 : 0.28;

    // Re-randomise node colours with new palette
    const { colors, glows, positions } = sc;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const col = pal.nodeColors[Math.floor(Math.random() * pal.nodeColors.length)];
      const rgb = hexToRgbNorm(col);
      colors[i*3] = rgb[0]; colors[i*3+1] = rgb[1]; colors[i*3+2] = rgb[2];

      const r = Math.sqrt(
        positions[i*3]**2 + positions[i*3+1]**2 + positions[i*3+2]**2,
      ) / ORBIT_RADIUS;
      glows[i] = pal.glowIntensity * lerp(1.0, 0.25, clamp(r, 0, 1));
    }
    sc.geo.attributes.aColor.needsUpdate = true;
    sc.geo.attributes.aGlow.needsUpdate  = true;
  }, [isDark]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        0,
        pointerEvents: 'none',   // pass all clicks through to UI
        overflow:      'hidden',
      }}
    />
  );
};

export default Background3D;
