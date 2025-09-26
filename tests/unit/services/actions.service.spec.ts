import { describe, it, expect, vi } from 'vitest';
import { ActionService } from '@/services/actions.service';

describe('ActionService', () => {
  it('show: defaults auto-dismiss per kind, explicit null keeps durable', () => {
    const svc = new ActionService();
    const id1 = svc.show('Hello');
    const list1 = svc.actions;
    expect(list1.length).toBe(1);
    const a1 = list1[0];
    expect(a1.id).toBe(id1);
    expect(a1.message).toBe('Hello');
    expect(a1.kind).toBe('info');
    expect(a1.placement).toBe('bottom');
    expect(a1.durationMs).toBe(5000);
    expect(a1.dismissLabel).toBe('Dismiss');
    expect(a1.undoLabel).toBe('Undo');
    expect(a1.canUndo).toBe(false);

    const id2 = svc.show('Timed', { durationMs: 3000 });
    const list2 = svc.actions;
    const a2 = list2.find((a) => a.id === id2)!;
    expect(a2.durationMs).toBe(3000);

    const id3 = svc.show('Durable', { durationMs: null });
    const a3 = svc.actions.find((a) => a.id === id3)!;
    expect(a3.durationMs).toBeNull();
  });

  it('dismiss: removes and calls onDismiss', async () => {
    const svc = new ActionService();
    const onDismiss = vi.fn();
    const id = svc.show('Dismiss me', { onDismiss });
    expect(svc.actions.length).toBe(1);
    svc.dismiss(id);
    expect(svc.actions.length).toBe(0);
    // onDismiss is called (sync or async)
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('undo: only when allowed; calls onUndo; removes from undoStack', () => {
    const svc = new ActionService();
    // Not undoable
    const id1 = svc.show('No undo');
    svc.undo(id1);
    expect(svc.actions.length).toBe(1);
    expect(svc.undoStack.length).toBe(0);

    // Undoable
    const onUndo = vi.fn();
    const id2 = svc.show('Yes undo', { canUndo: true, onUndo });
    expect(svc.undoStack.map((a) => a.id)).toContain(id2);
    svc.undo(id2);
    // removed from actions and undoStack
    expect(svc.actions.find((a) => a.id === id2)).toBeUndefined();
    expect(svc.undoStack.find((a) => a.id === id2)).toBeUndefined();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('undoLast: LIFO; clears both stacks appropriately', () => {
    const svc = new ActionService();
    const calls: number[] = [];
    const mkUndo = (id: number) => () => {
      calls.push(id);
    };
    const id1 = svc.show('A', { canUndo: true, onUndo: mkUndo(1) });
    const id2 = svc.show('B', { canUndo: true, onUndo: mkUndo(2) });
    const id3 = svc.show('C', { canUndo: true, onUndo: mkUndo(3) });
    expect(svc.undoStack.map((a) => a.id)).toEqual([id1, id2, id3]);

    svc.undoLast();
    expect(calls).toEqual([3]);
    expect(svc.actions.find((a) => a.id === id3)).toBeUndefined();
    expect(svc.undoStack.map((a) => a.id)).toEqual([id1, id2]);
  });

  it('clearAll: empties actions and undoStack', () => {
    const svc = new ActionService();
    svc.show('x');
    svc.show('y', { canUndo: true, onUndo: () => {} });
    expect(svc.actions.length).toBe(2);
    expect(svc.undoStack.length).toBe(1);
    svc.clearAll();
    expect(svc.actions.length).toBe(0);
    expect(svc.undoStack.length).toBe(0);
  });

  it('auto-dismisses timed action after n ms (fake timers)', () => {
    vi.useFakeTimers();
    const svc = new ActionService();
    const onDismiss = vi.fn();
    const id = svc.show('Timed', { durationMs: 3000, onDismiss });
    expect(svc.actions.some((a) => a.id === id)).toBe(true);

    vi.advanceTimersByTime(2999);
    expect(svc.actions.some((a) => a.id === id)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(svc.actions.some((a) => a.id === id)).toBe(false);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
