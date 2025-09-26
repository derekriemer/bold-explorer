<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/gps" />
        </ion-buttons>
        <ion-title>Debug</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Watch Options</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list inset>
              <ion-item>
                <ion-label>Provider</ion-label>
                <ion-segment v-model=" providerKind " @ionChange=" onProviderChange ">
                  <ion-segment-button value="geolocation">
                    <ion-label>GPS</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="mock">
                    <ion-label>Mock</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="replay">
                    <ion-label>Replay</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="background">
                    <ion-label>Background</ion-label>
                  </ion-segment-button>
                </ion-segment>
              </ion-item>
              <ion-item>
                <ion-label>Enable High Accuracy</ion-label>
                <ion-toggle v-model=" optEnableHighAccuracy " />
              </ion-item>
              <ion-item>
                <ion-label>Maximum Age (ms)</ion-label>
                <ion-input type="number" inputmode="numeric" v-model.number=" optMaximumAge " placeholder="0" />
              </ion-item>
              <ion-item>
                <ion-label>Timeout (ms)</ion-label>
                <ion-input type="number" inputmode="numeric" v-model.number=" optTimeout " placeholder="30000" />
              </ion-item>
              <ion-item>
                <ion-label>Target Accuracy (m)</ion-label>
                <ion-input type="number" inputmode="numeric" v-model.number=" minAccuracyM " placeholder="10" />
              </ion-item>
              <ion-item>
                <ion-label>Settle Window (ms)</ion-label>
                <ion-input type="number" inputmode="numeric" v-model.number=" settleMs " placeholder="15000" />
              </ion-item>
            </ion-list>

            <div class="actions">
              <ion-button color="primary" :disabled=" !dirty " @click=" restartWatch ">
                Restart Watch
              </ion-button>
              <ion-button color="medium" fill="outline" @click=" stopWatch " :disabled=" !watching ">Stop</ion-button>
              <ion-button fill="clear" size="small" @click=" applyDefaults ">Reset Defaults</ion-button>
              <span class="hint" v-if="dirty">Unsaved changes</span>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Live Telemetry</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="telemetry">
              <div class="telemetry-item">
                <div class="label">GPS</div>
                <div class="value">{{ gps ? `${ gps.lat.toFixed(5) }, ${ gps.lon.toFixed(5) }` : '—' }}</div>
              </div>
              <div class="telemetry-item">
                <div class="label">Accuracy</div>
                <div class="value">{{ curAccText }}</div>
              </div>
              <div class="telemetry-item">
                <div class="label">Provider</div>
                <div class="value">{{ providerDisplay }}</div>
              </div>
              <div class="telemetry-item" v-if="!isWeb">
                <div class="label">Compass (Magnetic)</div>
                <div class="value">{{ headingMag != null ? `${ headingMag.toFixed(0) }°` : '—' }}</div>
              </div>
              <div class="telemetry-item" v-if="!isWeb">
                <div class="label">Compass (True)</div>
                <div class="value">{{ headingTrue != null ? `${ headingTrue.toFixed(0) }°` : '—' }}</div>
              </div>
              <div class="telemetry-item" v-if="!isWeb">
                <div class="label">Declination</div>
                <div class="value">{{ declinationText }}</div>
              </div>
            </div>
            <p class="provider-status" v-if="providerStatusText">{{ providerStatusText }}</p>
            <div class="controls">
              <ion-button @click=" recenter ">Recenter/Calibrate</ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Data Diagnostics</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-button fill="outline" size="small" @click=" runDiagnostics ">Run Diagnostics</ion-button>
            <div class="debug-grid" v-if="diag">
              <div><span class="k">Repos installed:</span> <span class="v">{{ diag?.repos ?? '—' }}</span></div>
              <div><span class="k">Query OK:</span> <span class="v">{{ diag?.queryOk ?? '—' }}</span></div>
              <div><span class="k">Create OK:</span> <span class="v">{{ diag?.createOk ?? '—' }}</span></div>
              <div><span class="k">Delete OK:</span> <span class="v">{{ diag?.deleteOk ?? '—' }}</span></div>
              <div v-if="diag?.error"><span class="k">Error:</span> <span class="v err">{{ diag?.error }}</span></div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Settle Filters</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="settle-grid">
              <div><span class="k">Watching:</span> <span class="v">{{ watching }}</span></div>
              <div><span class="k">Target ≤:</span> <span class="v">{{ minAccuracyM }} m ({{
                (minAccuracyM * 3.28084).toFixed(0) }} ft)</span></div>
              <div><span class="k">Current acc:</span> <span class="v">{{ curAccText }}</span></div>
              <div><span class="k">Best acc:</span> <span class="v">{{ bestAccText }}</span></div>
              <div><span class="k">Fixes seen:</span> <span class="v">{{ fixCount }}</span></div>
              <div><span class="k">Best updates:</span> <span class="v">{{ bestCount }}</span></div>
              <div><span class="k">Countdown:</span> <span class="v">{{ countdownText }}</span></div>
              <div><span class="k">Reason:</span> <span class="v">{{ settleReason }}</span></div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
    <ion-alert
      :is-open=" permissionAlert.isOpen "
      :header=" permissionAlert.header "
      :message=" permissionAlert.message "
      :buttons=" permissionAlertButtons "
      @didDismiss=" permissionAlert.dismiss "
    />
  </ion-page>

