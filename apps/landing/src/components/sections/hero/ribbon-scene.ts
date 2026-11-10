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

const ribbonWidth = 5.4;
const maximumTwist = Math.acos(0.75);

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
  varying vec2 ribbonUv;
  varying vec3 ribbonNormal;

  void main() {
    vec3 normal = normalize(ribbonNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float light = abs(dot(normal, normalize(vec3(-0.3, 0.6, 1.0))));
    float originalBandUv = (ribbonUv.y - 0.5) * 3.0 + 0.5;
    float gradient = 0.5 + 0.5 * sin(ribbonUv.x * 12.0 + originalBandUv * 1.8);
    vec3 color = mix(primary, secondary, gradient) * (0.8 + light * 0.2);
    color += vec3(pow(light, 16.0) * 0.08);

    // The original middle third is opaque; only the added outer thirds fade.
    float edgeAlpha = 1.0 - smoothstep(1.0 / 6.0, 0.5, abs(ribbonUv.y - 0.5));
    gl_FragColor = vec4(color, edgeAlpha);
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
  }
`;

const createRibbonScene = (canvas: HTMLCanvasElement, onReady: () => void): (() => void) => {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  const scene = new Scene();
  const camera = new OrthographicCamera(-12, 12, 4, -4, 0.1, 40);
  const geometry = new PlaneGeometry(1, 1, 192, 18);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const normals = geometry.getAttribute("normal") as BufferAttribute;
  const uv = geometry.getAttribute("uv");
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
    material.uniforms.noiseStrength.value = 1;
    syncPlayback();
  });
  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      primary: { value: new Color(theme.getPropertyValue("--color-primary").trim() || "#ff3617") },
      secondary: {
        value: new Color(theme.getPropertyValue("--color-secondary").trim() || "#f88f52")
      },
      noiseMap: { value: noise },
      noiseStrength: { value: 0 },
      noiseTileSize: { value: Number.parseFloat(theme.fontSize) * 6 },
      pixelRatio: { value: 1 }
    },
    vertexShader,
    fragmentShader
  });
  const mesh = new Mesh(geometry, material);

  let span = 24;
  let elapsed = 0;
  let lastFrame = 0;
  let frame = 0;
  let visible = true;
  let disposed = false;
  let noiseLoaded = false;
  let hasSize = false;
  let ready = false;

  // Reuse the strip's vertex buffers. The width rotates around its local tangent
  // with a traveling twist, rather than rotating a flat picture as a whole.
  const updateGeometry = (): void => {
    for (let index = 0; index < positions.count; index++) {
      const u = uv.getX(index);
      const offset = (uv.getY(index) - 0.5) * ribbonWidth;
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
      const baseY = Math.sin(wave) * 1.3;
      const endpointHalfWidthX = Math.abs(widthDirection.x) * ribbonWidth * 0.5;
      const endpointHalfWidthY = Math.abs(widthDirection.y) * ribbonWidth * 0.5;
      const centerX = baseX + (camera.right - endpointHalfWidthX - baseX) * endpointAnchor;
      const centerY = baseY + (camera.top - endpointHalfWidthY - baseY) * endpointAnchor;
      positions.setXYZ(
        index,
        centerX + widthDirection.x * offset,
        centerY + widthDirection.y * offset,
        Math.cos(depth) * 0.7 + widthDirection.z * offset
      );
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  const render = (): void => {
    if (disposed || !noiseLoaded || !hasSize) return;

    updateGeometry();
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

    camera.left = (-4 * width) / height;
    camera.right = (4 * width) / height;
    camera.updateProjectionMatrix();
    span = Math.max(24, (camera.right - camera.left) * 1.2);
    material.uniforms.pixelRatio.value = pixelRatio;
    material.uniforms.noiseTileSize.value = Number.parseFloat(theme.fontSize) * 6;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    syncPlayback();
  };
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  });

  positions.setUsage(DynamicDrawUsage);
  normals.setUsage(DynamicDrawUsage);
  noise.wrapS = RepeatWrapping;
  noise.wrapT = RepeatWrapping;
  // Mipmaps average this high-frequency texture to gray and erase the overlay.
  noise.generateMipmaps = false;
  noise.minFilter = LinearFilter;
  noise.magFilter = LinearFilter;
  camera.position.z = 12;
  // The animated vertices extend beyond the original plane's bounds.
  mesh.frustumCulled = false;
  scene.add(mesh);
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
    geometry.dispose();
    material.dispose();
    noise.dispose();
    renderer.dispose();
  };
};

export { createRibbonScene };
