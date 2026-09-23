(function(){
'use strict';
const QS=new URLSearchParams(location.search);
const CAPTURE=QS.has('capture');

/* ------------------------------------------------------------------ utils */
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let R=rng(3120);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const sm=(t,a,b)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
const $=id=>document.getElementById(id);
function wrapA(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

/* ------------------------------------------------------------------ renderer */
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!CAPTURE,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURE});
renderer.setPixelRatio(CAPTURE?parseFloat(QS.get('pr')||'1'):Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.92;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#0b0d1a');
scene.fog=new THREE.Fog('#141733',120,420);
const camera=new THREE.PerspectiveCamera(64,1,0.05,900);
function resize(){ const w=canvas.clientWidth||innerWidth, h=canvas.clientHeight||innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
addEventListener('resize',resize);

/* ------------------------------------------------------------------ textures */
function ctex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } return t; }
const r0=rng(7);
const TX={
  floor: ctex(512,512,(g,w,h)=>{ for(let y=0;y<h;y+=32){ let x=-r0()*200; while(x<w){ const L=120+r0()*180; const s=90+r0()*30|0;
      g.fillStyle=`rgb(${s+40},${s-2},${s-40})`; g.fillRect(x,y,L,32); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y,2,32); g.fillRect(x,y,L,1.5);
      for(let k=0;k<6;k++){ g.fillStyle=`rgba(60,30,10,${.05+r0()*.08})`; g.fillRect(x,y+4+r0()*24,L,1); } x+=L; } } },[6,5]),
  tile: ctex(256,256,(g,w,h)=>{ g.fillStyle='#d9d4c7'; g.fillRect(0,0,w,h); g.fillStyle='#b8b2a4'; for(let i=0;i<=8;i++){ g.fillRect(i*32-1,0,2,h); g.fillRect(0,i*32-1,w,2);} for(let k=0;k<30;k++){ g.fillStyle='rgba(120,160,170,.18)'; g.fillRect((r0()*8|0)*32+1,(r0()*8|0)*32+1,30,30);} },[8,2]),
  rug: ctex(512,384,(g,w,h)=>{ g.fillStyle='#7a2f3a'; g.fillRect(0,0,w,h); g.strokeStyle='#e0b36b'; g.lineWidth=10; g.strokeRect(24,24,w-48,h-48);
      g.lineWidth=3; g.strokeRect(48,48,w-96,h-96); g.fillStyle='#2f4c6b';
      for(let i=0;i<6;i++) for(let j=0;j<4;j++){ const x=90+i*66, y=90+j*62; g.save(); g.translate(x,y); g.rotate(Math.PI/4); g.fillRect(-16,-16,32,32); g.restore(); g.fillStyle=(i+j)%2?'#2f4c6b':'#e0b36b'; } }),
  wall: ctex(256,256,(g,w,h)=>{ g.fillStyle='#2b3052'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=32){ g.fillStyle='rgba(255,255,255,.035)'; g.fillRect(x,0,14,h);} },[10,3]),
  wood: ctex(256,64,(g,w,h)=>{ g.fillStyle='#8a5a3b'; g.fillRect(0,0,w,h); for(let k=0;k<40;k++){ g.strokeStyle=`rgba(50,25,10,${.1+r0()*.15})`; g.beginPath(); const y=r0()*h; g.moveTo(0,y); g.bezierCurveTo(w*.3,y+r0()*8-4,w*.6,y+r0()*8-4,w,y+r0()*6-3); g.stroke(); } }),
  fur: ctex(256,256,(g,w,h)=>{ g.fillStyle='#d8893e'; g.fillRect(0,0,w,h); for(let k=1;k<9;k++){ const y=k*28+r0()*6; g.fillStyle='rgba(125,52,16,.5)'; g.beginPath(); g.moveTo(0,y);
      for(let x=0;x<=w;x+=16) g.lineTo(x,y+Math.sin(x*.05+k)*4); for(let x=w;x>=0;x-=16) g.lineTo(x,y+7+Math.sin(x*.07+k*2)*3); g.fill(); }
      for(let k=0;k<1400;k++){ g.fillStyle=`rgba(255,225,180,${r0()*.12})`; g.fillRect(r0()*w,r0()*h,1,3);} }),
  tail: ctex(256,64,(g,w,h)=>{ g.fillStyle='#d8893e'; g.fillRect(0,0,w,h); for(let k=0;k<9;k++){ g.fillStyle='rgba(125,52,16,.55)'; g.fillRect(k*28+6,0,10,h);} g.fillStyle='#8a3f14'; g.fillRect(w-26,0,26,h); }),
  sky: ctex(1024,512,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#070a1f'); gr.addColorStop(.7,'#1e2552'); gr.addColorStop(1,'#4b3b6e'); g.fillStyle=gr; g.fillRect(0,0,w,h);
      for(let k=0;k<260;k++){ g.fillStyle=`rgba(255,255,255,${r0()*.8})`; g.fillRect(r0()*w,r0()*h*.6,1.2,1.2); }
      g.fillStyle='#fff4d8'; g.beginPath(); g.arc(760,120,38,0,7); g.fill(); g.fillStyle='rgba(255,244,216,.12)'; g.beginPath(); g.arc(760,120,80,0,7); g.fill();
      let x=0; while(x<w){ const bw=30+r0()*60, bh=60+r0()*190; g.fillStyle='#0e1128'; g.fillRect(x,h-bh,bw,bh);
        for(let yy=h-bh+8;yy<h-6;yy+=12) for(let xx=x+5;xx<x+bw-5;xx+=9) if(r0()<.35){ g.fillStyle=r0()<.8?'#ffcf7a':'#9fd0ff'; g.fillRect(xx,yy,4,6);} x+=bw+2; } }),
};
function glowTex(inner,outer){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,inner); gr.addColorStop(.25,outer); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); return new THREE.CanvasTexture(c); }
const GLOW=glowTex('rgba(255,245,220,1)','rgba(255,190,110,.45)');
const GLOWR=glowTex('rgba(255,220,180,1)','rgba(255,90,40,.5)');
const ZTEX=ctex(64,64,(g)=>{ g.font='bold 48px sans-serif'; g.fillStyle='#e8ecff'; g.textAlign='center'; g.fillText('z',32,48); });

/* ------------------------------------------------------------------ room */
const RX0=-160,RX1=160,RZ0=-110,RZ1=110,RY=95;
const SOLIDS=[];      // AABBs {x0,x1,y0,y1,z0,z1}
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},o||{}));
const BOX=new THREE.BoxGeometry(1,1,1);
function box(x0,x1,y0,y1,z0,z1,mat,solid=true,cast=true){ const m=new THREE.Mesh(BOX,mat); m.scale.set(x1-x0,y1-y0,z1-z0); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  m.castShadow=cast; m.receiveShadow=true; scene.add(m); if(solid) SOLIDS.push({x0,x1,y0,y1,z0,z1}); return m; }
function cyl(x,y,z,r,h,mat,solid=true,seg=16,rt){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt??r,r,h,seg),mat); m.position.set(x,y+h/2,z); m.castShadow=m.receiveShadow=true; scene.add(m);
  if(solid) SOLIDS.push({x0:x-r,x1:x+r,y0:y,y1:y+h,z0:z-r,z1:z+r}); return m; }

