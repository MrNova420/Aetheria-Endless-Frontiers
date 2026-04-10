/**
 * src/space.js
 */
import * as THREE from 'three';
import { SpaceShader } from './shaders.js';
import { PlanetGenerator } from './planet.js';

function seededRng(seed) {
  let s=(seed>>>0)||1;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};
}

export class SpaceScene {
  constructor(scene, galaxy) {
    this.scene = scene;
    this.galaxy = galaxy;
    this.skyMesh = null;
    this.skyMat = null;
    this.planetMeshes = [];
    this.asteroidMesh = null;
    this.sunMesh = null;
    this.stationMesh = null;
    this.starPoints = null;
    this.currentSystem = null;
    this._buildStarfield();
    this._buildSky();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(500000, 32, 16);
    geo.scale(-1,1,1);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SpaceShader.uniforms),
      vertexShader: SpaceShader.vertexShader,
      fragmentShader: SpaceShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.skyMat.uniforms.uNebulaColor1.value = new THREE.Color(0.3,0.1,0.5);
    this.skyMat.uniforms.uNebulaColor2.value = new THREE.Color(0.1,0.2,0.4);
    this.skyMat.uniforms.uNebulaColor3.value = new THREE.Color(0.4,0.1,0.2);
    this.skyMat.uniforms.uStarDensity.value = 1.0;
    this.skyMesh = new THREE.Mesh(geo, this.skyMat);
    this.scene.add(this.skyMesh);
  }

  _buildStarfield() {
    const count = 50000;
    const pos = new Float32Array(count*3);
    const col = new Float32Array(count*3);
    const rng = seededRng(42);
    for (let i=0;i<count;i++){
      const theta=rng()*Math.PI*2, phi=Math.acos(2*rng()-1);
      const r=400000+rng()*50000;
      pos[i*3]  =r*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1]=r*Math.cos(phi);
      pos[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
      const t=rng();
      col[i*3]  =0.8+t*0.2;
      col[i*3+1]=0.85+t*0.1;
      col[i*3+2]=0.9+t*0.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col,3));
    const mat = new THREE.PointsMaterial({size:150,vertexColors:true,sizeAttenuation:true,depthWrite:false});
    this.starPoints = new THREE.Points(geo, mat);
    this.scene.add(this.starPoints);
  }

  enterSystem(systemData) {
    this._clearSystem();
    this.currentSystem = systemData;
    const rng = seededRng(systemData.seed || 12345);

    // Nebula colours per system
    const nc1 = new THREE.Color().setHSL(rng(), 0.6, 0.3);
    const nc2 = new THREE.Color().setHSL(rng(), 0.5, 0.25);
    const nc3 = new THREE.Color().setHSL(rng(), 0.7, 0.2);
    this.skyMat.uniforms.uNebulaColor1.value.copy(nc1);
    this.skyMat.uniforms.uNebulaColor2.value.copy(nc2);
    this.skyMat.uniforms.uNebulaColor3.value.copy(nc3);

    // Sun – emissive sphere + corona rings
    const starColor = new THREE.Color(systemData.starColor || '#ffeeaa');
    const starRadius = systemData.starRadius || 800;
    const sunGeo = new THREE.SphereGeometry(starRadius, 32, 16);
    const sunMat = new THREE.MeshStandardMaterial({
      color: starColor,
      emissive: starColor,
      emissiveIntensity: systemData.starIntensity || 1.4,
      roughness: 1.0,
      metalness: 0.0,
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(0, 0, 0);
    this.scene.add(this.sunMesh);

    // Corona glow rings (additive planes)
    for (let r = 0; r < 3; r++) {
      const scale = 1.3 + r * 0.5;
      const fGeo = new THREE.SphereGeometry(starRadius * scale, 24, 12);
      const fMat = new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.06 / (r + 1),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      });
      this.sunMesh.add(new THREE.Mesh(fGeo, fMat));
    }

    // Lens flare billboard
    const fGeo2 = new THREE.PlaneGeometry(starRadius * 5, starRadius * 5);
    const fMat2 = new THREE.MeshBasicMaterial({
      color: starColor,
      transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    this.sunMesh.add(new THREE.Mesh(fGeo2, fMat2));

    // Binary companion star (if present)
    if (systemData.binaryCompanion) {
      const bc = systemData.binaryCompanion;
      const bcColor = new THREE.Color(bc.color || '#aaddff');
      const bcGeo = new THREE.SphereGeometry(bc.radius, 24, 12);
      const bcMat = new THREE.MeshStandardMaterial({
        color: bcColor, emissive: bcColor,
        emissiveIntensity: bc.intensity || 0.5,
        roughness: 1.0, metalness: 0.0
      });
      const bcMesh = new THREE.Mesh(bcGeo, bcMat);
      bcMesh.position.set(bc.offset || 2500, 0, 0);
      // Corona
      const bcCorona = new THREE.SphereGeometry(bc.radius * 1.6, 16, 8);
      const bcCoronaMat = new THREE.MeshBasicMaterial({
        color: bcColor, transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide
      });
      bcMesh.add(new THREE.Mesh(bcCorona, bcCoronaMat));
      this.scene.add(bcMesh);
      this.planetMeshes.push(bcMesh); // track for cleanup
    }

    // Planets
    const planets = PlanetGenerator.getSystemPlanets(systemData.seed, systemData);
    planets.forEach((pc, i) => {
      this.buildPlanetSphere(pc, i);
    });

    // Space station
    this._buildStation();

    // Asteroid belt (wider + more varied)
    this._buildAsteroids(rng);
  }

  buildPlanetSphere(planetConfig, idx) {
    const r = Math.max(50, (planetConfig.radius || 800) / 15);
    const geo = new THREE.SphereGeometry(r, 48, 24);
    const orbitR = planetConfig.orbitRadius || (600 + idx*300);
    const angle = (idx || 0) * 1.3;

    // Procedural surface shader inline
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor1:  { value: planetConfig.vegetationColor || new THREE.Color(0.3,0.5,0.2) },
        uColor2:  { value: planetConfig.rockColor       || new THREE.Color(0.5,0.4,0.3) },
        uColor3:  { value: planetConfig.atmosphereColor || new THREE.Color(0.2,0.4,0.8) },
        uSeed:    { value: (planetConfig.seed||1)*0.001 }
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main(){ vN=normal; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor1, uColor2, uColor3;
        uniform float uSeed;
        varying vec3 vN, vP;
        float hash(vec3 p){p=fract(p*vec3(0.1031,0.103,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
        float fbm(vec3 p){float v=0.,a=0.5;for(int i=0;i<4;i++){v+=a*hash(p);a*=0.5;p*=2.;}return v;}
        void main(){
          vec3 n=normalize(vN);
          float h=fbm(vP*0.05+uSeed);
          float lat=abs(n.y);
          vec3 c=mix(uColor1,uColor2,h);
          c=mix(c,uColor3,lat*0.6);
          c=mix(c,vec3(0.9,0.93,0.98),smoothstep(0.7,0.9,lat));
          float diff=max(dot(n,normalize(vec3(1,1,0.5))),0.1);
          gl_FragColor=vec4(c*diff,1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle)*orbitR, 0, Math.sin(angle)*orbitR);
    mesh.userData.planetConfig = planetConfig;
    mesh.userData.orbitRadius = orbitR;
    mesh.userData.orbitAngle = angle;
    mesh.userData.orbitSpeed = planetConfig.orbitSpeed || 0.00005;
    this.scene.add(mesh);
    this.planetMeshes.push(mesh);
    return mesh;
  }

  _buildStation() {
    const group = new THREE.Group();
    // Torus ring
    const tGeo = new THREE.TorusGeometry(200, 20, 16, 64);
    const tMat = new THREE.MeshPhongMaterial({ color:0x445566, shininess:60 });
    group.add(new THREE.Mesh(tGeo, tMat));
    // Core cylinder
    const cGeo = new THREE.CylinderGeometry(15,15,100,16);
    group.add(new THREE.Mesh(cGeo, tMat));
    // Solar panels
    for (let i=0;i<4;i++){
      const pGeo = new THREE.BoxGeometry(200,2,40);
      const pMat = new THREE.MeshPhongMaterial({color:0x224488});
      const panel = new THREE.Mesh(pGeo, pMat);
      panel.rotation.y = i*Math.PI/2;
      panel.position.set(Math.cos(i*Math.PI/2)*210,0,Math.sin(i*Math.PI/2)*210);
      group.add(panel);
    }
    group.position.set(800, 300, -500);
    group.rotation.x = Math.PI/6;
    this.stationMesh = group;
    this.scene.add(group);
  }

  _buildAsteroids(rng) {
    // Two instanced meshes: main belt + scattered debris field
    const mainCount  = 500;
    const scatCount  = 150;
    const geo = new THREE.IcosahedronGeometry(1, 1);

    const buildBelt = (count, minR, maxR, ySpread, sizeMin, sizeMax) => {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x445566).lerpColors(new THREE.Color(0x334455), new THREE.Color(0x667788), rng()),
        roughness: 0.9, metalness: 0.2
      });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const mx = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const angle = rng() * Math.PI * 2;
        const r = minR + rng() * (maxR - minR);
        const y = (rng() - 0.5) * ySpread;
        const s = sizeMin + rng() * (sizeMax - sizeMin);
        const rot = new THREE.Euler(rng()*Math.PI*2, rng()*Math.PI*2, rng()*Math.PI*2);
        mx.makeRotationFromEuler(rot);
        const scale = new THREE.Matrix4().makeScale(s, s * (0.6 + rng() * 0.8), s * (0.7 + rng() * 0.6));
        mx.multiply(scale);
        mx.setPosition(Math.cos(angle)*r, y, Math.sin(angle)*r);
        inst.setMatrixAt(i, mx);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
      return inst;
    };

    // Main belt between outer planets
    const belt1 = buildBelt(mainCount, 2200, 3200, 250, 8, 55);
    // Inner debris ring (closer)
    const belt2 = buildBelt(scatCount, 1400, 1800, 100, 3, 22);

    this.asteroidMesh = belt1;
    this._asteroidMesh2 = belt2;
  }

  _clearSystem() {
    for (const m of this.planetMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this.planetMeshes = [];
    if (this.sunMesh) {
      this.sunMesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.scene.remove(this.sunMesh);
    }
    if (this.stationMesh) {
      this.stationMesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.scene.remove(this.stationMesh);
    }
    if (this.asteroidMesh) {
      this.scene.remove(this.asteroidMesh);
      this.asteroidMesh.geometry.dispose();
      this.asteroidMesh.material.dispose();
    }
    if (this._asteroidMesh2) {
      this.scene.remove(this._asteroidMesh2);
      this._asteroidMesh2.geometry.dispose();
      this._asteroidMesh2.material.dispose();
      this._asteroidMesh2 = null;
    }
    this.sunMesh = null; this.stationMesh = null; this.asteroidMesh = null;
  }

  update(dt, shipPos, shipVel) {
    if (this.skyMat) this.skyMat.uniforms.uTime.value += dt;
    // Orbit planets
    for (const m of this.planetMeshes) {
      m.userData.orbitAngle = (m.userData.orbitAngle||0) + (m.userData.orbitSpeed||0.00005)*dt;
      const r = m.userData.orbitRadius||500;
      const a = m.userData.orbitAngle;
      m.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
      m.rotation.y += 0.001*dt;
    }
    if (this.sunMesh) { this.sunMesh.rotation.y += 0.0001*dt; }
    if (this.stationMesh) { this.stationMesh.rotation.y += 0.0002*dt; }
    if (this.starPoints && shipPos) this.starPoints.position.copy(shipPos);
    if (this.skyMesh && shipPos) this.skyMesh.position.copy(shipPos);
  }

  getPlanetAt(pos, radius) {
    for (const m of this.planetMeshes) {
      if (m.position.distanceTo(pos) < radius) return m.userData.planetConfig;
    }
    return null;
  }

  getStationAt(pos) {
    if (this.stationMesh && this.stationMesh.position.distanceTo(pos) < 500) return this.stationMesh;
    return null;
  }

  dispose() {
    this._clearSystem();
    if (this.skyMesh) { this.scene.remove(this.skyMesh); this.skyMesh.geometry.dispose(); this.skyMat.dispose(); }
    if (this.starPoints) { this.scene.remove(this.starPoints); this.starPoints.geometry.dispose(); this.starPoints.material.dispose(); }
  }
}