</template>
<script setup lang="ts">
import
{
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonInput, IonToggle, IonSegment, IonSegmentButton, IonAlert
} from '@ionic/vue';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useWaypoints } from '@/stores/useWaypoints';
import { locationStream, providerRegistry, type LocationStreamMetaEvent } from '@/data/streams/location';
import { useActions } from '@/composables/useActions';
import { Heading } from '@/plugins/heading';
import { toLatLng, type ProviderKind } from '@/types';
import { usePermissionAlert } from '@/composables/usePermissionAlert';

type Fix = {
  lat: number;
  lon: number;
  accuracy?: number;
  altitude?: number | null;
  ts?: number;
  provider?: ProviderKind | null;
};
const gps = ref<Fix | null>(null);
const best = ref<Fix | null>(null);
const watching = ref<boolean>(false);
const actions = useActions();
const wps = useWaypoints();
const isWeb = Capacitor.getPlatform() === 'web';
const permissionAlert = usePermissionAlert();
const permissionAlertButtons = [
  {
    text: 'Not now',
    role: 'cancel',
    handler: () => { permissionAlert.dismiss(); }
  },
  {
    text: 'Open Settings',
    handler: () => permissionAlert.openSettings()
  }
] as const;

const DEFAULTS = {
  minAccuracyM: 10,
  settleMs: 15000,
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30000
} as const;

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  geolocation: 'Geolocation (GPS)',
  mock: 'Mock (Dev)',
  replay: 'Replay (Trail)',
  background: 'Background (Native)'
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const formatProvider = (kind?: ProviderKind | null): string =>
  kind ? (PROVIDER_LABELS[kind] ?? kind) : '';

const formatTimestamp = (value: number): string => timeFormatter.format(new Date(value));

async function recenter ()
{
  try
  {
    const sample = await locationStream.getCurrentSnapshot({ timeoutMs: 5000 });
    if (!sample)
    {
      permissionAlert.show({
        header: 'Location Unavailable',
        message: 'Unable to retrieve a GPS fix. Ensure location access is enabled and try again.'
      });
      return;
    }
    gps.value = {
      lat: sample.lat,
      lon: sample.lon,
      accuracy: sample.accuracy,
      altitude: sample.altitude ?? null,
      ts: sample.timestamp,
      provider: sample.provider
    };
  } catch (e)
  {
    console.warn('[Debug] recenter failed', e);
    if ((e as any)?.code === 1)
    {
      permissionAlert.show({
        header: 'Location Permission Required',
        message: 'Location access appears to be disabled. Open settings to unlock live updates.'
      });
    }
  }
}

// Compass plugin state
const headingMag = ref<number | null>(null);
const headingTrue = ref<number | null>(null);
let removeHeadingListener: (() => void) | null = null;

// Magnetic declination (true - magnetic), normalized to [-180, 180]
const declinationDeg = computed(() =>
{
  if (headingMag.value == null || headingTrue.value == null) return null;
  let d = headingTrue.value - headingMag.value;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
});
const declinationText = computed(() => declinationDeg.value != null ? `${ declinationDeg.value.toFixed(1) }°` : '—');

const diag = ref<{ repos?: boolean; queryOk?: boolean; createOk?: boolean; deleteOk?: boolean; count?: number; error?: string } | null>(null);

// Tunable options state
const minAccuracyM = ref<number>(DEFAULTS.minAccuracyM);
const settleMs = ref<number>(DEFAULTS.settleMs);
const optEnableHighAccuracy = ref<boolean>(DEFAULTS.enableHighAccuracy);
const optMaximumAge = ref<number>(DEFAULTS.maximumAge);
const optTimeout = ref<number>(DEFAULTS.timeout);
const providerKind = ref<ProviderKind>(providerRegistry.getActiveKind());

type Applied = { minAccuracyM: number; settleMs: number; options: { enableHighAccuracy: boolean; maximumAge: number; timeout: number } };
const lastApplied = ref<Applied | null>(null);
const lastStartAt = ref<number | null>(null);
const dirty = computed(() =>
{
  const applied = lastApplied.value;
  if (!applied) return true;
  return (
    applied.minAccuracyM !== minAccuracyM.value ||
    applied.settleMs !== settleMs.value ||
    applied.options.enableHighAccuracy !== optEnableHighAccuracy.value ||
    applied.options.maximumAge !== optMaximumAge.value ||
    applied.options.timeout !== optTimeout.value
  );
});

