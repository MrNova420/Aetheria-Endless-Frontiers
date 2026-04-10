/**
 * src/mining.js
 */
import * as THREE from 'three';

let _nodeId = 0;

function buildCarbonNode(color) {
  const g = new THREE.Group();
  for (let i=0;i<3;i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.3+i*0.1, 6, 6),
      new THREE.MeshLambertMaterial({ color: color||0x44aa22 })
    );
    m.position.set(Math.cos(i*2.1)*0.4,0.4+i*0.2,Math.sin(i*2.1)*0.4);
    g.add(m);
  }
  return g;
}

function buildFerriteNode() {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6,1),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  m.scale.set(1,0.5,1.3);
  const g = new THREE.Group(); g.add(m); return g;
}

function buildCopperNode(rng) {
  const g = new THREE.Group();
  for (let i=0;i<3;i++) {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35,0),
      new THREE.MeshPhongMaterial({ color:0xcc6622, emissive:0x442200, emissiveIntensity:0.3, shininess:80 })
    );
    m.position.set((rng()-0.5)*0.6, 0.3+i*0.3, (rng()-0.5)*0.6);
    g.add(m);
  }
  return g;
}

function buildGoldNode(rng) {
  const g = new THREE.Group();
  for (let i=0;i<2;i++) {
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3,0),
      new THREE.MeshPhongMaterial({ color:0xddaa00, emissive:0x553300, emissiveIntensity:0.5, shininess:120 })
    );
    m.position.set((rng()-0.5)*0.5, 0.3+i*0.35, (rng()-0.5)*0.5);
    g.add(m);
  }
  return g;
}

function buildUraniumNode() {
  const g = new THREE.Group();
  for (let i=0;i<4;i++) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.15,0.8+i*0.2,5),
      new THREE.MeshPhongMaterial({ color:0x22ff44, emissive:0x00aa22, emissiveIntensity:0.8, shininess:60 })
    );
    m.position.set(Math.cos(i*1.57)*0.4, 0.4+i*0.1, Math.sin(i*1.57)*0.4);
    g.add(m);
  }
  return g;
}

function buildDiHydrogenNode() {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2,0.3,1.5,6),
    new THREE.MeshPhongMaterial({ color:0x4499ff, emissive:0x0044ff, emissiveIntensity:1.0, transparent:true, opacity:0.85 })
  );
  m.position.y = 0.75;
  const g = new THREE.Group(); g.add(m); return g;
}

function buildEmerilNode() {
  const g = new THREE.Group();
  for (let i=0;i<3;i++) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.2,1.0,5),
      new THREE.MeshPhongMaterial({ color:0x00ffcc, emissive:0x007755, emissiveIntensity:0.7, shininess:100 })
    );
    m.position.set(Math.cos(i*2.1)*0.35, 0.5, Math.sin(i*2.1)*0.35);
    m.rotation.z=(Math.random()-0.5)*0.5;
    g.add(m);
  }
  return g;
}

const NODE_BUILDERS = {
  'Carbon':        (_r) => buildCarbonNode(0x44aa22),
  'Ferrite Dust':  (_r) => buildFerriteNode(),
  'Copper':        (rng) => buildCopperNode(rng),
  'Gold':          (rng) => buildGoldNode(rng),
  'Uranium':       (_r) => buildUraniumNode(),
  'Di-Hydrogen':   (_r) => buildDiHydrogenNode(),
  'Emeril':        (_r) => buildEmerilNode(),
  'Sodium':        (_r) => buildCarbonNode(0xffdd44),
  'Oxygen':        (_r) => buildCarbonNode(0x88ddff),
  'Cobalt':        (_r) => buildCarbonNode(0x4455ff),
  'Titanium':      (_r) => buildFerriteNode(),
  'Pure Ferrite':  (_r) => buildFerriteNode(),
  'Condensed Carbon': (_r) => buildCarbonNode(0x336633),
  'Platinum':      (rng) => buildGoldNode(rng),
  'Chromatic Metal':  (rng) => buildCopperNode(rng),
  'Indium':        (_r) => buildEmerilNode()
};

