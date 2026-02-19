
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const els = {
  cols: document.getElementById("cols"),
  rows: document.getElementById("rows"),
  margin: document.getElementById("margin"),
  showGrid: document.getElementById("showGrid"),
  snap: document.getElementById("snap"),

  toolSeg: document.getElementById("toolSeg"),
  touchToolSeg: document.getElementById("touchToolSeg"),
  symV: document.getElementById("symV"),
  symH: document.getElementById("symH"),

  radius: document.getElementById("radius"),
  fusion: document.getElementById("fusion"),
  iso: document.getElementById("iso"),
  res: document.getElementById("res"),
  simplify: document.getElementById("simplify"),
  smooth: document.getElementById("smooth"),
  showAnchors: document.getElementById("showAnchors"),
  bgWhite: document.getElementById("bgWhite"),
  neg: document.getElementById("neg"),
  exportBg: document.getElementById("exportBg"),
  btnTogglePanel: document.getElementById("btnTogglePanel"),

  colsVal: document.getElementById("colsVal"),
  rowsVal: document.getElementById("rowsVal"),
  marginVal: document.getElementById("marginVal"),
  radiusVal: document.getElementById("radiusVal"),
  fusionVal: document.getElementById("fusionVal"),
  isoVal: document.getElementById("isoVal"),
  resVal: document.getElementById("resVal"),
  simplifyVal: document.getElementById("simplifyVal"),
  smoothVal: document.getElementById("smoothVal"),

  btnUndo: document.getElementById("btnUndo"),
  btnRedo: document.getElementById("btnRedo"),
  btnSave: document.getElementById("btnSave"),
  btnLoad: document.getElementById("btnLoad"),
  fileLoad: document.getElementById("fileLoad"),
  mbUndo: document.getElementById("mbUndo"),
  mbRedo: document.getElementById("mbRedo"),
  mbSave: document.getElementById("mbSave"),
  mbLoad: document.getElementById("mbLoad"),
  mbExport: document.getElementById("mbExport"),

  btnClear: document.getElementById("btnClear"),
  btnExportSvg: document.getElementById("btnExportSvg"),
  btnExportPng: document.getElementById("btnExportPng"),
  status: document.getElementById("status"),
};

const state = {
  mode: "point",   // point | fusionVisual | metaball | pixel
  points: [],
  pixels: new Set()
};

const history = {
  undo: [],
  redo: [],
  max: 120,
};

function snapshot(){
  return {
    mode: state.mode,
    points: state.points.map(p => ({x:p.x, y:p.y})),
    pixels: Array.from(state.pixels),
  };
}

function restore(snap){
  state.mode = snap.mode;
  state.points = snap.points.map(p => ({x:p.x, y:p.y}));
  state.pixels = new Set(snap.pixels);

  // sync mode buttons
  els.toolSeg.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b.dataset.mode===state.mode));

  updateUndoRedoUI();
  draw();
}

function pushUndo(){
  history.undo.push(snapshot());
  if(history.undo.length > history.max) history.undo.shift();
  history.redo = [];
  updateUndoRedoUI();
}

function doUndo(){
  if(history.undo.length === 0) return;
  const cur = snapshot();
  const prev = history.undo.pop();
  history.redo.push(cur);
  restore(prev);
}

function doRedo(){
  if(history.redo.length === 0) return;
  const cur = snapshot();
  const next = history.redo.pop();
  history.undo.push(cur);
  restore(next);
}

function updateUndoRedoUI(){
  // Bottom bar (mobile) mirrors
if(els.mbUndo) els.mbUndo.addEventListener("click", doUndo);
if(els.mbRedo) els.mbRedo.addEventListener("click", doRedo);
if(els.mbSave) els.mbSave.addEventListener("click", saveToDisk);
if(els.mbLoad) els.mbLoad.addEventListener("click", openLoadDialog);
if(els.mbExport) els.mbExport.addEventListener("click", exportPNG);

if(els.btnUndo) els.btnUndo.disabled = history.undo.length === 0;
  if(els.btnRedo) els.btnRedo.disabled = history.redo.length === 0;
}


function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function themeColors(){
  // base: fond blanc + forme sombre
  let bg = els.bgWhite && els.bgWhite.checked ? "#ffffff" : "#0b0d12";
  let fg = els.bgWhite && els.bgWhite.checked ? "#0b0d12" : "#ffffff";
  if(els.neg && els.neg.checked){ const t=bg; bg=fg; fg=t; }
  return {bg, fg};
}

function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }


