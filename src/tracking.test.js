import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { estimatePose } from './pose.js';
import { MarkerTracker, TRACKING_TIMEOUT } from './tracking.js';

const base = [{x:260,y:170},{x:460,y:170},{x:460,y:370},{x:260,y:370}];
const shifted = (x=0) => base.map(p=>({x:p.x+x,y:p.y}));
const update = (t,c,time) => t.update(c,720,540,640,time);
const quaternion = p => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
  new Vector3(...p.x),new Vector3(...p.y),new Vector3(...p.z),
));

test('suppresses one-pixel corner jitter without losing tracking',()=>{
  const tracker=new MarkerTracker();
  let rawPrevious, filteredPrevious, rawMotion=0, filteredMotion=0;
  for(let i=0;i<100;i++){
    const corners=base.map((p,k)=>({x:p.x+Math.sin(i*2.1+k*1.7),y:p.y+Math.cos(i*1.8+k*2.3)}));
    const raw=quaternion(estimatePose(corners,720,540,640));
    const filtered=update(tracker,corners,i*100);assert.ok(filtered);
    if(i>10){rawMotion+=raw.angleTo(rawPrevious);filteredMotion+=filtered.rotation.angleTo(filteredPrevious);}
    rawPrevious=raw;filteredPrevious=filtered.rotation.clone();
  }
  assert.ok(filteredMotion < rawMotion*.3, `rotation noise: ${filteredMotion/rawMotion}`);
});

test('continues following a moving marker with bounded delay',()=>{
  const tracker=new MarkerTracker();
  update(tracker,base,0);
  let pose;
  for(let i=1;i<=15;i++)pose=update(tracker,shifted(i*5),i*100);
  const screenX=360+640*pose.position.x/-pose.position.z;
  assert.ok(Math.abs(screenX-435)<10,`tracking delay: ${435-screenX}px`);
});

test('rejects an isolated position glitch but accepts sustained relocation',()=>{
  const tracker=new MarkerTracker();update(tracker,base,0);
  assert.equal(update(tracker,shifted(250),100),null);
  assert.ok(update(tracker,base,200));
  assert.equal(update(tracker,shifted(250),300),null);
  assert.equal(update(tracker,shifted(250),400),null);
  const relocated=update(tracker,shifted(250),500);assert.ok(relocated?.snap);
});

test('brief detection gaps preserve smoothing; timeout reacquires immediately',()=>{
  const tracker=new MarkerTracker();assert.equal(update(tracker,base,0).snap,true);
  assert.equal(update(tracker,shifted(1),500).snap,false);
  assert.equal(update(tracker,shifted(200),500+TRACKING_TIMEOUT+1).snap,true);
  tracker.reset();assert.equal(update(tracker,base,1500).snap,true);
});
