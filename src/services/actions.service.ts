import { reactive, readonly } from 'vue';

export type ActionPlacement = 'top' | 'bottom' | 'center' | 'banner-top' | 'banner-bottom';
export type ActionKind = 'info' | 'success' | 'warning' | 'error';

export interface ActionOptions {
  kind?: ActionKind;
  placement?: ActionPlacement;
  durationMs?: number | null; // null or undefined = durable
  dismissLabel?: string;
  undoLabel?: string;
  canUndo?: boolean;
  onUndo?: () => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
}

export interface ActionItem extends Required<Pick<ActionOptions, 'kind' | 'placement'>> {
  id: number;
  message: string;
  durationMs: number | null;
  dismissLabel: string;
  undoLabel: string;
  canUndo: boolean;
  onUndo?: () => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
  createdAt: number;
}

export class ActionService {
  private seq = 1;
  private state = reactive({
    actions: [] as ActionItem[],
    undoStack: [] as ActionItem[]
  });

  get actions() { return readonly(this.state.actions); }
  get undoStack() { return readonly(this.state.undoStack); }

  show(message: string, opts: ActionOptions = {}): number {
    const id = this.seq++;
    const item: ActionItem = {
      id,
      message,
      kind: opts.kind ?? 'info',
      placement: opts.placement ?? 'bottom',
      durationMs: opts.durationMs ?? null,
      dismissLabel: opts.dismissLabel ?? 'Dismiss',
      undoLabel: opts.undoLabel ?? 'Undo',
      canUndo: !!opts.canUndo || !!opts.onUndo,
      onUndo: opts.onUndo,
      onDismiss: opts.onDismiss,
      createdAt: Date.now()
    };
    this.state.actions.push(item);
    if (item.canUndo) this.state.undoStack.push(item);
    return id;
  }

  dismiss(id: number) {
    const idx = this.state.actions.findIndex(a => a.id === id);
    if (idx !== -1) {
      const [item] = this.state.actions.splice(idx, 1);
      if (item?.onDismiss) void item.onDismiss();
    }
  }

  undo(id: number) {
    const item = this.state.actions.find(a => a.id === id) || this.state.undoStack.find(a => a.id === id);
    if (item && item.canUndo && item.onUndo) {
      void item.onUndo();
      this.dismiss(item.id);
      // remove from undo stack as well
      const ui = this.state.undoStack.findIndex(a => a.id === item.id);
      if (ui !== -1) this.state.undoStack.splice(ui, 1);
    }
  }

  undoLast() {
    const last = this.state.undoStack.pop();
    if (last && last.onUndo) void last.onUndo();
    if (last) this.dismiss(last.id);
  }

  clearAll() {
    this.state.actions.splice(0);
    this.state.undoStack.splice(0);
  }
}

export const actionsService = new ActionService();

