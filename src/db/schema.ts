import type { ColumnType } from 'kysely';

export interface Trail {
  id: ColumnType<number, number | undefined, number>;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Waypoint {
  id: ColumnType<number, number | undefined, number>;
  name: string;
  lat: number;
  lon: number;
  elev_m: number | null;
  description: string | null;
  created_at: string;
}

export interface TrailWaypoint {
  id: ColumnType<number, number | undefined, number>;
  trail_id: number;
  waypoint_id: number;
  position: number;
  created_at: string;
}

export interface AutoWaypoint {
  id: ColumnType<number, number | undefined, number>;
  trail_id: number;
  name: string | null;
  segment_index: number;
  offset_m: number;
  lat: number | null;
  lon: number | null;
  created_at: string;
}

export interface Collection {
  id: ColumnType<number, number | undefined, number>;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CollectionWaypoint {
  id: ColumnType<number, number | undefined, number>;
  collection_id: number;
  waypoint_id: number;
  created_at: string;
}

export interface CollectionTrail {
  id: ColumnType<number, number | undefined, number>;
  collection_id: number;
  trail_id: number;
  created_at: string;
}

export interface DB {
  trail: Trail;
  waypoint: Waypoint;
  trail_waypoint: TrailWaypoint;
  auto_waypoint: AutoWaypoint;
  collection: Collection;
  collection_waypoint: CollectionWaypoint;
  collection_trail: CollectionTrail;
}
