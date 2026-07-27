# SUM Playlist Studio 빠른 시작

## 가장 쉬운 실행

1. GitHub에서 저장소를 다운로드하거나 clone합니다.
2. Node.js LTS를 설치합니다.
3. `WINDOWS_START.cmd`를 더블클릭합니다.
4. Electron 창이 열리면 썸네일 자동생성 탭부터 사용합니다.

## 썸네일 3장 만들기

1. 채널을 `Light Pop Lounge` 또는 `Morning Showa Café`로 선택합니다.
2. 카페 배경 사진을 1~3장 선택합니다.
3. 문장형 또는 10자 안팎 문구를 고릅니다.
4. 저장 폴더를 선택합니다.
5. `서로 다른 3장 자동 생성`을 누릅니다.

## 긴 플레이리스트 영상 만들기

1. 영상·CapCut 자동화 탭으로 이동합니다.
2. MP3 또는 WAV 파일을 한꺼번에 선택합니다.
3. 제목과 순서를 확인합니다.
4. 완성한 썸네일 JPG를 선택합니다.
5. `긴 MP4 자동 만들기`를 누릅니다.

## CapCut에서 세부 편집하기

`CapCut Kit ZIP`에는 다음 파일이 들어갑니다.

- 순서가 붙은 음원 파일
- 완성 썸네일
- 트랙 제목 자막 `track_titles.srt`
- 시작·종료 시간이 있는 `timeline.csv`
- YouTube 설명란용 `youtube_chapters.txt`
- 전체 제작정보 `project_manifest.json`

ZIP을 풀어 CapCut 새 프로젝트에 음원과 썸네일을 불러오고, SRT 자막을 가져오면 됩니다.

## 무설치 EXE 만들기

`WINDOWS_BUILD_EXE.cmd`를 더블클릭하면 `release` 폴더에 portable EXE가 생성됩니다.

GitHub 웹에서는 Actions → Build Windows Portable → Run workflow로도 EXE를 만들 수 있습니다. 완료 후 Artifacts에서 다운로드합니다.