function boxBlurAlpha(src, w, h, radius){
  radius = Math.max(0, Math.floor(radius));
  if(radius === 0) return src;

  const tmp = new Uint16Array(w*h);
  const out = new Uint8ClampedArray(w*h);

  // horizontal pass into tmp (Uint16)
  for(let y=0; y<h; y++){
    let sum = 0;
    const row = y*w;
    // init window
    for(let x=-radius; x<=radius; x++){
      const xx = clamp(x, 0, w-1);
      sum += src[row + xx];
    }
    for(let x=0; x<w; x++){
      tmp[row + x] = sum;
      const x0 = clamp(x - radius, 0, w-1);
      const x1 = clamp(x + radius + 1, 0, w-1);
      sum += src[row + x1] - src[row + x0];
    }
  }

  const window = radius*2 + 1;

  // vertical pass from tmp into out (Uint8)
  for(let x=0; x<w; x++){
    let sum = 0;
    // init window
    for(let y=-radius; y<=radius; y++){
      const yy = clamp(y, 0, h-1);
      sum += tmp[yy*w + x];
    }
    for(let y=0; y<h; y++){
      out[y*w + x] = Math.round(sum / (window*window));
      const y0 = clamp(y - radius, 0, h-1);
      const y1 = clamp(y + radius + 1, 0, h-1);
      sum += tmp[y1*w + x] - tmp[y0*w + x];
    }
  }

  return out;
}

function hexToRgb(hex){
  const h = (hex||"#000000").replace("#","");
  const v = h.length===3 ? h.split("").map(ch=>ch+ch).join("") : h;
  const n = parseInt(v, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}


function updateVals(){
  els.colsVal.textContent = els.cols.value;
  els.rowsVal.textContent = els.rows.value;
  els.marginVal.textContent = els.margin.value;
  els.radiusVal.textContent = els.radius.value;
  els.fusionVal.textContent = els.fusion.value;
  els.isoVal.textContent = (+els.iso.value).toFixed(2);
  els.resVal.textContent = els.res.value;
  els.simplifyVal.textContent = els.simplify.value;
  els.smoothVal.textContent = (+els.smooth.value).toFixed(2);
}

function grid(){
  const cols = +els.cols.value;
  const rows = +els.rows.value;
  const margin = +els.margin.value;
  const cell = canvas.width / cols;
  const inner = {
    x0: margin*cell,
    y0: margin*cell,
    x1: (cols - margin)*cell,
    y1: (rows - margin)*cell,
  };
  return {cols, rows, margin, cell, inner};
}

function drawGrid(g){
  const {bg, fg} = themeColors();
  const isDark = bg !== "#ffffff";

  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)";
  ctx.lineWidth = 1;
  for(let i=0;i<=g.cols;i++){
    const x=i*g.cell;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for(let j=0;j<=g.rows;j++){
    const y=j*g.cell;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  if(g.margin>0){
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.26)";
    ctx.lineWidth = 2;
    ctx.strokeRect(g.inner.x0, g.inner.y0, g.inner.x1-g.inner.x0, g.inner.y1-g.inner.y0);
  }
  ctx.restore();
}

function getCanvasPos(evt){
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: (evt.clientX-rect.left)*sx, y: (evt.clientY-rect.top)*sy };
}

function inInnerPoint(p,g){
  return p.x>=g.inner.x0 && p.x<=g.inner.x1 && p.y>=g.inner.y0 && p.y<=g.inner.y1;
}
function inInnerCell(c,r,g){
  return c>=g.margin && c<=g.cols-1-g.margin && r>=g.margin && r<=g.rows-1-g.margin;
}

function applySymmetryPoints(p){
  const out=[p];
  const cx = canvas.width/2;
  const cy = canvas.height/2;
  if(els.symV.checked) out.push({x:2*cx-p.x, y:p.y});
  if(els.symH.checked) out.push({x:p.x, y:2*cy-p.y});
  if(els.symV.checked && els.symH.checked) out.push({x:2*cx-p.x, y:2*cy-p.y});
  const dedup=[];
  for(const q of out){
    if(!dedup.some(t=>Math.hypot(t.x-q.x,t.y-q.y)<0.5)) dedup.push(q);
  }
  return dedup;
}
function applySymmetryCells(c,r,g){
  const out=[{c,r}];
  const vc = (g.cols-1)-c;
  const vr = (g.rows-1)-r;
  if(els.symV.checked) out.push({c:vc,r});
  if(els.symH.checked) out.push({c,r:vr});
  if(els.symV.checked && els.symH.checked) out.push({c:vc,r:vr});
  const dedup=[];
  for(const t of out){
    if(!dedup.some(u=>u.c===t.c && u.r===t.r)) dedup.push(t);
  }
  return dedup;
}

function togglePoint(p,g){
  const tol = Math.max(6, g.cell*0.25);
  for(let i=0;i<state.points.length;i++){
    if(dist(state.points[i], p) <= tol){
      state.points.splice(i,1);
      return;
    }
  }
  state.points.push(p);
}
function togglePixel(c,r){
  const k=`${c},${r}`;
  if(state.pixels.has(k)) state.pixels.delete(k);
  else state.pixels.add(k);
}

