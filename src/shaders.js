/**
 * src/shaders.js
 * All custom GLSL shaders used throughout the game.
 */

// ─── Terrain Shader ───────────────────────────────────────────────────────────
export const TerrainShader = {
  uniforms: {
    uTime      : { value: 0 },
    uFogColor  : { value: null },   // THREE.Color
    uFogDensity: { value: 0.008 },
    uSunDir    : { value: null },   // THREE.Vector3
    uSunColor  : { value: null },   // THREE.Color
    // biome blend weights uploaded per-chunk
    uBiomeWeights: { value: null }, // Float32Array[5]
  },

  vertexShader: /* glsl */`
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;
    varying float vSlope;

    void main() {
      vec4 worldPos  = modelMatrix * vec4(position, 1.0);
      vWorldPos      = worldPos.xyz;
      vNormal        = normalize(normalMatrix * normal);
      vHeight        = position.y;
      // slope = how horizontal the normal is (0=cliff, 1=flat)
      vSlope         = dot(vNormal, vec3(0.0,1.0,0.0));
      gl_Position    = projectionMatrix * viewMatrix * worldPos;
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;

    uniform float   uTime;
    uniform vec3    uFogColor;
    uniform float   uFogDensity;
    uniform vec3    uSunDir;
    uniform vec3    uSunColor;
    uniform float   uBiomeWeights[5];

    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;
    varying float vSlope;

    // ── Biome base colours (low / mid / high) ──
    // 0 Magitech Ruins
    vec3 biome0(float h) {
      return mix(vec3(0.36,0.29,0.19), mix(vec3(0.47,0.38,0.25),vec3(0.62,0.56,0.38),h),smoothstep(0.0,0.5,h));
    }
    // 1 Crystal Vaults
    vec3 biome1(float h) {
      return mix(vec3(0.05,0.12,0.24), mix(vec3(0.10,0.20,0.38),vec3(0.16,0.31,0.54),h),smoothstep(0.0,0.5,h));
    }
    // 2 Tech Wasteland
    vec3 biome2(float h) {
      return mix(vec3(0.23,0.15,0.06), mix(vec3(0.35,0.23,0.09),vec3(0.54,0.37,0.14),h),smoothstep(0.0,0.5,h));
    }
    // 3 Corrupted Forest
    vec3 biome3(float h) {
      return mix(vec3(0.05,0.10,0.03), mix(vec3(0.08,0.16,0.06),vec3(0.12,0.23,0.09),h),smoothstep(0.0,0.5,h));
    }
    // 4 Floating Isles
    vec3 biome4(float h) {
      return mix(vec3(0.75,0.85,0.94), mix(vec3(0.66,0.78,0.91),vec3(0.56,0.72,0.87),h),smoothstep(0.0,0.5,h));
    }

    // ── Cheap procedural detail noise ──
    float hash(vec2 p) {
      return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
    }
    float valueNoise(vec2 p) {
      vec2 i=floor(p); vec2 f=fract(p);
      f=f*f*(3.0-2.0*f);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
    }

    void main() {
      // Normalised height for gradient
      float h = clamp(vHeight / 35.0, 0.0, 1.0);

      // Base biome colour
      vec3 col = vec3(0.0);
      float total = 0.0;
      for(int i=0;i<5;i++) total += uBiomeWeights[i];
      if(total < 0.001) total = 1.0;
      col += biome0(h) * uBiomeWeights[0];
      col += biome1(h) * uBiomeWeights[1];
      col += biome2(h) * uBiomeWeights[2];
      col += biome3(h) * uBiomeWeights[3];
      col += biome4(h) * uBiomeWeights[4];
      col /= total;

      // Rocky cliff override on steep slopes
      float cliff = smoothstep(0.6,0.3,vSlope);
      col = mix(col, vec3(0.25,0.22,0.20), cliff * 0.7);

      // Snow cap
      float snow = smoothstep(0.72,0.85,h) * smoothstep(0.3,0.6,vSlope);
      col = mix(col, vec3(0.92,0.94,0.98), snow);

      // Detail noise micro-texture
      float det  = valueNoise(vWorldPos.xz * 0.8) * 0.08
                 + valueNoise(vWorldPos.xz * 3.0) * 0.04;
      col += det - 0.06;

      // Lighting – Lambert with sun
      float diff = max(0.0, dot(vNormal, normalize(uSunDir)));
      vec3  lit  = col * (vec3(0.18,0.20,0.28) + uSunColor * diff * 0.85);

      // Specular glint on crystals / water-like areas
      vec3  halfV = normalize(normalize(uSunDir) + vec3(0,1,0));
      float spec  = pow(max(dot(vNormal,halfV),0.0), 32.0) * uBiomeWeights[1] * 0.4;
      lit += vec3(0.5,0.9,1.0) * spec;

      // Fog
      float dist    = length(vWorldPos - cameraPosition);
      float fogFac  = 1.0 - exp(-uFogDensity * dist * dist);
      lit = mix(lit, uFogColor, clamp(fogFac,0.0,1.0));

      gl_FragColor = vec4(lit, 1.0);
    }
  `,
};

