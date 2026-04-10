/**
 * src/shaders.js  –  Film-grade GLSL shaders for Aetheria
 */

export const TerrainShader = {
  uniforms: {
    uTime:           { value: 0 },
    uBiomeColorLow:  { value: null },
    uBiomeColorMid:  { value: null },
    uBiomeColorHigh: { value: null },
    uBiomeAccent:    { value: null },
    uWaterLevel:     { value: 10 },
    uHeightScale:    { value: 80 },
    uFogColor:       { value: null },
    uFogDensity:     { value: 0.008 },
    uSunDir:         { value: null },
    uSunColor:       { value: null },
    uAmbientColor:   { value: null },
    uEmissiveColor:  { value: null },
    uEmissiveStrength:{ value: 0.0 },
  },
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vHeight;
    varying vec3 vViewDir;
    uniform float uHeightScale;
    uniform float uWaterLevel;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vNormal   = normalize(normalMatrix * normal);
      vHeight   = position.y / uHeightScale;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir  = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3 uBiomeColorLow;
    uniform vec3 uBiomeColorMid;
    uniform vec3 uBiomeColorHigh;
    uniform vec3 uBiomeAccent;
    uniform float uWaterLevel;
    uniform float uHeightScale;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;
    uniform vec3  uEmissiveColor;
    uniform float uEmissiveStrength;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vHeight;
    varying vec3 vViewDir;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float hash3(vec3 p) {
      p = fract(p * vec3(0.1031, 0.1030, 0.0973));
      p += dot(p, p.yxz + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float valueNoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
    }
    float fbm(vec2 p, int oct) {
      float v=0.0,a=0.5,freq=1.0;
      for(int i=0;i<8;i++){
        if(i>=oct) break;
        v+=a*valueNoise(p*freq);
        a*=0.5; freq*=2.1;
      }
      return v;
    }
    float voronoi(vec2 p) {
      vec2 g=floor(p); vec2 f=fract(p);
      float md=8.0;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
        vec2 o=vec2(x,y);
        vec2 r=o+vec2(hash(g+o),hash(g+o+7.7))-f;
        md=min(md,dot(r,r));
      }
      return sqrt(md);
    }
    // Triplanar blending
    vec3 triplanar(vec3 pos, vec3 nor, float scale) {
      vec3 w=abs(nor); w=pow(w,vec3(6.0)); w/=(w.x+w.y+w.z);
      float xy=fbm(pos.xy*scale,5);
      float xz=fbm(pos.xz*scale,5);
      float yz=fbm(pos.yz*scale,5);
      return vec3(xy*w.z+xz*w.y+yz*w.x);
    }

    void main() {
      vec3 N = normalize(vNormal);
      float slope = 1.0 - abs(N.y);
      float h = clamp(vHeight, 0.0, 1.0);
      float worldH = vWorldPos.y;

      // Triplanar detail
      vec3 tp = triplanar(vWorldPos*0.05, N, 1.0);
      float detail = tp.x;
      float crack = voronoi(vWorldPos.xz * 0.08) * 0.5;

      // Height-based biome layering
      vec3 col;
      float sand  = smoothstep(0.0, 0.08, h);
      float soil  = smoothstep(0.05,0.35, h);
      float rock  = smoothstep(0.30,0.65, h);
      float snow  = smoothstep(0.60,0.85, h);

      col = mix(uBiomeColorLow,  uBiomeColorLow*1.3,  sand);
      col = mix(col, uBiomeColorMid,  soil);
      col = mix(col, uBiomeColorHigh*0.6, rock);
      col = mix(col, vec3(0.90,0.93,0.98), snow);

      // Slope cliff override
      col = mix(col, uBiomeColorHigh*0.5 + vec3(0.1), smoothstep(0.45,0.75,slope));

      // Detail variation
      col *= 0.85 + 0.3*detail;
      col = mix(col, uBiomeAccent*0.6, crack*0.15*(1.0-slope));

      // Diffuse lighting with half-Lambert wrap
      float diff = max(dot(N, normalize(uSunDir)), 0.0);
      float wrap = diff * 0.5 + 0.5; // softer wrap-around
      vec3 H = normalize(normalize(uSunDir) + vViewDir);
      float spec = pow(max(dot(N,H),0.0), 48.0) * (snow*1.0 + (1.0-h)*0.12);

      // Rim light (atmospheric backscatter from sun side)
      float rim = pow(1.0 - max(dot(N, vViewDir), 0.0), 3.0);
      rim *= max(dot(N, normalize(uSunDir)), 0.0) * 0.4;

      vec3 lighting = uAmbientColor + uSunColor * wrap * 0.9 + uSunColor * spec * 0.5 + uSunColor * rim;
      col *= lighting;

      // AO from detail
      float ao = 0.65 + 0.35 * detail;
      col *= ao;

      // Emissive zones (lava cracks, crystal glow, exotic bio-luminescence)
      if (uEmissiveStrength > 0.01) {
        float lavaCrack = smoothstep(0.35, 0.55, crack) * (1.0 - slope) * (1.0 - snow);
        // Animate lava/crystal glow with time
        float pulse = 0.8 + 0.2 * sin(uTime * 1.5 + vWorldPos.x * 0.03 + vWorldPos.z * 0.05);
        col += uEmissiveColor * lavaCrack * uEmissiveStrength * pulse;
      }

      // Fog
      float dist = length(vWorldPos - cameraPosition);
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFogColor, clamp(fog, 0.0, 0.92));

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
    uFogColor:   { value: null },
    uFogDensity: { value: 0.008 },
    uDepthScale: { value: 20 }
  },
  vertexShader: `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying float vDepth;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float waveH(vec2 p, float t){
      float h=0.0;
      h+=sin(p.x*0.3+t*1.2)*cos(p.y*0.25+t*0.9)*0.6;
      h+=sin(p.x*0.7-t*0.8)*sin(p.y*0.6+t*1.1)*0.3;
      h+=sin(p.x*1.5+t*1.5)*cos(p.y*1.3-t)*0.15;
      return h;
    }
    void main(){
      vec3 pos = position;
      pos.y += waveH(pos.xz, uTime);
      vec4 wp = modelMatrix * vec4(pos,1.0);
      vWorldPos = wp.xyz;

      float eps=0.5;
      float hL=waveH(pos.xz+vec2(-eps,0.0),uTime);
      float hR=waveH(pos.xz+vec2( eps,0.0),uTime);
      float hD=waveH(pos.xz+vec2(0.0,-eps),uTime);
      float hU=waveH(pos.xz+vec2(0.0, eps),uTime);
      vNormal = normalize(vec3(hL-hR, 2.0*eps, hD-hU));
      vDepth = 0.5;
      vec4 mvPos = modelViewMatrix * vec4(pos,1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3  uWaterColor;
    uniform vec3  uSkyColor;
    uniform vec3  uSunDir;
    uniform vec3  uFogColor;
    uniform float uFogDensity;
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying vec3  vViewDir;
    varying float vDepth;

    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewDir);
      vec3 S = normalize(uSunDir);

      // Fresnel
      float fresnel = pow(1.0 - max(dot(N,V),0.0), 4.0);
      // Shallow/deep tint
      vec3 shallow = uWaterColor * 1.4;
      vec3 deep    = uWaterColor * 0.4;
      vec3 waterC  = mix(deep, shallow, vDepth);

      // Specular
      vec3 H = normalize(S+V);
      float spec = pow(max(dot(N,H),0.0), 128.0);

      vec3 col = mix(waterC, uSkyColor, fresnel*0.6);
      col += vec3(1.0,0.98,0.9) * spec * 0.8;

      // Foam (near shore - simple noise)
      float foam = 0.0;
      if(vDepth > 0.85) foam = 0.3;
      col = mix(col, vec3(1.0), foam);

      // Fog
      float dist = length(vWorldPos - cameraPosition);
      float fog  = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
      col = mix(col, uFogColor, clamp(fog,0.0,0.85));

      gl_FragColor = vec4(col, 0.82);
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
    uAmbientColor: { value: null }
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

    void main(){
      vUv = uv;
      vColor = instanceColor;
      vec3 pos = position;
      // Wind sway based on height
      float tip = smoothstep(0.0, 1.0, pos.y);
      float sway = sin(uTime*2.0 + pos.x*3.0 + pos.z*2.0) * uWindStrength * tip;
      pos.x += uWindDir.x * sway;
      pos.z += uWindDir.z * sway;
      vec4 wp = modelMatrix * vec4(pos, 1.0);
      vWorldPos = wp.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform vec3  uAmbientColor;
    varying vec3  vColor;
    varying vec3  vNormal;
    varying vec3  vWorldPos;
    varying vec2  vUv;

    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}

    void main(){
      // Alpha clip leaf edges
      float n = hash(vUv*8.0 + 0.5);
      if(n < 0.15) discard;

      vec3 N = normalize(vNormal);
      vec3 S = normalize(uSunDir);
      // Two-sided
      float diff = abs(dot(N, S));
      // Translucency
      float trans = pow(max(dot(-N, S),0.0), 2.0) * 0.4;
      vec3 col = vColor * (uAmbientColor + uSunColor*(diff*0.7 + trans));
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
    uStarDensity:  { value: 1.0 }
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
    varying vec3  vDir;

    float hash3f(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
    float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    float valueN(vec3 p){
      vec3 i=floor(p); vec3 f=fract(p);
      vec3 u=f*f*(3.0-2.0*f);
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

    void main(){
      vec3 dir = normalize(vDir);
      vec3 col = vec3(0.0);

      // Stars - 3 size classes
      for(int layer=0;layer<3;layer++){
        float scale = 80.0 + float(layer)*120.0;
        vec3 sg = floor(dir * scale);
        float h = hash3f(sg);
        float thresh = 0.88 + float(layer)*0.04;
        thresh /= uStarDensity;
        if(h > thresh){
          float bright = (h - thresh)/(1.0-thresh);
          bright = pow(bright, 2.0) * (1.5 + float(layer)*0.8);
          vec3 starCol = mix(vec3(0.8,0.9,1.0), vec3(1.0,0.8,0.7), hash3f(sg+0.3));
          col += starCol * bright;
        }
      }

      // Milky Way band
      float mwBand = exp(-pow(dir.y / 0.15, 2.0));
      float mw = fbm3d(dir * 4.0, 5) * mwBand;
      col += vec3(0.5,0.55,0.7) * mw * 0.4;

      // Nebula clouds (3 layers)
      float n1 = fbm3d(dir * 2.0 + vec3(0.0), 4);
      float n2 = fbm3d(dir * 2.5 + vec3(10.3,0.0,5.1), 4);
      float n3 = fbm3d(dir * 1.8 + vec3(3.3,8.0,1.2), 4);
      col += uNebulaColor1 * max(n1-0.4,0.0) * 0.8;
      col += uNebulaColor2 * max(n2-0.42,0.0) * 0.7;
      col += uNebulaColor3 * max(n3-0.44,0.0) * 0.5;

      gl_FragColor = vec4(col, 1.0);
    }
  `
};
