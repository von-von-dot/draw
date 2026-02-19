const canvas=document.getElementById("cv");
const ctx=canvas.getContext("2d");

const panel=document.getElementById("panel");
const toggle=document.getElementById("toggle");
const radius=document.getElementById("radius");
const fusion=document.getElementById("fusion");
const iso=document.getElementById("iso");
const drawBtn=document.getElementById("drawBtn");
const eraseBtn=document.getElementById("eraseBtn");

let mode="draw";
drawBtn.onclick=()=>{mode="draw";drawBtn.classList.add("active");eraseBtn.classList.remove("active");};
eraseBtn.onclick=()=>{mode="erase";eraseBtn.classList.add("active");drawBtn.classList.remove("active");};
toggle.onclick=()=>{panel.classList.toggle("open");};

// Points in CSS pixels
let points=[];
let lastAdd=null;

function resize(){
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1, Math.round(rect.width*dpr));
  canvas.height=Math.max(1, Math.round(rect.height*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize();
window.addEventListener("resize", ()=>{ resize(); requestRender(true); });

// Offscreen small buffer
const off=document.createElement("canvas");
const offCtx=off.getContext("2d", { willReadFrequently:true });

let isDown=false;
let dirty=false;
let forceHigh=false;
let rafId=0;

function requestRender(high=false){
  dirty=true;
  if(high) forceHigh=true;
  if(rafId) return;
  rafId=requestAnimationFrame(()=>{
    rafId=0;
    if(!dirty) return;
    dirty=false;
    render(forceHigh);
    forceHigh=false;
  });
}

function getRenderParams(high){
  const scale = high ? 2.0 : (isDown ? 3.2 : 2.6);
  const step  = high ? 3   : (isDown ? 5   : 4);
  return {scale, step};
}

function fieldValue(x,y, inv2s2){
  let v=0;
  for(let i=0;i<points.length;i++){
    const p=points[i];
    const dx=x-p.x, dy=y-p.y;
    v += Math.exp(-(dx*dx+dy*dy)*inv2s2);
  }
  return v;
}

function render(high){
  const rect=canvas.getBoundingClientRect();
  const w=rect.width, h=rect.height;

  const r=+radius.value;
  const f=+fusion.value;
  const threshold=+iso.value;

  const sigma=r*(1+f/120);
  const inv2s2=1/(2*sigma*sigma);

  const {scale, step} = getRenderParams(high);
  const ow=Math.max(120, Math.round(w/scale));
  const oh=Math.max(120, Math.round(h/scale));

  if(off.width!==ow || off.height!==oh){
    off.width=ow; off.height=oh;
  }

  offCtx.clearRect(0,0,ow,oh);
  offCtx.fillStyle="#fff";
  offCtx.fillRect(0,0,ow,oh);

  offCtx.fillStyle="#000";
  const sx = w/ow;
  const sy = h/oh;

  for(let y=0;y<oh;y+=step){
    const cy = (y+0.5) * sy;
    for(let x=0;x<ow;x+=step){
      const cx = (x+0.5) * sx;
      if(fieldValue(cx, cy, inv2s2) >= threshold){
        offCtx.fillRect(x,y,step,step);
      }
    }
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,w,h);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(off, 0, 0, ow, oh, 0, 0, w, h);
}

function getPos(touch){
  const rect=canvas.getBoundingClientRect();
  return {x:touch.clientX-rect.left, y:touch.clientY-rect.top};
}

function addPoint(p){
  const minDist = isDown ? 7 : 4;
  if(lastAdd && Math.hypot(p.x-lastAdd.x, p.y-lastAdd.y) < minDist) return;
  points.push(p);
  lastAdd=p;
  const cap=800;
  if(points.length>cap) points.splice(0, points.length-cap);
}

function eraseAt(p){
  const R=22;
  points = points.filter(q=>Math.hypot(q.x-p.x, q.y-p.y) > R);
}

canvas.addEventListener("touchstart",(e)=>{
  e.preventDefault();
  isDown=true;
  lastAdd=null;
  const p=getPos(e.touches[0]);
  if(mode==="draw") addPoint(p);
  else eraseAt(p);
  requestRender(false);
},{passive:false});

canvas.addEventListener("touchmove",(e)=>{
  e.preventDefault();
  const p=getPos(e.touches[0]);
  if(mode==="draw") addPoint(p);
  else eraseAt(p);
  requestRender(false);
},{passive:false});

canvas.addEventListener("touchend",(e)=>{
  e.preventDefault();
  isDown=false;
  lastAdd=null;
  requestRender(true);
},{passive:false});

canvas.addEventListener("touchcancel",(e)=>{
  e.preventDefault();
  isDown=false;
  lastAdd=null;
  requestRender(true);
},{passive:false});

radius.oninput=()=>requestRender(true);
fusion.oninput=()=>requestRender(true);
iso.oninput=()=>requestRender(true);

requestRender(true);
