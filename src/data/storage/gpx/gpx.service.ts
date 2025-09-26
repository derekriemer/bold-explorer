import { Filesystem, Directory } from '@capacitor/filesystem';

export async function exportTrailToGpx(trailId: number, opts?: { includeAuto?: boolean }) {
  void opts;
  const data = `<gpx><trail id="${trailId}"/></gpx>`;
  const fileName = `trail-${trailId}.gpx`;
  await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
  return { path: fileName };
}

export async function exportCollectionToGpx(
  collectionId: number,
  opts?: { includeAuto?: boolean }
) {
  void opts;
  const data = `<gpx><collection id="${collectionId}"/></gpx>`;
  const fileName = `collection-${collectionId}.gpx`;
  await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
  return { path: fileName };
}

export async function importGpx(
  fileUri: string
): Promise<{ createdWaypoints: number[]; createdTrails: number[] }> {
  void fileUri;
  // Placeholder stub
  return { createdWaypoints: [], createdTrails: [] };
}
