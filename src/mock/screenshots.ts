/** 스크린샷 한 장. uri가 비어 있으면 회색 자리표시자로 보여요. (갤러리 연동 시 uri만 채우면 됨) */
export type Screenshot = { id: string; capturedAt: string; uri?: string };

/** 한 번에 분류하는 장수 */
export const BATCH_SIZE = 10;

/** 아직 분류하지 않은 스크린샷 (목업). 실제로는 기기 갤러리에서 최신순으로 불러와요. */
export const UNSORTED_SCREENSHOTS: Screenshot[] = Array.from({ length: 12 }, (_, i) => ({
  id: `shot-${i + 1}`,
  capturedAt: `11월 ${13 - Math.floor(i / 3)}일`,
}));
