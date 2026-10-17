import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const document=await io.read('../animation_export/tutu_web.glb');
await document.transform(dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write('public/models/tutu.glb',document);
