// Widmer – Mobile Fusion v4 (iOS friendly)
// Fusion visuelle + grille + export/save/undo. Optimisé: rendu offscreen downscale pendant dessin.

const canvas = document.getElementById("cv");
const ctx = canvas.getContext("2d");

const els = {
  panel: document.getElementById("panel"),
  toggle: document.getElementById("toggle"),
  radius: document.getElementById("radius"),
  fusion: document.getElementById("fusion"),
  iso: document.getElementById("iso"),
  q: document.getElementById("q"),

  cols: document.getElementById("cols"),
  rows: document.getElementById("rows"),
  showGrid: document.getElementById("showGrid"),
  snap: document.getElementById("snap"),
  symV: document.getElementById("symV"),
  symH: document.getElementById("symH"),

  bgWhite: document.getElementById("bgWhite"),
  neg: document.getElementById("neg"),
  exportBg: document.getElementById("exportBg"),
  showAnchors: document.getElementById("showAnchors"),

  drawBtn: document.getElementById("drawBtn"),
  eraseBtn: document.getElementById("eraseBtn"),

  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  exportBtn: document.getElementById("exportBtn"),
  shareBtn: document.getElementById("shareBtn"),
  clearBtn: document.getElementById("clearBtn"),
  fileLoad: document.getElementById("fileLoad"),

  mbUndo: document.getElementById("mbUndo"),
  mbRedo: document.getElementById("mbRedo"),
  mbSave: document.getElementById("mbSave"),
  mbLoad: document.getElementById("mbLoad"),
  mbExport: document.getElementById("mbExport"),
  mbShare: document.getElementById("mbShare"),

  status: document.getElementById("status"),

  toast: document.getElementById("toast"),

  colsVal: document.getElementById("colsVal"),
  rowsVal: document.getElementById("rowsVal"),
  radiusVal: document.getElementById("radiusVal"),
  fusionVal: document.getElementById("fusionVal"),
  isoVal: document.getElementById("isoVal"),
  qVal: document.getElementById("qVal"),
};

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

function theme(){
  let bg = els.bgWhite.checked ? "#ffffff" : "#0b0d12";
  let fg = els.bgWhite.checked ? "#0b0d12" : "#ffffff";
  if(els.neg.checked){ const t=bg; bg=fg; fg=t; }
  return {bg, fg};
}

function resize(){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize();
window.addEventListener("resize", ()=>{ resize(); requestRender(true); });

function gridRect(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const m = Math.round(Math.min(w,h) * 0.06); // inner margin
  const x0 = m, y0 = m;
  const x1 = w - m, y1 = h - m;
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0, outerW:w, outerH:h};
}

function grid(){
  const g = gridRect();
  const cols = +els.cols.value;
  const rows = +els.rows.value;
  return { ...g, cols, rows, cellX: g.w/cols, cellY: g.h/rows };
}

// Points stored as grid intersections: {i,j}
const state = { points: [] };

const hist = { undo: [], redo: [], max: 80 };

function snapshot(){
  return { points: state.points.map(p=>({i:p.i,j:p.j})), ui: currentUI() };
}
function pushUndo(){
  hist.undo.push(snapshot());
  if(hist.undo.length>hist.max) hist.undo.shift();
  hist.redo = [];
  updateUndoRedoUI();
}
function restore(s){
  state.points = s.points.map(p=>({i:p.i,j:p.j}));
  applyUI(s.ui);
  hist.redo = [];
  updateUndoRedoUI();
  requestRender(true);
}
function doUndo(){
  if(hist.undo.length===0) return;
  const cur = snapshot();
  const prev = hist.undo.pop();
  hist.redo.push(cur);
  restore(prev);
}
function doRedo(){
  if(hist.redo.length===0) return;
  const cur = snapshot();
  const nxt = hist.redo.pop();
  hist.undo.push(cur);
  restore(nxt);
}
function updateUndoRedoUI(){
  const u = hist.undo.length===0;
  const r = hist.redo.length===0;
  [els.undoBtn, els.mbUndo].forEach(b=> b.disabled = u);
  [els.redoBtn, els.mbRedo].forEach(b=> b.disabled = r);
}

