// Ponto de entrada do ZeyForge.
import { render } from 'preact';
import { App } from './ui/App';
import { installShortcuts } from './app/shortcuts';
import { BUILD_TARGET } from './engine/quality';
import './ui/styles/app.css';

render(<App />, document.getElementById('app')!);
installShortcuts();

// Offline (somente no build web; apps nativos já têm os arquivos localmente)
if (BUILD_TARGET === 'web' && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.match(/^(localhost|127\.)/)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