const lastProviderMeta = ref<LocationStreamMetaEvent | null>(null);

const providerDisplay = computed(() =>
{
  const provider = gps.value?.provider ?? providerKind.value ?? null;
  const label = formatProvider(provider);
  return label || '—';
});

const providerStatusText = computed(() =>
{
  const meta = lastProviderMeta.value;
  if (!meta) return '';
  const providerLabel = formatProvider(meta.provider) || meta.provider;
  if (!providerLabel) return '';
  if (meta.previous && meta.previous !== meta.provider)
  {
    const previousLabel = formatProvider(meta.previous) || meta.previous;
    return `Provider switched to ${ providerLabel } (was ${ previousLabel }) at ${ formatTimestamp(meta.at) }`;
  }
  return `Provider active: ${ providerLabel } at ${ formatTimestamp(meta.at) }`;
});

// Fix counters and settle reasoning
const fixCount = ref(0);
const bestCount = ref(0);
let lastCurrentTs: number | null = null;
let lastBestTs: number | null = null;

watch(gps, (g) =>
{
  if (!g) return;
  if (g.ts != null && g.ts !== lastCurrentTs)
  {
    fixCount.value += 1;
    lastCurrentTs = g.ts ?? Date.now();
  }
  // Track best by smallest accuracy
  if (g?.accuracy != null)
  {
    if (!best.value || best.value.accuracy == null || g.accuracy < best.value.accuracy)
    {
      best.value = { ...g };
      if (best.value.ts != null && best.value.ts !== lastBestTs)
      {
        bestCount.value += 1;
        lastBestTs = best.value.ts ?? Date.now();
      }
    }
  }
});

function getApplied (): Applied
{
  return {
    minAccuracyM: minAccuracyM.value,
    settleMs: settleMs.value,
    options: {
      enableHighAccuracy: optEnableHighAccuracy.value,
      maximumAge: optMaximumAge.value,
      timeout: optTimeout.value
    }
  };
}

async function restartWatch ()
{
  await stopWatch();
  const cfg = getApplied();
  // Configure provider + stream filters
  locationStream.configureProvider({ maximumAgeMs: cfg.options.maximumAge, timeoutMs: cfg.options.timeout });
  locationStream.configureWatch({
    minAccuracyM: cfg.minAccuracyM,
    minIntervalMs: 1000,
    distanceMinM: 0,
    settleMs: cfg.settleMs
  });
  const ok = await ensurePermissions();
  if (ok)
  {
    await locationStream.start();
    watching.value = true;
    if (!sub) sub = locationStream.updates.subscribe((s) =>
    {
      gps.value = {
        lat: s.lat,
        lon: s.lon,
        accuracy: s.accuracy,
        altitude: s.altitude ?? null,
        ts: s.timestamp,
        provider: s.provider
      };
    });
  }
  lastApplied.value = cfg;
  lastStartAt.value = Date.now();
  fixCount.value = 0;
  bestCount.value = 0;
}

async function stopWatch ()
{
  try { sub?.unsubscribe(); } catch { }
  sub = null;
  await locationStream.stop();
  watching.value = false;
}

function onProviderChange ()
{
  providerRegistry.switchTo(providerKind.value);
}

function applyDefaults ()
{
  minAccuracyM.value = DEFAULTS.minAccuracyM;
  settleMs.value = DEFAULTS.settleMs;
  optEnableHighAccuracy.value = DEFAULTS.enableHighAccuracy;
  optMaximumAge.value = DEFAULTS.maximumAge;
  optTimeout.value = DEFAULTS.timeout;
}

const formatAccuracyBase = (value?: number | null): string | null =>
{
  if (value == null) return null;
  const feet = m2ft(value);
  const feetText = feet != null ? `${ feet.toFixed(0) } ft` : '';
  return feetText ? `${ value.toFixed(0) } m (${ feetText })` : `${ value.toFixed(0) } m`;
};

const formatAccuracyWithProvider = (value?: number | null, provider?: ProviderKind | null): string =>
{
  const base = formatAccuracyBase(value);
  if (!base) return '—';
  const providerLabel = formatProvider(provider ?? null);
  return providerLabel ? `${ base } via ${ providerLabel }` : base;
};

const curAccText = computed(() =>
{
  return formatAccuracyWithProvider(gps.value?.accuracy, gps.value?.provider ?? providerKind.value);
});
const bestAccText = computed(() =>
{
  return formatAccuracyBase(best.value?.accuracy) ?? '—';
});

const reachedTarget = computed(() =>
{
  const a = gps.value?.accuracy;
  return a != null && a <= minAccuracyM.value;
});

