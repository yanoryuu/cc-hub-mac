import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './mac.css';

// macOS の Electron(preload の ccHub.platform)では、タイトルバーとサイドバーの透過を有効にする
const hub = (window as unknown as { ccHub?: { platform?: string } }).ccHub;
if (hub?.platform === 'darwin') document.documentElement.classList.add('mac');

// ダブルタップ拡大の保険(touch-action が効かない古いブラウザ向け)
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
