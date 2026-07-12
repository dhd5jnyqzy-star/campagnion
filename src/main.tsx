import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { store } from './app/store';
import './index.css';

// Offline-Boot (M5/§1): Service Worker registrieren, Updates ziehen sich
// selbst nach. In Nicht-Secure-Contexts (http-LAN-Test) tut das schlicht nichts.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
