import { Filesystem, Directory } from '@capacitor/filesystem';

export async function exportTrailToGpx(trailId: number, _opts?: { includeAuto?: boolean }) {
  const data = `<gpx><trail id="${trailId}"/></gpx>`;
  const fileName = `trail-${trailId}.gpx`;
  await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
  return { path: fileName };
}

export async function exportCollectionToGpx(collectionId: number, _opts?: { includeAuto?: boolean }) {
  const data = `<gpx><collection id="${collectionId}"/></gpx>`;
  const fileName = `collection-${collectionId}.gpx`;
  await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
  return { path: fileName };
}

export async function importGpx(_fileUri: string): Promise<{ createdWaypoints: number[]; createdTrails: number[] }> {
  // Placeholder stub
  return { createdWaypoints: [], createdTrails: [] };
}
