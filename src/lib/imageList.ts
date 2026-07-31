import type { BackgroundImage } from '../types';

// 업로드 경로(dialog 실제 파일 경로)와 드롭 경로(drop://합성 키)가 같은 배열에 섞여도
// path 기준 중복만 제거하고 순서(먼저 온 항목 우선)를 유지한다.
export function dedupeImages(images: BackgroundImage[]): BackgroundImage[] {
  const seen = new Set<string>();
  const result: BackgroundImage[] = [];
  for (const image of images) {
    if (seen.has(image.path)) continue;
    seen.add(image.path);
    result.push(image);
  }
  return result;
}
