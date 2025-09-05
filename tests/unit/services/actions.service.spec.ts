import { describe, it, expect, vi } from 'vitest';
import { ActionService } from '@/services/actions.service';

describe('ActionService', () => {
  it('show: defaults, durable vs timed (durationMs null)', () => {
    const svc = new ActionService();
    const id1 = svc.show('Hello');
    const list1 = (svc.actions as unknown as any[]);
    expect(list1.length).toBe(1);
    const a1 = list1[0];
    expect(a1.id).toBe(id1);
    expect(a1.message).toBe('Hello');
    expect(a1.kind).toBe('info');
    expect(a1.placement).toBe('bottom');
    expect(a1.durationMs).toBeNull();
    expect(a1.dismissLabel).toBe('Dismiss');
    expect(a1.undoLabel).toBe('Undo');
    expect(a1.canUndo).toBe(false);

    const id2 = svc.show('Timed', { durationMs: 3000 });
    const list2 = (svc.actions as unknown as any[]);
    const a2 = list2.find(a => a.id === id2)!;
    expect(a2.durationMs).toBe(3000);
  });

  it('dismiss: removes and calls onDismiss', async () => {
    const svc = new ActionService();
    const onDismiss = vi.fn();
    const id = svc.show('Dismiss me', { onDismiss });
    expect((svc.actions as unknown as any[]).length).toBe(1);
    svc.dismiss(id);
    expect((svc.actions as unknown as any[]).length).toBe(0);
    // onDismiss is called (sync or async)
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('undo: only when allowed; calls onUndo; removes from undoStack', () => {
    const svc = new ActionService();
    // Not undoable
    const id1 = svc.show('No undo');
    svc.undo(id1);
    expect((svc.actions as unknown as any[]).length).toBe(1);
    expect((svc.undoStack as unknown as any[]).length).toBe(0);

    // Undoable
    const onUndo = vi.fn();
    const id2 = svc.show('Yes undo', { canUndo: true, onUndo });
    expect((svc.undoStack as unknown as any[]).map(a => a.id)).toContain(id2);
    svc.undo(id2);
    // removed from actions and undoStack
    expect((svc.actions as unknown as any[]).find(a => a.id === id2)).toBeUndefined();
    expect((svc.undoStack as unknown as any[]).find(a => a.id === id2)).toBeUndefined();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('undoLast: LIFO; clears both stacks appropriately', () => {
    const svc = new ActionService();
    const calls: number[] = [];
    const mkUndo = (id: number) => () => { calls.push(id); };
    const id1 = svc.show('A', { canUndo: true, onUndo: mkUndo(1) });
    const id2 = svc.show('B', { canUndo: true, onUndo: mkUndo(2) });
    const id3 = svc.show('C', { canUndo: true, onUndo: mkUndo(3) });
    expect((svc.undoStack as unknown as any[]).map(a => a.id)).toEqual([id1, id2, id3]);

    svc.undoLast();
    expect(calls).toEqual([3]);
    expect((svc.actions as unknown as any[]).find(a => a.id === id3)).toBeUndefined();
    expect((svc.undoStack as unknown as any[]).map(a => a.id)).toEqual([id1, id2]);
  });

  it('clearAll: empties actions and undoStack', () => {
    const svc = new ActionService();
    svc.show('x');
    svc.show('y', { canUndo: true, onUndo: () => {} });
    expect((svc.actions as unknown as any[]).length).toBe(2);
    expect((svc.undoStack as unknown as any[]).length).toBe(1);
    svc.clearAll();
    expect((svc.actions as unknown as any[]).length).toBe(0);
    expect((svc.undoStack as unknown as any[]).length).toBe(0);
  });
});

