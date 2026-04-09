/**
 * src/noise.js
 * Simplex Noise 2D/3D + Fractal (fBm) helpers.
 * Based on Stefan Gustavson's public-domain simplex noise algorithm.
 */

const GRAD3 = [
  [ 1, 1, 0], [-1, 1, 0], [ 1,-1, 0], [-1,-1, 0],
  [ 1, 0, 1], [-1, 0, 1], [ 1, 0,-1], [-1, 0,-1],
  [ 0, 1, 1], [ 0,-1, 1], [ 0, 1,-1], [ 0,-1,-1]
];

function dot2(g, x, y)       { return g[0]*x + g[1]*y; }
function dot3(g, x, y, z)    { return g[0]*x + g[1]*y + g[2]*z; }

export class SimplexNoise {
  constructor(seed = 1337) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Seeded shuffle (LCG)
    let s = Math.abs(seed | 0) || 1;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }

    this._perm      = new Uint8Array(512);
    this._permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this._perm[i]      = p[i & 255];
      this._permMod12[i] = this._perm[i] % 12;
    }
  }

  /** 2-D simplex noise → [-1, 1] */
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.SQRT3 || Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const perm = this._perm, pm12 = this._permMod12;

    const s  = (xin + yin) * 0.366025403784439;
    const i  = Math.floor(xin + s);
    const j  = Math.floor(yin + s);
    const t  = (i + j) * 0.211324865405187;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + 0.211324865405187;
    const y1 = y0 - j1 + 0.211324865405187;
    const x2 = x0 - 1  + 2 * 0.211324865405187;
    const y2 = y0 - 1  + 2 * 0.211324865405187;
    const ii = i & 255, jj = j & 255;
    const gi0 = pm12[ii      + perm[jj     ]];
    const gi1 = pm12[ii + i1 + perm[jj + j1]];
    const gi2 = pm12[ii + 1  + perm[jj + 1 ]];

    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot2(GRAD3[gi0], x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot2(GRAD3[gi1], x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot2(GRAD3[gi2], x2, y2); }

    return 70 * (n0 + n1 + n2);   // returns [-1, 1]
  }

  /** Fractional Brownian Motion convenience method – delegates to the standalone fbm(). */
  fbm2(x, y, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
    return fbm(this, x, y, octaves, persistence, lacunarity);
  }

  /** 3-D simplex noise → [-1, 1] */
  noise3D(xin, yin, zin) {
    const F3 = 1 / 3, G3 = 1 / 6;
    const perm = this._perm, pm12 = this._permMod12;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;

    let i1, j1, k1, i2, j2, k2;
    if      (x0 >= y0 && y0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
    else if (x0 >= y0 && x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
    else if (x0 <  y0 && y0 <  z0) { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
    else if (x0 >= z0             ) { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    else if (y0 >= z0             ) { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
    else                            { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }

    const x1 = x0-i1+G3, y1 = y0-j1+G3, z1 = z0-k1+G3;
    const x2 = x0-i2+2*G3, y2 = y0-j2+2*G3, z2 = z0-k2+2*G3;
    const x3 = x0-1+3*G3, y3 = y0-1+3*G3, z3 = z0-1+3*G3;
    const ii = i&255, jj = j&255, kk = k&255;
    const gi0 = pm12[ii+     perm[jj+     perm[kk   ]]];
    const gi1 = pm12[ii+i1+  perm[jj+j1+  perm[kk+k1]]];
    const gi2 = pm12[ii+i2+  perm[jj+j2+  perm[kk+k2]]];
    const gi3 = pm12[ii+1+   perm[jj+1+   perm[kk+1 ]]];

    let n0=0,n1=0,n2=0,n3=0;
    let t0=0.6-x0*x0-y0*y0-z0*z0; if(t0>=0){t0*=t0;n0=t0*t0*dot3(GRAD3[gi0],x0,y0,z0);}
    let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1>=0){t1*=t1;n1=t1*t1*dot3(GRAD3[gi1],x1,y1,z1);}
    let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2>=0){t2*=t2;n2=t2*t2*dot3(GRAD3[gi2],x2,y2,z2);}
    let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3>=0){t3*=t3;n3=t3*t3*dot3(GRAD3[gi3],x3,y3,z3);}

    return 32 * (n0 + n1 + n2 + n3);
  }
}

/**
 * Fractional Brownian Motion – stacks octaves of SimplexNoise.
 * Returns value in roughly [-1, 1].
 */
export function fbm(noise, x, y, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
  let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (let o = 0; o < octaves; o++) {
    value    += noise.noise2D(x * frequency, y * frequency) * amplitude;
    maxVal   += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxVal;
}

/** Domain-warped fBm for more interesting terrain */
export function warpedFbm(noise, x, y, octaves = 6) {
  const qx = fbm(noise, x          , y          , octaves);
  const qy = fbm(noise, x + 5.2    , y + 1.3    , octaves);
  return      fbm(noise, x + 4*qx  , y + 4*qy   , octaves);
}
