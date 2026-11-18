import {
  type BufferAttribute,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  WebGLRenderer
} from "three";

const ribbonWidth = 7.2;
const maximumTwist = Math.acos(0.75);
const halfHeight = 7.5;
const segments = 192;
// Separate strands enter on the left, merge into one ribbon, and split again, less, on the right.
const strandCount = 4;
const mergeStart = 0.08;
const mergeEnd = 0.42;
const splitStart = 0.62;
const splitEnd = 0.9;
const splitStrength = 0.6;
const strandSpread = 0.9;

// Light follows the mesh normals, so turning folds change the surface shading.
const vertexShader = `
  varying vec2 ribbonUv;
  varying vec3 ribbonNormal;

  void main() {
    ribbonUv = uv;
    ribbonNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  uniform vec3 primary;
  uniform vec3 secondary;
  uniform sampler2D noiseMap;
  uniform float noiseStrength;
  uniform float noiseTileSize;
  uniform float pixelRatio;
  uniform float bandStart;
  uniform float bandSize;
  uniform float mergeStart;
  uniform float mergeEnd;
  uniform float splitStart;
  uniform float splitEnd;
  uniform float splitStrength;
  uniform float fill;
  varying vec2 ribbonUv;
  varying vec3 ribbonNormal;

  void main() {
    vec3 normal = normalize(ribbonNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float light = abs(dot(normal, normalize(vec3(-0.3, 0.6, 1.0))));
    float merge =
      smoothstep(mergeStart, mergeEnd, ribbonUv.x) -
      splitStrength * smoothstep(splitStart, splitEnd, ribbonUv.x);
    float bandUv = bandStart + ribbonUv.y * bandSize;
    float originalBandUv = (bandUv - 0.5) * 3.0 + 0.5;
    float gradient = 0.5 + 0.5 * sin(ribbonUv.x * 12.0 + originalBandUv * 1.8);
    vec3 color = mix(primary, secondary, gradient) * (0.8 + light * 0.2);
    color += vec3(pow(light, 16.0) * 0.08);

    // Strands and the merged ribbon both keep an opaque middle third and fade their outer thirds.
    float strandAlpha = 1.0 - smoothstep(1.0 / 6.0, 0.5, abs(ribbonUv.y - 0.5));
    float mergedAlpha = 1.0 - smoothstep(1.0 / 6.0, 0.5, abs(bandUv - 0.5));
    float alpha = mix(strandAlpha, mergedAlpha, merge);
    // The fill layer spans all strands and fills the gaps between them, lighter where they part.
    float fillAlpha = mergedAlpha * (1.0 - 0.4 * (1.0 - merge));
    gl_FragColor = vec4(color, mix(alpha, fillAlpha, fill));
    #include <colorspace_fragment>

    // Match the auth card's CSS overlay in display color space, at a fixed grain size.
    vec4 grain = texture2D(noiseMap, gl_FragCoord.xy / (pixelRatio * noiseTileSize));
    vec3 base = gl_FragColor.rgb;
    vec3 overlay = mix(
      2.0 * base * grain.rgb,
      1.0 - 2.0 * (1.0 - base) * (1.0 - grain.rgb),
      step(vec3(0.5), base)
    );
    gl_FragColor.rgb = mix(base, overlay, grain.a * noiseStrength);
    // Premultiplied, so overlapping faded edges never turn lighter than the page.
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

  return progress * progress * (3 - 2 * progress);
};

// 1 where strands are fully apart, 0 where they form one ribbon.
const getSeparation = (u: number): number => {
  return (
    1 - smoothstep(mergeStart, mergeEnd, u) + splitStrength * smoothstep(splitStart, splitEnd, u)
  );
};

const createRibbonScene = (canvas: HTMLCanvasElement, onReady: () => void): (() => void) => {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  const scene = new Scene();
  const camera = new OrthographicCamera(-12, 12, halfHeight, -halfHeight, 0.1, 40);
  const centers = new Float32Array((segments + 1) * 3);
  const widthDirections = new Float32Array((segments + 1) * 3);
  const tangent = new Vector3();
  const normal = new Vector3();
  const binormal = new Vector3();
  const widthDirection = new Vector3();
  const theme = getComputedStyle(document.documentElement);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const noise = new TextureLoader().load("/assets/noise.png", () => {
    if (disposed) {
      noise.dispose();
      return;
    }

    noiseLoaded = true;
    uniforms.noiseStrength.value = 1;
    syncPlayback();
  });
  // Shared uniform objects, so one update reaches every strand's material.
  const uniforms = {
    primary: { value: new Color(theme.getPropertyValue("--color-primary").trim() || "#ff3617") },
    secondary: {
      value: new Color(theme.getPropertyValue("--color-secondary").trim() || "#f88f52")
    },
    noiseMap: { value: noise },
    noiseStrength: { value: 0 },
    noiseTileSize: { value: Number.parseFloat(theme.fontSize) * 6 },
    pixelRatio: { value: 1 },
    mergeStart: { value: mergeStart },
    mergeEnd: { value: mergeEnd },
    splitStart: { value: splitStart },
    splitEnd: { value: splitEnd },
    splitStrength: { value: splitStrength }
  };
  // Index -1 is the full-width fill layer, drawn under the strands.
  const strands = Array.from({ length: strandCount + 1 }, (_, layer) => {
    const strand = layer - 1;
    const isFill = strand === -1;
    const geometry = new PlaneGeometry(1, 1, segments, isFill ? 18 : 6);
    const material = new ShaderMaterial({
      side: DoubleSide,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      uniforms: {
        ...uniforms,
        bandStart: { value: isFill ? 0 : strand / strandCount },
        bandSize: { value: isFill ? 1 : 1 / strandCount },
        fill: { value: isFill ? 1 : 0 }
      },
      vertexShader,
      fragmentShader
    });
    const mesh = new Mesh(geometry, material);

    mesh.renderOrder = layer;

    return { strand, isFill, geometry, material, mesh };
  });

  let span = 24;
  let elapsed = 0;
  let lastFrame = 0;
  let frame = 0;
  let visible = true;
  let disposed = false;
  let noiseLoaded = false;
  let hasSize = false;
  let ready = false;

  // The merged ribbon's centerline and width direction for each column, shared by all strands.
  // The width rotates around its local tangent with a traveling twist.
  const updatePath = (): void => {
    for (let column = 0; column <= segments; column++) {
      const u = column / segments;
      const merge = 1 - getSeparation(u);
      const phase = (u - 0.5) * Math.PI * 2;
      const wave = phase + elapsed * 0.12;
      const depth = phase * 0.7 - elapsed * 0.1;
      // Retain 75% of the untwisted width at the tightest fold, up from 50%.
      const twist =
        Math.sin(phase * 1.2 + elapsed * 0.3 + Math.sin(phase - elapsed * 0.55) * 0.7) *
        maximumTwist;

      tangent
        .set(span, 1.3 * Math.PI * 2 * Math.cos(wave), -0.7 * Math.PI * 1.4 * Math.sin(depth))
        .normalize();
      normal.set(-tangent.y, tangent.x, 0).normalize();
      binormal.crossVectors(tangent, normal).normalize();
      widthDirection
        .copy(normal)
        .multiplyScalar(Math.cos(twist))
        .addScaledVector(binormal, Math.sin(twist));
      // Ease the full-width endpoint into the top-right canvas boundary.
      const endpointProgress = Math.max(0, (u - 0.8) / 0.2);
      const endpointAnchor = endpointProgress * endpointProgress * (3 - 2 * endpointProgress);
      const baseX = (u - 0.5) * span;
      // Separate strands wave less, so they stay inside the canvas.
      const baseY = Math.sin(wave) * 1.3 * (0.4 + 0.6 * merge);
      const endpointHalfWidthX = Math.abs(widthDirection.x) * ribbonWidth * 0.5;
      const endpointHalfWidthY = Math.abs(widthDirection.y) * ribbonWidth * 0.5;
      const centerX = baseX + (camera.right - endpointHalfWidthX - baseX) * endpointAnchor;
      const centerY = baseY + (camera.top - endpointHalfWidthY - baseY) * endpointAnchor;
      centers.set([centerX, centerY, Math.cos(depth) * 0.7], column * 3);
      widthDirections.set([widthDirection.x, widthDirection.y, widthDirection.z], column * 3);
    }
  };
  const updateStrands = (): void => {
    for (const { strand, isFill, geometry } of strands) {
      const positions = geometry.getAttribute("position") as BufferAttribute;
      const uv = geometry.getAttribute("uv");
      const slot = isFill ? 0 : (strand + 0.5) / strandCount - 0.5;

      for (let index = 0; index < positions.count; index++) {
        const column = index % (segments + 1);
        const separation = getSeparation(column / segments);
        // Separate strands are wider than their slot, so their faded edges overlap into soft gaps.
        const width = isFill
          ? ribbonWidth * (1 + separation * 0.6)
          : (ribbonWidth / strandCount) * (1 + separation * 0.8);
        const offset = slot * ribbonWidth + (uv.getY(index) - 0.5) * width;
        const drift = isFill
          ? 0
          : slot * strandCount * strandSpread +
            Math.sin(elapsed * 0.4 + column * 0.03 + strand) * 0.3;

        positions.setXYZ(
          index,
          centers[column * 3] + widthDirections[column * 3] * offset,
          centers[column * 3 + 1] + widthDirections[column * 3 + 1] * offset + drift * separation,
          centers[column * 3 + 2] + widthDirections[column * 3 + 2] * offset
        );
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  };
  const render = (): void => {
    if (disposed || !noiseLoaded || !hasSize) return;

    updatePath();
    updateStrands();
    renderer.render(scene, camera);

    // Reveal only after a full-size frame includes the uploaded noise texture.
    if (!ready) {
      ready = true;
      onReady();
    }
  };
  const animate = (timestamp: number): void => {
    frame = requestAnimationFrame(animate);

    if (timestamp - lastFrame < 1000 / 30) return;

    elapsed += lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.1) : 0;
    lastFrame = timestamp;
    render();
  };
  const syncPlayback = (): void => {
    const canAnimate =
      !disposed && noiseLoaded && hasSize && !motion.matches && visible && !document.hidden;

    cancelAnimationFrame(frame);
    lastFrame = 0;
    render();

    if (canAnimate) {
      frame = requestAnimationFrame(animate);
    }
  };
  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);

    hasSize = width > 0 && height > 0;

    if (!hasSize) {
      syncPlayback();
      return;
    }

    camera.left = (-halfHeight * width) / height;
    camera.right = (halfHeight * width) / height;
    camera.updateProjectionMatrix();
    span = Math.max(24, (camera.right - camera.left) * 1.2);
    uniforms.pixelRatio.value = pixelRatio;
    uniforms.noiseTileSize.value = Number.parseFloat(theme.fontSize) * 6;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    syncPlayback();
  };
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  });

  noise.wrapS = RepeatWrapping;
  noise.wrapT = RepeatWrapping;
  // Mipmaps average this high-frequency texture to gray and erase the overlay.
  noise.generateMipmaps = false;
  noise.minFilter = LinearFilter;
  noise.magFilter = LinearFilter;
  camera.position.z = 12;
  for (const { geometry, mesh } of strands) {
    (geometry.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage);
    (geometry.getAttribute("normal") as BufferAttribute).setUsage(DynamicDrawUsage);
    // The animated vertices extend beyond the original plane's bounds.
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  renderer.setClearColor(0x000000, 0);
  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  motion.addEventListener("change", syncPlayback);
  document.addEventListener("visibilitychange", syncPlayback);
  resize();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    motion.removeEventListener("change", syncPlayback);
    document.removeEventListener("visibilitychange", syncPlayback);
    strands.forEach(({ geometry, material }) => {
      geometry.dispose();
      material.dispose();
    });
    noise.dispose();
    renderer.dispose();
  };
};

export { createRibbonScene };
