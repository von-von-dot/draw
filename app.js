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

let points=[];

function resize(){
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=rect.width*dpr;
  canvas.height=rect.height*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize();
window.addEventListener("resize", resize);

function fieldValue(x,y){
  let v=0;
  const r=+radius.value;
  const f=+fusion.value;
  const sigma=r*(1+f/120);
  const inv=1/(2*sigma*sigma);
  for(let p of points){
    const dx=x-p.x, dy=y-p.y;
    v+=Math.exp(-(dx*dx+dy*dy)*inv);
  }
  return v;
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const threshold=+iso.value;
  const step=4;
  ctx.fillStyle="#000";

  for(let y=0;y<canvas.height;y+=step){
    for(let x=0;x<canvas.width;x+=step){
      if(fieldValue(x,y)>=threshold){
        ctx.fillRect(x,y,step,step);
      }
    }
  }
}

function getPos(touch){
  const rect=canvas.getBoundingClientRect();
  return {x:touch.clientX-rect.left,y:touch.clientY-rect.top};
}

canvas.addEventListener("touchstart",(e)=>{
  e.preventDefault();
  const p=getPos(e.touches[0]);
  if(mode==="draw") points.push(p);
  else points=points.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>20);
  draw();
},{passive:false});

canvas.addEventListener("touchmove",(e)=>{
  e.preventDefault();
  const p=getPos(e.touches[0]);
  if(mode==="draw") points.push(p);
  else points=points.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>20);
  draw();
},{passive:false});

radius.oninput=fusion.oninput=iso.oninput=draw;
draw();