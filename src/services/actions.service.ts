import { reactive, readonly } from 'vue';

export type ActionPlacement = 'top' | 'bottom' | 'center' | 'banner-top' | 'banner-bottom';
export type ActionKind = 'info' | 'success' | 'warning' | 'error';

export interface ActionOptions {
  kind?: ActionKind;
  placement?: ActionPlacement;
  durationMs?: number | null; // null or undefined = durable
  canAutoDismiss?: boolean; // when durationMs is undefined, auto-timeout per kind if true (default true)
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
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private state = reactive<{ actions: ActionItem[]; undoStack: ActionItem[] }>({
    actions: [],
    undoStack: [],
  });

  get actions(): readonly ActionItem[] {
    return readonly(this.state.actions) as readonly ActionItem[];
  }
  get undoStack(): readonly ActionItem[] {
    return readonly(this.state.undoStack) as readonly ActionItem[];
  }

  show(message: string, opts: ActionOptions = {}): number {
    const id = this.seq++;
    // Determine auto-dismiss duration
    const kind = opts.kind ?? 'info';
    const auto = opts.canAutoDismiss ?? true;
    const computedDuration = (() => {
      if (opts.durationMs !== undefined) {
        return opts.durationMs;
      } // explicit (including null)
      if (!auto) {
        return null;
      }
      switch (kind) {
        case 'warning':
          return 10000; // 10s
        case 'error':
          return 20000; // 20s
        case 'success':
        case 'info':
        default:
          return 5000; // 5s
      }
    })();

    const item: ActionItem = {
      id,
      message,
      kind,
      placement: opts.placement ?? 'bottom',
      durationMs: computedDuration ?? null,
      dismissLabel: opts.dismissLabel ?? 'Dismiss',
      undoLabel: opts.undoLabel ?? 'Undo',
      canUndo: !!opts.canUndo || !!opts.onUndo,
      onUndo: opts.onUndo,
      onDismiss: opts.onDismiss,
      createdAt: Date.now(),
    };
    this.state.actions.push(item);
    if (item.canUndo) {
      this.state.undoStack.push(item);
    }
    if (item.durationMs !== null && item.durationMs !== undefined) {
      const t = setTimeout(
        () => {
          this.dismiss(id);
        },
        Math.max(0, item.durationMs)
      );
      this.timers.set(id, t);
    }
    return id;
  }

  dismiss(id: number) {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    const idx = this.state.actions.findIndex((a) => a.id === id);
    if (idx !== -1) {
      const [item] = this.state.actions.splice(idx, 1);
      if (item?.onDismiss) {
        void item.onDismiss();
      }
    }
  }

  undo(id: number) {
    const item =
      this.state.actions.find((a) => a.id === id) || this.state.undoStack.find((a) => a.id === id);
    if (item && item.canUndo && item.onUndo) {
      void item.onUndo();
      this.dismiss(item.id);
      // remove from undo stack as well
      const ui = this.state.undoStack.findIndex((a) => a.id === item.id);
      if (ui !== -1) {
        this.state.undoStack.splice(ui, 1);
      }
    }
  }

  undoLast() {
    const last = this.state.undoStack.pop();
    if (last && last.onUndo) {
      void last.onUndo();
    }
    if (last) {
      this.dismiss(last.id);
    }
  }

  clearAll() {
    // clear any pending timers
    for (const t of this.timers.values()) {
      clearTimeout(t);
    }
    this.timers.clear();
    this.state.actions.splice(0);
    this.state.undoStack.splice(0);
  }
}

export const actionsService = new ActionService();
