import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Gera um service worker (offline) apenas para o build web.
function serviceWorker(outDir: string): Plugin {
  return {
    name: 'zeyforge-sw',
    apply: 'build',
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push('./' + relative(outDir, p).replace(/\\/g, '/')); });
      walk(outDir);
      const list = files.filter(f => !f.endsWith('sw.js') && !f.endsWith('.map') && !f.endsWith('.htaccess'));
      const version = 'zf-' + Date.now().toString(36);
      writeFileSync(join(outDir, 'sw.js'), `// gerado no build\nconst V='${version}';const F=${JSON.stringify(['./', ...list])};
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin))return;e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)))});`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const native = env.VITE_TARGET === 'native';
  const outDir = native ? 'dist-native' : 'dist';
  return {
    base: './',
    plugins: [preact(), ...(native ? [] : [serviceWorker(outDir)])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.2.0') },
    clearScreen: false,
    server: { port: 5173, strictPort: true, host: !!process.env.TAURI_DEV_HOST || undefined },
    build: {
      outDir,
      emptyOutDir: true,
      target: native ? 'es2022' : 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1800,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three/build')) return 'three';
            if (id.includes('three-gpu-pathtracer')) return 'pathtracer';
            if (id.includes('three-bvh-csg') || id.includes('three-mesh-bvh')) return 'bvh';
            if (id.includes('@tauri-apps') || id.includes('@capacitor')) return 'platform';
            return undefined;
          },
        },
      },
    },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