// floor, walls, ceiling
{ const f=new THREE.Mesh(new THREE.PlaneGeometry(RX1-RX0,RZ1-RZ0),M('#ffffff',{map:TX.floor,roughness:.55})); f.rotation.x=-Math.PI/2; f.receiveShadow=true; scene.add(f);
  const wm=M('#ffffff',{map:TX.wall,roughness:.95});
  box(RX0,RX1,0,RY,RZ0-2,RZ0,wm,false,false);                                 // back
  box(RX0,RX1,0,RY,RZ1,RZ1+2,wm,false,false);                                 // front
  box(RX1,RX1+2,0,RY,RZ0,RZ1,wm,false,false);                                 // right
  // left wall with a window hole  z -45..45, y 26..78
  box(RX0-2,RX0,0,26,RZ0,RZ1,wm,false,true); box(RX0-2,RX0,78,RY,RZ0,RZ1,wm,false,true);
  box(RX0-2,RX0,26,78,RZ0,-45,wm,false,true); box(RX0-2,RX0,26,78,45,RZ1,wm,false,true);
  const frame=M('#e9e2d4'); box(RX0-1,RX0+1,77,79,-46,46,frame,false); box(RX0-1,RX0+1,25,27,-46,46,frame,false); box(RX0-1,RX0+1,26,78,-1,1,frame,false);
  box(RX0-1,RX0+1,26,78,-46,-44,frame,false); box(RX0-1,RX0+1,26,78,44,46,frame,false);
  box(RX0,RX0+12,24,26.5,-48,48,M('#e9e2d4'));                                // sill
  const c=new THREE.Mesh(new THREE.PlaneGeometry(RX1-RX0,RZ1-RZ0),M('#1a1d38',{roughness:1})); c.rotation.x=Math.PI/2; c.position.y=RY; scene.add(c);
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(600,300),new THREE.MeshBasicMaterial({map:TX.sky,fog:false})); sky.position.set(RX0-160,60,0); sky.rotation.y=Math.PI/2; scene.add(sky);
  // skirting
  const sk=M('#e9e2d4'); box(RX0,RX1,0,4,RZ0,RZ0+1,sk,false,false); box(RX1-1,RX1,0,4,RZ0,RZ1,sk,false,false);
  // wall art
  const art=ctex(256,192,(g,w,h)=>{ g.fillStyle='#f1e6d0'; g.fillRect(0,0,w,h); g.fillStyle='#e0663d'; g.beginPath(); g.arc(90,100,52,0,7); g.fill(); g.fillStyle='#2f4c6b'; g.fillRect(130,40,90,110); g.fillStyle='#e0b36b'; g.fillRect(40,150,170,14); });
  const p=new THREE.Mesh(new THREE.PlaneGeometry(40,30),new THREE.MeshStandardMaterial({map:art,roughness:.9})); p.position.set(RX1-.5,60,20); p.rotation.y=-Math.PI/2; scene.add(p);
  box(RX1-1.4,RX1-.6,44,76,-2,42,M('#1d1a14'),false,false).position.x=RX1-1.2;
}
// kitchen run along the back wall
const cab=M('#2e5f63',{roughness:.6}), top=M('#7f786c',{roughness:.45}), steel=M('#b9c0c7',{metalness:.85,roughness:.28});
box(-150,-20,0,36,RZ0,RZ0+24,cab);
box(-152,-18,36,38.5,RZ0,RZ0+26,top);
box(-150,-20,58,84,RZ0,RZ0+14,cab);
{ const bs=new THREE.Mesh(new THREE.PlaneGeometry(130,20),M('#9d998f',{map:TX.tile,roughness:.35})); bs.position.set(-85,48,RZ0+.3); scene.add(bs); }
for(let x=-150;x<-20;x+=26){ box(x+12.6,x+13.4,4,34,RZ0+24,RZ0+24.4,M('#1e3f42'),false,false); box(x+11,x+15,26,27,RZ0+24.4,RZ0+25.4,steel,false,false); }
// stove
const BURNERS=[];
{ box(-98,-68,38.5,39,RZ0+3,RZ0+23,M('#141417',{roughness:.2,metalness:.4}),false,false);
  for(const [x,z] of [[-90,RZ0+8],[-76,RZ0+8],[-90,RZ0+18],[-76,RZ0+18]]){ const hot=(x===-90&&z===RZ0+18)||(x===-76&&z===RZ0+8);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.6,.45,8,28),new THREE.MeshBasicMaterial({color:hot?'#ff5a1f':'#2a2a30'})); ring.rotation.x=Math.PI/2; ring.position.set(x,39.3,z); scene.add(ring);
    if(hot){ const g=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWR,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9})); g.position.set(x,40,z); g.scale.set(16,10,1); scene.add(g);
      BURNERS.push({p:V(x,39,z),ring,g}); } } }
// sink + faucet
box(-58,-36,37.9,38.6,RZ0+5,RZ0+20,M('#6d767e',{metalness:.8,roughness:.3}),false,false);
{ const f=new THREE.Mesh(new THREE.TorusGeometry(5,.6,8,20,Math.PI),steel); f.position.set(-47,44,RZ0+4); f.rotation.y=Math.PI/2; scene.add(f); cyl(-47,38.5,RZ0+4,.8,5.5,steel,true,10); }
// kettle, toaster, cereal, mug
cyl(-128,38.5,RZ0+12,5,9,M('#d9523b',{roughness:.35}),true,20,4); cyl(-128,47.5,RZ0+12,1.4,1.4,M('#222'),false,10);
box(-118,-108,38.5,45,RZ0+6,RZ0+13,steel);
box(-32,-24,38.5,52,RZ0+4,RZ0+10,M('#f2c94c'));
{ const lbl=ctex(64,128,(g)=>{ g.fillStyle='#f2c94c'; g.fillRect(0,0,64,128); g.fillStyle='#d64f3a'; g.font='bold 16px sans-serif'; g.fillText('CRUNCH',4,40); g.beginPath(); g.arc(32,82,18,0,7); g.fill(); });
  const p=new THREE.Mesh(new THREE.PlaneGeometry(8,13.5),new THREE.MeshStandardMaterial({map:lbl})); p.position.set(-28,45.2,RZ0+10.05); scene.add(p); }
