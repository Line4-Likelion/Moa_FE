import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { getClassifications } from './api';
import type { Screenshot } from '../mock/screenshots';

export async function loadUnsortedScreenshots(): Promise<Screenshot[]> {
  if (Platform.OS === 'web') throw new Error('스크린샷 불러오기는 모바일 앱에서 사용할 수 있어요.');
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!permission.granted) throw new Error('사진 접근 권한이 필요해요. 기기 설정에서 허용해 주세요.');

  const records = await getClassifications();
  const sorted = new Set(records.map((record) => record.fileKey));
  const albums = Platform.OS === 'android' ? await MediaLibrary.getAlbumsAsync() : [];
  const album = albums.find((item) => /^(screenshots?|스크린샷|화면 캡처|screen captures?)$/i.test(item.title));
  if (Platform.OS === 'android' && !album) return [];

  const screenshots: Screenshot[] = [];
  let after: string | undefined;
  do {
    const page = await MediaLibrary.getAssetsAsync({
      first: 100, after, mediaType: 'photo', sortBy: ['creationTime'],
      ...(Platform.OS === 'ios' ? { mediaSubtypes: ['screenshot' as const] } : { album }),
    });
    for (const asset of page.assets) {
      if (!sorted.has(asset.id)) screenshots.push({ id: asset.id, uri: asset.uri, capturedAt: new Date(asset.creationTime).toLocaleDateString() });
    }
    after = page.hasNextPage ? page.endCursor : undefined;
  } while (after);
  return screenshots;
}
