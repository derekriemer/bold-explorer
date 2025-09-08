import { createApp } from 'vue';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import App from './App.vue';
import router from './router';
import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { installRepositories } from './plugins/repositories';
import { installActions } from './plugins/actions';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

async function bootstrap() {
  // Register the jeep-sqlite custom element (web sqlite bridge)
  if (typeof window !== 'undefined') {
    jeepSqlite(window);
    await customElements.whenDefined('jeep-sqlite');
    let el = document.querySelector('jeep-sqlite') as any;
    if (!el) {
      el = document.createElement('jeep-sqlite');
      document.body.appendChild(el);
    }
    // Ensure sql.js assets are loaded from /sqljs. Set both attribute and property.
    el.setAttribute('wasm-path', '/sqljs');
    (el as any).wasmPath = '/sqljs';
    // Explicit log to help debug path issues rather than hiding errors
    // eslint-disable-next-line no-console
    console.info('[jeep-sqlite] wasmPath set to', el.getAttribute('wasm-path'));
  }
  const pinia = createPinia();
  await installRepositories(pinia);

  const app = createApp(App)
    .use(IonicVue)
    .use(pinia)
    .use(router);

  installActions(app);

  router.isReady().then(() => {
    app.mount('#app');
  });
}

bootstrap();