function currentUI(){
  return {
    radius:+els.radius.value, fusion:+els.fusion.value, iso:+els.iso.value, q:+els.q.value,
    cols:+els.cols.value, rows:+els.rows.value,
    showGrid:!!els.showGrid.checked, snap:!!els.snap.checked,
    symV:!!els.symV.checked, symH:!!els.symH.checked,
    bgWhite:!!els.bgWhite.checked, neg:!!els.neg.checked, exportBg:!!els.exportBg.checked,
    showAnchors:!!els.showAnchors.checked
  };
}
function applyUI(u){
  if(!u) return;
  els.radius.value = clamp(+u.radius||50,10,140);
  els.fusion.value = clamp(+u.fusion||60,0,160);
  els.iso.value = clamp(+u.iso||1.0,0.6,2.2);
  els.q.value = clamp(+u.q||3.2,2.2,4.2);
  els.cols.value = clamp(+u.cols||20,6,60);
  els.rows.value = clamp(+u.rows||20,6,60);
  els.showGrid.checked = !!u.showGrid;
  els.snap.checked = !!u.snap;
  els.symV.checked = !!u.symV;
  els.symH.checked = !!u.symH;
  els.bgWhite.checked = !!u.bgWhite;
  els.neg.checked = !!u.neg;
  els.exportBg.checked = !!u.exportBg;
  els.showAnchors.checked = (u.showAnchors !== false);
  updateVals();
}

function updateVals(){
  els.colsVal.textContent = els.cols.value;
  els.rowsVal.textContent = els.rows.value;
  els.radiusVal.textContent = els.radius.value;
  els.fusionVal.textContent = els.fusion.value;
  els.isoVal.textContent = (+els.iso.value).toFixed(2);
  els.qVal.textContent = (+els.q.value).toFixed(1);
  els.status.textContent = `${state.points.length} pts`;
}

// tool mode
let mode="draw";
function setMode(m){
  mode=m;
  els.drawBtn.classList.toggle("active", m==="draw");
  els.eraseBtn.classList.toggle("active", m==="erase");
}
els.drawBtn.addEventListener("click", ()=>setMode("draw"));
els.eraseBtn.addEventListener("click", ()=>setMode("erase"));
setMode("draw");

// panel toggle
els.toggle.addEventListener("click", ()=> els.panel.classList.toggle("open"));