// fridge (door open, light spilling out)
const FRIDGE=M('#aeb4ba',{roughness:.4,metalness:.3});
box(-160,-132,0,84,RZ0,RZ0+2,FRIDGE); box(-160,-158,0,84,RZ0,-80,FRIDGE); box(-134,-132,0,84,RZ0,RZ0+6,FRIDGE); box(-160,-132,82,84,RZ0,-80,FRIDGE);
box(-160,-132,0,4,RZ0,-80,FRIDGE); box(-160,-132,46,47,RZ0,-80,FRIDGE);
{ const inside=new THREE.Mesh(new THREE.PlaneGeometry(26,78),new THREE.MeshBasicMaterial({color:'#fff6e0'})); inside.position.set(-146,43,RZ0+2.2); scene.add(inside);
  for(const y of [20,34,60,72]) box(-158,-134,y,y+.6,RZ0+2,-82,new THREE.MeshStandardMaterial({color:'#ffffff',transparent:true,opacity:.35}),false,false);
  const cols=['#e04b5a','#6ec26b','#f0e3c0','#4d8fd6','#ffb627'];
  for(let k=0;k<7;k++) cyl(-155+k*3.2,34.6,RZ0+10+ (k%2)*6,1.1,6+(k%3)*2,M(cols[k%5],{roughness:.3}),false,10);
  // open door
  const door=box(-134,-130,2,82,-80,-52,FRIDGE); SOLIDS.pop(); SOLIDS.push({x0:-134,x1:-130,y0:2,y1:82,z0:-80,z1:-52});
  for(const y of [22,40,58]) box(-130,-126,y,y+1,-78,-54,M('#f4f6f8'));
  const cone=new THREE.Mesh(new THREE.ConeGeometry(38,120,32,1,true),new THREE.MeshBasicMaterial({color:'#fff1cf',transparent:true,opacity:.045,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  cone.position.set(-90,30,-80); cone.rotation.z=Math.PI/2+.25; cone.rotation.y=-.35; scene.add(cone);
  const spot=new THREE.SpotLight('#ffe7bd',1.5,240,.8,.7,1.4); spot.position.set(-140,50,-95); spot.target.position.set(-60,0,-40); scene.add(spot,spot.target); }
// dining table + chairs + things
const TBL=M('#ffffff',{map:TX.wood,roughness:.5});
box(-100,-30,29,31.5,-4,40,TBL);
for(const [x,z] of [[-97,-1],[-33,-1],[-97,37],[-33,37]]) box(x-1.2,x+1.2,0,29,z-1.2,z+1.2,TBL);
for(const [x,z,s] of [[-80,-14,1],[-50,-14,1],[-80,54,-1],[-50,54,-1]]){ box(x-7,x+7,16,18,z-7,z+7,TBL); box(x-7,x+7,18,40,z+s*6,z+s*7.5,TBL);
  for(const [dx,dz] of [[-6,-6],[6,-6],[-6,6],[6,6]]) box(x+dx-.6,x+dx+.6,0,16,z+dz-.6,z+dz+.6,TBL,false); }
cyl(-78,31.5,12,7,.8,M('#f4f1ea',{roughness:.3}),false,24); cyl(-52,31.5,24,7,.8,M('#f4f1ea',{roughness:.3}),false,24);
cyl(-64,31.5,30,2.2,7,new THREE.MeshStandardMaterial({color:'#bfe3ff',transparent:true,opacity:.35,roughness:.05}),true,16);
const CANDLE={p:V(-40,31.5,6)};
{ cyl(-40,31.5,6,1.6,7,M('#f6ecd7'),true,12); const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:'#ffcf7a',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); fl.position.set(-40,40,6); fl.scale.set(5,7,1); scene.add(fl); CANDLE.fl=fl;
  const L=new THREE.PointLight('#ffb35c',1.3,90,1.6); L.position.set(-40,42,6); scene.add(L); CANDLE.L=L; }
// living room: rug, sofa, coffee table, tv, bookshelf, lamp, plant
{ const rug=new THREE.Mesh(new THREE.PlaneGeometry(120,86),M('#ffffff',{map:TX.rug,roughness:1})); rug.rotation.x=-Math.PI/2; rug.position.set(78,.12,8); rug.receiveShadow=true; scene.add(rug); }
const SOFA=M('#223447',{roughness:.95});
box(112,150,0,16,-36,52,SOFA); box(142,152,16,36,-36,52,SOFA); box(112,152,16,25,-40,-32,SOFA); box(112,152,16,25,48,56,SOFA);
for(const z of [-20,4,28]) box(114,141,16,19,z-11,z+11,M('#2a4460',{roughness:1}),false);
box(132,142,19,28,-28,-16,M('#e0b36b',{roughness:1}),false);            // cushion
box(62,98,15,17,-4,20,TBL); for(const [x,z] of [[64,-2],[96,-2],[64,18],[96,18]]) box(x-1,x+1,0,15,z-1,z+1,TBL,false);
box(70,80,17,17.8,2,6,M('#1b1b20',{roughness:.4}));                     // remote
cyl(88,17,12,2,4,M('#e7e1d6',{roughness:.3}),true,16);                   // mug
box(14,30,0,18,-24,44,M('#262235',{roughness:.5}));                       // tv stand
const TVS=new THREE.MeshBasicMaterial({color:'#6fa4ff'});
box(20,22,20,50,-18,38,M('#101014',{roughness:.3})); { const scr=new THREE.Mesh(new THREE.PlaneGeometry(54,28),TVS); scr.position.set(22.1,35,10); scr.rotation.y=Math.PI/2; scene.add(scr); }
const TVL=new THREE.PointLight('#6fa4ff',1.5,130,1.4); TVL.position.set(40,35,10); scene.add(TVL);
box(60,100,0,77,RZ0,RZ0+13,TBL); for(const y of [0,15,30,45,60,75]) box(60,100,y,y+1.6,RZ0,RZ0+13,TBL,false);
SOLIDS.pop();       // shelves are hollow: keep back, sides and planks
SOLIDS.push({x0:60,x1:100,y0:0,y1:77,z0:RZ0,z1:RZ0+4},{x0:60,x1:61.5,y0:0,y1:77,z0:RZ0,z1:RZ0+13},{x0:98.5,x1:100,y0:0,y1:77,z0:RZ0,z1:RZ0+13});
for(const y of [0,15,30,45,60,75]) SOLIDS.push({x0:60,x1:100,y0:y,y1:y+1.6,z0:RZ0,z1:RZ0+13});
{ const bc=['#d9523b','#2f4c6b','#e0b36b','#6ec26b','#e9e2d4','#7a2f3a','#4a6f8f'];
  for(const y of [1.6,16.6,31.6,46.6,61.6]){ let x=62; while(x<96){ const w=1.6+R()*2.4, h=8+R()*5; if(R()<.14){ x+=3; continue; }
    box(x,x+w,y,y+h,RZ0+3,RZ0+11,M(bc[Math.floor(R()*bc.length)],{roughness:.8}),false); x+=w+.2; } } }
{ cyl(150,0,-96,5,1.5,M('#222'),true,16); cyl(150,1.5,-96,.6,58,M('#222'),true,8);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(6,10,11,20,1,true),new THREE.MeshStandardMaterial({color:'#ffd9a0',emissive:'#ffb866',emissiveIntensity:.9,side:THREE.DoubleSide}));
  shade.position.set(150,64,-96); scene.add(shade); SOLIDS.push({x0:140,x1:160,y0:58,y1:70,z0:-106,z1:-86});
  const L=new THREE.PointLight('#ffbd73',1.6,170,1.5); L.position.set(150,62,-96); scene.add(L); }
{ cyl(-150,26.5,28,3.5,6,M('#b8643e'),true,14,4.5); const leaf=M('#3f7a4a',{roughness:.9,flatShading:true});
  for(let k=0;k<7;k++){ const l=new THREE.Mesh(new THREE.ConeGeometry(1.4,10,5),leaf); l.position.set(-150+Math.cos(k)*2,37,28+Math.sin(k)*2); l.rotation.set(Math.sin(k*2)*.5,0,Math.cos(k*2)*.5); l.castShadow=true; scene.add(l); } }
// ceiling fan
const FAN={c:V(70,80,10),blades:new THREE.Group(),r:27};
{ cyl(70,82,10,.6,13,M('#1c1c22'),false,8); const hub=cyl(70,79,10,3,3,M('#1c1c22'),false,16);
  FAN.blades.position.set(70,80,10); for(let k=0;k<4;k++){ const b=new THREE.Mesh(BOX,M('#6b4a34',{roughness:.6})); b.scale.set(24,.5,5); b.position.set(Math.cos(k*Math.PI/2)*14,0,Math.sin(k*Math.PI/2)*14); b.rotation.y=-k*Math.PI/2; b.castShadow=true; FAN.blades.add(b); }
  scene.add(FAN.blades); }

/* lights */
scene.add(new THREE.HemisphereLight('#4a5896','#140f20',0.42));
const moon=new THREE.DirectionalLight('#9fb7ff',0.72); moon.position.set(-320,190,40); moon.target.position.set(-40,0,0);
moon.castShadow=true; moon.shadow.mapSize.set(2048,2048); Object.assign(moon.shadow.camera,{left:-190,right:190,top:130,bottom:-130,near:10,far:700}); moon.shadow.bias=-.0005; moon.shadow.normalBias=.3;
scene.add(moon,moon.target);
const under=new THREE.PointLight('#ffd08a',.35,60,2); under.position.set(-85,55,RZ0+16); scene.add(under);
{ const strip=new THREE.Mesh(new THREE.PlaneGeometry(128,1.2),new THREE.MeshBasicMaterial({color:'#c9a974'})); strip.rotation.x=Math.PI/2; strip.position.set(-85,57.9,RZ0+12); scene.add(strip); }
// window light shaft
{ const sh=new THREE.Mesh(new THREE.BoxGeometry(150,50,88),new THREE.MeshBasicMaterial({color:'#8fa6ff',transparent:true,opacity:.045,depthWrite:false,blending:THREE.AdditiveBlending}));
  sh.position.set(-95,34,0); sh.rotation.z=-.42; scene.add(sh); }
// dust motes
const DUST=(()=>{ const n=700, g=new THREE.BufferGeometry(), p=new Float32Array(n*3); for(let i=0;i<n;i++){ p[i*3]=lerp(RX0,RX1,R()); p[i*3+1]=R()*RY; p[i*3+2]=lerp(RZ0,RZ1,R()); }
  g.setAttribute('position',new THREE.BufferAttribute(p,3)); const m=new THREE.Points(g,new THREE.PointsMaterial({color:'#ffe9c4',size:.35,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending})); scene.add(m); return m; })();

/* ------------------------------------------------------------------ the cat */
const CAT={ g:new THREE.Group(), head:new THREE.Group(), eyes:[], paw:new THREE.Group(), tail:[], z:[], state:'sleep', wake:0, swipeT:-9, cool:0, calm:0, noise:0,
  perch:0, jumpT:-1 };
const PERCHES=[ {p:V(126,19,8),yaw:Math.PI/2}, {p:V(-66,31.5,18),yaw:-Math.PI/2+.4}, {p:V(-40,38.5,RZ0+14),yaw:.3} ];
{ const fur=new THREE.MeshStandardMaterial({map:TX.fur,roughness:1}), white=M('#f3e7d6',{roughness:1}), pink=M('#e8a0a0');
  const bg=new THREE.SphereGeometry(1,28,18); bg.rotateX(Math.PI/2); const body=new THREE.Mesh(bg,fur); body.scale.set(5.2,4.4,9); body.position.set(0,4.2,0); body.castShadow=true; CAT.g.add(body); CAT.body=body;
  const chest=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),white); chest.scale.set(3.6,3.2,3); chest.position.set(0,3.8,-6.3); CAT.g.add(chest);
  CAT.head.position.set(0,7.6,-8.6); CAT.g.add(CAT.head);
  const skull=new THREE.Mesh(new THREE.SphereGeometry(3.6,24,18),M('#d8893e',{roughness:1})); skull.scale.set(1.1,.95,1); skull.castShadow=true; CAT.head.add(skull);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(1.6,16,12),white); muzzle.scale.set(1.2,.8,.9); muzzle.position.set(0,-1.2,-2.9); CAT.head.add(muzzle);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.45,10,8),pink); nose.position.set(0,-.5,-4.1); CAT.head.add(nose);
  for(const s of [-1,1]){ const ear=new THREE.Mesh(new THREE.ConeGeometry(1.5,3,4),M('#c97b35',{roughness:1})); ear.position.set(s*2.2,3.4,-.4); ear.rotation.z=-s*.35; ear.castShadow=true; CAT.head.add(ear); CAT['ear'+s]=ear;
    const e=new THREE.Mesh(new THREE.SphereGeometry(.85,16,12),new THREE.MeshStandardMaterial({color:'#9dff4a',emissive:'#6dff1a',emissiveIntensity:1.6,roughness:.2}));
    e.position.set(s*1.45,.7,-3.1); CAT.head.add(e); const pupil=new THREE.Mesh(new THREE.BoxGeometry(.22,1.3,.2),new THREE.MeshBasicMaterial({color:'#050505'})); pupil.position.set(0,0,-.78); e.add(pupil);
    CAT.eyes.push({e,lid:null,pupil});
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:'#b8ff5c',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0})); gl.scale.set(5,5,1); gl.position.copy(e.position); gl.position.z-=.6; CAT.head.add(gl); CAT.eyes[CAT.eyes.length-1].gl=gl;
    for(let k=0;k<3;k++){ const w=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,5,3),white); w.rotation.z=Math.PI/2+s*(k-1)*.15; w.position.set(s*2.8,-1.2+k*.2,-3.1); CAT.head.add(w); } }
  // paws: resting front paws + the swiping one
  for(const s of [-1]){ const pw=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,10),white); pw.scale.set(1,.6,1.5); pw.position.set(s*2,.8,-10.2); CAT.g.add(pw); }
  CAT.paw.position.set(2.2,3.2,-7.5); CAT.g.add(CAT.paw);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,6,10),M('#d8893e',{roughness:1})); arm.position.set(0,-2.2,-1.2); arm.rotation.x=.9; CAT.paw.add(arm);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(1.3,12,10),white); hand.scale.set(1,.7,1.4); hand.position.set(0,-3.8,-3.4); CAT.paw.add(hand); CAT.hand=hand;
  for(let k=0;k<3;k++){ const cl=new THREE.Mesh(new THREE.ConeGeometry(.18,.9,5),M('#f7f7f2')); cl.position.set((k-1)*.55,-4.2,-4.7); cl.rotation.x=-1.9; CAT.paw.add(cl); }
  // tail
  CAT.tailMat=new THREE.MeshStandardMaterial({map:TX.tail,roughness:1}); CAT.tailMesh=new THREE.Mesh(new THREE.BufferGeometry(),CAT.tailMat); CAT.tailMesh.castShadow=true; CAT.g.add(CAT.tailMesh);
  // z's
  for(let k=0;k<3;k++){ const z=new THREE.Sprite(new THREE.SpriteMaterial({map:ZTEX,transparent:true,depthWrite:false})); z.scale.set(3,3,1); scene.add(z); CAT.z.push(z); }
  CAT.g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); scene.add(CAT.g);
  CAT.g.position.copy(PERCHES[0].p); CAT.g.rotation.y=PERCHES[0].yaw; }
