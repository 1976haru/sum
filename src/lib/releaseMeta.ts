export interface ReleaseMetadataInput {
  releaseTitle: string;
  artistName: string;
  coverHeadline: string;
  generatedAt?: string;
}

// 커버에 인쇄된 문구와 DistroKid 등록 메타데이터가 어긋나 반려되는 것을 막기 위한 동봉 파일.
// coverHeadline은 App 레벨에서 이미 releaseTitle 파생값(또는 명시적 분리 편집값)이므로,
// 이 함수는 그 결과만 그대로 받아 적을 뿐 별도 판단을 하지 않는다.
export function buildReleaseMetadataText(input: ReleaseMetadataInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  return [
    `Release Title: ${input.releaseTitle}`,
    `Artist Name: ${input.artistName}`,
    `Cover Text (as printed): ${input.coverHeadline}`,
    'Cover Size: 3000x3000',
    `Generated: ${generatedAt}`,
    '⚠ 위 Release Title / Artist Name을 DistroKid 등록 화면에 그대로 입력하세요.'
  ].join('\n');
}