// Symmetry helper (grid indices)
function symPoints(p, cols, rows){
  const pts = [{i:p.i, j:p.j}];
  if(els.symV.checked){
    pts.push({i: cols - p.i, j:p.j});
  }
  if(els.symH.checked){
    const base = pts.slice();
    for(const q of base) pts.push({i:q.i, j: rows - q.j});
  }
  // de-dupe
  const out=[]; const seen=new Set();
  for(const q of pts){
    const k = q.i+"_"+q.j;
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

function toScreen(p, g){
  const x = g.x0 + p.i * g.cellX;
  const y = g.y0 + p.j * g.cellY;
  return {x,y};
}

function nearestGridIndex(pos, g){
  // pos is in CSS px within canvas
  const u = clamp((pos.x - g.x0)/g.w, 0, 1);
  const v = clamp((pos.y - g.y0)/g.h, 0, 1);
  const i = Math.round(u * g.cols);
  const j = Math.round(v * g.rows);
  return {i: clamp(i,0,g.cols), j: clamp(j,0,g.rows)};
}

function addPointGrid(p, g){
  const tol = Math.max(0.45, 0.20); // in cells
  // avoid duplicates
  for(const q of state.points){
    if(q.i===p.i && q.j===p.j) return;
  }
  state.points.push({i:p.i, j:p.j});
}
function erasePointNear(pos, g){
  const R = Math.max(12, Math.min(g.cellX,g.cellY)*0.45);
  for(let idx=state.points.length-1; idx>=0; idx--){
    const s = toScreen(state.points[idx], g);
    if(Math.hypot(s.x-pos.x, s.y-pos.y) <= R){
      state.points.splice(idx,1);
      return true;
    }
  }
  return false;
}

function getPos(touch){
  const r = canvas.getBoundingClientRect();
  return {x: touch.clientX - r.left, y: touch.clientY - r.top};
}

// rendering (offscreen downscale)
const off = document.createElement("canvas");
const offCtx = off.getContext("2d", { willReadFrequently:true });

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

function render(high){
  updateVals();
  const g = grid();
  const {bg, fg} = theme();

  // background
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,g.outerW,g.outerH);

  if(els.showGrid.checked){
    drawGridLines(g, bg);
  }

  // fusion layer inside inner rect
  renderFusionLayer(g, fg, high);

  if(els.showAnchors.checked){
    drawAnchors(g, fg);
  }
}

function drawGridLines(g, bg){
  const isDark = bg !== "#ffffff";
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
  for(let c=0;c<=g.cols;c++){
    const x = g.x0 + c*g.cellX;
    ctx.beginPath(); ctx.moveTo(x,g.y0); ctx.lineTo(x,g.y1); ctx.stroke();
  }
  for(let r=0;r<=g.rows;r++){
    const y = g.y0 + r*g.cellY;
    ctx.beginPath(); ctx.moveTo(g.x0,y); ctx.lineTo(g.x1,y); ctx.stroke();
  }
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(g.x0,g.y0,g.w,g.h);
  ctx.restore();
}

function drawAnchors(g, fg){
  ctx.save();
  ctx.fillStyle = fg;
  const r = 2.2;
  for(const p of state.points){
    const s = toScreen(p,g);
    ctx.beginPath(); ctx.arc(s.x,s.y,r,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function renderFusionLayer(g, fg, high){
  const r = +els.radius.value;
  const f = +els.fusion.value;
  const threshold = +els.iso.value;

  // Offscreen size (inner rect only)
  const scale = high ? 2.0 : (isDown ? (+els.q.value) : Math.max(2.4, +els.q.value-0.4));
  const step  = high ? 3 : (isDown ? 5 : 4);

  const ow = Math.max(140, Math.round(g.w / scale));
  const oh = Math.max(140, Math.round(g.h / scale));

  if(off.width!==ow || off.height!==oh){ off.width=ow; off.height=oh; }

  offCtx.clearRect(0,0,ow,oh);
  // transparent background
  offCtx.clearRect(0,0,ow,oh);

  const sx = g.w/ow;
  const sy = g.h/oh;

  // points expanded with symmetry, mapped to inner-local coords (CSS px)
  const pts = [];
  for(const p0 of state.points){
    for(const p of symPoints(p0, g.cols, g.rows)){
      const s = toScreen(p,g);
      pts.push({x: s.x - g.x0, y: s.y - g.y0});
    }
  }

  // gaussian parameters in inner-local coords
  const sigma = r*(1+f/120);
  const inv2s2 = 1/(2*sigma*sigma);

  // draw
  offCtx.fillStyle = fg;

  for(let y=0;y<oh;y+=step){
    const cy = (y+0.5)*sy;
    for(let x=0;x<ow;x+=step){
      const cx = (x+0.5)*sx;
      let v=0;
      for(let i=0;i<pts.length;i++){
        const dx=cx-pts[i].x, dy=cy-pts[i].y;
        v += Math.exp(-(dx*dx+dy*dy)*inv2s2);
        if(v > threshold + 1.5) break;
      }
      if(v >= threshold){
        offCtx.fillRect(x,y,step,step);
      }
    }
  }

  // blit to main
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0,0,ow,oh, g.x0, g.y0, g.w, g.h);
  ctx.restore();
}

// Touch drawing
function stamp(pos){
  const g = grid();
  // accept only inside inner rect
  if(pos.x < g.x0 || pos.x > g.x1 || pos.y < g.y0 || pos.y > g.y1) return;

  if(mode==="erase"){
    // erase nearest point (and its symmetrical counterpart will be regenerated in render, so remove base near)
    erasePointNear(pos,g);
    return;
  }

  // draw
  if(els.snap.checked){
    const idx = nearestGridIndex(pos,g);
    // apply symmetry at add-time? we store only base point; symmetry applied in render
    addPointGrid(idx,g);
  } else {
    // snap off: still store as nearest intersection (simpler + keeps grid logic)
    const idx = nearestGridIndex(pos,g);
    addPointGrid(idx,g);
  }
}

canvas.addEventListener("touchstart",(e)=>{
  e.preventDefault();
  isDown=true;
  pushUndo();
  const p = getPos(e.touches[0]);
  stamp(p);
  requestRender(false);
},{passive:false});

canvas.addEventListener("touchmove",(e)=>{
  e.preventDefault();
  const p = getPos(e.touches[0]);
  stamp(p);
  requestRender(false);
},{passive:false});

function endTouch(e){
  e.preventDefault();
  isDown=false;
  requestRender(true);
}
canvas.addEventListener("touchend", endTouch, {passive:false});
canvas.addEventListener("touchcancel", endTouch, {passive:false});

// UI wiring
function redrawHigh(){ requestRender(true); }
function redrawLow(){ requestRender(false); }

["input","change"].forEach(evtName=>{
  document.addEventListener(evtName,(e)=>{
    const id = e.target && e.target.id;
    if(!id) return;
    if(["radius","fusion","iso","q","cols","rows","showGrid","snap","symV","symH","bgWhite","neg","exportBg","showAnchors"].includes(id)){
      redrawHigh();
    }
  }, {passive:true});
});

// Save/Load
function downloadBlob(name, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
function saveToDisk(){
  const cfg = {version:4, meta:{app:"Widmer Mobile Fusion", exportedAt:new Date().toISOString()}, snap:snapshot()};
  const blob = new Blob([JSON.stringify(cfg,null,2)], {type:"application/json;charset=utf-8"});
  const stamp = new Date().toISOString().replaceAll(":","-").slice(0,19);
  downloadBlob(`widmer-${stamp}.json`, blob);
}
function openLoad(){
  els.fileLoad.value="";
  els.fileLoad.click();
}
els.fileLoad.addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    const cfg = JSON.parse(await file.text());
    if(!cfg || !cfg.snap) throw new Error("bad");
    pushUndo();
    restore(cfg.snap);
  }catch(err){
    console.error(err);
    alert("Fichier JSON invalide.");
  }
});


function showToast(msg){
  if(!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>els.toast.classList.remove("show"), 2400);
}

async function sharePNG(blob, filename){
  // iOS Safari: uses Share Sheet. User then chooses “Enregistrer l’image” to save to Photos.
  try{
    if(navigator.canShare){
      const file = new File([blob], filename, {type:"image/png"});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title: filename});
        showToast("Partage ouvert. Choisis “Enregistrer l’image” pour l’ajouter aux Photos.");
        return true;
      }
    }
  }catch(err){
    console.warn("share failed", err);
  }
  return false;
}
function exportPNG(shareFirst=false){
  // Render clean export: no grid, no anchors
  const g = grid();
  const {bg} = theme();

  const out = document.createElement("canvas");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  out.width = Math.round(rect.width * dpr);
  out.height = Math.round(rect.height * dpr);
  const c = out.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);

  if(els.exportBg.checked){
    c.fillStyle = bg;
    c.fillRect(0,0,rect.width,rect.height);
  } else {
    c.clearRect(0,0,rect.width,rect.height);
  }

  // reuse current off buffer by forcing high render into an export-off to avoid UI state
  // We'll call a dedicated render to the output context
  renderFusionToContext(c, g, theme().fg);

  out.toBlob(async (blob)=>{
    if(!blob) return;
    const stamp = new Date().toISOString().replaceAll(":","-").slice(0,19);
    const filename = `widmer-${stamp}.png`;

    if(shareFirst){
      const ok = await sharePNG(blob, filename);
      if(ok) return;
      showToast("Partage non dispo ici → téléchargement (Fichiers / Téléchargements).");
    } else {
      showToast("PNG téléchargé. Sur iPhone: Fichiers → Téléchargements (ou dossier du navigateur).");
    }

    downloadBlob(filename, blob);
  }, "image/png");
}

