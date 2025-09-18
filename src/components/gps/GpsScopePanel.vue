<template>
  <component
    :is="componentForScope"
    v-bind="panelProps"
    @update:selected-id="handleUpdate"
    @record-new-trail="emitRecordTrail"
    @toggle-follow="emitToggleFollow"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GpsUiScope } from '@/stores/useGpsUi';
import GpsWaypointPanel from './GpsWaypointPanel.vue';
import GpsTrailPanel from './GpsTrailPanel.vue';
import GpsCollectionPanel from './GpsCollectionPanel.vue';

const emit = defineEmits<{
  (e: 'update:waypointId', id: number | null): void;
  (e: 'update:trailId', id: number | null): void;
  (e: 'update:collectionId', id: number | null): void;
  (e: 'recordNewTrail'): void;
  (e: 'toggleFollow'): void;
}>();

const props = defineProps<{
  scope: GpsUiScope;
  waypoint: {
    selectedId: number | null;
    options: Array<{ id: number; name: string }>;
  };
  trail: {
    selectedId: number | null;
    options: Array<{ id: number; name: string }>;
    followState: {
      active: boolean;
      current: number | string;
      nextName: string | null;
    };
  };
  collection: {
    selectedId: number | null;
    options: Array<{ id: number; name: string }>;
    isEmpty: boolean;
  };
}>();

const componentForScope = computed(() =>
{
  switch (props.scope)
  {
    case 'trail':
      return GpsTrailPanel;
    case 'collection':
      return GpsCollectionPanel;
    case 'waypoint':
    default:
      return GpsWaypointPanel;
  }
});

const panelProps = computed(() =>
{
  if (props.scope === 'trail')
  {
    return {
      selectedId: props.trail.selectedId,
      trails: props.trail.options,
      followState: props.trail.followState,
    };
  }
  if (props.scope === 'collection')
  {
    return {
      selectedId: props.collection.selectedId,
      collections: props.collection.options,
      collectionIsEmpty: props.collection.isEmpty,
    };
  }
  return {
    selectedId: props.waypoint.selectedId,
    waypoints: props.waypoint.options,
  };
});

function handleUpdate(id: number | null)
{
  if (props.scope === 'trail') emit('update:trailId', id);
  else if (props.scope === 'collection') emit('update:collectionId', id);
  else emit('update:waypointId', id);
}

function emitRecordTrail()
{
  emit('recordNewTrail');
}

function emitToggleFollow()
{
  emit('toggleFollow');
}
</script>
