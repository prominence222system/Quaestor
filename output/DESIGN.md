# Quaestor 설계 문서 (011-health-contracts-field)

## Overall Project Architecture
Quaestor는 Claude 사용량을 주기적으로 스크랩(관측)하여 한도 초과 시 시스템 시작을 차단하는 도구입니다. 백그라운드 프로세스로 동작하며 내부적으로 HTTP 컨트롤 서버를 노출합니다. 클라이언트(Foreman 등)는 이 서버의 상태 API(`/api/status`)와 헬스 체크 API(`/api/health`)를 통해 감시자의 상태와 사용량을 파악합니다. 이번 라운드(011)에서는 Agora 버전 관측기와의 연동을 위해 `/api/health` 엔드포인트에 `contracts` 버전을 선언적으로 노출합니다.

## Directory Structure
- `p-quaestor/lib/control-server.js`: 컨트롤 서버 로직 및 라우트 핸들러 (`/api/health` 포함)
- `p-quaestor/test/control-server.test.js`: 컨트롤 서버 라우트 단위 및 통합 테스트

## Technical Decisions and Rationale
- **계약 버전 상수화**: `contracts` 맵(`{ "supervised-v1": "1.2.0" }`)은 파일 외부에서 동적으로 읽지 않고 `control-server.js` 내부에 상수로 선언합니다. 외부 볼트 문서를 동적으로 읽을 경우 시스템이 스스로를 근거로 검증하는 순환 논리에 빠질 위험이 있기 때문입니다.
- **유지보수 주석 명시**: 상수 선언부 바로 위에 "이 값을 바꾸는 시점 = Agora 등록 문서의 `version` 을 바꾸는 시점"임을 주석으로 강제하여, 향후 버전 변경 시 누락을 방지합니다.
- **기존 필드 보존**: 기존의 소프트웨어 버전(`version: "0.1.0"`)과 새로운 계약 버전(`contracts`) 축을 분리 유지합니다. 하위 호환성을 위해 `ok`, `id`, `startedAt` 등 기존 필드는 일절 수정하지 않습니다.

## Data Flow
1. 클라이언트(Agora 버전 관측기 등)가 `GET /api/health` 요청
2. `control-server.js`의 라우트 핸들러가 동작
3. 하드코딩된 `contracts` 상수를 포함하여 JSON 페이로드를 조립
4. 클라이언트에게 `200 OK`와 함께 응답 반환

## Implementation Phases
- **Phase 1**: `lib/control-server.js` 에 계약 버전 상수를 선언하고 `/api/health` 응답에 `contracts` 추가. 관련 통합 테스트를 실포트 기반으로 `test/control-server.test.js` 에 구현.
