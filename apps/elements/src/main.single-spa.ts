import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { singleSpaAngularElements } from 'single-spa-angular/elements';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

const lifecycles = singleSpaAngularElements({
  template: '<elements-root />',
  bootstrapFunction: () => platformBrowserDynamic().bootstrapModule(AppModule, { ngZone: 'noop' }),
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;
