import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './clerk';
import ErrorBoundary from './ErrorBoundary';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
