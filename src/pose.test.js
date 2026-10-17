import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimatePose,isWave} from './pose.js';

test('projects the estimated marker back onto front-facing and tilted QR corners',()=>{
  for(const angle of [0,.3,-.6,1]){
    const c=Math.cos(angle),s=Math.sin(angle),f=640,w=720,h=540;
    const corners=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].map(([x,y])=>{
      const z=3+s*x;return {x:w/2+f*(c*x+.2)/z,y:h/2-f*(y-.1)/z};
    });
    const p=estimatePose(corners,w,h,f);assert.ok(p);
    assert.ok(Math.abs(p.position[0]-.2)<1e-7);assert.ok(Math.abs(p.position[1]+.1)<1e-7);assert.ok(Math.abs(p.position[2]+3)<1e-7);
    for(let i=0;i<4;i++){
      const [x,y]=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]][i];
      const a=p.position.map((v,k)=>v+p.x[k]*x+p.y[k]*y);
      assert.ok(Math.abs(w/2+f*a[0]/-a[2]-corners[i].x)<1e-6);
      assert.ok(Math.abs(h/2-f*a[1]/-a[2]-corners[i].y)<1e-6);
    }
  }
});
test('degenerate corners cannot produce a pose',()=>{
  assert.equal(estimatePose(Array(4).fill({x:1,y:1}),720,540,640),null);
});
test('only known wave instructions trigger the character',()=>{
  for(const s of ['tutu:wave','手を振る','{"character":"tutu","action":"wave"}'])assert.equal(isWave(s),true);
  for(const s of ['https://example.com','wave','{"character":"other","action":"wave"}','null'])assert.equal(isWave(s),false);
});
