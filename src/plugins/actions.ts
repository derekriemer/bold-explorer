import type { App, InjectionKey } from 'vue';
import { actionsService, type ActionService } from '@/services/actions.service';

export const ActionServiceKey: InjectionKey<ActionService> = Symbol('ActionService');

export function installActions(app: App) {
  app.provide(ActionServiceKey, actionsService);
  (app.config.globalProperties as any).$actions = actionsService;
}