const catHeadWorld=new THREE.Vector3();
function updateCat(dt){
  const t=S.t;
  // jumping between perches (play mode only)
  if(CAT.jumpT>=0){ CAT.jumpT+=dt/1.1; const a=PERCHES[CAT.from].p, b=PERCHES[CAT.perch].p, k=sm(CAT.jumpT,0,1);
    CAT.g.position.lerpVectors(a,b,k); CAT.g.position.y+=Math.sin(Math.PI*clamp(CAT.jumpT,0,1))*28; CAT.g.rotation.y=lerp(PERCHES[CAT.from].yaw,PERCHES[CAT.perch].yaw,k);
    if(CAT.jumpT>=1){ CAT.jumpT=-1; } }
  else if(!CAPTURE && !S.auto && CAT.state==='sleep' && (CAT.nextMove-=dt)<=0){ CAT.nextMove=35+R()*25; CAT.from=CAT.perch; CAT.perch=(CAT.perch+1+Math.floor(R()*2))%PERCHES.length; CAT.jumpT=0; }
  CAT.head.getWorldPosition(catHeadWorld);
  const d=catHeadWorld.distanceTo(pos), spd=vel.length();
  // noise: fast flight nearby makes noise; it drains slowly
  const near=clamp(1-(d-10)/40,0,1);
  CAT.noise=clamp(CAT.noise+ (near*spd/18*1.3 - .22)*dt, 0, 1);
  if(CAT.state==='sleep' && (CAT.noise>=1 || d<20)){ CAT.state='awake'; CAT.calm=0; pop('!!','the cat is awake','var(--cat)'); }
  if(CAT.state==='awake'){
    CAT.calm = d>34 ? CAT.calm+dt : 0;
    if(CAT.calm>4.5){ CAT.state='sleep'; CAT.noise=.4; }
    CAT.cool-=dt;
    if(d<18.5 && CAT.cool<=0 && t-CAT.swipeT>1){ CAT.swipeT=t; CAT.cool=3.2; CAT.hitDone=false; }
  }
  // head tracking
  const awake=CAT.state==='awake';
  const local=CAT.g.worldToLocal(pos.clone());
  const hy=awake? clamp(Math.atan2(-local.x,-(local.z+8.6)),-1.1,1.1) : Math.sin(t*.4)*.05;
  const hp=awake? clamp(Math.atan2(local.y-7.6,Math.hypot(local.x,local.z+8.6)),-.5,.7) : -.35;
  CAT.head.rotation.y=lerp(CAT.head.rotation.y,hy,dt*8); CAT.head.rotation.x=lerp(CAT.head.rotation.x,hp,dt*8);
  CAT.head.position.y=lerp(CAT.head.position.y, awake?9.4:7.2, dt*4);
  for(const s of [-1,1]) CAT['ear'+s].rotation.x=lerp(CAT['ear'+s].rotation.x, awake?-.25:.3, dt*6);
  const open=awake?1:0; for(const e of CAT.eyes){ e.e.scale.y=lerp(e.e.scale.y, open?1.15:.1, dt*10); e.e.material.emissiveIntensity=open?1.6:.1; e.e.material.color.set(open?'#9dff4a':'#3a2a1a'); e.gl.material.opacity=lerp(e.gl.material.opacity,open*.9,dt*6); }
  // breathing
  const br=awake?0:Math.sin(t*1.6)*.12; CAT.body.scale.set(5.2+br*.5,4.4+br,9);
  // swipe animation
  const st=(t-CAT.swipeT)/.42;
  if(st>=0&&st<=1){ const k=Math.sin(Math.PI*st); CAT.paw.rotation.x=-k*1.7; CAT.paw.rotation.y=k*(local.x>0?-.6:.6); CAT.paw.position.y=3.2+k*4;
    if(st>.35&&!CAT.hitDone){ CAT.hand.getWorldPosition(v3); if(v3.distanceTo(pos)<9 || d<16){ CAT.hitDone=true; swipeHit(); } } }
  else { CAT.paw.rotation.x=lerp(CAT.paw.rotation.x,0,dt*8); CAT.paw.position.y=lerp(CAT.paw.position.y,3.2,dt*8); }
  // tail
  { const pts=[]; for(let k=0;k<8;k++){ const u=k/7; const sw=Math.sin(t*(awake?6:1.2)-k*.6)*(awake?1:.25);
      pts.push(V(2.6+Math.sin(u*2.2)*4.5+sw*u*3.2, 2.2+u*(awake?8:1.2), 7.5+u*6-u*u*7)); }
    CAT.tailMesh.geometry.dispose(); CAT.tailMesh.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,1.05,8,false); }
  // zzz
  CAT.z.forEach((z,i)=>{ const ph=((t*.45+i/3)%1); z.visible=!awake&&CAT.jumpT<0; z.position.copy(catHeadWorld).add(V(ph*4-1,3+ph*10,ph*2)); z.material.opacity=Math.sin(Math.PI*ph)*.85; z.scale.setScalar(2+ph*2.5); });
}
function swipeHit(){ const away=pos.clone().sub(CAT.g.position).setY(0).normalize(); vel.addScaledVector(away,34); vel.y+=16;
  spinT=.9; S.money=Math.max(0,S.money-20); S.streak=0; pop('SWIPED  −$20','cat · streak lost','var(--cat)'); flash('rgba(184,255,92,.45)'); if(S.auto) autoPlan(); }

