import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';
// Side-effect: registers the global connectElgatoStreamDeckSocket function
import './hooks/use-stream-deck';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