// ---------- Metaballs vector (marching squares) ----------
function fieldValue(x,y, r, fusion){
  let v=0;
  const rr=(r+fusion);
  const rr2=rr*rr;
  for(const p of state.points){
    const dx=x-p.x, dy=y-p.y;
    const d2=dx*dx + dy*dy + 1e-6;
    v += rr2 / d2;
  }
  return v;
}

function marchingSquares(g){
  if(state.points.length===0) return [];
  const iso = +els.iso.value;
  const r = +els.radius.value;
  const fusion = +els.fusion.value;

  const res = +els.res.value; // 4..48
  const step = Math.max(2, Math.round(g.cell * (12 / res)));

  const x0=g.inner.x0, y0=g.inner.y0, x1=g.inner.x1, y1=g.inner.y1;
  const cols = Math.ceil((x1-x0)/step);
  const rows = Math.ceil((y1-y0)/step);

  const gridVals = new Float32Array((cols+1)*(rows+1));
  for(let j=0;j<=rows;j++){
    const y=y0 + j*step;
    for(let i=0;i<=cols;i++){
      const x=x0 + i*step;
      gridVals[j*(cols+1)+i] = fieldValue(x,y,r,fusion);
    }
  }

  function interp(p1,p2,v1,v2){
    const t=(iso - v1) / (v2 - v1 + 1e-9);
    return { x: p1.x + (p2.x-p1.x)*t, y: p1.y + (p2.y-p1.y)*t };
  }

  const segs=[];
  for(let j=0;j<rows;j++){
    for(let i=0;i<cols;i++){
      const x=x0 + i*step;
      const y=y0 + j*step;

      const a={x:x, y:y};
      const b={x:x+step, y:y};
      const c={x:x+step, y:y+step};
      const d={x:x, y:y+step};

      const va=gridVals[j*(cols+1)+i];
      const vb=gridVals[j*(cols+1)+(i+1)];
      const vc=gridVals[(j+1)*(cols+1)+(i+1)];
      const vd=gridVals[(j+1)*(cols+1)+i];

      const ia = va>=iso ? 1:0;
      const ib = vb>=iso ? 1:0;
      const ic = vc>=iso ? 1:0;
      const id = vd>=iso ? 1:0;

      const idx = (ia<<3)|(ib<<2)|(ic<<1)|id;
      if(idx===0 || idx===15) continue;

      const pAB=interp(a,b,va,vb);
      const pBC=interp(b,c,vb,vc);
      const pCD=interp(c,d,vc,vd);
      const pDA=interp(d,a,vd,va);

      switch(idx){
        case 1:  segs.push([pDA,pCD]); break;
        case 2:  segs.push([pCD,pBC]); break;
        case 3:  segs.push([pDA,pBC]); break;
        case 4:  segs.push([pAB,pBC]); break;
        case 5:  segs.push([pAB,pDA]); segs.push([pBC,pCD]); break;
        case 6:  segs.push([pAB,pCD]); break;
        case 7:  segs.push([pAB,pDA]); break;
        case 8:  segs.push([pAB,pDA]); break;
        case 9:  segs.push([pAB,pCD]); break;
        case 10: segs.push([pAB,pBC]); segs.push([pDA,pCD]); break;
        case 11: segs.push([pAB,pBC]); break;
        case 12: segs.push([pDA,pBC]); break;
        case 13: segs.push([pCD,pBC]); break;
        case 14: segs.push([pDA,pCD]); break;
      }
    }
  }
  return segs;
}

function linkSegments(segs){
  if(!segs.length) return [];
  const key = (p) => `${Math.round(p.x*2)/2},${Math.round(p.y*2)/2}`;
  const map = new Map();
  for(const [p1,p2] of segs){
    const k1=key(p1), k2=key(p2);
    if(!map.has(k1)) map.set(k1,[]);
    if(!map.has(k2)) map.set(k2,[]);
    map.get(k1).push(p2);
    map.get(k2).push(p1);
  }
  const used = new Set();
  const polys=[];
  const edgeKey = (a,b)=> key(a)+"|"+key(b);

  for(const [p1,p2] of segs){
    const ek=edgeKey(p1,p2), rk=edgeKey(p2,p1);
    if(used.has(ek) || used.has(rk)) continue;

    const poly=[p1];
    let prev=p1;
    let cur=p2;
    used.add(ek);

    for(let guard=0; guard<20000; guard++){
      poly.push(cur);
      const neigh = map.get(key(cur)) || [];
      let next=null;
      for(const n of neigh){
        if(Math.hypot(n.x-prev.x,n.y-prev.y) < 0.75) continue;
        const e=edgeKey(cur,n), r=edgeKey(n,cur);
        if(used.has(e) || used.has(r)) continue;
        next=n; used.add(e); break;
      }
      if(!next) break;
      prev=cur;
      cur=next;
      if(Math.hypot(cur.x-p1.x, cur.y-p1.y) < 1.0 && poly.length>6){
        poly.push(p1);
        break;
      }
    }

    if(poly.length>8){
      const a=poly[0], b=poly[poly.length-1];
      if(Math.hypot(a.x-b.x,a.y-b.y) > 1.5) poly.push({...a});
      polys.push(poly);
    }
  }
  return polys;
}

