import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { protegerDatos } from './db';
import { iniciarSync } from './sync';
import './styles.css';

registerSW({ immediate: true });
protegerDatos();
iniciarSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
