// The marker is one unit wide, with +Y toward the top of the QR.
export const PAYLOAD = 'tutu:wave';
export function isWave(value) {
  if (value === PAYLOAD || value === '手を振る') return true;
  try { const d = JSON.parse(value); return d.character === 'tutu' && d.action === 'wave'; } catch { return false; }
}
function solve(rows) {
  const n = rows.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    if (Math.abs(divisor) < 1e-10) return null;
    for (let c = col; c <= n; c++) rows[col][c] /= divisor;
    for (let r = 0; r < n; r++) if (r !== col) {
      const k = rows[r][col];
      for (let c = col; c <= n; c++) rows[r][c] -= k * rows[col][c];
    }
  }
  return rows.map(row => row[n]);
}
const length = a => Math.hypot(...a);
const scale = (a, s) => a.map(v => v * s);
const dot = (a,b) => a.reduce((s,v,i) => s + v*b[i],0);
export function estimatePose(corners, width, height, focal) {
  if (!corners?.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const world = [[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]];
  const rows = [];
  for (let i=0;i<4;i++) {
    const [x,y] = world[i], u=(corners[i].x-width/2)/focal, v=(corners[i].y-height/2)/focal;
    rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);
  }
  const h = solve(rows);
  if (!h) return null;
  let x=[h[0],h[3],h[6]], y=[h[1],h[4],h[7]];
  const s=2/(length(x)+length(y));
  const position=[h[2]*s,-h[5]*s,-s];
  // Convert camera coordinates (Y down, Z forward) to Three.js coordinates.
  x=scale([x[0],-x[1],-x[2]],1/length(x));
  y=[y[0],-y[1],-y[2]];
  const d=dot(x,y); y=y.map((v,i)=>v-d*x[i]);
  if (length(y)<1e-6 || !Number.isFinite(s) || s<=0) return null;
  y=scale(y,1/length(y));
  const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
  return {x,y,z,position};
}