// RDP simplify
function simplifyRDP(pts, eps){
  if(pts.length<4) return pts;
  const first=0, last=pts.length-1;

  function perpDist(p,a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    if(dx===0 && dy===0) return Math.hypot(p.x-a.x, p.y-a.y);
    const t=((p.x-a.x)*dx + (p.y-a.y)*dy) / (dx*dx+dy*dy);
    const xx=a.x + t*dx, yy=a.y + t*dy;
    return Math.hypot(p.x-xx, p.y-yy);
  }

  let maxD=0, idx=0;
  for(let i=1;i<last;i++){
    const d=perpDist(pts[i], pts[first], pts[last]);
    if(d>maxD){ maxD=d; idx=i; }
  }
  if(maxD>eps){
    const left=simplifyRDP(pts.slice(0,idx+1), eps);
    const right=simplifyRDP(pts.slice(idx), eps);
    return left.slice(0,-1).concat(right);
  }
  return [pts[first], pts[last]];
}

// Chaikin smoothing
function chaikin(pts, iterations, amount){
  let p=pts.slice();
  for(let it=0; it<iterations; it++){
    const out=[];
    for(let i=0;i<p.length-1;i++){
      const p0=p[i], p1=p[i+1];
      const q={
        x: p0.x + (p1.x-p0.x)*(0.25 + 0.25*amount),
        y: p0.y + (p1.y-p0.y)*(0.25 + 0.25*amount),
      };
      const r={
        x: p0.x + (p1.x-p0.x)*(0.75 - 0.25*amount),
        y: p0.y + (p1.y-p0.y)*(0.75 - 0.25*amount),
      };
      out.push(q,r);
    }
    out.push({...out[0]});
    p=out;
  }
  return p;
}

function computeMetaballPolys(g){
  const segs = marchingSquares(g);
  const polys = linkSegments(segs);

  const simp = +els.simplify.value; // 0..12
  const smooth = +els.smooth.value; // 0..1
  const eps = (simp/12) * g.cell * 0.9;

  const out=[];
  for(let poly of polys){
    if(eps>0.01){
      poly = simplifyRDP(poly, eps);
      const a=poly[0], b=poly[poly.length-1];
      if(Math.hypot(a.x-b.x,a.y-b.y) > 1.5) poly.push({...a});
    }
    if(smooth>0){
      const iters = smooth>0.66 ? 2 : 1;
      poly = chaikin(poly, iters, smooth);
    }
    out.push(poly);
  }
  return out;
}

// ---------- Fusion visuelle (raster) ----------
const _fv = {
  off: document.createElement("canvas"),
  mask: document.createElement("canvas"),
};
_fv.off.width = canvas.width; _fv.off.height = canvas.height;
_fv.mask.width = canvas.width; _fv.mask.height = canvas.height;

function isoToAlphaThreshold(iso){
  // iso 0.5..2.5 => seuil 60..220
  const t = (iso - 0.5) / 2.0;
  return Math.round(60 + clamp(t,0,1) * 160);
}

