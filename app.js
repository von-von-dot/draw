const canvas=document.getElementById("cv");
const ctx=canvas.getContext("2d",{alpha:true});

const els={
  panel:document.getElementById("panel"),
  btnToggle:document.getElementById("btnToggle"),
  touchToolSeg:document.getElementById("touchToolSeg"),
  cols:document.getElementById("cols"),
  rows:document.getElementById("rows"),
  showGrid:document.getElementById("showGrid"),
  snap:document.getElementById("snap"),
  symV:document.getElementById("symV"),
  symH:document.getElementById("symH"),
  radius:document.getElementById("radius"),
  fusion:document.getElementById("fusion"),
  iso:document.getElementById("iso"),
  qual:document.getElementById("qual"),
  smooth:document.getElementById("smooth"),
  bgWhite:document.getElementById("bgWhite"),
  neg:document.getElementById("neg"),
  exportBg:document.getElementById("exportBg"),
  btnUndo:document.getElementById("btnUndo"),
  btnRedo:document.getElementById("btnRedo"),
  btnSave:document.getElementById("btnSave"),
  btnLoad:document.getElementById("btnLoad"),
  btnClear:document.getElementById("btnClear"),
  fileLoad:document.getElementById("fileLoad"),
  mbUndo:document.getElementById("mbUndo"),
  mbRedo:document.getElementById("mbRedo"),
  mbSave:document.getElementById("mbSave"),
  mbLoad:document.getElementById("mbLoad"),
  mbExport:document.getElementById("mbExport"),
  status:document.getElementById("status"),
  colsVal:document.getElementById("colsVal"),
  rowsVal:document.getElementById("rowsVal"),
  radiusVal:document.getElementById("radiusVal"),
  fusionVal:document.getElementById("fusionVal"),
  isoVal:document.getElementById("isoVal"),
  qualVal:document.getElementById("qualVal"),
  smoothVal:document.getElementById("smoothVal"),
};

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function themeColors(){
  let bg=els.bgWhite.checked?"#ffffff":"#0b0d12";
  let fg=els.bgWhite.checked?"#0b0d12":"#ffffff";
  if(els.neg.checked){const t=bg;bg=fg;fg=t;}
  return {bg,fg};
}
function hexToRgb(hex){
  const h=(hex||"#000").replace("#","");
  const v=h.length===3?h.split("").map(c=>c+c).join(""):h;
  const n=parseInt(v,16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}

const state={points:[]};
const history={undo:[],redo:[],max:80};

function currentUI(){
  return {
    cols:+els.cols.value, rows:+els.rows.value,
    showGrid:!!els.showGrid.checked,
    snap:!!els.snap.checked,
    symV:!!els.symV.checked, symH:!!els.symH.checked,
    radius:+els.radius.value,
    fusion:+els.fusion.value,
    iso:+els.iso.value,
    qual:+els.qual.value,
    smooth:+els.smooth.value,
    bgWhite:!!els.bgWhite.checked,
    neg:!!els.neg.checked,
    exportBg:!!els.exportBg.checked,
  };
}
function applyUI(u){
  if(!u) return;
  els.cols.value=clamp(+u.cols||20,6,48);
  els.rows.value=clamp(+u.rows||20,6,48);
  els.showGrid.checked=!!u.showGrid;
  els.snap.checked=!!u.snap;
  els.symV.checked=!!u.symV;
  els.symH.checked=!!u.symH;
  els.radius.value=clamp(+u.radius||44,8,120);
  els.fusion.value=clamp(+u.fusion||60,0,140);
  els.iso.value=clamp(+u.iso||1.0,0.6,2.2);
  els.qual.value=clamp(+u.qual||12,6,28);
  els.smooth.value=clamp(+u.smooth||0.25,0,0.8);
  els.bgWhite.checked=!!u.bgWhite;
  els.neg.checked=!!u.neg;
  els.exportBg.checked=!!u.exportBg;
  updateVals();
}
function snapshot(){ return {points:state.points.map(p=>({x:p.x,y:p.y})), ui: currentUI()}; }
function restore(snap){ state.points=snap.points.map(p=>({x:p.x,y:p.y})); applyUI(snap.ui); history.redo=[]; updateUndoRedoUI(); draw(); }
function pushUndo(){ history.undo.push(snapshot()); if(history.undo.length>history.max) history.undo.shift(); history.redo=[]; updateUndoRedoUI(); }
function doUndo(){ if(history.undo.length===0) return; const cur=snapshot(); const prev=history.undo.pop(); history.redo.push(cur); restore(prev); }
function doRedo(){ if(history.redo.length===0) return; const cur=snapshot(); const nxt=history.redo.pop(); history.undo.push(cur); restore(nxt); }
function updateUndoRedoUI(){
  const u=history.undo.length===0, r=history.redo.length===0;
  [els.btnUndo,els.mbUndo].forEach(b=>b.disabled=u);
  [els.btnRedo,els.mbRedo].forEach(b=>b.disabled=r);
}

let touchTool="draw";
function setTouchTool(next){
  touchTool=next;
  els.touchToolSeg.querySelectorAll("button[data-tool]").forEach(b=>b.classList.toggle("active", b.dataset.tool===touchTool));
}
els.touchToolSeg.addEventListener("click",(e)=>{
  const btn=e.target.closest("button[data-tool]"); if(!btn) return;
  setTouchTool(btn.dataset.tool);
});
setTouchTool("draw");

function setPanelCollapsed(c){
  els.panel.classList.toggle("collapsed", !!c);
  els.btnToggle.textContent = c ? "Réglages" : "Fermer";
}
els.btnToggle.addEventListener("click", ()=> setPanelCollapsed(!els.panel.classList.contains("collapsed")));
setPanelCollapsed(true);

function updateVals(){
  els.colsVal.textContent=els.cols.value;
  els.rowsVal.textContent=els.rows.value;
  els.radiusVal.textContent=els.radius.value;
  els.fusionVal.textContent=els.fusion.value;
  els.isoVal.textContent=(+els.iso.value).toFixed(2);
  els.qualVal.textContent=els.qual.value;
  els.smoothVal.textContent=(+els.smooth.value).toFixed(2);
  els.status.textContent = `${state.points.length} points`;
}

function grid(){
  const cols=+els.cols.value, rows=+els.rows.value;
  const size=Math.min(canvas.width, canvas.height);
  const cell=size/Math.max(cols, rows);
  const w=cols*cell, h=rows*cell;
  const x0=(canvas.width-w)/2, y0=(canvas.height-h)/2;
  return {cols,rows,cell,x0,y0,w,h,x1:x0+w,y1:y0+h};
}
function inGrid(p,g){ return p.x>=g.x0 && p.x<=g.x1 && p.y>=g.y0 && p.y<=g.y1; }
function getCanvasPos(evt){
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width, sy=canvas.height/r.height;
  return {x:(evt.clientX-r.left)*sx, y:(evt.clientY-r.top)*sy};
}
function snapToGrid(p,g){
  if(!els.snap.checked) return p;
  const cx=Math.round((p.x-g.x0)/g.cell)*g.cell + g.x0;
  const cy=Math.round((p.y-g.y0)/g.cell)*g.cell + g.y0;
  return {x:clamp(cx,g.x0,g.x1), y:clamp(cy,g.y0,g.y1)};
}
function applySymmetryPoints(p,g){
  const pts=[p];
  if(els.symV.checked){
    const mx=g.x0+g.w/2;
    pts.push({x:mx-(p.x-mx), y:p.y});
  }
  if(els.symH.checked){
    const my=g.y0+g.h/2;
    const base=pts.slice();
    for(const q of base) pts.push({x:q.x, y: my-(q.y-my)});
  }
  const out=[], seen=new Set();
  for(const q of pts){
    const k=`${Math.round(q.x*2)/2},${Math.round(q.y*2)/2}`;
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}
function addPoint(pos){
  const g=grid();
  let p=snapToGrid(pos,g);
  if(!inGrid(p,g)) return;
  const tol=Math.max(6, g.cell*0.22);
  if(state.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<=tol)) return;
  state.points.push(p);
}
function erasePoint(pos){
  const g=grid();
  let p=snapToGrid(pos,g);
  const tol=Math.max(10, g.cell*0.30);
  for(let i=state.points.length-1;i>=0;i--){
    if(Math.hypot(state.points[i].x-p.x,state.points[i].y-p.y)<=tol){
      state.points.splice(i,1); return;
    }
  }
}

let isDown=false;
let lastKey=null;
function stamp(pos){
  const g=grid();
  let p=snapToGrid(pos,g);
  if(!inGrid(p,g)) return;
  const pts=applySymmetryPoints(p,g).filter(q=>inGrid(q,g));
  for(const q of pts){
    const k=`${Math.round(q.x*2)/2},${Math.round(q.y*2)/2}`;
    if(lastKey===k) continue;
    if(touchTool==="erase") erasePoint(q);
    else addPoint(q);
    lastKey=k;
  }
}
canvas.addEventListener("pointerdown",(evt)=>{
  evt.preventDefault();
  isDown=true; lastKey=null;
  pushUndo();
  canvas.setPointerCapture(evt.pointerId);
  stamp(getCanvasPos(evt));
  draw();
});
canvas.addEventListener("pointermove",(evt)=>{
  if(!isDown) return;
  evt.preventDefault();
  stamp(getCanvasPos(evt));
  draw();
});
function endDrag(evt){
  if(!isDown) return;
  isDown=false; lastKey=null;
  try{canvas.releasePointerCapture(evt.pointerId);}catch(e){}
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", endDrag);

// rendering
let off=document.createElement("canvas");
let offCtx=off.getContext("2d",{willReadFrequently:true});

function renderFusionVisual(g){
  const r=+els.radius.value;
  const fusion=+els.fusion.value;
  const iso=+els.iso.value;
  const quality=+els.qual.value;
  const smooth=+els.smooth.value;

  const ow=Math.max(40, Math.round(g.cols*quality));
  const oh=Math.max(40, Math.round(g.rows*quality));
  off.width=ow; off.height=oh;

  const {fg}=themeColors();
  const rgb=hexToRgb(fg);

  const sx=ow/g.w, sy=oh/g.h;

  const pts=[];
  for(const p of state.points){
    for(const q of applySymmetryPoints(p,g)){
      if(!inGrid(q,g)) continue;
      pts.push({x:(q.x-g.x0)*sx, y:(q.y-g.y0)*sy});
    }
  }

  const r0=r*((sx+sy)/2);
  const sigma=Math.max(1.5, r0*(1+fusion/120));
  const inv2s2=1/(2*sigma*sigma);
  const thr=1.0*iso;

  const img=offCtx.createImageData(ow,oh);
  const data=img.data;

  for(let y=0;y<oh;y++){
    for(let x=0;x<ow;x++){
      let v=0;
      for(let i=0;i<pts.length;i++){
        const dx=x-pts[i].x, dy=y-pts[i].y;
        v += Math.exp(-(dx*dx+dy*dy)*inv2s2);
        if(v>thr+1.5) break;
      }
      let a=0;
      if(v>=thr) a=1;
      else if(smooth>0){
        const band=0.35*(1+smooth*2.0);
        a=clamp((v-(thr-band))/band, 0, 1);
      }
      const idx=(y*ow+x)*4;
      if(a<=0){
        data[idx+3]=0;
      }else{
        data[idx]=rgb.r; data[idx+1]=rgb.g; data[idx+2]=rgb.b; data[idx+3]=Math.round(a*255);
      }
    }
  }

  offCtx.clearRect(0,0,ow,oh);
  offCtx.putImageData(img,0,0);

  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(off, g.x0, g.y0, g.w, g.h);
  ctx.restore();
}

function drawGridLines(g){
  const {bg}=themeColors();
  const isDark = bg!=="#ffffff";
  ctx.save();
  ctx.lineWidth=1;
  ctx.strokeStyle=isDark?"rgba(255,255,255,0.16)":"rgba(0,0,0,0.12)";
  for(let c=0;c<=g.cols;c++){
    const x=g.x0+c*g.cell;
    ctx.beginPath(); ctx.moveTo(x,g.y0); ctx.lineTo(x,g.y1); ctx.stroke();
  }
  for(let r=0;r<=g.rows;r++){
    const y=g.y0+r*g.cell;
    ctx.beginPath(); ctx.moveTo(g.x0,y); ctx.lineTo(g.x1,y); ctx.stroke();
  }
  ctx.strokeStyle=isDark?"rgba(255,255,255,0.30)":"rgba(0,0,0,0.22)";
  ctx.lineWidth=2;
  ctx.strokeRect(g.x0,g.y0,g.w,g.h);
  ctx.restore();
}
function drawAnchors(){
  const {fg}=themeColors();
  ctx.save();
  ctx.fillStyle=fg;
  for(const p of state.points){
    ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function resizeCanvas(){
  const wrap=document.querySelector(".canvaswrap");
  const rect=wrap.getBoundingClientRect();
  const dpr=Math.max(1, Math.min(3, window.devicePixelRatio||1));
  const size=Math.round(Math.min(rect.width, rect.height)*dpr);
  if(canvas.width!==size || canvas.height!==size){
    canvas.width=size; canvas.height=size;
  }
}
function draw(){
  resizeCanvas();
  const g=grid();
  const {bg}=themeColors();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if(els.showGrid.checked) drawGridLines(g);
  renderFusionVisual(g);
  drawAnchors();
  updateVals();
}

// Save/Load
function downloadBlob(name, blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function saveToDisk(){
  const cfg={version:1, meta:{app:"Widmer Mobile Fusion", exportedAt:new Date().toISOString()}, snap:snapshot()};
  const blob=new Blob([JSON.stringify(cfg,null,2)],{type:"application/json;charset=utf-8"});
  const stamp=new Date().toISOString().replaceAll(":","-").slice(0,19);
  downloadBlob(`widmer-fusion-${stamp}.json`, blob);
}
function openLoadDialog(){ els.fileLoad.value=""; els.fileLoad.click(); }
els.fileLoad.addEventListener("change", async (e)=>{
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  try{
    const cfg=JSON.parse(await file.text());
    if(!cfg || !cfg.snap) throw new Error("bad");
    pushUndo();
    restore(cfg.snap);
  }catch(err){
    console.error(err);
    alert("Fichier JSON invalide.");
  }
});

function exportPNG(){
  const {bg}=themeColors();
  const out=document.createElement("canvas");
  out.width=canvas.width; out.height=canvas.height;
  const c=out.getContext("2d");
  if(els.exportBg.checked){
    c.fillStyle=bg; c.fillRect(0,0,out.width,out.height);
  }else{
    c.clearRect(0,0,out.width,out.height);
  }
  // redraw clean without anchors/grid for export
  const g=grid();
  c.save();
  c.imageSmoothingEnabled=true;
  // background already done if needed
  // render fusion only
  // reuse off by drawing computed image then scaling
  c.drawImage(off, g.x0, g.y0, g.w, g.h);
  c.restore();

  out.toBlob((blob)=>{
    if(!blob) return;
    const stamp=new Date().toISOString().replaceAll(":","-").slice(0,19);
    downloadBlob(`widmer-fusion-${stamp}.png`, blob);
  }, "image/png");
}

function clearAll(){
  pushUndo();
  state.points=[];
  draw();
}

["input","change"].forEach(evtName=>{
  document.addEventListener(evtName,(e)=>{
    const id=e.target && e.target.id;
    if(!id) return;
    if(["cols","rows","showGrid","snap","symV","symH","radius","fusion","iso","qual","smooth","bgWhite","neg","exportBg"].includes(id)){
      draw();
    }
  }, {passive:true});
});

[els.btnUndo,els.mbUndo].forEach(b=>b.addEventListener("click", doUndo));
[els.btnRedo,els.mbRedo].forEach(b=>b.addEventListener("click", doRedo));
[els.btnSave,els.mbSave].forEach(b=>b.addEventListener("click", saveToDisk));
[els.btnLoad,els.mbLoad].forEach(b=>b.addEventListener("click", openLoadDialog));
els.btnClear.addEventListener("click", clearAll);
els.mbExport.addEventListener("click", exportPNG);

updateVals();
updateUndoRedoUI();
draw();
