import { render } from 'preact';
import { loadConfig } from './config';
import { syncViewport } from './platform/viewport';
import { createAppServices } from './state/app-services';
import { ServicesContext } from './state/hooks';
import { App } from './ui/App';
import './styles.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root element.');
}

const services = createAppServices(loadConfig(import.meta.env));
syncViewport();

render(
  <ServicesContext.Provider value={services}>
    <App />
  </ServicesContext.Provider>,
  root,
);