function computeFusionVisualMask(g){
  const fusion = +els.fusion.value;
  const iso = +els.iso.value;

  // quality / scale: higher res => closer to 1 (better quality)
  const q = +els.res.value; // 4..48
  const scale = clamp(Math.round(1 + (48 - q) / 16), 1, 4); // 1..4

  const sw = Math.max(1, Math.floor(g.inner.w / scale));
  const sh = Math.max(1, Math.floor(g.inner.h / scale));

  // small offscreen for blur math
  if(!computeFusionVisualMask._s){
    computeFusionVisualMask._s = document.createElement("canvas");
    computeFusionVisualMask._sctx = computeFusionVisualMask._s.getContext("2d", { willReadFrequently:true });
  }
  const sc = computeFusionVisualMask._s;
  const sctx = computeFusionVisualMask._sctx;
  sc.width = sw;
  sc.height = sh;

  sctx.clearRect(0,0,sw,sh);

  // draw disks (alpha mask) in small space
  const r = (+els.radius.value) / scale;
  sctx.fillStyle = "#000";

  // draw sym points
  const pts = [];
  for(const p of state.points){
    for(const q of applySymmetryPoints(p)) pts.push(q);
  }
  for(const p of pts){
    if(!inInnerPoint(p,g)) continue;
    const x = (p.x - g.inner.x0) / scale;
    const y = (p.y - g.inner.y0) / scale;
    sctx.beginPath();
    sctx.arc(x, y, r, 0, Math.PI*2);
    sctx.closePath();
    sctx.fill();
  }

  // read alpha
  const img = sctx.getImageData(0,0,sw,sh);
  const data = img.data;

  const alpha = new Uint8ClampedArray(sw*sh);
  for(let i=0,j=0;i<data.length;i+=4,j++){
    alpha[j] = data[i+3];
  }

  // blur radius in small space
  const br = fusion / scale;
  const blurred = boxBlurAlpha(alpha, sw, sh, br);

  // threshold (iso)
  const thr = clamp(255 * (1/iso), 1, 254);

  const {fg} = themeColors();
  const rgb = hexToRgb(fg);

  for(let i=0,j=0;i<data.length;i+=4,j++){
    if(blurred[j] >= thr){
      data[i] = rgb.r; data[i+1] = rgb.g; data[i+2] = rgb.b; data[i+3] = 255;
    } else {
      data[i+3] = 0;
    }
  }
  sctx.putImageData(img, 0, 0);

  // full-size canvas to composite without changing draw() call site
  if(!computeFusionVisualMask._f){
    computeFusionVisualMask._f = document.createElement("canvas");
    computeFusionVisualMask._fctx = computeFusionVisualMask._f.getContext("2d");
  }
  const fc = computeFusionVisualMask._f;
  const fctx = computeFusionVisualMask._fctx;
  fc.width = canvas.width;
  fc.height = canvas.height;
  fctx.clearRect(0,0,fc.width,fc.height);

  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(sc, 0,0, sw, sh, g.inner.x0, g.inner.y0, g.inner.w, g.inner.h);

  return fc;
}