/* ------------------------------------------------------------------ the drone */
const drone=new THREE.Group(); scene.add(drone);
const dBody=new THREE.Group(); drone.add(dBody);
const ROTORS=[];
{ const shell=M('#23262e',{metalness:.6,roughness:.32}), accent=M('#ffb627',{emissive:'#ffb627',emissiveIntensity:1.2});
  const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.26,1.15),shell); dBody.add(b);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.42,20,12,0,Math.PI*2,0,Math.PI/2),shell); dome.scale.set(1,.55,1.2); dome.position.y=.12; dBody.add(dome);
  for(const s of [-1,1]){ const st=new THREE.Mesh(new THREE.BoxGeometry(.03,.05,.9),accent); st.position.set(s*.46,.02,0); dBody.add(st); }
  const lens=new THREE.Mesh(new THREE.SphereGeometry(.12,14,10),M('#0b0b10',{metalness:.9,roughness:.05})); lens.position.set(0,-.02,-.6); dBody.add(lens);
  const hl=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),new THREE.MeshBasicMaterial({color:'#ffffff'})); hl.position.set(0,.1,-.6); dBody.add(hl);
  for(const [x,z] of [[-.75,-.7],[.75,-.7],[-.75,.7],[.75,.7]]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.08,.06,Math.hypot(x,z)),shell); arm.position.set(x/2,0,z/2); arm.rotation.y=Math.atan2(x,z); dBody.add(arm);
    const mot=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.18,12),shell); mot.position.set(x,.06,z); dBody.add(mot);
    const led=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:z<0?'#ffffff':'#ff3344'})); led.position.set(x,-.06,z); dBody.add(led);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(.44,24),new THREE.MeshBasicMaterial({color:'#cfd8ff',transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));
    disc.rotation.x=-Math.PI/2; disc.position.set(x,.17,z); dBody.add(disc);
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.84,.015,.08),M('#1a1a1f')); bl.position.set(x,.17,z); dBody.add(bl); ROTORS.push(bl); }
  dBody.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  const beam=new THREE.Mesh(new THREE.ConeGeometry(2.4,9,20,1,true),new THREE.MeshBasicMaterial({color:'#fff4dc',transparent:true,opacity:.06,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  beam.rotation.x=Math.PI/2; beam.position.set(0,-.3,-5.1); dBody.add(beam);
}
drone.scale.setScalar(1.35);
const parcel=new THREE.Group();
{ const b=new THREE.Mesh(new THREE.BoxGeometry(.55,.42,.55),M('#c79a5b')); const s1=new THREE.Mesh(new THREE.BoxGeometry(.57,.44,.07),M('#7a2e2e')); const s2=s1.clone(); s2.rotation.y=Math.PI/2;
  parcel.add(b,s1,s2); const str=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.4,4),new THREE.MeshBasicMaterial({color:'#e8dcc4'})); str.position.y=.4; parcel.add(str);
  parcel.position.set(0,-.62,0); b.castShadow=true; dBody.add(parcel); }
const guide=new THREE.Mesh(new THREE.ConeGeometry(.14,.46,10),new THREE.MeshBasicMaterial({color:'#ffb627',transparent:true,opacity:.9,depthTest:false}));
guide.geometry.rotateX(-Math.PI/2); guide.renderOrder=5; scene.add(guide);

/* ------------------------------------------------------------------ markers */
function beam(color){ const g=new THREE.Group();
  const cy=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,90,20,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.14,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  cy.position.y=45; g.add(cy);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.1,8,40),new THREE.MeshBasicMaterial({color})); ring.rotation.x=Math.PI/2; g.add(ring);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); sp.scale.set(6,6,1); g.add(sp);
  g.userData={ring,sp}; scene.add(g); return g; }
const pickBeam=beam('#ffb627'), dropBeam=beam('#7ef0c5');
const pickBox=parcel.clone(); pickBox.position.set(0,.4,0); pickBeam.add(pickBox);

/* ------------------------------------------------------------------ jobs */
const SPOTS=[
  {n:'the kettle',z:'kitchen',p:V(-118,40.4,RZ0+18)},
  {n:'the cereal box',z:'kitchen',p:V(-36,40,RZ0+16)},
  {n:'the sink edge',z:'kitchen',p:V(-60,40,RZ0+22)},
  {n:'the fridge door',z:'fridge',p:V(-128,42.4,-66)},
  {n:'the fridge top',z:'fridge',p:V(-146,86.5,-95)},
  {n:'the dinner plate',z:'table',p:V(-78,33.4,12)},
  {n:'the water glass',z:'table',p:V(-58,33.4,34)},
  {n:'the windowsill plant',z:'window',p:V(-152,28.4,12)},
  {n:'the TV remote',z:'living',p:V(75,19.6,-6)},
  {n:'the coffee mug',z:'living',p:V(88,22,5)},
  {n:'the sofa cushion',z:'living',p:V(126,30,-22)},
  {n:'the sofa, next to the cat',z:'living',p:V(113,19.6,-6)},
  {n:"the sofa, right under the cat's nose",z:'living',p:V(111,19.6,5)},
  {n:'the bookshelf',z:'shelf',p:V(80,47.6,RZ0+18)},
  {n:'the lamp base',z:'living',p:V(150,3,-84)},
];
const ITEMS=['an AA battery','one sugar cube','a lost earring','a single Lego brick','a guitar pick','a cat treat (hide it)','a SIM tray pin','the last gummy bear'];
const ZONES={ kitchen:['THE KITCHEN','burners on · mind the heat'], fridge:['FRIDGE LIGHT','cold air · bright door'], table:['DINING TABLE','candle · plates · crumbs'],
  window:['WINDOWSILL','moonlight · the city outside'], living:['LIVING ROOM','tv glow · sleeping cat'], shelf:['BOOKSHELF','narrow gaps · dusty'], floor:['THE FLOOR','crumbs · cables · socks'] };