const countdownText = computed(() =>
{
  if (!lastStartAt.value) return '—';
  const remain = Math.max(0, (lastStartAt.value + settleMs.value) - Date.now());
  const s = Math.ceil(remain / 100) / 10; // tenths
  return `${ s.toFixed(1) }s`;
});

const settleReason = computed(() =>
{
  if (reachedTarget.value) return 'target achieved';
  if (!lastStartAt.value) return '—';
  const expired = Date.now() >= (lastStartAt.value + settleMs.value);
  if (expired)
  {
    const isBest = gps.value?.ts != null && best.value?.ts != null && gps.value.ts === best.value.ts;
    return isBest ? 'deadline best' : 'deadline pending';
  }
  return 'settling';
});

async function runDiagnostics ()
{
  const out: any = {};
  try
  {
    out.repos = !!wps?.$repos?.waypoints && typeof wps.$repos.waypoints.all === 'function';
    if (!out.repos) throw new Error('Pinia repos not installed');
    const list = await wps.$repos.waypoints.all();
    out.count = list.length;
    out.queryOk = true;
  } catch (e: any)
  {
    out.error = `Query failed: ${ e?.message ?? String(e) }`;
    diag.value = out;
    actions.show(out.error, { kind: 'error', placement: 'banner-top', durationMs: null });
    return;
  }
  // Try create/delete a temp waypoint to test write path
  let tempId: number | null = null;
  try
  {
    tempId = await wps.$repos.waypoints.create({
      name: `diag-${ Date.now() }`,
      latLng: toLatLng(0, 0),
      elev_m: null
    });
    out.createOk = Number.isFinite(tempId);
  } catch (e: any)
  {
    out.error = `Create failed: ${ e?.message ?? String(e) }`;
    diag.value = out;
    actions.show(out.error, { kind: 'error', placement: 'banner-top', durationMs: null });
    return;
  }
  try
  {
    if (tempId != null) await wps.$repos.waypoints.remove(tempId);
    out.deleteOk = true;
  } catch (e: any)
  {
    out.error = `Delete failed: ${ e?.message ?? String(e) }`;
  }
  diag.value = out;
  actions.show('Diagnostics completed', { kind: out.error ? 'warning' : 'success' });
}

onMounted(async () =>
{
  metaSub = locationStream.meta$.subscribe((meta) =>
  {
    lastProviderMeta.value = meta;
    if (providerKind.value !== meta.provider)
    {
      providerKind.value = meta.provider;
    }
    if (meta.previous && meta.previous !== meta.provider)
    {
      console.info('[DebugPage] provider changed', meta);
    } else
    {
      console.debug('[DebugPage] provider meta', meta);
    }
  });

  // Start watch immediately with current UI config
  try
  {
    const ok = await ensurePermissions();
    if (ok)
    {
      await restartWatch();
    }
  } catch (e) { console.warn('[DebugPage] ensurePermissions/restartWatch failed', e); }
  if (!isWeb)
  {
    try
    {
      const sub = await Heading.addListener('heading', (evt) =>
      {
        const mag = typeof (evt as any)?.magnetic === 'number' ? (evt as any).magnetic : null;
        const tru = typeof (evt as any)?.true === 'number' ? (evt as any).true : null;
        headingMag.value = mag;
        headingTrue.value = tru;
      });
      await Heading.start({ useTrueNorth: true });
      removeHeadingListener = () => { sub.remove(); void Heading.stop(); };
    } catch (e)
    {
      console.error('[Heading] init error', e);
    }
  }
});

onBeforeUnmount(() =>
{
  try { removeHeadingListener?.(); } catch (e) { console.warn('[DebugPage] removeHeadingListener failed', e); }
  removeHeadingListener = null;
  try { metaSub?.unsubscribe(); } catch { }
  metaSub = null;
  try { sub?.unsubscribe(); } catch { }
  sub = null;
});

// --- Shared helpers
async function ensurePermissions (): Promise<boolean>
{
  const ok = await locationStream.ensureProviderPermissions();
  if (!ok)
  {
    permissionAlert.show({
      header: 'Location Permission Required',
      message: 'Open settings to enable location access so background tracking can start.'
    });
  }
  return ok;
}

const m2ft = (m?: number) => (m == null ? undefined : m * 3.28084);

import type { Subscription } from 'rxjs';
let sub: Subscription | null = null;
let metaSub: Subscription | null = null;
</script>
<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.telemetry-item .label {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.telemetry-item .value {
  font-size: 1.2rem;
  font-weight: 600;
}

.provider-status {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.controls {
  margin-top: 12px;
}

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  margin-top: 12px;
}

.debug-grid .k {
  color: var(--ion-color-medium);
  margin-right: 6px;
}

.debug-grid .v.err {
  color: var(--ion-color-danger);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.actions .hint {
  color: var(--ion-color-warning);
  font-size: 0.9rem;
}

.settle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}
</style>
