import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { Builder } from './Builder';
import { registerSW } from 'virtual:pwa-register';

createRoot(document.getElementById('root')!).render(<StrictMode><Builder /></StrictMode>);

// черновик сборки хранится в памяти телефона, поэтому обновиться можно в любой момент — выбор не пропадёт
const update = registerSW({ immediate: true, onNeedRefresh() { void update(true); } });
