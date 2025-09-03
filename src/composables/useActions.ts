import { inject } from 'vue';
import { actionsService, type ActionService } from '@/services/actions.service';
import { ActionServiceKey } from '@/plugins/actions';

export function useActions(): ActionService {
  return inject(ActionServiceKey, actionsService);
}

