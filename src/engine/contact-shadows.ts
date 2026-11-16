// Sombras de contato (técnica de profundidade vista de baixo + blur), como em renders de produto.
import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export class ContactShadows {
  readonly group = new THREE.Group();
  private rt: THREE.WebGLRenderTarget;
  private rtBlur: THREE.WebGLRenderTarget;
  private cam: THREE.OrthographicCamera;
  private plane: THREE.Mesh;
  private blurPlane: THREE.Mesh;
  private depthMat: THREE.MeshDepthMaterial;
  private hBlur: THREE.ShaderMaterial;
  private vBlur: THREE.ShaderMaterial;
  darkness = 1.4;
  blur = 2.2;
  opacity = 0.85;
  dirty = true;
  private size = 100;

  constructor(resolution: number) {
    this.rt = new THREE.WebGLRenderTarget(resolution, resolution);
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    this.rtBlur.texture.generateMipmaps = false;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
    this.plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity: this.opacity, depthWrite: false }));
    this.plane.renderOrder = -1;
    this.plane.scale.y = -1;
    this.group.add(this.plane);
    this.blurPlane = new THREE.Mesh(geo);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);
    this.cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.cam.rotation.x = Math.PI / 2;
    this.group.add(this.cam);
    this.depthMat = new THREE.MeshDepthMaterial();
    this.depthMat.userData.darkness = { value: this.darkness };
    this.depthMat.onBeforeCompile = shader => {
      shader.uniforms.darkness = this.depthMat.userData.darkness;
      shader.fragmentShader = 'uniform float darkness;\n' + shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );');
    };
    this.depthMat.depthTest = false; this.depthMat.depthWrite = false;
    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader); this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader); this.vBlur.depthTest = false;
  }

  /** Posiciona o plano sob o modelo. */
  fit(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    const s = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    this.size = Math.max(s.x, s.z) * 1.6 + 20;
    this.group.position.set(c.x, box.min.y - 0.01, c.z);
    this.plane.scale.set(this.size, -1, this.size);
    this.blurPlane.scale.set(this.size, 1, this.size);
    this.cam.left = -this.size / 2; this.cam.right = this.size / 2; this.cam.top = this.size / 2; this.cam.bottom = -this.size / 2;
    this.cam.near = 0; this.cam.far = Math.max(10, s.y * 0.9);
    this.cam.updateProjectionMatrix();
    this.dirty = true;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, hide: THREE.Object3D[]): void {
    if (!this.dirty || !this.group.visible) return;
    this.dirty = false;
    (this.plane.material as THREE.MeshBasicMaterial).opacity = this.opacity;
    this.depthMat.userData.darkness.value = this.darkness;
    const vis = hide.map(o => o.visible); hide.forEach(o => (o.visible = false));
    const bg = scene.background, env = scene.environment, planeVis = this.plane.visible;
    this.plane.visible = false;
    scene.background = null; scene.overrideMaterial = this.depthMat;
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha(), prevTM = renderer.toneMapping;
    renderer.setClearAlpha(0); renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(this.rt); renderer.clear();
    renderer.render(scene, this.cam);
    scene.overrideMaterial = null;
    this.blurPass(renderer, this.blur); this.blurPass(renderer, this.blur * 0.4);
    renderer.setRenderTarget(prevTarget); renderer.setClearAlpha(prevClear); renderer.toneMapping = prevTM;
    scene.background = bg; scene.environment = env; this.plane.visible = planeVis;
    hide.forEach((o, i) => (o.visible = vis[i]));
  }

  private blurPass(renderer: THREE.WebGLRenderer, amount: number): void {
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.rtBlur); renderer.render(this.blurPlane, this.cam);
    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.rt); renderer.render(this.blurPlane, this.cam);
    this.blurPlane.visible = false;
  }

  dispose(): void { this.rt.dispose(); this.rtBlur.dispose(); }
}