// ---------- Rendering ----------
function draw(){
  const g = grid();
  const {bg, fg} = themeColors();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // background fill for preview
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  if(els.showGrid.checked) drawGrid(g);

  ctx.fillStyle = fg;

  if(state.mode === "pixel"){
    for(const k of state.pixels){
      const [c,r]=k.split(",").map(Number);
      ctx.fillRect(c*g.cell, r*g.cell, g.cell, g.cell);
    }
    els.status.textContent = `${state.pixels.size} pixel${state.pixels.size>1?'s':''}`;
    return;
  }

  if(state.mode === "point"){
    const r = +els.radius.value;
    for(const p of state.points){
      ctx.beginPath();
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
    }
    els.status.textContent = `${state.points.length} point${state.points.length>1?'s':''}`;
    return;
  }

  if(state.mode === "fusionVisual"){
    const mask = computeFusionVisualMask(g);
    ctx.drawImage(mask, 0, 0);
    els.status.textContent = `${state.points.length} point${state.points.length>1?'s':''}`;
    return;
  }

  // metaball vector
  const polys = computeMetaballPolys(g);
  if(polys.length){
    ctx.beginPath();
    for(const poly of polys){
      if(poly.length<3) continue;
      ctx.moveTo(poly[0].x, poly[0].y);
      for(let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
    }
    ctx.fill("nonzero");
  }

  if(els.showAnchors.checked && polys.length){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    for(const poly of polys){
      const step = Math.max(1, Math.floor(poly.length/80));
      for(let i=0;i<poly.length;i+=step){
        const p=poly[i];
        ctx.beginPath(); ctx.arc(p.x,p.y,2.3,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  els.status.textContent = `${state.points.length} point${state.points.length>1?'s':''}`;
}

// ---------- Interaction ----------

// ---------- Drag draw/erase (pointer) ----------
let isDown = false;
let dragMode = "draw"; // draw | erase
let touchTool = "draw"; // on-screen tool for touch

let lastStamp = null;

function stampKeyPoint(p){
  const kx = Math.round(p.x*2)/2;
  const ky = Math.round(p.y*2)/2;
  return `${kx},${ky}`;
}
function stampKeyCell(c,r){ return `${c},${r}`; }

function addPointAt(p,g){
  if(!inInnerPoint(p,g)) return;
  const tol = Math.max(6, g.cell*0.25);
  if(state.points.some(q => Math.hypot(q.x-p.x,q.y-p.y) <= tol)) return;
  state.points.push(p);
}
function erasePointAt(p,g){
  const tol = Math.max(8, g.cell*0.30);
  for(let i=state.points.length-1;i>=0;i--){
    if(Math.hypot(state.points[i].x-p.x, state.points[i].y-p.y) <= tol){
      state.points.splice(i,1);
      return;
    }
  }
}

function applyPointStamp(pos, evt){
  const g = grid();
  let p = {x: pos.x, y: pos.y};

  if(els.snap.checked && !evt.altKey){
    p.x = Math.round(p.x / g.cell) * g.cell;
    p.y = Math.round(p.y / g.cell) * g.cell;
  }

  p.x = clamp(p.x, g.inner.x0, g.inner.x1);
  p.y = clamp(p.y, g.inner.y0, g.inner.y1);
  if(!inInnerPoint(p,g)) return;

  const pts = applySymmetryPoints(p).map(q => ({
    x: clamp(q.x, g.inner.x0, g.inner.x1),
    y: clamp(q.y, g.inner.y0, g.inner.y1),
  })).filter(q => inInnerPoint(q,g));

  for(const q of pts){
    const sk = stampKeyPoint(q);
    if(lastStamp === sk) continue;
    if(dragMode === "erase") erasePointAt(q,g);
    else addPointAt(q,g);
    lastStamp = sk;
  }
}

function applyPixelStamp(pos){
  const g = grid();
  const c = Math.floor(pos.x / g.cell);
  const r = Math.floor(pos.y / g.cell);
  for(const t of applySymmetryCells(c,r,g)){
    if(!inInnerCell(t.c,t.r,g)) continue;
    const sk = stampKeyCell(t.c,t.r);
    if(lastStamp === sk) continue;
    if(dragMode === "erase") state.pixels.delete(sk);
    else state.pixels.add(sk);
    lastStamp = sk;
  }
}

canvas.addEventListener("pointerdown", (evt)=>{
  if(evt.pointerType === "mouse" && evt.button !== 0) return;
  evt.preventDefault();
  isDown = true;
  lastStamp = null;

  if(evt.pointerType === "mouse") dragMode = evt.shiftKey ? "erase" : "draw";
  else dragMode = touchTool;

  // snapshot once per gesture
  pushUndo();

  canvas.setPointerCapture(evt.pointerId);
  const pos = getCanvasPos(evt);
  if(state.mode === "pixel") applyPixelStamp(pos);
  else applyPointStamp(pos, evt);
  draw();
});

canvas.addEventListener("pointermove", (evt)=>{
  if(!isDown) return;
  evt.preventDefault();
  const pos = getCanvasPos(evt);

  // freehand density control when snap is off (or Alt)
  if(state.mode !== "pixel" && (!els.snap.checked || evt.altKey)){
    if(lastStamp){
      const parts = lastStamp.split(",");
      if(parts.length===2){
        const lx = parseFloat(parts[0]);
        const ly = parseFloat(parts[1]);
        if(Number.isFinite(lx) && Number.isFinite(ly)){
          if(Math.hypot(pos.x-lx, pos.y-ly) < 10) return;
        }
      }
    }
    lastStamp = `${pos.x},${pos.y}`;
  }

  if(state.mode === "pixel") applyPixelStamp(pos);
  else applyPointStamp(pos, evt);
  draw();
});

function endDrag(evt){
  if(!isDown) return;
  isDown = false;
  lastStamp = null;
  try{ canvas.releasePointerCapture(evt.pointerId); }catch(e){}
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", endDrag);


els.toolSeg.addEventListener("click", (evt)=>{
  const btn = evt.target.closest("button[data-mode]");
  if(!btn) return;
  const next = btn.dataset.mode;
  if(!["point","fusionVisual","metaball","pixel"].includes(next)) return;
  state.mode = next;
  els.toolSeg.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b.dataset.mode===next));
  draw();
});

// Touch tool buttons (mobile): Dessiner / Effacer
function setTouchTool(next){
  touchTool = next;
  if(els.touchToolSeg){
    els.touchToolSeg.querySelectorAll("button[data-tool]").forEach(b=>{
      b.classList.toggle("active", b.dataset.tool === touchTool);
    });
  }
}
if(els.touchToolSeg){
  els.touchToolSeg.addEventListener("click", (evt)=>{
    const btn = evt.target.closest("button[data-tool]");
    if(!btn) return;
    const next = btn.dataset.tool;
    if(!["draw","erase"].includes(next)) return;
    setTouchTool(next);
  });
}
setTouchTool("draw");


els.btnClear.addEventListener("click", ()=>{
  state.points = [];
  state.pixels.clear();
  draw();
});



// Save / Load (fichier .json sur disque)
function currentConfig(){
  return {
    version: 1,
    meta: {
      app: "Widmer Grid",
      exportedAt: new Date().toISOString(),
    },
    ui: {
      cols: +els.cols.value,
      rows: +els.rows.value,
      margin: +els.margin.value,
      showGrid: !!els.showGrid.checked,
      snap: !!els.snap.checked,
      symV: !!els.symV.checked,
      symH: !!els.symH.checked,
      radius: +els.radius.value,
      fusion: +els.fusion.value,
      iso: +els.iso.value,
      res: +els.res.value,
      simplify: +els.simplify.value,
      smooth: +els.smooth.value,
      showAnchors: !!els.showAnchors.checked,
      bgWhite: !!(els.bgWhite && els.bgWhite.checked),
      neg: !!(els.neg && els.neg.checked),
      exportBg: !!(els.exportBg && els.exportBg.checked),
    },
    data: snapshot(), // mode + points + pixels
  };
}

function applyUIFromConfig(cfg){
  if(!cfg || !cfg.ui) return;
  const u = cfg.ui;

  if(Number.isFinite(u.cols)) els.cols.value = String(u.cols);
  if(Number.isFinite(u.rows)) els.rows.value = String(u.rows);
  if(Number.isFinite(u.margin)) els.margin.value = String(u.margin);
  if(Number.isFinite(u.radius)) els.radius.value = String(u.radius);
  if(Number.isFinite(u.fusion)) els.fusion.value = String(u.fusion);
  if(Number.isFinite(u.iso)) els.iso.value = String(u.iso);
  if(Number.isFinite(u.res)) els.res.value = String(u.res);
  if(Number.isFinite(u.simplify)) els.simplify.value = String(u.simplify);
  if(Number.isFinite(u.smooth)) els.smooth.value = String(u.smooth);

  if(typeof u.showGrid === "boolean") els.showGrid.checked = u.showGrid;
  if(typeof u.snap === "boolean") els.snap.checked = u.snap;
  if(typeof u.symV === "boolean") els.symV.checked = u.symV;
  if(typeof u.symH === "boolean") els.symH.checked = u.symH;
  if(typeof u.showAnchors === "boolean") els.showAnchors.checked = u.showAnchors;
  if(els.bgWhite && typeof u.bgWhite === "boolean") els.bgWhite.checked = u.bgWhite;
  if(els.neg && typeof u.neg === "boolean") els.neg.checked = u.neg;
  if(els.exportBg && typeof u.exportBg === "boolean") els.exportBg.checked = u.exportBg;

  updateVals();
}

function downloadJSON(filename, obj){
  const text = JSON.stringify(obj, null, 2);
  const blob = new Blob([text], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function safeInt(n, def){ return Number.isFinite(n) ? Math.round(n) : def; }

function validateConfig(cfg){
  if(!cfg || typeof cfg !== "object") return "Fichier invalide.";
  if(!cfg.data || typeof cfg.data !== "object") return "Fichier incomplet (data manquante).";
  if(!Array.isArray(cfg.data.points) || !Array.isArray(cfg.data.pixels)) return "Fichier incomplet (points/pixels).";

  // clamp UI for safety (matching UI ranges)
  if(cfg.ui && typeof cfg.ui === "object"){
    cfg.ui.cols = clamp(safeInt(cfg.ui.cols, +els.cols.value), 6, 60);
    cfg.ui.rows = clamp(safeInt(cfg.ui.rows, +els.rows.value), 6, 60);
    cfg.ui.margin = clamp(safeInt(cfg.ui.margin, +els.margin.value), 0, 6);
    cfg.ui.res = clamp(safeInt(cfg.ui.res, +els.res.value), 4, 48);
    cfg.ui.simplify = clamp(safeInt(cfg.ui.simplify, +els.simplify.value), 0, 12);
    cfg.ui.radius = clamp(safeInt(cfg.ui.radius, +els.radius.value), 4, 140);
    cfg.ui.fusion = clamp(safeInt(cfg.ui.fusion, +els.fusion.value), 0, 160);
    cfg.ui.iso = clamp(Number(cfg.ui.iso ?? +els.iso.value), 0.5, 2.5);
    cfg.ui.smooth = clamp(Number(cfg.ui.smooth ?? +els.smooth.value), 0, 1);
  }
  return null;
}

function loadFromObject(cfg){
  const err = validateConfig(cfg);
  if(err){
    alert(err);
    return;
  }
  // one undo point for the whole load
  pushUndo();

  applyUIFromConfig(cfg);
  restore(cfg.data); // also redraws + syncs mode buttons
}

function saveToDisk(){
  const cfg = currentConfig();
  const stamp = new Date().toISOString().replaceAll(":","-").slice(0,19);
  downloadJSON(`widmer-grid-${stamp}.json`, cfg);
}

function openLoadDialog(){
  if(!els.fileLoad) return;
  els.fileLoad.value = "";
  els.fileLoad.click();
}

if(els.btnSave) els.btnSave.addEventListener("click", saveToDisk);
if(els.btnLoad) els.btnLoad.addEventListener("click", openLoadDialog);

if(els.fileLoad){
  els.fileLoad.addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const cfg = JSON.parse(text);
      loadFromObject(cfg);
    } catch(err){
      console.error(err);
      alert("Impossible de lire ce fichier JSON.");
    }
  });
}

// Undo / Redo
if(els.btnUndo) els.btnUndo.addEventListener("click", doUndo);
if(els.btnRedo) els.btnRedo.addEventListener("click", doRedo);

window.addEventListener("keydown", (e)=>{
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if(!mod) return;

  const k = e.key.toLowerCase();
  if(k === "z" && !e.shiftKey){
    e.preventDefault();
    doUndo();
  } else if((k === "z" && e.shiftKey) || k === "y"){
    e.preventDefault();
    doRedo();
  }
});




// ---------- Export Option A (shapes only) ----------
function exportPNG(){
  const g = grid();
  const off = document.createElement("canvas");
  off.width = canvas.width; off.height = canvas.height;
  const c = off.getContext("2d");
  const {bg, fg} = themeColors();
  c.clearRect(0,0,off.width,off.height);
  if(els.exportBg && els.exportBg.checked){
    c.fillStyle = bg;
    c.fillRect(0,0,off.width,off.height);
  }
  c.fillStyle = fg;

  if(state.mode === "pixel"){
    for(const k of state.pixels){
      const [cc,rr]=k.split(",").map(Number);
      c.fillRect(cc*g.cell, rr*g.cell, g.cell, g.cell);
    }
  } else if(state.mode === "point"){
    const r = +els.radius.value;
    for(const p of state.points){
      c.beginPath(); c.arc(p.x,p.y,r,0,Math.PI*2); c.fill();
    }
  } else if(state.mode === "fusionVisual"){
    const mask = computeFusionVisualMask(g);
    c.drawImage(mask, 0, 0);
  } else {
    const polys = computeMetaballPolys(g);
    if(polys.length){
      c.beginPath();
      for(const poly of polys){
        if(poly.length<3) continue;
        c.moveTo(poly[0].x, poly[0].y);
        for(let i=1;i<poly.length;i++) c.lineTo(poly[i].x, poly[i].y);
        c.closePath();
      }
      c.fill("nonzero");
    }
  }

  const a=document.createElement("a");
  a.href = off.toDataURL("image/png");
  a.download = "widmer-icon.png";
  a.click();
}

function exportSVG(){
  const g = grid();
  const {bg, fg} = themeColors();
  const fill = fg;
  const num = (n)=> (Math.round(n*100)/100).toString();

  let body = "";

  if(state.mode === "pixel"){
    body += `<g id="pixels" fill="${fill}">`;
    for(const k of state.pixels){
      const [c,r]=k.split(",").map(Number);
      body += `<rect x="${num(c*g.cell)}" y="${num(r*g.cell)}" width="${num(g.cell)}" height="${num(g.cell)}" />`;
    }
    body += `</g>`;
  } else if(state.mode === "point" || state.mode === "fusionVisual"){
    body += `<g id="points" fill="${fill}">`;
    const r = +els.radius.value;
    for(const p of state.points){
      body += `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(r)}" />`;
    }
    body += `</g>`;
  } else {
    const polys = computeMetaballPolys(g);
    body += `<g id="shape" fill="${fill}" fill-rule="nonzero">`;
    polys.forEach((poly, idx)=>{
      if(poly.length<3) return;
      let d = `M ${num(poly[0].x)} ${num(poly[0].y)}`;
      for(let i=1;i<poly.length;i++){
        d += ` L ${num(poly[i].x)} ${num(poly[i].y)}`;
      }
      d += " Z";
      body += `<path id="p${idx}" d="${d}" />`;
    });
    body += `</g>`;
  }

  const bgRect = (els.exportBg && els.exportBg.checked)
    ? `<rect id="bg" x="0" y="0" width="${canvas.width}" height="${canvas.height}" fill="${bg}" />\n`
    : "";

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">\n` +
    `${bgRect}${body}\n</svg>\n`;

  const blob = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="widmer-icon.svg";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

els.btnExportPng.addEventListener("click", exportPNG);
els.btnExportSvg.addEventListener("click", exportSVG);

// Re-render on UI changes
for(const k in els){
  const el = els[k];
  if(!el || !el.addEventListener) continue;
  if(el.tagName === "INPUT"){
    el.addEventListener("input", ()=>{ updateVals(); draw(); });
    el.addEventListener("change", ()=>{ updateVals(); draw(); });
  }
}

updateVals();
updateUndoRedoUI();

// Mobile panel toggle
function setPanelCollapsed(collapsed){
  const panel = document.querySelector(".panel");
  if(!panel) return;
  panel.classList.toggle("collapsed", !!collapsed);
  if(els.btnTogglePanel) els.btnTogglePanel.textContent = collapsed ? "Réglages" : "Fermer";
}
if(els.btnTogglePanel){
  els.btnTogglePanel.addEventListener("click", ()=>{
    const panel = document.querySelector(".panel");
    if(!panel) return;
    setPanelCollapsed(!panel.classList.contains("collapsed"));
  });
}
// start collapsed on small screens
if(window.matchMedia && window.matchMedia("(max-width: 980px)").matches){
  setPanelCollapsed(true);
}

draw();
