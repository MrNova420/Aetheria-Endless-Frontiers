/**
 * src/shaders.js  –  AAA film-grade GLSL shaders for Aetheria
 * Full PBR terrain, caustic water, volumetric atmosphere, cinematic space
 */

import * as THREE from 'three';

// ─── Vignette + Subtle Chromatic Aberration Post-Process Shader ──────────────
export const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse:       { value: null },
    uVignetteStr:   { value: 0.55 },       // vignette darkness at edges
    uVignetteSmooth:{ value: 0.30 },       // softness of vignette falloff
    uChromaStr:     { value: 0.0025 },     // chromatic aberration strength
    uDamageFlash:   { value: 0.0 },        // 0-1, red flash on hit
    uTime:          { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignetteStr;
    uniform float uVignetteSmooth;
    uniform float uChromaStr;
    uniform float uDamageFlash;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Subtle chromatic aberration — offset R/B channels slightly from centre
      vec2 dir   = uv - 0.5;
      float dist = length(dir);
      vec2 offset = dir * uChromaStr * dist;

      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;
      vec4 col = vec4(r, g, b, 1.0);

      // Vignette — smooth circular darkening at edges
      float vignette = smoothstep(uVignetteStr, uVignetteStr - uVignetteSmooth, dist);
      col.rgb *= mix(0.0, 1.0, vignette);

      // Damage flash — brief red tint
      if (uDamageFlash > 0.0) {
        col.rgb = mix(col.rgb, vec3(0.9, 0.05, 0.05), uDamageFlash * 0.35);
      }

      gl_FragColor = col;
    }
  `,
};

export const TerrainShader = {
  uniforms: {
    uTime:            { value: 0 },
    uBiomeColorLow:   { value: null },
    uBiomeColorMid:   { value: null },
    uBiomeColorHigh:  { value: null },
    uBiomeAccent:     { value: null },
    uWaterLevel:      { value: 10 },
    uHeightScale:     { value: 80 },
    uFogColor:        { value: null },
    uFogDensity:      { value: 0.008 },
    uSunDir:          { value: null },
    uSunColor:        { value: null },
    uAmbientColor:    { value: null },
    uEmissiveColor:   { value: null },
    uEmissiveStrength:{ value: 0.0 },
    uWetness:         { value: 0.0 },  // 0=dry, 1=soaked (from weather)
    uWindTime:        { value: 0.0 },  // for lava UV scroll
    uTexGrass:     { value: null },
    uTexRock:      { value: null },
    uTexSand:      { value: null },
    uTexSnow:      { value: null },
    uTexAlien:     { value: null },
    uTexGrassNorm: { value: null },
    uTexRockNorm:  { value: null },
    uUseTextures:  { value: 0.0 },   // 0=no textures, 1=use textures
  },
  vertexShader: `
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;
    varying vec3  vViewDir;
    varying float vDist;
    uniform float uHeightScale;
    uniform float uWaterLevel;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vNormal   = normalize(normalMatrix * normal);
      vHeight   = position.y / uHeightScale;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir  = normalize(-mvPos.xyz);
      vDist     = length(mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    #extension GL_OES_standard_derivatives : enable

    uniform sampler2D uTexGrass;
    uniform sampler2D uTexRock;
    uniform sampler2D uTexSand;
    uniform sampler2D uTexSnow;
    uniform sampler2D uTexAlien;
    uniform sampler2D uTexGrassNorm;
    uniform sampler2D uTexRockNorm;
    uniform float uUseTextures;

    uniform float uTime;
    uniform vec3  uBiomeColorLow;
    uniform vec3  uBiomeColorMid;
    uniform vec3  uBiomeColorHigh;
    uniform vec3  uBiomeAccent;
    uniform float uWaterLevel;
    uniform float uHeightScale;
    uniform vec3  uFogColor;
    uniform float uFogDensity;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform vec3  uAmbientColor;
    uniform vec3  uEmissiveColor;
    uniform float uEmissiveStrength;
    uniform float uWetness;
    uniform float uWindTime;

    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;
    varying vec3  vViewDir;
    varying float vDist;

    // ── Noise primitives ─────────────────────────────────────────────────────
    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float hash3(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
    float vnoise(vec2 p){
      vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
    }
    float fbm(vec2 p,int oct){
      float v=0.0,a=0.5;
      for(int i=0;i<8;i++){if(i>=oct)break;v+=a*vnoise(p);a*=0.5;p*=2.1;}
      return v;
    }
    float voronoi(vec2 p){
      vec2 g=floor(p),f=fract(p); float md=8.0;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
        vec2 o=vec2(x,y),r=o+vec2(hash(g+o),hash(g+o+7.7))-f;
        md=min(md,dot(r,r));
      }
      return sqrt(md);
    }

    // ── Triplanar sampling ────────────────────────────────────────────────────
    vec3 triplanarW(vec3 pos, vec3 nor, float scale, int oct) {
      vec3 w=abs(nor); w=pow(w,vec3(8.0)); w/=(w.x+w.y+w.z+0.001);
      return vec3(
        fbm(pos.xy*scale,oct)*w.z +
        fbm(pos.xz*scale,oct)*w.y +
        fbm(pos.yz*scale,oct)*w.x
      );
    }

    // ── Derivative-based normal bump ─────────────────────────────────────────
    vec3 bumpNormal(vec3 baseN, vec3 worldPos, float strength) {
      float h  = fbm(worldPos.xz * 0.25, 4);
      float hx = fbm((worldPos + vec3(0.5,0,0)).xz * 0.25, 4);
      float hz = fbm((worldPos + vec3(0,0,0.5)).xz * 0.25, 4);
      vec3 bumpDir = vec3(h - hx, 1.0, h - hz) * strength;
      return normalize(baseN + bumpDir);
    }

    // ── ACES tone curve (applied per-channel) ─────────────────────────────────
    float aces(float x){
      float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
    }
    vec3 acesTone(vec3 c){return vec3(aces(c.r),aces(c.g),aces(c.b));}

    // ── Schlick Fresnel ───────────────────────────────────────────────────────
    float fresnelSchlick(float cosA, float f0){
      return f0+(1.0-f0)*pow(clamp(1.0-cosA,0.0,1.0),5.0);
    }

    // ── PBR-style diffuse + specular ─────────────────────────────────────────
    vec3 pbrLight(vec3 albedo, float roughness, float metallic,
                  vec3 N, vec3 V, vec3 L, vec3 lightCol, vec3 ambCol) {
      vec3 H = normalize(V + L);
      float NdotL = max(dot(N, L), 0.0);
      float NdotV = max(dot(N, V), 0.001);
      float NdotH = max(dot(N, H), 0.0);
      float HdotV = max(dot(H, V), 0.0);

      // Wrap diffuse (half-Lambert + subsurface feel)
      float wrap   = NdotL * 0.7 + 0.3;
      vec3  diff   = albedo * (1.0 - metallic) * wrap * lightCol;

      // GGX specular
      float alpha  = roughness * roughness;
      float alpha2 = alpha * alpha;
      float denom  = NdotH*NdotH*(alpha2-1.0)+1.0;
      float D      = alpha2 / (3.14159*denom*denom + 0.0001);
      float k      = alpha * 0.5;
      float G      = (NdotL/(NdotL*(1.0-k)+k)) * (NdotV/(NdotV*(1.0-k)+k));
      vec3  F0     = mix(vec3(0.04), albedo, metallic);
      vec3  F      = F0 + (1.0-F0)*pow(1.0-HdotV, 5.0);
      vec3  spec   = D * G * F / (4.0 * NdotV + 0.001);
      spec        *= lightCol * NdotL;

      // Ambient occlusion from Fresnel angle
      float ao = 0.5 + 0.5 * NdotV;
      return diff + spec + albedo * ambCol * ao * (1.0 - metallic);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewDir);
      vec3 L = normalize(uSunDir);

      float slope = 1.0 - clamp(N.y, 0.0, 1.0);
      float h = clamp(vHeight, 0.0, 1.0);

      // ── Derivative bump ────────────────────────────────────────────────────
      // Stronger bump in mid-range, fade at high slopes (cliffs are smooth rock)
      float bumpStr = mix(1.8, 0.3, slope);
      vec3 bN = bumpNormal(N, vWorldPos, bumpStr * 0.012);

      // ── Triplanar detail ───────────────────────────────────────────────────
      vec3 tp_c = triplanarW(vWorldPos * 0.04, N, 1.0, 5);
      float detail = tp_c.x;

      // High-freq micro-detail (close-up rock/grass grain)
      float micro = fbm(vWorldPos.xz * 1.2, 3) * 0.5 + 0.5;

      // Voronoi cracks (for rock/cliff faces)
      float crack = voronoi(vWorldPos.xz * 0.06);

      // ── Height-based biome layering ────────────────────────────────────────
      // sand/shore → low vegetation → rock → snow
      float tSand = smoothstep(0.0,  0.07, h);
      float tSoil = smoothstep(0.04, 0.38, h);
      float tRock = smoothstep(0.30, 0.68, h);
      float tSnow = smoothstep(0.58, 0.82, h);

      vec3 albedo = uBiomeColorLow;
      albedo = mix(albedo, uBiomeColorLow * 1.25, tSand);
      albedo = mix(albedo, uBiomeColorMid,         tSoil);
      albedo = mix(albedo, uBiomeColorHigh * 0.55, tRock);
      albedo = mix(albedo, vec3(0.90,0.93,0.99),   tSnow);
      // Cliff rock override
      albedo = mix(albedo, uBiomeColorHigh * 0.45 + vec3(0.08), smoothstep(0.40,0.72, slope));
      // Accent patches (mineral deposits, sand streaks)
      albedo = mix(albedo, uBiomeAccent * 0.7, crack * 0.13 * (1.0 - slope));

      // Texture blending (when real textures are available)
      if (uUseTextures > 0.5) {
        vec2 uv = vWorldPos.xz * 0.08;
        vec3 texGrass = texture2D(uTexGrass,  uv * 0.5).rgb;
        vec3 texRock  = texture2D(uTexRock,   uv * 0.3).rgb;
        vec3 texSand  = texture2D(uTexSand,   uv * 0.4).rgb;
        vec3 texSnow  = texture2D(uTexSnow,   uv * 0.6).rgb;
        vec3 texBase  = texGrass;
        texBase = mix(texBase, texSand,  smoothstep(0.0,  0.07, h));
        texBase = mix(texBase, texRock,  smoothstep(0.30, 0.68, h));
        texBase = mix(texBase, texRock,  smoothstep(0.40, 0.72, slope));
        texBase = mix(texBase, texSnow,  tSnow);
        albedo = mix(albedo, albedo * texBase * 2.2, 0.65);
      }

      // ── Per-zone material properties ───────────────────────────────────────
      float roughness = mix(0.82, 0.45, tSnow);             // snow is smoother
      roughness       = mix(roughness, 0.92, slope);         // cliffs rougher
      roughness       = mix(roughness, 0.35, uWetness);      // wet = smoother/shiny
      float metallic  = mix(0.0, 0.08, tRock * (1.0-tSnow)); // slight metal in rock

      // ── Detail modulation ──────────────────────────────────────────────────
      albedo *= 0.78 + 0.44 * detail;
      albedo *= 0.88 + 0.24 * micro;

      // Wetness darkening + specular boost
      if (uWetness > 0.02) {
        float wet = uWetness * (1.0 - tSnow) * smoothstep(0.4, 0.0, slope);
        albedo   *= 1.0 - wet * 0.38;
        roughness = mix(roughness, 0.08, wet);
        // Puddle in flat low areas
        float puddle = smoothstep(0.18, 0.0, slope) * smoothstep(0.35, 0.0, h) * wet;
        vec3 puddleCol = uFogColor * 0.5 + vec3(0.05,0.08,0.12);
        albedo = mix(albedo, puddleCol, puddle * 0.6);
        roughness = mix(roughness, 0.04, puddle);
      }

      // ── PBR lighting ──────────────────────────────────────────────────────
      vec3 col = pbrLight(albedo, roughness, metallic, bN, V, L, uSunColor, uAmbientColor);

      // ── Emissive zones (lava, crystal, bio-luminescent) ───────────────────
      if (uEmissiveStrength > 0.01) {
        float lavaCrack = smoothstep(0.4, 0.58, crack) * (1.0 - slope) * (1.0 - tSnow);

        // Animated lava flow: scroll UV along crack direction
        float lavaScroll = fbm(vWorldPos.xz * 0.05 + vec2(0.0, uWindTime * 0.4), 3);
        float lavaGlow   = lavaCrack * (0.6 + 0.4 * lavaScroll);

        // Pulse
        float pulse = 0.75 + 0.25 * sin(uTime * 2.2 + vWorldPos.x * 0.04 + vWorldPos.z * 0.07);
        // Lava light contribution — warms nearby rock
        vec3 lavaLight = uEmissiveColor * lavaGlow * uEmissiveStrength;
        col += lavaLight * pulse;
        // Secondary warm scatter
        col += lavaLight * 0.15 * pulse * (1.0 - lavaCrack);
      }

      // ── Fake SSAO ─────────────────────────────────────────────────────────
      float aoFake  = 0.55 + 0.45 * detail * micro;
      // Concave areas (slope change → darker in crevices)
      float crevice = clamp(1.0 - crack * 2.0, 0.0, 1.0);
      aoFake       *= 0.70 + 0.30 * crevice;
      col          *= aoFake;

      // ── Atmospheric perspective (distance haze) ────────────────────────────
      float distFog = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
      // Slight horizon warmth even in fog
      vec3  fogTint = mix(uFogColor, uFogColor * 1.15 + uSunColor * 0.06, 0.3);
      col = mix(col, fogTint, clamp(distFog, 0.0, 0.94));

      // ── Color grading S-curve ─────────────────────────────────────────────
      // Subtle S-curve for punchy contrast without blowing highlights
      col = col / (col + vec3(0.25)) * 1.25;   // Reinhard-style soft
      col = mix(col, acesTone(col), 0.4);       // Partial ACES

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export const AtmosphereShader = {
  uniforms: {
    uTime:           { value: 0 },
    uSunDir:         { value: null },
    uSunIntensity:   { value: 2.0 },
    uDayFactor:      { value: 1.0 },
    uRayleighColor:  { value: null },
    uMieColor:       { value: null },
    uAtmosphereColor:{ value: null },
    uCloudCoverage:  { value: 0.5 },
    uAuroraColor:    { value: null },
    // Moon disc uniforms (up to 3 moons)
    uMoon0Dir:   { value: new THREE.Vector3(0.4,0.6,0.5) },
    uMoon0Color: { value: new THREE.Color(0.85,0.88,0.92) },
    uMoon0Size:  { value: 0.035 },
    uMoon1Dir:   { value: new THREE.Vector3(-0.5,0.5,0.3) },
    uMoon1Color: { value: new THREE.Color(0.8,0.6,0.5) },
    uMoon1Size:  { value: 0.025 },
    uMoon2Dir:   { value: new THREE.Vector3(0.2,0.7,-0.4) },
    uMoon2Color: { value: new THREE.Color(0.7,0.85,0.95) },
    uMoon2Size:  { value: 0.03 },
    uMoonCount:  { value: 0 },
  },
  vertexShader: `
    varying vec3 vWorldDir;
    void main() {
      vWorldDir = (modelMatrix * vec4(position, 0.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3  uSunDir;
    uniform float uSunIntensity;
    uniform float uDayFactor;
    uniform vec3  uRayleighColor;
    uniform vec3  uMieColor;
    uniform vec3  uAtmosphereColor;
    uniform float uCloudCoverage;
    uniform vec3  uAuroraColor;
    uniform vec3  uMoon0Dir; uniform vec3 uMoon0Color; uniform float uMoon0Size;
    uniform vec3  uMoon1Dir; uniform vec3 uMoon1Color; uniform float uMoon1Size;
    uniform vec3  uMoon2Dir; uniform vec3 uMoon2Color; uniform float uMoon2Size;
    uniform int   uMoonCount;
    varying vec3  vWorldDir;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float hash3f(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
    float valueN(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
    float fbm2(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*valueN(p);a*=0.5;p*=2.1;}return v;}
    float fbm3(vec3 p){
      float v=0.0,a=0.5;
      for(int i=0;i<5;i++){
        v+=a*(hash3f(floor(p))+fract(dot(fract(p),vec3(1.0))));
        a*=0.5;p*=2.0;
      }
      return v;
    }

    vec3 moonDisc(vec3 dir, vec3 moonDir, vec3 moonCol, float moonSize, float night) {
      float d = dot(dir, normalize(moonDir));
      float disc = smoothstep(1.0 - moonSize, 1.0 - moonSize * 0.6, d);
      // Limb darkening on moon edge
      float limb = 1.0 - (1.0 - disc) * 0.3;
      // Soft glow halo around moon
      float glow = pow(max(d, 0.0), 60.0 / moonSize) * 0.15;
      return moonCol * (disc * limb + glow) * night * 1.8;
    }

    void main() {
      vec3 dir = normalize(vWorldDir);
      vec3 sun = normalize(uSunDir);

      // Rayleigh scattering
      float cosTheta = dot(dir, sun);
      float rayleigh = (3.0/(16.0*3.14159)) * (1.0 + cosTheta*cosTheta);
      vec3 skyCol = uRayleighColor * rayleigh * uSunIntensity;

      // Horizon gradient
      float horizon = pow(clamp(1.0 - abs(dir.y), 0.0, 1.0), 3.0);
      skyCol = mix(skyCol, uAtmosphereColor, horizon * 0.65);

      // Mie scattering (sun halo)
      float mie = pow(max(cosTheta, 0.0), 64.0);
      skyCol += uMieColor * mie * uSunIntensity * 1.5;

      // Sun disc + corona
      float sunDisc = smoothstep(0.9985, 0.9996, cosTheta);
      float corona  = pow(max(cosTheta,0.0), 8.0) * 0.3;
      // Multi-ring corona glow
      float corona2 = pow(max(cosTheta,0.0), 18.0) * 0.5;
      float corona3 = pow(max(cosTheta,0.0), 40.0) * 0.8;
      skyCol += vec3(1.0,0.95,0.8) * (sunDisc + corona + corona2 + corona3) * uSunIntensity;

      // Twilight / dusk glow at horizon
      float dusk = smoothstep(0.0, 0.25, 1.0 - abs(sun.y)) * smoothstep(0.0, 0.3, uDayFactor);
      skyCol += uMieColor * horizon * dusk * 0.5;

      // Night sky
      float night = 1.0 - clamp(uDayFactor, 0.0, 1.0);
      if (night > 0.01) {
        // Stars
        vec3 sd = dir * 200.0;
        float star = 0.0;
        vec3 sg = floor(sd * 4.0);
        float h = hash3f(sg);
        float brightness = smoothstep(0.97, 1.0, h);
        // Star colour tints
        vec3 starCol = mix(vec3(0.9,0.9,1.0), vec3(1.0,0.85,0.7), hash3f(sg+1.1));
        float sz = mix(0.5, 2.0, hash3f(sg + 0.5));
        float distStar = length(fract(sd*4.0)-0.5);
        star = brightness * smoothstep(0.3*sz, 0.0, distStar);
        // Scintillation twinkle
        float twinkle = 0.8 + 0.2 * sin(uTime * 5.0 * hash3f(sg+2.0));
        skyCol += starCol * star * night * 3.0 * twinkle;

        // Milky-Way-style dense star band
        float mwAngle = abs(dir.y);
        float mwDens  = fbm2(dir.xz * 4.0 + vec2(uTime * 0.002)) * smoothstep(0.15, 0.0, mwAngle);
        skyCol += vec3(0.6,0.65,0.9) * mwDens * night * 0.4;

        // Aurora
        if (dir.y > 0.05) {
          float auroraY = (dir.y - 0.05) * 4.0;
          float aurora = fbm2(vec2(dir.x * 3.0 + uTime*0.12, dir.z * 3.0));
          aurora = smoothstep(0.35, 0.7, aurora) * exp(-auroraY*2.0);
          // Shimmer bands
          float shimmer = sin(dir.x * 12.0 + uTime * 0.5) * 0.3 + 0.7;
          skyCol += uAuroraColor * aurora * night * 1.8 * shimmer;
        }

        // Moon discs
        if (uMoonCount >= 1) skyCol += moonDisc(dir, uMoon0Dir, uMoon0Color, uMoon0Size, night);
        if (uMoonCount >= 2) skyCol += moonDisc(dir, uMoon1Dir, uMoon1Color, uMoon1Size, night);
        if (uMoonCount >= 3) skyCol += moonDisc(dir, uMoon2Dir, uMoon2Color, uMoon2Size, night);
      }

      // Clouds (2 layers)
      if (dir.y > 0.02) {
        float cloudH = 1.0 / (dir.y + 0.001);
        vec2 cp1 = dir.xz * cloudH * 0.5 + vec2(uTime*0.005, 0.0);
        vec2 cp2 = dir.xz * cloudH * 0.8 + vec2(0.0, uTime*0.003);
        float c1 = fbm2(cp1 * 2.0);
        float c2 = fbm2(cp2 * 3.0 + 5.5);
        float cloud = smoothstep(uCloudCoverage - 0.1, uCloudCoverage + 0.3, (c1+c2)*0.5);
        vec3 cloudCol = mix(vec3(1.0), vec3(0.5,0.55,0.6), 0.3 + 0.7*(1.0-uDayFactor));
        // Cloud shadow / underside
        cloudCol = mix(cloudCol, vec3(0.3,0.35,0.4), smoothstep(0.4,0.8,cloud) * 0.5);
        cloudCol = mix(cloudCol, vec3(1.0,0.6,0.3)*uSunIntensity, horizon * uDayFactor * 0.4);
        float cloudFade = smoothstep(0.02, 0.1, dir.y);
        skyCol = mix(skyCol, cloudCol, cloud * cloudFade * clamp(uDayFactor+0.35,0.0,1.0));
      }

      // Ground (below horizon)
      if (dir.y < 0.0) {
        skyCol = mix(uAtmosphereColor * 0.3, skyCol, smoothstep(-0.1, 0.0, dir.y));
      }

      gl_FragColor = vec4(skyCol, 1.0);
    }
  `
};

export const WaterShader = {
  uniforms: {
    uTime:       { value: 0 },
    uWaterColor: { value: null },
    uSkyColor:   { value: null },
    uSunDir:     { value: null },
    uSunColor:   { value: null },
    uFogColor:   { value: null },
    uFogDensity: { value: 0.008 },
    uDepthScale: { value: 20 },
    uWaterLevel: { value: 10 },
  },
  vertexShader: `
    uniform float uTime;
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying vec3  vViewDir;
    varying float vDepth;
    varying float vWaveCrest;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float waveH(vec2 p, float t) {
      float h = 0.0;
      // Gerstner-like wave layers
      h += sin(p.x*0.28 + t*1.1) * cos(p.y*0.22 + t*0.85) * 0.65;
      h += sin(p.x*0.65 - t*0.75 + 1.3) * sin(p.y*0.55 + t*1.05) * 0.32;
      h += sin(p.x*1.4  + t*1.4)  * cos(p.y*1.2 - t) * 0.16;
      h += sin(p.x*2.8  - t*1.8 + 2.1) * sin(p.y*2.4 + t*2.0) * 0.07;
      return h;
    }
    void main(){
      vec3 pos = position;
      float wh = waveH(pos.xz, uTime);
      pos.y += wh;
      vec4 wp = modelMatrix * vec4(pos, 1.0);
      vWorldPos = wp.xyz;

      float eps = 0.4;
      float hL = waveH(pos.xz + vec2(-eps, 0.0), uTime);
      float hR = waveH(pos.xz + vec2( eps, 0.0), uTime);
      float hD = waveH(pos.xz + vec2(0.0, -eps), uTime);
      float hU = waveH(pos.xz + vec2(0.0,  eps), uTime);
      vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

      // Wave crest (high tips get foam)
      vWaveCrest = clamp((wh - 0.55) * 3.0, 0.0, 1.0);
      vDepth = 0.5;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3  uWaterColor;
    uniform vec3  uSkyColor;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform vec3  uFogColor;
    uniform float uFogDensity;
    uniform float uTime;
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying vec3  vViewDir;
    varying float vDepth;
    varying float vWaveCrest;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float vnoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}

    // Caustic pattern from animated voronoi
    float caustic(vec2 p, float t) {
      p += vec2(sin(t * 0.7) * 0.5, cos(t * 0.5) * 0.4);
      vec2 g = floor(p), f = fract(p);
      float md = 8.0;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
        vec2 o = vec2(x,y);
        vec2 r = o + vec2(hash(g+o+t*0.1), hash(g+o+t*0.1+3.7)) - f;
        md = min(md, dot(r,r));
      }
      return 1.0 - smoothstep(0.0, 0.5, sqrt(md));
    }

    // Shore foam rings (animated inward rings)
    float shoreRing(vec2 p, float t) {
      float n = vnoise(p * 0.8 + t * 0.15);
      float ring = fract(n * 3.0 + t * 0.4);
      return smoothstep(0.6, 0.9, ring) * smoothstep(1.0, 0.7, ring);
    }

    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewDir);
      vec3 S = normalize(uSunDir);

      // Schlick Fresnel (f0 = 0.02 for water)
      float cosA    = max(dot(N, V), 0.0);
      float fresnel = 0.02 + 0.98 * pow(1.0 - cosA, 5.0);

      // Shallow / deep colour
      vec3 deepCol    = uWaterColor * 0.30;
      vec3 shallowCol = uWaterColor * 1.50;
      vec3 waterC     = mix(deepCol, shallowCol, vDepth);

      // Sub-surface scatter — light tint on backlit thin water
      float sss = pow(max(dot(-V, S), 0.0), 4.0) * 0.25;
      waterC += uSunColor * sss * vec3(0.2, 0.6, 0.5);

      // Specular (GGX approximation, low roughness)
      vec3  H    = normalize(S + V);
      float NdH  = max(dot(N, H), 0.0);
      float spec = pow(NdH, 256.0) * 1.8;
      // Secondary broad highlight
      float spec2 = pow(NdH, 32.0) * 0.15;

      // Sky reflection via Fresnel
      vec3 col = mix(waterC, uSkyColor * 0.9, fresnel * 0.7);
      col += uSunColor * (spec + spec2);

      // Caustics (visible in shallow/lit areas)
      float caustAmt = (1.0 - fresnel) * 0.18 * max(dot(N, S), 0.0);
      float caust = caustic(vWorldPos.xz * 0.15, uTime);
      col += uSunColor * caust * caustAmt;

      // Wave crest foam
      col = mix(col, vec3(1.0, 1.0, 1.0), vWaveCrest * 0.6);

      // Shore foam rings
      float foam = shoreRing(vWorldPos.xz * 0.04, uTime);
      col = mix(col, vec3(0.95, 0.97, 1.0), foam * 0.35);

      // Fog
      float dist = length(vWorldPos - cameraPosition);
      float fog  = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFogColor, clamp(fog, 0.0, 0.82));

      // Alpha: more transparent where shallow, opaque where deep
      float alpha = mix(0.68, 0.94, 1.0 - vDepth);
      gl_FragColor = vec4(col, alpha);
    }
  `
};

export const FloraShader = {
  uniforms: {
    uTime:         { value: 0 },
    uWindStrength: { value: 0.3 },
    uWindDir:      { value: null },
    uSunDir:       { value: null },
    uSunColor:     { value: null },
    uAmbientColor: { value: null },
    uFogColor:     { value: null },
    uFogDensity:   { value: 0.008 },
  },
  vertexShader: `
    attribute vec3 instanceColor;
    uniform float uTime;
    uniform float uWindStrength;
    uniform vec3  uWindDir;
    varying vec3  vColor;
    varying vec3  vNormal;
    varying vec3  vWorldPos;
    varying vec2  vUv;
    varying float vHeight;
    varying float vDist;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}

    void main(){
      vUv    = uv;
      vColor = instanceColor;
      vec3 pos = position;

      // Hierarchical wind: base sway + turbulence gust
      float tip  = smoothstep(0.0, 1.0, pos.y);
      // Primary sway
      float swayFreq = 1.8 + hash(instanceColor.xz) * 0.8;
      float sway = sin(uTime * swayFreq + pos.x * 3.0 + pos.z * 2.0) * uWindStrength * tip;
      // Secondary turbulence (leaf flutter at tips)
      float flutter = sin(uTime * 6.0 + pos.x * 7.0) * uWindStrength * tip * tip * 0.3;
      pos.x += uWindDir.x * (sway + flutter);
      pos.z += uWindDir.z * (sway + flutter);
      // Slight vertical bounce
      pos.y += abs(sin(uTime * swayFreq * 0.5)) * uWindStrength * tip * 0.1;

      vec4 wp  = modelMatrix * vec4(pos, 1.0);
      vWorldPos = wp.xyz;
      vNormal  = normalize(normalMatrix * normal);
      vHeight  = pos.y;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      vDist = length(mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform vec3  uAmbientColor;
    uniform vec3  uFogColor;
    uniform float uFogDensity;
    varying vec3  vColor;
    varying vec3  vNormal;
    varying vec3  vWorldPos;
    varying vec2  vUv;
    varying float vHeight;
    varying float vDist;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float hash3f(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}

    void main(){
      // Alpha clip for leaf/grass silhouette
      float n = hash(vUv * 8.0 + 0.5);
      if(n < 0.12) discard;

      vec3 N = normalize(vNormal);
      vec3 S = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      // Per-instance colour variation (subtle)
      float varSeed = hash3f(vWorldPos * 0.02);
      vec3  albedo  = vColor * (0.82 + varSeed * 0.36);
      // Height-based tip lightening (fresh growth at tips)
      albedo = mix(albedo, albedo * 1.3 + vec3(0.04, 0.06, 0.01), smoothstep(0.3, 1.0, vHeight));

      // Two-sided diffuse with wrap
      float diff  = abs(dot(N, S)) * 0.7 + 0.3;

      // Sub-surface scatter through thin leaf
      float sss   = pow(max(dot(-N, S), 0.0), 2.5) * 0.45;
      // Forward scatter (backlit glow when sun is behind leaf)
      float fwd   = pow(max(dot(V, -S), 0.0), 3.0) * 0.2;

      // Specular sheen (waxy leaves)
      vec3  H     = normalize(S + V);
      float spec  = pow(max(dot(N, H), 0.0), 24.0) * 0.12;

      vec3 col = albedo * (uAmbientColor + uSunColor * diff);
      col += albedo * uSunColor * (sss + fwd);
      col += uSunColor * spec;

      // Fog
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
      col = mix(col, uFogColor, clamp(fog, 0.0, 0.88));

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export const SpaceShader = {
  uniforms: {
    uTime:         { value: 0 },
    uNebulaColor1: { value: null },
    uNebulaColor2: { value: null },
    uNebulaColor3: { value: null },
    uStarDensity:  { value: 1.0 },
    uGalaxyAngle:  { value: 0.0 },   // system-specific galaxy orientation
  },
  vertexShader: `
    varying vec3 vDir;
    void main(){
      vDir = (modelMatrix * vec4(position, 0.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3  uNebulaColor1;
    uniform vec3  uNebulaColor2;
    uniform vec3  uNebulaColor3;
    uniform float uStarDensity;
    uniform float uGalaxyAngle;
    varying vec3  vDir;

    float hash3f(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float valueN(vec3 p){
      vec3 i=floor(p); vec3 f=fract(p); vec3 u=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash3f(i),hash3f(i+vec3(1,0,0)),u.x),
                     mix(hash3f(i+vec3(0,1,0)),hash3f(i+vec3(1,1,0)),u.x),u.y),
                 mix(mix(hash3f(i+vec3(0,0,1)),hash3f(i+vec3(1,0,1)),u.x),
                     mix(hash3f(i+vec3(0,1,1)),hash3f(i+vec3(1,1,1)),u.x),u.y),u.z);
    }
    float fbm3d(vec3 p, int oct){
      float v=0.0,a=0.5;
      for(int i=0;i<6;i++){if(i>=oct)break;v+=a*valueN(p);a*=0.5;p*=2.1;}
      return v;
    }
    float vnoise2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
    float fbm2d(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*vnoise2(p);a*=0.5;p*=2.1;}return v;}

    // Bokeh glow kernel — soft disc around bright stars
    float bokeh(float brightness, float radius) {
      return brightness * smoothstep(radius, 0.0, radius * 0.5) * 2.0;
    }

    // Spiral galaxy arm pattern (logarithmic spiral)
    float galaxyArm(vec2 p, float armAngle, float tightness) {
      float r = length(p);
      float theta = atan(p.y, p.x);
      float spiral = mod(theta - tightness * log(r + 0.01) + armAngle, 3.14159*2.0);
      float arm = exp(-pow(spiral - 3.14159, 2.0) * 6.0);
      return arm * exp(-r * 1.8);
    }

    void main(){
      vec3 dir = normalize(vDir);
      vec3 col = vec3(0.0);

      // ── Stars — 4 size classes with bokeh glow ───────────────────────────
      for(int layer = 0; layer < 4; layer++){
        float scale  = 70.0 + float(layer) * 110.0;
        vec3  sg     = floor(dir * scale);
        float h      = hash3f(sg);
        float thresh = (0.86 + float(layer) * 0.035) / uStarDensity;
        if(h > thresh){
          float bright = pow((h - thresh) / (1.0 - thresh), 2.2) * (1.8 + float(layer) * 0.6);
          // Colour tint (blue O/B, white A, yellow G, orange K)
          float tint   = hash3f(sg + 1.1);
          vec3  starC;
          if      (tint < 0.2) starC = vec3(0.70, 0.80, 1.00); // blue-white
          else if (tint < 0.45) starC = vec3(0.95, 0.97, 1.00); // white
          else if (tint < 0.70) starC = vec3(1.00, 0.95, 0.75); // yellow
          else if (tint < 0.88) starC = vec3(1.00, 0.75, 0.50); // orange
          else                  starC = vec3(1.00, 0.45, 0.35); // red
          // Scintillation
          float twink = 0.7 + 0.3 * sin(uTime * 4.0 * hash3f(sg + 2.7) + float(layer) * 1.3);
          // Bokeh soft glow (larger stars)
          if (layer >= 2 && bright > 1.0) {
            col += starC * bright * twink * 0.6;  // core
            col += starC * pow(bright, 0.5) * twink * 0.25; // soft halo
          } else {
            col += starC * bright * twink;
          }
        }
      }

      // ── Milky Way — dense core band ────────────────────────────────────────
      float yRot = dir.y * cos(uGalaxyAngle) - dir.z * sin(uGalaxyAngle);
      float mwBand = exp(-pow(yRot / 0.14, 2.0));
      float mw  = fbm3d(dir * 3.5, 5) * mwBand;
      float mw2 = fbm3d(dir * 7.0 + vec3(1.3), 4) * mwBand * 0.5;
      col += vec3(0.55, 0.60, 0.80) * (mw + mw2) * 0.45;

      // ── Dust lanes — dark absorption in galaxy band ────────────────────────
      float dust = fbm3d(dir * 5.0 + vec3(4.4, 0.0, 1.2), 4) * mwBand;
      col *= 1.0 - dust * 0.35;

      // ── Spiral galaxy arms (visible from "above") ─────────────────────────
      if (abs(dir.y) < 0.3) {
        vec2 gp = dir.xz * (2.0 + abs(dir.y) * 4.0);
        float arm1 = galaxyArm(gp,  0.0,        1.8);
        float arm2 = galaxyArm(gp,  3.14159,    1.8);
        float arm3 = galaxyArm(gp,  3.14159*0.5, 1.9);
        float arms = (arm1 + arm2 + arm3 * 0.6) * (1.0 - abs(dir.y) * 3.0);
        col += vec3(0.6, 0.65, 0.90) * arms * 0.3;
      }

      // ── Nebula clouds — 4 depth-layered volumes ────────────────────────────
      float n1 = fbm3d(dir * 1.8 + vec3(0.0),            4);
      float n2 = fbm3d(dir * 2.2 + vec3(10.3, 0.0, 5.1), 4);
      float n3 = fbm3d(dir * 2.8 + vec3(3.3, 8.0, 1.2),  4);
      float n4 = fbm3d(dir * 1.4 + vec3(7.7, 2.0, 9.5),  3);
      col += uNebulaColor1 * max(n1 - 0.38, 0.0) * 0.90;
      col += uNebulaColor2 * max(n2 - 0.40, 0.0) * 0.75;
      col += uNebulaColor3 * max(n3 - 0.42, 0.0) * 0.55;
      // Deep background tint
      col += mix(uNebulaColor1, uNebulaColor3, 0.5) * max(n4 - 0.44, 0.0) * 0.30;

      // ── Vignette (edges slightly darker) ─────────────────────────────────
      float vig = 1.0 - dot(dir.xz, dir.xz) * 0.12;
      col *= clamp(vig, 0.7, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `
};
