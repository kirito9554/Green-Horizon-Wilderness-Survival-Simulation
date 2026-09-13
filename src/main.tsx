import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import EncounterDemoApp from './EncounterDemoApp.tsx';
import './index.css';

const searchParams = new URLSearchParams(window.location.search);
const RootComponent = searchParams.get('encounter') === '1' ? EncounterDemoApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
);