import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { isWave, PAYLOAD } from './pose.js';
import { MarkerTracker, TRACKING_TIMEOUT } from './tracking.js';

const $ = id => document.getElementById(id);
if (new URLSearchParams(location.search).has('marker')) {
  $('app').hidden = true;
  $('marker-page').hidden = false;
  QRCode.toCanvas($('qr'), PAYLOAD, { width: 600, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } }).catch(error => {
    console.error(error); $('marker-page').append('QRコードを生成できませんでした。ページを再読み込みしてください。');
  });
} else {
  init().catch(error => {
    console.error(error);
    $('status').textContent = 'ARを起動できませんでした';
    $('hint').textContent = 'WebGL対応のSafariまたはChromeで開き直してください';
  });
}

async function init() {
  const video = $('video'), viewport = $('viewport');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  $('render').append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60,1,.01,1000);
  scene.add(new THREE.HemisphereLight(0xfff7e7,0xa6b49c,2.7));
  const light = new THREE.DirectionalLight(0xfff4df,3); light.position.set(-2,4,3); scene.add(light);
  const anchor = new THREE.Group(); scene.add(anchor); anchor.visible = false;
  const targetPosition = new THREE.Vector3(), targetRotation = new THREE.Quaternion();
  const tracker = new MarkerTracker();
  const scan = document.createElement('canvas'), ctx = scan.getContext('2d', { willReadFrequently: true });
  let stream, starting=false, mixer, modelReady=false, modelLoading=false, lastSeen=0, lastScan=0, running=true;
  let width=640,height=480,focal=576, seen=false;
  const status = message => { if ($('status').textContent !== message) $('status').textContent = message; };

  function resize() {
    const w=video.videoWidth||640,h=video.videoHeight||480;
    const area=$('experience').getBoundingClientRect(), ratio=Math.min(area.width/w,area.height/h);
    viewport.style.width=`${w*ratio}px`;viewport.style.height=`${h*ratio}px`;
    renderer.setSize(w*ratio,h*ratio,false);
    width=Math.round(Math.min(w,720));height=Math.round(width*h/w);focal=Math.max(width,height)*.9;
    scan.width=width;scan.height=height;
    camera.aspect=width/height; camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(height/(2*focal)));camera.updateProjectionMatrix();
    lastSeen=0;anchor.visible=false;seen=false;tracker.reset();
  }
  new ResizeObserver(resize).observe($('experience'));
  video.addEventListener('resize',resize);
  async function loadModel() {
    if(modelLoading||modelReady)return;
    modelLoading=true;$('retry-model').hidden=true;
    try {
      const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf=await loader.loadAsync('./models/tutu.glb',progress=>{
        $('model-status').textContent=progress.total?`tutuを準備中 ${Math.round(progress.loaded/progress.total*100)}%`:'tutuを準備中…';
      });
      const model=gltf.scene;
      model.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3()), center=bounds.getCenter(new THREE.Vector3());
      // Keep normalization outside the animated nodes, so clips retain original transforms.
      const normalizer=new THREE.Group();
      const s=1.2/size.y;normalizer.scale.setScalar(s);
      model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));normalizer.add(model);
      const upright=new THREE.Group();upright.rotation.x=Math.PI/2;upright.add(normalizer);anchor.add(upright);
      const clip=THREE.AnimationClip.findByName(gltf.animations,'Tutu_Wave_GLB');
      if(!clip)throw new Error('Wave animation is missing');
      mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();modelReady=true;
      $('model-status').textContent='tutuの準備ができました';
    }catch(error){console.error(error);$('model-status').textContent='tutuの読み込みに失敗しました';$('retry-model').hidden=false;}
    finally{modelLoading=false;}
  }
  $('retry-model').addEventListener('click',loadModel);
  async function startCamera() {
    if(starting||stream)return;
    starting=true;$('camera-button').hidden=true;
    try {
      if(!window.isSecureContext)throw new Error('HTTPS_REQUIRED');
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('CAMERA_UNAVAILABLE');
      status('カメラの使用を許可してください');
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      video.srcObject=stream;await video.play();resize();status('QRコードを探しています');
      $('hint').textContent='QRコード全体を映してください';
    } catch(error) {
      stream?.getTracks().forEach(t=>t.stop());stream=null;
      status(error.name==='NotAllowedError'?'カメラの許可が必要です':error.name==='NotFoundError'?'カメラが見つかりません':'カメラを起動できませんでした');
      $('hint').textContent=error.message==='HTTPS_REQUIRED'?'HTTPSまたはlocalhostで開いてください':error.name==='NotAllowedError'?'ブラウザのサイト設定でカメラを許可して、再度起動してください':'ほかのアプリで使用中の場合は閉じて、もう一度お試しください';
      $('camera-button').hidden=false;
    }finally{starting=false;}
  }
  $('camera-button').addEventListener('click',startCamera);
  const clock=new THREE.Clock();
  function frame(now) {
    if(!running)return;
    requestAnimationFrame(frame);
    const delta=Math.min(clock.getDelta(),.05);
    if(document.hidden)return;
    if(stream&&video.readyState>=2&&now-lastScan>100){
      lastScan=now;ctx.drawImage(video,0,0,width,height);
      const pixels=ctx.getImageData(0,0,width,height);
      const qr=jsQR(pixels.data,width,height,{inversionAttempts:'dontInvert'});
      if(qr&&isWave(qr.data)){
        const l=qr.location,pose=tracker.update([l.topLeftCorner,l.topRightCorner,l.bottomRightCorner,l.bottomLeftCorner],width,height,focal,now);
        if(pose){
          targetPosition.copy(pose.position);
          targetRotation.copy(pose.rotation);
          if(pose.snap){anchor.position.copy(targetPosition);anchor.quaternion.copy(targetRotation);}
          if(!seen)mixer?.setTime(0);
          lastSeen=now;seen=true;
        }
      }else if(qr){status('tutu用のQRコードを映してください');}
    }
    const visible=modelReady&&seen&&now-lastSeen<TRACKING_TIMEOUT;
    anchor.visible=visible;$('experience').classList.toggle('tracking',visible);
    if(visible){
      const smoothing=1-Math.exp(-delta*12);
      anchor.position.lerp(targetPosition,smoothing);anchor.quaternion.slerp(targetRotation,smoothing);
      mixer.update(delta);status('tutuが、こんにちは！');$('hint').textContent='QRコードを映したまま、少し角度を変えてみて';
    }else if(stream&&seen){status(now-lastSeen<TRACKING_TIMEOUT?'tutuを準備しています':'QRコードを探しています');$('hint').textContent='QRコード全体を映してください';}
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;running=false;renderer.dispose();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  // Request the camera on entry, with a retry button for browsers requiring a gesture.
  void startCamera();void loadModel();
}