function zoneAt(p){ if(p.x<-128&&p.z<-52) return 'fridge'; if(p.z<-72&&p.x<-15) return 'kitchen'; if(p.x<-135&&Math.abs(p.z)<50) return 'window';
  if(p.x>55&&p.x<105&&p.z<-88) return 'shelf'; if(p.x>-108&&p.x<-22&&p.z>-24&&p.z<62) return 'table'; if(p.x>8) return 'living'; return 'floor'; }

const S={ money:0, done:0, streak:0, job:null, carrying:false, timeLeft:0, timeMax:0, zone:'', t:0, auto:true, hotCd:0, fanCd:0 };
const pos=V(-18,46,RZ0+18), vel=V();
let yaw=Math.PI/2, pitch=-0.08, bank=0, spinT=0;
function newJob(forced){
  const a=forced? forced[0] : SPOTS.filter(s=>s.p.distanceTo(pos)>35)[Math.floor(R()*9)];
  let pool=SPOTS.filter(s=>s!==a&&s.z!==a.z); const b=forced? forced[1] : pool[Math.floor(R()*pool.length)];
  const it=forced&&forced[2]? forced[2] : ITEMS[Math.floor(R()*ITEMS.length)];
  S.job={a,b,item:it,pay:Math.round(14+a.p.distanceTo(b.p)*.16)}; S.carrying=false;
  S.timeMax=Math.round(a.p.distanceTo(b.p)/10+12); S.timeLeft=S.timeMax;
  pickBeam.position.copy(a.p).setY(a.p.y-1.2); dropBeam.position.copy(b.p).setY(b.p.y-1.2); pickBeam.visible=dropBeam.visible=true;
  $('pickTxt').innerHTML=`${it} <em>· ${a.n}</em>`; $('dropTxt').innerHTML=`${b.n} <em>· ${ZONES[b.z][0].toLowerCase()}</em>`;
  $('rowPick').classList.remove('off'); $('rowDrop').classList.add('off'); autoPlan();
}
let popT=0; function pop(v,s,c){ $('popv').textContent=v; $('popv').style.color=c||'var(--honey)'; $('pops').textContent=s||''; $('pop').classList.add('on'); popT=2; }
let flashT=0; function flash(c){ $('flash').style.background=`radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 30%,${c})`; $('flash').style.opacity=1; flashT=.35; }
let zoneT=0; function showZone(z){ $('dname').textContent=ZONES[z][0]; $('dsub').textContent=ZONES[z][1]; $('district').classList.add('on'); zoneT=2.6; }

