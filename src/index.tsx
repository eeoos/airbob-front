import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AppProviders } from './app/providers/AppProviders';
import { clearIdentityOwnedFrontendState } from './app/providers/clearIdentityOwnedFrontendState';
import { ErrorBoundary } from './app/errors/ErrorBoundary';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders clearIdentityOwnedState={clearIdentityOwnedFrontendState}>
          <App />
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
