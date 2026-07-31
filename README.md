# SUM Playlist Studio

**Sound · Thumbnail · Movie** — 플레이리스트 채널용 썸네일·영상 자동화 데스크톱 앱입니다.

한국 `Light Pop Lounge`와 일본 `Morning Showa Café` 같은 카페 음악 채널을 기준으로 설계했습니다. HotAIMusic의 장점인 로컬 Electron + FFmpeg 구조를 참고하되, 곡 생성 기능은 제외하고 다음 작업에 집중합니다.

- 1280×720 썸네일 자동 조판 및 JPG 일괄 저장
- 한국어·일본어 감성/궁금증형 헤드라인 추천
- 여러 MP3/WAV를 한 편의 플레이리스트 MP4로 자동 연결
- YouTube 챕터·타임라인·SRT 자동 생성
- CapCut에서 바로 불러오기 쉬운 미디어 키트 ZIP 생성
- Windows 한글 경로 대응, 로컬 처리, API 키 불필요

> CapCut의 비공개 내부 프로젝트 파일을 직접 조작하지 않습니다. 대신 오디오, 썸네일, SRT, 타임라인, 설명문을 정리한 안전한 import-ready ZIP을 만듭니다.

## 개발 실행

```powershell
npm install
npm run dev
```

## 빌드

```powershell
npm run build
npm run dist:win
```

## 기본 워크플로

1. 채널·계절·분위기를 선택합니다.
2. 카페 배경 사진을 1~3장 불러옵니다.
3. 추천 문구를 선택하고 썸네일 3종을 JPG로 저장합니다.
4. MP3/WAV 파일을 순서대로 불러옵니다.
5. 완성 썸네일을 선택해 긴 MP4를 렌더링합니다.
6. 필요하면 CapCut Kit ZIP을 만들어 자막과 세부 편집을 이어갑니다.

## 알려진 의존성 경고

곡세트 체크리스트(xlsx) 임포터는 `xlsx@0.18.5`(SheetJS)를 사용합니다. `npm audit`에서 프로토타입 오염(GHSA-4r6h-8v6p-xvw6)·ReDoS(GHSA-5pgg-2g8v-p4x9) 경고가 뜨지만, 이 앱은 사용자 본인이 로컬에서 직접 선택한 파일만 읽으므로(원격/신뢰할 수 없는 입력 없음) 실질적인 공격 표면이 없습니다. 버전은 0.18.5로 고정합니다(그 이후 버전은 npm 레지스트리가 아니라 SheetJS 자체 CDN에만 배포됩니다).

## 라이선스

개인·상업 채널 운영에 사용할 수 있도록 MIT License로 배포합니다. 사용한 이미지·음원·폰트의 권리는 사용자가 직접 확인해야 합니다.