// ─── Sky / Atmosphere Shader ──────────────────────────────────────────────────
export const SkyShader = {
  uniforms: {
    uSunDir     : { value: null },
    uDayFactor  : { value: 1.0 },   // 0=night 1=day
    uTime       : { value: 0.0 },
  },

  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;
    uniform vec3  uSunDir;
    uniform float uDayFactor;
    uniform float uTime;
    varying vec3  vDir;

    float hash(float n){ return fract(sin(n)*43758.5453); }
    float noise(vec3 p){
      vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.-2.*f);
      float n=i.x+i.y*57.+i.z*113.;
      return mix(mix(mix(hash(n),hash(n+1.),f.x),
                     mix(hash(n+57.),hash(n+58.),f.x),f.y),
                 mix(mix(hash(n+113.),hash(n+114.),f.x),
                     mix(hash(n+170.),hash(n+171.),f.x),f.y),f.z);
    }

    void main() {
      vec3  d    = normalize(vDir);
      float up   = clamp(d.y, 0.0, 1.0);
      float sunA = max(0.0, dot(d, normalize(uSunDir)));

      // Day sky gradient
      vec3 zenith  = mix(vec3(0.04,0.05,0.15), vec3(0.10,0.25,0.65), uDayFactor);
      vec3 horizon = mix(vec3(0.12,0.10,0.20), vec3(0.60,0.75,0.90), uDayFactor);
      vec3 sky     = mix(horizon, zenith, smoothstep(0.0,0.6,up));

      // Sun disc
      float sunD   = 1.0 - smoothstep(0.0, 0.02, 1.0 - sunA);
      vec3  sunCol = mix(vec3(1.0,0.5,0.2), vec3(1.0,1.0,0.9), uDayFactor);
      sky += sunCol * sunD * uDayFactor;

      // Sun corona
      sky += sunCol * pow(sunA, 8.0) * 0.4 * uDayFactor;

      // Stars at night
      float stars = noise(d * 180.0) * noise(d * 60.0) * 10.0;
      stars = clamp(stars - 8.5, 0.0, 1.0);
      sky += vec3(stars) * (1.0 - uDayFactor) * 1.5;

      // Aurora at night
      float au = noise(vec3(d.x*3.+uTime*.05, d.y*2., d.z*3.)) * (1.0-uDayFactor);
      au *= smoothstep(0.2,0.6,up) * smoothstep(0.9,0.5,up);
      sky += vec3(0.0,0.8,0.4) * au * 0.6;
      sky += vec3(0.4,0.0,0.8) * au * 0.3;

      // Clouds
      float cx    = d.x/(d.y+0.2)*2.;
      float cz    = d.z/(d.y+0.2)*2.;
      float cloud = noise(vec3(cx+uTime*.01, 0.5, cz+uTime*.005)) * uDayFactor;
      cloud       = smoothstep(0.52,0.75,cloud) * smoothstep(0.0,0.15,up);
      sky = mix(sky, vec3(0.95,0.97,1.0)*uDayFactor, cloud*0.7);

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

// ─── Magic Particle Shader ────────────────────────────────────────────────────
export const ParticleShader = {
  uniforms: {
    uTime  : { value: 0 },
    uColor : { value: null },
  },
  vertexShader: /* glsl */`
    attribute float aSize;
    attribute float aLife;
    varying   float vLife;
    uniform   float uTime;
    void main() {
      vLife = aLife;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (300.0 / -mv.z) * aLife;
      gl_Position  = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    precision mediump float;
    uniform vec3  uColor;
    varying float vLife;
    void main() {
      vec2  uv   = gl_PointCoord - 0.5;
      float d    = length(uv);
      float core = 1.0 - smoothstep(0.0, 0.45, d);
      float glow = 1.0 - smoothstep(0.0, 0.5, d);
      vec3  col  = uColor * core + uColor * glow * 0.4;
      float a    = glow * vLife;
      gl_FragColor = vec4(col, a);
    }
  `,
};

// ─── Enemy / Object Emissive Pulse Shader ────────────────────────────────────
export const EmissivePulseShader = {
  uniforms: {
    uTime      : { value: 0 },
    uBaseColor : { value: null },
    uEmissive  : { value: null },
    uPulseSpeed: { value: 2.0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision mediump float;
    uniform float uTime;
    uniform vec3  uBaseColor;
    uniform vec3  uEmissive;
    uniform float uPulseSpeed;
    varying vec3  vNormal;
    void main() {
      float rim   = 1.0 - max(0.0, dot(vNormal, vec3(0.0,0.0,1.0)));
      float pulse = (sin(uTime * uPulseSpeed) * 0.5 + 0.5);
      vec3  col   = uBaseColor + uEmissive * (rim * 0.6 + pulse * 0.4);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ─── Water / Void Plane Shader ────────────────────────────────────────────────
export const WaterShader = {
  uniforms: {
    uTime   : { value: 0 },
    uColor  : { value: null },
  },
  vertexShader: /* glsl */`
    uniform float uTime;
    varying vec2  vUv;
    varying float vWave;
    void main() {
      vUv   = uv;
      float wave = sin(position.x*0.3 + uTime*1.5)*0.5
                 + sin(position.z*0.4 + uTime*1.1)*0.5;
      vec3 pos   = position + vec3(0.0, wave*0.6, 0.0);
      vWave = wave;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision mediump float;
    uniform float uTime;
    uniform vec3  uColor;
    varying vec2  vUv;
    varying float vWave;
    void main() {
      float foam = smoothstep(0.3, 0.5, vWave);
      vec3  col  = mix(uColor, vec3(1.0), foam*0.25);
      float edge = abs(vUv.x-0.5)*2.;
      float alpha= 0.65 + vWave*0.1;
      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true,
};