/* ------------------------------------------------------------------ input */
const keys={}; let locked=false, dragging=false, lastX=0, lastY=0;
addEventListener('keydown',e=>{ keys[e.code]=true; if(['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });
canvas.addEventListener('click',()=>{ if(!S.auto&&canvas.requestPointerLock){ try{ const p=canvas.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} } });
document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===canvas; });
addEventListener('mousemove',e=>{ if(S.auto) return; if(locked){ yaw-=e.movementX*.0022; pitch-=e.movementY*.0022; }
  else if(dragging){ yaw-=(e.clientX-lastX)*.005; pitch-=(e.clientY-lastY)*.005; lastX=e.clientX; lastY=e.clientY; } pitch=clamp(pitch,-1.2,1.1); });
canvas.addEventListener('mousedown',e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; });
addEventListener('mouseup',()=>dragging=false);
const touch={move:null,look:null,mx:0,my:0,up:0,dn:0};
canvas.addEventListener('touchstart',e=>{ for(const t of e.changedTouches){ if(t.clientX<innerWidth/2&&!touch.move) touch.move={id:t.identifier,x:t.clientX,y:t.clientY}; else if(!touch.look) touch.look={id:t.identifier,x:t.clientX,y:t.clientY}; } e.preventDefault(); },{passive:false});
canvas.addEventListener('touchmove',e=>{ for(const t of e.changedTouches){ if(touch.move&&t.identifier===touch.move.id){ touch.mx=clamp((t.clientX-touch.move.x)/60,-1,1); touch.my=clamp((t.clientY-touch.move.y)/60,-1,1); }
  if(touch.look&&t.identifier===touch.look.id){ yaw-=(t.clientX-touch.look.x)*.006; pitch=clamp(pitch-(t.clientY-touch.look.y)*.006,-1.2,1.1); touch.look.x=t.clientX; touch.look.y=t.clientY; } } e.preventDefault(); },{passive:false});
canvas.addEventListener('touchend',e=>{ for(const t of e.changedTouches){ if(touch.move&&t.identifier===touch.move.id){ touch.move=null; touch.mx=touch.my=0; } if(touch.look&&t.identifier===touch.look.id) touch.look=null; } });
for(const [id,k] of [['tUp','up'],['tDn','dn']]){ const b=$(id); b.addEventListener('touchstart',e=>{touch[k]=1;e.preventDefault();},{passive:false}); b.addEventListener('touchend',()=>touch[k]=0); }

/* ------------------------------------------------------------------ autopilot */
let WP=[], wpi=0;
function autoPlan(){ if(!S.job) return; const T=S.carrying?S.job.b.p:S.job.a.p;
  const cruise=clamp(Math.max(pos.y,T.y)+7,30,56);
  const dir=V(T.x-pos.x,0,T.z-pos.z); const L=dir.length(); dir.normalize();
  if(L>40){ const pre=T.clone().addScaledVector(dir,-26); WP=[V(pos.x,cruise,pos.z), V(pre.x,cruise,pre.z), V(pre.x,T.y+3,pre.z), T.clone()]; }
  else WP=[V(pos.x,cruise,pos.z), V(T.x,cruise,T.z), V(T.x,T.y+2.5,T.z), T.clone()];
  wpi=0; }
const desired=V();
function autoInput(dt){
  if(!WP.length){ vel.multiplyScalar(Math.exp(-2*dt)); return; }
  let w=WP[wpi]; const d=w.clone().sub(pos); const final=wpi===WP.length-1;
  if(!final&&d.length()<3.5){ wpi++; w=WP[wpi]; d.copy(w).sub(pos); }
  const dist=d.length(), spd=final? clamp(dist*1.6,2.5,16) : (wpi===2? clamp(dist*1.5,4,17):21);
  desired.copy(d).normalize().multiplyScalar(spd); vel.lerp(desired,1-Math.exp(-dt*(final?4:2.4)));
  if(Math.hypot(vel.x,vel.z)>1.5) yaw+=wrapA(Math.atan2(-vel.x,-vel.z)-yaw)*Math.min(1,dt*3.5);
  pitch=lerp(pitch,-0.12,dt*2);
}

/* ------------------------------------------------------------------ physics */
const RAD=.75;
function collide(){
  pos.x=clamp(pos.x,RX0+RAD,RX1-RAD); pos.z=clamp(pos.z,RZ0+RAD,RZ1-RAD); pos.y=clamp(pos.y,RAD,RY-RAD);
  for(const b of SOLIDS){
    if(pos.x<b.x0-RAD||pos.x>b.x1+RAD||pos.z<b.z0-RAD||pos.z>b.z1+RAD||pos.y<b.y0-RAD||pos.y>b.y1+RAD) continue;
    const pen=[pos.x-(b.x0-RAD),(b.x1+RAD)-pos.x,pos.z-(b.z0-RAD),(b.z1+RAD)-pos.z,pos.y-(b.y0-RAD),(b.y1+RAD)-pos.y];
    let m=0; for(let i=1;i<6;i++) if(pen[i]<pen[m]) m=i;
    if(m===0){pos.x=b.x0-RAD; vel.x=Math.min(vel.x,0);} else if(m===1){pos.x=b.x1+RAD; vel.x=Math.max(vel.x,0);}
    else if(m===2){pos.z=b.z0-RAD; vel.z=Math.min(vel.z,0);} else if(m===3){pos.z=b.z1+RAD; vel.z=Math.max(vel.z,0);}
    else if(m===4){pos.y=b.y0-RAD; vel.y=Math.min(vel.y,0);} else {pos.y=b.y1+RAD; vel.y=Math.max(vel.y,0);} }
}
const fwd=V(), right=V(), v3=V();
let lastYaw=yaw;
function step(dt){
  S.t+=dt;
  if(S.auto) autoInput(dt);
  else { const kx=(keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0); yaw+=kx*dt*1.8;
    const f=(keys.KeyW?1:0)-(keys.KeyS?1:0)-touch.my, s=(keys.KeyD?1:0)-(keys.KeyA?1:0)+touch.mx,
          u=(keys.Space||keys.ArrowUp||touch.up?1:0)-(keys.ShiftLeft||keys.ShiftRight||keys.ArrowDown||touch.dn?1:0);
    const cp=Math.cos(pitch); fwd.set(-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp); right.set(Math.cos(yaw),0,-Math.sin(yaw));
    const A=40; vel.addScaledVector(fwd,f*A*dt).addScaledVector(right,s*A*.8*dt); vel.y+=u*A*.75*dt; vel.multiplyScalar(Math.exp(-2.3*dt));
    const sp=vel.length(); if(sp>20) vel.multiplyScalar(20/sp); }
  // hazards: hot air over burners
  S.hotCd-=dt;
  for(const b of BURNERS){ const dx=pos.x-b.p.x, dz=pos.z-b.p.z; if(dx*dx+dz*dz<30 && pos.y<b.p.y+22 && pos.y>b.p.y){
      vel.y+=70*dt; vel.x+=dx*3*dt; vel.z+=dz*3*dt; if(S.hotCd<=0){ S.hotCd=2; S.money=Math.max(0,S.money-10); pop('HOT  −$10','hot air from the stove','var(--hot)'); flash('rgba(255,106,77,.45)'); } } }
  // ceiling fan downdraft + blade hit
  S.fanCd-=dt; { const dx=pos.x-FAN.c.x, dz=pos.z-FAN.c.z, r=Math.hypot(dx,dz);
    if(r<FAN.r && pos.y>60) vel.y-=26*dt*(1-r/FAN.r);
    if(r<FAN.r && Math.abs(pos.y-FAN.c.y)<2.2 && S.fanCd<=0){ S.fanCd=1.5; vel.set(dx/r*28,-18,dz/r*28); spinT=.9; S.money=Math.max(0,S.money-15); pop('FAN  −$15','ceiling fan · watch your head','var(--hot)'); flash('rgba(255,243,227,.4)'); } }
  pos.addScaledVector(vel,dt); collide();
  updateCat(dt);
  // pose
  const sp=vel.length();
  const yawRate=wrapA(yaw-lastYaw)/Math.max(dt,1e-4); lastYaw=yaw;
  bank=lerp(bank,clamp(-yawRate*.35,-.6,.6),dt*5);
  spinT=Math.max(0,spinT-dt);
  drone.position.copy(pos); drone.position.y+=Math.sin(S.t*5)*.06;
  drone.rotation.set(0,yaw+ (spinT>0? (1-spinT/.9)*Math.PI*4:0),0);
  const lv=v3.copy(vel).applyAxisAngle(V(0,1,0),-yaw);
  dBody.rotation.set(clamp(lv.z*.02,-.35,.35),0,clamp(-lv.x*.02,-.35,.35)+bank*.6);
  for(const r of ROTORS) r.rotation.y+=dt*47;
  parcel.visible=S.carrying;
  // jobs
  if(S.job){ if(S.carrying) S.timeLeft-=dt;
    if(!S.carrying&&pos.distanceTo(S.job.a.p)<2.6){ S.carrying=true; pickBeam.visible=false; $('rowPick').classList.add('off'); $('rowDrop').classList.remove('off'); pop('PARCEL UP',S.job.item,'var(--honey)'); if(S.auto) autoPlan(); }
    else if(S.carrying&&pos.distanceTo(S.job.b.p)<2.9){ const late=S.timeLeft<=0, tip=late?0:Math.round(S.timeLeft*1.5), pay=late?Math.round(S.job.pay/2):S.job.pay;
      S.money+=pay+tip; S.done++; S.streak=late?0:S.streak+1; pop(`+$${pay+tip}`,late?'late · no tip':`delivered · tip $${tip}`,'var(--mint)'); saveBest();
      S.job=null; nextJobT=1.1; dropBeam.visible=false; } }
  else if((nextJobT-=dt)<=0) newJob(scripted());
  const z=zoneAt(pos); if(z!==S.zone){ S.zone=z; showZone(z); }
  for(const b of [pickBeam,dropBeam]){ b.userData.ring.rotation.z+=dt*2; b.userData.ring.position.y=Math.sin(S.t*3)*.2; b.userData.sp.material.opacity=.6+.3*Math.sin(S.t*5); }
  pickBox.rotation.y+=dt*1.6; pickBox.position.y=.5+Math.sin(S.t*3)*.2;
  FAN.blades.rotation.y+=dt*5;
  CANDLE.fl.scale.set(4.5+Math.sin(S.t*23)*.4,6.5+Math.sin(S.t*17)*.7,1); CANDLE.L.intensity=1.2+Math.sin(S.t*19)*.15;
  TVL.intensity=1.3+Math.sin(S.t*7)*.25+Math.sin(S.t*23)*.15; TVS.color.setHSL(.6+Math.sin(S.t*.9)*.05,.8,.62+Math.sin(S.t*11)*.05);
  for(const b of BURNERS) b.g.material.opacity=.75+Math.sin(S.t*8+b.p.x)*.2;
  DUST.rotation.y+=dt*.01; DUST.position.y=Math.sin(S.t*.2)*1.5;
}
let nextJobT=0; const SCRIPT=[]; let si=0; function scripted(){ return CAPTURE? (SCRIPT[si++]||null) : null; }

/* ------------------------------------------------------------------ camera + hud */
const camPos=V(), camLook=V(); let camInit=false;
function updateCamera(dt){
  const cp=Math.cos(pitch*.8), back=V(Math.sin(yaw)*cp,-Math.sin(pitch*.8),Math.cos(yaw)*cp);
  const want=pos.clone().addScaledVector(back,4.4); want.y+=1.5;
  for(let it=0;it<2;it++) for(const b of SOLIDS){ if(want.x>b.x0-.2&&want.x<b.x1+.2&&want.z>b.z0-.2&&want.z<b.z1+.2&&want.y>b.y0-.2&&want.y<b.y1+.2) want.lerp(pos,.5); }
  want.x=clamp(want.x,RX0+.5,RX1-.5); want.z=clamp(want.z,RZ0+.5,RZ1-.5); want.y=clamp(want.y,.5,RY-.5);
  const look=pos.clone().addScaledVector(back,-7); look.y+=.2;
  if(!camInit){ camPos.copy(want); camLook.copy(look); camInit=true; }
  camPos.lerp(want,1-Math.exp(-dt*7)); camLook.lerp(look,1-Math.exp(-dt*9));
  camera.position.copy(camPos); camera.lookAt(camLook);
  camera.fov=lerp(camera.fov,62+vel.length()*.5,dt*3); camera.updateProjectionMatrix();
}
const MAPS=380, MSC=MAPS/360;
const mapBase=document.createElement('canvas'); mapBase.width=mapBase.height=MAPS;
{ const g=mapBase.getContext('2d'); const m=v=>(v+180)*MSC; g.fillStyle='#10132a'; g.fillRect(0,0,MAPS,MAPS);
  g.fillStyle='#3a2e28'; g.fillRect(m(RX0),m(RZ0),(RX1-RX0)*MSC,(RZ1-RZ0)*MSC); g.fillStyle='#7a2f3a'; g.fillRect(m(18),m(-35),120*MSC,86*MSC);
  g.fillStyle='#8e8f99'; for(const b of SOLIDS) if(b.y1>10) g.fillRect(m(b.x0),m(b.z0),(b.x1-b.x0)*MSC,(b.z1-b.z0)*MSC);
  g.fillStyle='#8fa6ff'; g.fillRect(m(RX0)-3,m(-45),4,90*MSC); }
const mctx=$('mapc').getContext('2d');
function drawMap(){ const c=MAPS/2, m=v=>(v+180)*MSC, zoom=2.4;
  mctx.save(); mctx.clearRect(0,0,MAPS,MAPS); mctx.beginPath(); mctx.arc(c,c,c,0,7); mctx.clip(); mctx.fillStyle='#10132a'; mctx.fillRect(0,0,MAPS,MAPS);
  mctx.translate(c,c); mctx.rotate(yaw); mctx.scale(zoom,zoom); mctx.translate(-m(pos.x),-m(pos.z)); mctx.drawImage(mapBase,0,0);
  mctx.fillStyle=CAT.state==='awake'?'#b8ff5c':'#e0a060'; mctx.beginPath(); mctx.arc(m(CAT.g.position.x),m(CAT.g.position.z),4,0,7); mctx.fill();
  mctx.restore();
  const mark=(p,col)=>{ const dx=(p.x-pos.x)*MSC*zoom, dz=(p.z-pos.z)*MSC*zoom, cs=Math.cos(yaw), sn=Math.sin(yaw); let x=dx*cs-dz*sn, y=dx*sn+dz*cs; const L=Math.hypot(x,y), lim=c-12; if(L>lim){x*=lim/L;y*=lim/L;}
    mctx.fillStyle=col; mctx.strokeStyle='#10132a'; mctx.lineWidth=3; mctx.beginPath(); mctx.arc(c+x,c+y,9,0,7); mctx.stroke(); mctx.fill(); };
  if(S.job){ if(!S.carrying) mark(S.job.a.p,'#ffb627'); mark(S.job.b.p,S.carrying?'#7ef0c5':'rgba(126,240,197,.35)'); }
  mctx.fillStyle='#fff3e3'; mctx.beginPath(); mctx.moveTo(c,c-13); mctx.lineTo(c+8,c+9); mctx.lineTo(c,c+4); mctx.lineTo(c-8,c+9); mctx.closePath(); mctx.fill();
  mctx.strokeStyle='rgba(255,243,227,.25)'; mctx.lineWidth=2; mctx.beginPath(); mctx.arc(c,c,c-2,0,7); mctx.stroke(); }
function hud(dt){
  $('money').textContent='$'+S.money; $('stats').textContent=`${S.done} delivered · streak ${S.streak}`;
  $('spd').textContent=Math.round(vel.length()*2.8*10); $('alt').textContent=`alt ${Math.round(pos.y*2.8)} cm`;
  $('noise').style.width=(CAT.noise*100)+'%'; const cp=$('catpill'); const aw=CAT.state==='awake'; cp.textContent=aw?'cat · awake':'cat · asleep'; cp.classList.toggle('awake',aw);
  if(S.job){ const tl=Math.max(0,S.timeLeft); $('tval').textContent=`${Math.floor(tl/60)}:${String(Math.floor(tl%60)).padStart(2,'0')}`; const f=tl/S.timeMax;
    $('tbar').style.width=(f*100)+'%'; $('tbar').style.background=f<.25?'var(--hot)':f<.5?'var(--honey)':'var(--mint)'; }
  const T=S.job?(S.carrying?S.job.b.p:S.job.a.p):null, el=$('pointer');
  if(T){ v3.copy(T).project(camera); const w=canvas.clientWidth,h=canvas.clientHeight; let x=(v3.x*.5+.5)*w,y=(-v3.y*.5+.5)*h; const behind=v3.z>1;
    const inView=!behind&&x>40&&x<w-40&&y>60&&y<h-60; let ang=0;
    if(!inView){ let dx=x-w/2,dy=y-h/2; if(behind){dx=-dx;dy=-dy;} const k=Math.min((w/2-60)/Math.abs(dx||1),(h/2-80)/Math.abs(dy||1)); x=w/2+dx*k; y=h/2+dy*k; ang=Math.atan2(dy,dx)+Math.PI/2; } else { y-=34; ang=Math.PI; }
    el.style.transform=`translate(${x}px,${y}px)`; el.querySelector('.arr').style.transform=`rotate(${ang}rad)`; el.style.color=S.carrying?'var(--mint)':'var(--honey)'; el.style.opacity=1;
    $('pdist').textContent=Math.round(pos.distanceTo(T)*2.8)+' cm';
    const dir=T.clone().sub(pos).normalize(); guide.position.copy(pos).addScaledVector(dir,1.4); guide.position.y+=.6; guide.lookAt(guide.position.clone().add(dir)); guide.material.color.set(S.carrying?'#7ef0c5':'#ffb627'); guide.visible=true;
  } else { el.style.opacity=0; guide.visible=false; }
  if((popT-=dt)<=0) $('pop').classList.remove('on'); if((zoneT-=dt)<=0) $('district').classList.remove('on'); if(flashT>0&&(flashT-=dt)<=0) $('flash').style.opacity=0;
  drawMap();
}
function saveBest(){ if(S.auto) return; try{ const b=+localStorage.getItem('nightdrop-best')||0; if(S.money>b) localStorage.setItem('nightdrop-best',S.money); }catch(e){} }
try{ const b=+localStorage.getItem('nightdrop-best')||0; if(b) $('best').textContent=`best shift · $${b}`; }catch(e){}

$('go').addEventListener('click',()=>{ $('intro').classList.add('gone'); S.auto=false; S.money=0; S.done=0; S.streak=0; R=rng(Date.now()%100000);
  pos.set(-18,46,RZ0+30); vel.set(0,0,0); yaw=Math.PI/2; pitch=-.08; S.job=null; nextJobT=.4; CAT.state='sleep'; CAT.noise=0; CAT.nextMove=30; canvas.focus();
  try{ const p=canvas.requestPointerLock&&canvas.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} });
CAT.nextMove=30;

function frame(dt,noRender){ step(dt/2); step(dt/2); updateCamera(dt); hud(dt); if(!noRender) renderer.render(scene,camera); }
resize();
if(CAPTURE){
  $('intro').classList.add('gone');
  if(QS.has('clean')) document.querySelectorAll('.hud').forEach(e=>e.style.display='none');
  const S_=n=>SPOTS.find(s=>s.n===n);
  SCRIPT.push([S_('the cereal box'),S_("the sofa, right under the cat's nose"),'an AA battery'],[S_('the coffee mug'),S_('the fridge door'),'a cat treat (hide it)']);
  window.__cap={ step:(n)=>{ for(let i=0;i<n;i++) frame(1/30,i<n-1); }, info:()=>({t:S.t.toFixed(1),done:S.done,carry:S.carrying,money:S.money,zone:S.zone,cat:CAT.state,noise:CAT.noise.toFixed(2),pos:[pos.x|0,pos.y|0,pos.z|0],wp:wpi+'/'+WP.length}) };
} else { let last=performance.now(); function loop(now){ const dt=Math.min(.05,(now-last)/1000); last=now; frame(dt); requestAnimationFrame(loop); } requestAnimationFrame(loop); }
})();
