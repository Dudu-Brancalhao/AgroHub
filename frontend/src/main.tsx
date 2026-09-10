import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { App } from './App';
import { store } from './app/store';
import { theme } from './styles/theme';
import { GlobalStyle } from './styles/GlobalStyle';
import { configureHttpClient } from './lib/httpClient';
import { clearSession } from './features/auth/sessionStorage';
import { sessionCleared } from './features/auth/authSlice';

/**
 * Wires the http client to the store without the client importing it — that would be a
 * dependency pointing outward (Principle II) and a require cycle.
 */
configureHttpClient({
  getToken: () => store.getState().auth.session?.accessToken ?? null,
  onUnauthorized: () => {
    clearSession();
    store.dispatch(sessionCleared());
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
