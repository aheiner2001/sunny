import type { Inspection } from '@/types';

/** Keep local-only photos until the matching bytes are present in an acknowledged cloud record. */
export function compactConfirmedInspections(
  inspections: Inspection[],
  confirmed: ReadonlyMap<string, Inspection>,
): Inspection[] {
  return inspections.map(inspection => {
    const cloud = confirmed.get(inspection.id);
    if (!cloud) return inspection;
    const cloudResponses = new Map(cloud.responses?.map(response => [response.questionId, response]));
    return {
      ...inspection,
      signatureBase64: inspection.signatureBase64 && inspection.signatureBase64 === cloud.signatureBase64
        ? undefined : inspection.signatureBase64,
      photoUrls: inspection.photoUrls && JSON.stringify(inspection.photoUrls) === JSON.stringify(cloud.photoUrls)
        ? undefined : inspection.photoUrls,
      responses: inspection.responses.map(response => ({
        ...response,
        photoUrl: response.photoUrl && response.photoUrl === cloudResponses.get(response.questionId)?.photoUrl
          ? undefined : response.photoUrl,
      })),
    };
  });
}
