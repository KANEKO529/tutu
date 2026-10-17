import { Matrix4, Quaternion, Vector3 } from 'three';
import { estimatePose } from './pose.js';

export const TRACKING_TIMEOUT = 800;
const rotationOf = pose => new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(new Vector3(...pose.x), new Vector3(...pose.y), new Vector3(...pose.z)),
);

// Smooth image measurements before solving the pose: small corner errors can
// otherwise become large changes in the marker's normal (especially head-on).
export class MarkerTracker {
  reset() {
    this.corners = null;
    this.pose = null;
    this.lastSeen = null;
    this.pending = null;
  }

  constructor() { this.reset(); }

  update(corners, width, height, focal, now) {
    if (corners?.length !== 4) return null;
    const side = corners.reduce((sum, p, i) => {
      const q = corners[(i + 1) % 4];
      return sum + Math.hypot(p.x - q.x, p.y - q.y);
    }, 0) / 4;
    // Very small codes decode successfully but do not give a reliable 3D pose.
    if (side < 38) return null;
    const raw = estimatePose(corners, width, height, focal);
    if (!raw) return null;
    const position = new Vector3(...raw.position), rotation = rotationOf(raw);
    const fresh = this.lastSeen === null || now - this.lastSeen > TRACKING_TIMEOUT;
    if (!fresh && this.pose) {
      const depth = Math.abs(this.pose.position.z);
      const jump = position.distanceTo(this.pose.position) > depth * .22
        || rotation.angleTo(this.pose.rotation) > Math.PI / 4;
      if (jump) {
        // A genuine large move persists; a one-frame bad solve does not.
        const consistent = this.pending
          && position.distanceTo(this.pending.position) < depth * .08
          && rotation.angleTo(this.pending.rotation) < .2;
        this.pending = { position, rotation, count: consistent ? this.pending.count + 1 : 1 };
        if (this.pending.count < 3) return null;
        this.corners = null;
      } else {
        this.pending = null;
      }
    }
    const snap = fresh || !this.corners;
    if (snap) {
      this.corners = corners.map(p => ({ x: p.x, y: p.y }));
    } else {
      const dt = Math.max(.016, Math.min(.25, (now - this.lastSeen) / 1000));
      const displacement = Math.sqrt(corners.reduce((sum, p, i) =>
        sum + (p.x - this.corners[i].x) ** 2 + (p.y - this.corners[i].y) ** 2, 0) / 4);
      const speed = displacement / side / dt;
      // Strong damping at rest; increase response as the phone/marker moves.
      const cutoff = Math.min(8, .35 + 8 * Math.max(0, speed - .08));
      const alpha = 1 - Math.exp(-2 * Math.PI * cutoff * dt);
      this.corners.forEach((p, i) => {
        p.x += (corners[i].x - p.x) * alpha;
        p.y += (corners[i].y - p.y) * alpha;
      });
    }
    const filtered = estimatePose(this.corners, width, height, focal);
    if (!filtered) return null;
    const nextPosition = new Vector3(...filtered.position), nextRotation = rotationOf(filtered);
    if (snap || !this.pose) {
      this.pose = { position: nextPosition, rotation: nextRotation };
    } else {
      // A small dead zone prevents the character from constantly chasing noise.
      const distance = this.pose.position.distanceTo(nextPosition);
      const positionDeadZone = Math.abs(nextPosition.z) * .0015;
      if (distance > positionDeadZone) this.pose.position.lerp(nextPosition, 1 - positionDeadZone / distance);
      const angle = this.pose.rotation.angleTo(nextRotation), angleDeadZone = .018;
      if (angle > angleDeadZone) this.pose.rotation.slerp(nextRotation, 1 - angleDeadZone / angle);
    }
    this.lastSeen = now;
    return { ...this.pose, snap };
  }
}