function renderFusionToContext(c, g, fg){
  const r = +els.radius.value;
  const f = +els.fusion.value;
  const threshold = +els.iso.value;

  // export is always high
  const scale = 2.0;
  const step  = 3;

  const ow = Math.max(220, Math.round(g.w / scale));
  const oh = Math.max(220, Math.round(g.h / scale));

  // local offscreen for export (avoid race with UI)
  const exp = document.createElement("canvas");
  exp.width = ow; exp.height = oh;
  const ex = exp.getContext("2d", { willReadFrequently:true });

  const sx = g.w/ow;
  const sy = g.h/oh;

  const pts = [];
  for(const p0 of state.points){
    for(const p of symPoints(p0, g.cols, g.rows)){
      const s = toScreen(p,g);
      pts.push({x: s.x - g.x0, y: s.y - g.y0});
    }
  }

  const sigma = r*(1+f/120);
  const inv2s2 = 1/(2*sigma*sigma);

  ex.clearRect(0,0,ow,oh);
  ex.fillStyle = fg;

  for(let y=0;y<oh;y+=step){
    const cy = (y+0.5)*sy;
    for(let x=0;x<ow;x+=step){
      const cx = (x+0.5)*sx;
      let v=0;
      for(let i=0;i<pts.length;i++){
        const dx=cx-pts[i].x, dy=cy-pts[i].y;
        v += Math.exp(-(dx*dx+dy*dy)*inv2s2);
        if(v > threshold + 1.5) break;
      }
      if(v >= threshold){
        ex.fillRect(x,y,step,step);
      }
    }
  }

  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(exp, 0,0,ow,oh, g.x0, g.y0, g.w, g.h);
  c.restore();
}

// Buttons wiring
[els.undoBtn, els.mbUndo].forEach(b=>b.addEventListener("click", doUndo));
[els.redoBtn, els.mbRedo].forEach(b=>b.addEventListener("click", doRedo));
[els.saveBtn, els.mbSave].forEach(b=>b.addEventListener("click", saveToDisk));
[els.loadBtn, els.mbLoad].forEach(b=>b.addEventListener("click", openLoad));
[els.exportBtn, els.mbExport].forEach(b=>b.addEventListener("click", ()=>exportPNG(false)));
[els.shareBtn, els.mbShare].forEach(b=>b && b.addEventListener("click", ()=>exportPNG(true)));
els.clearBtn.addEventListener("click", ()=>{ pushUndo(); state.points=[]; requestRender(true); });

updateUndoRedoUI();
updateVals();
requestRender(true);