export class MiningSystem {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    this.nodes = new Map();
    this._beamLine = null;
    this._particles = null;
    this._miningTarget = null;
    this._miningProgress = 0;
    this._respawnQueue = [];
  }

  spawnResourceNode(pos, resourceType, amount, planetSeed) {
    const id = _nodeId++;
    const nodeRng = this._rng(((planetSeed || 0) ^ id * 2654435761) >>> 0);
    const builder = NODE_BUILDERS[resourceType] || ((_r) => buildFerriteNode());
    const group = builder(nodeRng);
    group.position.copy(pos);
    group.userData.nodeId = id;
    group.userData.resourceType = resourceType;
    group.userData.amount = amount;
    group.userData.maxAmount = amount;
    this.scene.add(group);
    this.nodes.set(id, { id, group, pos: pos.clone(), resourceType, amount, respawnAt: -1 });
    return id;
  }

  spawnForChunk(cx, cz, planet) {
    const cs = 192;
    const rng = this._rng((cx*7919+cz*1031)>>>0);
    const weights = planet.resourceWeights || {};
    const types = Object.keys(weights);
    if (!types.length) return;
    const count = 4 + Math.floor(rng()*8);
    for (let i=0;i<count;i++) {
      const lx=(rng()-0.5)*cs;
      const lz=(rng()-0.5)*cs;
      const wx=cx*cs+lx, wz=cz*cs+lz;
      let total=0; for(const t of types) total+=weights[t];
      let roll=rng()*total, pick=types[0];
      for(const t of types){roll-=weights[t];if(roll<=0){pick=t;break;}}
      const amount = 50+Math.floor(rng()*150);
      const pos = new THREE.Vector3(wx, 0, wz);
      this.spawnResourceNode(pos, pick, amount, planet.seed);
    }
  }

  removeForChunk(cx, cz) {
    const cs=192;
    const ox=cx*cs, oz=cz*cs;
    for(const [id,node] of this.nodes){
      if(Math.abs(node.pos.x-ox)<cs && Math.abs(node.pos.z-oz)<cs){
        this.scene.remove(node.group);
        node.group.traverse(c=>{
          if(c.geometry) c.geometry.dispose();
          if(c.material) c.material.dispose();
        });
        this.nodes.delete(id);
      }
    }
  }

  update(dt, playerPos, isMining, miningDir, getHeightAt) {
    const now = Date.now() / 1000;

    if (getHeightAt) {
      for (const [, node] of this.nodes) {
        if (!node._heightSet) {
          node.pos.y = getHeightAt(node.pos.x, node.pos.z) + 0.5;
          node.group.position.copy(node.pos);
          node._heightSet = true;
        }
      }
    }

    for (let i=this._respawnQueue.length-1;i>=0;i--){
      const r=this._respawnQueue[i];
      if(now>=r.at){
        this.spawnResourceNode(r.pos,r.type,r.amount,0);
        this._respawnQueue.splice(i,1);
      }
    }

    if (isMining && playerPos) {
      let nearest=null, nearDist=8;
      for(const [,node] of this.nodes){
        const d=node.pos.distanceTo(playerPos);
        if(d<nearDist){nearDist=d;nearest=node;}
      }
      if(nearest){
        this._miningTarget=nearest;
        this._miningProgress+=dt*2;
        this._updateBeam(playerPos, nearest.pos);
        if(this._miningProgress>=1){
          this._miningProgress=0;
          const take=Math.min(10,nearest.amount);
          nearest.amount-=take;
          if(this.inventory) this.inventory.addItem(nearest.resourceType, take);
          if(nearest.amount<=0){
            this.scene.remove(nearest.group);
            nearest.group.traverse(c=>{
              if(c.geometry) c.geometry.dispose();
              if(c.material) c.material.dispose();
            });
            this.nodes.delete(nearest.id);
            this._respawnQueue.push({at:now+180,pos:nearest.pos.clone(),type:nearest.resourceType,amount:nearest.maxAmount||100});
            this._clearBeam();
            this._miningTarget=null;
          }
        }
      } else {
        this._clearBeam();
        this._miningTarget=null;
        this._miningProgress=0;
      }
    } else {
      this._clearBeam();
      this._miningTarget=null;
      this._miningProgress=0;
    }

    for(const[,node] of this.nodes){
      node.group.rotation.y+=dt*0.3;
    }
  }

  _updateBeam(from, to) {
    this._clearBeam();
    const pts=[from.clone(),to.clone()];
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=new THREE.LineBasicMaterial({color:0xff4400,linewidth:2});
    this._beamLine=new THREE.Line(geo,mat);
    this.scene.add(this._beamLine);
  }

  _clearBeam(){
    if(this._beamLine){
      this.scene.remove(this._beamLine);
      this._beamLine.geometry.dispose();
      this._beamLine.material.dispose();
      this._beamLine=null;
    }
  }

  getNodesNear(pos, radius) {
    const result=[];
    for(const[,node] of this.nodes){
      if(node.pos.distanceTo(pos)<radius) result.push(node);
    }
    return result;
  }

  removeNode(id){
    const node=this.nodes.get(id);
    if(!node)return;
    this.scene.remove(node.group);
    node.group.traverse(c=>{
      if(c.geometry) c.geometry.dispose();
      if(c.material) c.material.dispose();
    });
    this.nodes.delete(id);
  }

  getMiningProgress(){return this._miningProgress;}
  getMiningTarget(){return this._miningTarget;}

  _rng(seed){
    let s=(seed>>>0)||1;
    return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};
  }

  dispose(){
    for(const[,node] of this.nodes){
      this.scene.remove(node.group);
      node.group.traverse(c=>{
        if(c.geometry) c.geometry.dispose();
        if(c.material) c.material.dispose();
      });
    }
    this.nodes.clear();
    this._clearBeam();
  }
}
