// Render fotorrealista por path tracing (carregado sob demanda): iluminação global, refração real, cáusticas aproximadas.
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

export class PhotoRenderer {
  private pt: WebGLPathTracer;
  running = false;
  target = 256;
  onProgress: (samples: number, target: number) => void = () => {};

  constructor(renderer: THREE.WebGLRenderer) {
    this.pt = new WebGLPathTracer(renderer);
    this.pt.tiles.set(2, 2);
    this.pt.bounces = 8;
    this.pt.transmissiveBounces = 12;
    this.pt.filterGlossyFactor = 0.4;
    this.pt.minSamples = 1;
    this.pt.renderDelay = 0;
    this.pt.fadeDuration = 0;
    this.pt.dynamicLowRes = false;
  }

  async start(scene: THREE.Scene, camera: THREE.Camera, samples: number): Promise<void> {
    this.target = samples;
    // geração síncrona da BVH (sem worker): mais compatível com WebView/Tauri/Capacitor
    await new Promise(r => setTimeout(r, 30));
    this.pt.setScene(scene, camera);
    this.pt.updateEnvironment();
    this.running = true;
  }

  updateCamera(): void { this.pt.updateCamera(); }

  /** Chamado a cada frame. Retorna true enquanto ainda está acumulando amostras. */
  step(): boolean {
    if (!this.running) return false;
    if (this.pt.samples >= this.target) { this.onProgress(this.target, this.target); return false; }
    this.pt.renderSample();
    this.onProgress(Math.floor(this.pt.samples), this.target);
    return true;
  }

  get samples(): number { return this.pt.samples; }

  stop(): void { this.running = false; }

  dispose(): void { this.running = false; this.pt.dispose(); }
}
