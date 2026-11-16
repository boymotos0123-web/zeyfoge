// Pós-processamento (carregado sob demanda): oclusão de ambiente GTAO + SMAA + saída com tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export class PostFX {
  composer: EffectComposer;
  private renderPass: RenderPass;
  private gtao: GTAOPass;
  private smaa: SMAAPass | null = null;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, msaa: number, smaa: boolean) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.gtao = new GTAOPass(scene, camera, w, h);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.85;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());
    if (smaa) { this.smaa = new SMAAPass(); this.composer.addPass(this.smaa); }
  }

  /** Ajusta o raio da oclusão ao tamanho da cena (mm). */
  setSceneScale(size: number): void {
    this.gtao.updateGtaoMaterial({ radius: Math.max(0.5, size * 0.02), distanceExponent: 1.4, thickness: Math.max(0.3, size * 0.01), scale: 1, samples: 16, distanceFallOff: 1 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  }

  setCamera(camera: THREE.Camera): void { this.renderPass.camera = camera; this.gtao.camera = camera; }

  setSize(w: number, h: number): void { this.composer.setSize(w, h); this.gtao.setSize(w, h); }

  render(): void { this.composer.render(); }

  dispose(): void { this.composer.dispose(); }
}
