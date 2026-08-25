# Quaestor: 009-rename-launcher-scripts 설계 문서

## 1. 프로젝트 아키텍처 개요 (Overall project architecture)
Quaestor(구 Bellows)는 Claude의 사용량을 스크레이핑하여 한도에 도달하기 전에 시스템 기동(foundry)을 멈추게 하는 독립적인 감시·차단기입니다.
- **감시 및 추출**: `puppeteer`를 사용해 claude.ai 설정 페이지를 주기적으로 스크레이핑하고 사용량(session/weekly)을 추출합니다.
- **판정 및 제어**: 추출된 사용량을 바탕으로 차단 임계값 도달 여부를 판정(`deriveDesired`)하고, 필요 시 `.prominence/STOP.json` 파일을 생성하여 차단합니다.
- **모니터링 및 상태 제공**: `/api/status`, `/api/health` HTTP 엔드포인트를 통해 시스템의 상태와 가용량을 감독자(Foreman)에게 제공합니다.

## 2. 디렉토리 구조 (Directory structure)
- `run-quaestor.ps1` (구 `run-bellows.ps1`): Quaestor 백그라운드 프로세스를 구동하는 주 실행 런처
- `deploy-quaestor.ps1` (구 `deploy-bellows.ps1`): 배포용 스크립트
- `p-quaestor/`: 핵심 로직이 들어있는 Node.js 패키지
  - `lib/`: 설정, 스크레이핑, 상태 판정, HTTP 제어 서버 등의 모듈
  - `test/`: 단위 및 통합 테스트 코드
  - `watch-loop.js`, `watch-once.js`: 실행 진입점

## 3. 기술적 결정 및 근거 (Technical decisions and rationale)
- **파일 이동 방식**: 런처 파일명 변경 시 기존 파일(`run-bellows.ps1`, `deploy-bellows.ps1`)을 단순 복사/삭제하는 대신 `git mv` 명령을 사용하여 git 이력을 보존합니다.
- **문자열 치환 시 범위 제한**: 스크립트 내부의 변수명(`$env:BELLOWS_*` -> `$env:QUAESTOR_*`) 및 콘솔 출력 문자열(`[bellows]` -> `[quaestor]`)만 변경합니다. 
- **불변 영역 유지 (제약사항)**:
  - `%LOCALAPPDATA%\...\BellowsProfile` 디렉토리명은 유지합니다 (기존 세션 로그인 정보 파기 방지).
  - `.prominence\bellows.log`, `STOP.json` 등의 런타임 파일명 및 생성되는 로그의 형식(`[start] bellows watcher`)은 `logparse.js` 등의 기존 파서가 깨지지 않도록 절대 변경하지 않습니다.
- **오도하는 Setup 메시지 수정**: `-Setup` 시 출력되는 안내 메시지의 프로필 경로를 실제로 사용되는 `%LOCALAPPDATA%\Google\Chrome\BellowsProfile` 경로로 동기화하여 수동 로그인 시 발생하던 사용자 오조작을 방지합니다.

## 4. 데이터 흐름 (Data flow)
1. **시작(Foreman / 사용자)**: Foreman이 `run-quaestor.ps1`을 호출하여 스크립트 실행.
2. **초기화 및 검증**: 런처 스크립트에서 `%LOCALAPPDATA%\Google\Chrome\BellowsProfile` 등 경로 세팅 및 구동.
3. **루프 진입 (`watch-loop.js`)**: 스크립트는 Node.js 프로세스를 호출하고 감시 루프 실행.

## 5. 상세 설계: Phase 1 (Detailed design for Phase 1)
### 파일명 변경 및 스크립트 내부 텍스트 갱신
- **실행 명령**:
  - `git mv run-bellows.ps1 run-quaestor.ps1`
  - `git mv deploy-bellows.ps1 deploy-quaestor.ps1`
- **`run-quaestor.ps1` 내부 변경**:
  - 파일 참조: 자기 자신이나 배포 스크립트를 참조하는 문자열을 `-quaestor.ps1`로 수정
  - 환경변수: `$env:BELLOWS_INTERVAL_MIN` → `$env:QUAESTOR_INTERVAL_MIN` (006 작업에서 추가된 fallback 구조이므로 바로 변경 가능)
  - 콘솔 접두어: `Write-Host` 등으로 출력되는 `[bellows-chrome]` 등의 접두어에서 `bellows`를 `quaestor`로 수정. (단, 파일 실행 인자로 전달되는 `watch-loop` 등의 로그 포맷에 영향을 주지 않도록 유의)
  - `-Setup` 안내문: `--user-data-dir="C:\BellowsChrome"`를 출력하는 부분을 찾아 실제 기본값(`$env:LOCALAPPDATA\Google\Chrome\BellowsProfile`)으로 변경.
- **`deploy-quaestor.ps1` 내부 변경**:
  - 위와 동일한 원칙으로 파일 참조, 콘솔 출력 등에서 옛 이름 `bellows`를 `quaestor`로 수정.
