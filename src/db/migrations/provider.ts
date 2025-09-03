import type { Kysely } from 'kysely';
import { Migrator } from 'kysely';

export const migrations = {
  '001_trail': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('trail')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('trail').execute();
    }
  },
  '002_waypoint': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('waypoint')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('lat', 'real', (col) => col.notNull())
        .addColumn('lon', 'real', (col) => col.notNull())
        .addColumn('elev_m', 'real')
        .addColumn('description', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
      await db.schema
        .createIndex('idx_waypoint_lat_lon')
        .on('waypoint')
        .column('lat')
        .column('lon')
        .execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('waypoint').execute();
    }
  },
  '003_trail_waypoint': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('trail_waypoint')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('trail_id', 'integer', (col) => col.notNull().references('trail.id'))
        .addColumn('waypoint_id', 'integer', (col) => col.notNull().references('waypoint.id'))
        .addColumn('position', 'integer', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
      await db.schema.createIndex('idx_trail_waypoint_trail').on('trail_waypoint').column('trail_id').execute();
      await db.schema.createIndex('idx_trail_waypoint_wp').on('trail_waypoint').column('waypoint_id').execute();
      await db.schema.createIndex('idx_trail_waypoint_trail_pos').on('trail_waypoint').columns(['trail_id','position']).execute();
      await db.schema.createIndex('uq_trail_waypoint_pair').on('trail_waypoint').columns(['trail_id','waypoint_id']).unique().execute();
      await db.schema.createIndex('uq_trail_waypoint_trail_pos').on('trail_waypoint').columns(['trail_id','position']).unique().execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('trail_waypoint').execute();
    }
  },
  '004_collections': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('collection')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('collection_waypoint')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('collection_id', 'integer', (col) => col.notNull().references('collection.id'))
        .addColumn('waypoint_id', 'integer', (col) => col.notNull().references('waypoint.id'))
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
      await db.schema.createIndex('idx_collection_waypoint_collection').on('collection_waypoint').column('collection_id').execute();
      await db.schema.createIndex('idx_collection_waypoint_wp').on('collection_waypoint').column('waypoint_id').execute();

      await db.schema
        .createTable('collection_trail')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('collection_id', 'integer', (col) => col.notNull().references('collection.id'))
        .addColumn('trail_id', 'integer', (col) => col.notNull().references('trail.id'))
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
      await db.schema.createIndex('idx_collection_trail_collection').on('collection_trail').column('collection_id').execute();
      await db.schema.createIndex('idx_collection_trail_trail').on('collection_trail').column('trail_id').execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('collection_trail').execute();
      await db.schema.dropTable('collection_waypoint').execute();
      await db.schema.dropTable('collection').execute();
    }
  },
  '005_auto_waypoint': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('auto_waypoint')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('trail_id', 'integer', (col) => col.notNull().references('trail.id'))
        .addColumn('name', 'text')
        .addColumn('segment_index', 'integer', (col) => col.notNull())
        .addColumn('offset_m', 'real', (col) => col.notNull())
        .addColumn('lat', 'real')
        .addColumn('lon', 'real')
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();
      await db.schema.createIndex('idx_auto_waypoint_trail').on('auto_waypoint').column('trail_id').execute();
      await db.schema.createIndex('idx_auto_waypoint_trail_segment').on('auto_waypoint').columns(['trail_id','segment_index']).execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('auto_waypoint').execute();
    }
  }
};

export function createMigrator(db: Kysely<any>) {
  return new Migrator({ db, provider: { getMigrations: async () => migrations } });
}
