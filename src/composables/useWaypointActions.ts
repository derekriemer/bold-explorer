import type { LatLng } from '@/types/latlng';
import { useWaypoints } from '@/stores/useWaypoints';
import { useActions } from './useActions';

type Point = { name: string; latLng: LatLng; elev_m: number | null };

/**
 * Wrap common waypoint actions with toasts and store updates.
 * Keeps pages as orchestration-only layers.
 */
export function useWaypointActions ()
{
  const wps = useWaypoints();
  const actions = useActions();

  async function createStandalone (p: Point): Promise<number>
  {
    const id = await wps.create(p);
    await wps.refreshAll();
    actions.show('Waypoint created', { kind: 'success' });
    return id;
  }

  async function addToTrail (trailId: number, p: Point): Promise<void>
  {
    await wps.addToTrail(trailId, p);
    await wps.loadForTrail(trailId);
    actions.show('Waypoint added to trail', { kind: 'success' });
  }

  async function rename (id: number, name: string): Promise<void>
  {
    await wps.update(id, { name });
    await wps.refreshAll();
    actions.show('Waypoint renamed', { kind: 'success' });
  }

  async function remove (id: number): Promise<void>
  {
    await wps.remove(id);
    await wps.refreshAll();
    actions.show('Waypoint deleted', { kind: 'success' });
  }

  async function attachToTrail (trailId: number, waypointId: number): Promise<void>
  {
    await wps.attach(trailId, waypointId);
    actions.show('Waypoint attached to trail', { kind: 'success' });
  }

  return { createStandalone, addToTrail, rename, remove, attachToTrail } as const;
}

