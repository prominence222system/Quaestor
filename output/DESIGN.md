# Quaestor (Bellows) - 005 기동 시 관측 이력 복원 설계

## 1. Overall Project Architecture
Quaestor(코드명 Bellows)는 Claude의 사용량을 감시하고 한도에 도달하기 전에 시스템을 정지시키는 독립적인 파수꾼 프로세스입니다. 
- claude.ai 설정 페이지를 주기적으로 스크레이핑하여 사용량(session_pct, weekly_pct)을 수집합니다.
- 수집된 정보를 바탕으로 `deriveDesired()` 로직을 통해 차단 여부를 결정하고, `.prominence\STOP.json` 파일을 작성하여 foundry의 새 작업 착수를 막습니다.
- `control-server`를 통해 관측 상태(state)를 노출하며, 이는 Foreman 시스템과의 감독 계약에 사용됩니다.

이번 005 작업은 기존 구조(관측, 판정, 노출, 차단)를 전혀 변경하지 않고, 프로세스 재기동 시 이전 로그 파일(`bellows.log`)의 끝부분을 읽어 **관측 이력을 복원**하는 '읽기 전용 배선'만 순수하게 추가합니다.

## 2. Directory Structure
```
p-bellows/
  ├─ lib/
  │  ├─ config.js        (설정 관리)
  │  ├─ scrape.js        (사용량 스크레이핑)
  │  ├─ extract.js       (수치 추출)
  │  ├─ observation.js   (관측 상태 판정 - `deriveState`, 불변)
  │  ├─ control-server.js(상태 노출 HTTP 서버)
  │  └─ logparse.js      (★ 신규: 로그 텍스트 파서 - 순수 함수)
  ├─ test/
  │  ├─ logparse.test.js (★ 신규: 파서 단위 테스트)
  │  └─ run-all.js       (통합 테스트 러너)
  └─ watch-loop.js       (★ 변경: 루프 시작 전 1회 복원 배선 추가)
```

## 3. Technical Decisions and Rationale
1. **순수 함수 기반 파싱 (`parseLogTail`)**
   - **이유:** I/O, 시간, 파일 경로에 의존하지 않는 순수 함수로 구현하여 테스트를 매우 쉽게 만들고, 외부 요인에 의한 부작용을 원천 차단합니다.
2. **로그 파일 부분 읽기 (최대 64KB)**
   - **이유:** 로그 파일이 무한히 커질 수 있으므로 전체를 읽지 않습니다. 마지막 64KB만 읽고 맨 처음 잘린 줄은 안전하게 버립니다.
3. **Never-brick 설계**
   - **이유:** 로그를 읽다 죽으면 안전장치가 마비됩니다. 파일이 없거나, 파싱 중 예외가 발생하더라도 빈 관측 상태(`createObservation()`)로 조용히 폴백합니다.
4. **기존 로직 불변성 유지**
   - **이유:** `deriveState` 등 핵심 판정 로직은 이미 검증되었습니다. 005 작업은 오직 상태 복원(입력값 주입) 역할만 수행하여 회귀를 막습니다.

## 4. Data Flow
1. **기동:** `watch-loop.js` 루프 직전, `.prominence/bellows.log` 끝부분 64KB를 읽습니다.
2. **파싱:** 읽어들인 문자열을 줄(line) 단위로 쪼개고, 첫 줄은 버린 뒤 `parseLogTail(lines)`로 전달합니다.
3. **상태 복원:** `parseLogTail`은 과거 로그에서 추출된 `lastSuccessAt`, `lastUsage`, `consecutiveFailures`, `lastFailure` 객체를 반환합니다.
4. **적용 및 폴링:** 추출된 상태로 메모리상의 `observation`을 덮어쓰고 무한 폴링 루프를 시작합니다.
5. **노출:** 노출 API는 복원된 상태를 통해 즉각 올바른 `state`(`crit` 등)를 클라이언트(Foreman)에 반환합니다.

## 5. Implementation Phases
- Phase 1: `lib/logparse.js` 순수 파서 및 단위 테스트 (신/구 형식 지원, 성공 이후 실패 카운트)
- Phase 2: `watch-loop.js` 기동 복원 배선, 64KB 꼬리 읽기, never-brick 폴백 및 경계 검증

### Detailed Design: Phase 1
Phase 1에서는 I/O 로직 없이 문자열 배열을 처리하여 이력을 복원하는 순수 함수 `parseLogTail(lines)`를 구현합니다.

**입력:** `lines` (로그 텍스트 줄 배열)
**출력:** 성공 시 관측 객체( `{ lastSuccessAt, lastUsage, consecutiveFailures, lastFailure }` ), 정보가 아예 없으면 `null`.

**로직:**
1. 순차적으로 줄을 읽으며 성공/실패 패턴을 정규식으로 찾습니다.
2. 성공 줄 발견 시 `lastSuccessAt` 및 `lastUsage`를 갱신하고, `consecutiveFailures` 카운트를 `0`으로 초기화합니다.
3. 실패 줄 발견 시 `consecutiveFailures`를 `+1`하고 `lastFailure` 정보를 갱신합니다. 옛 버전 로그라 `kind`가 없다면 `'unknown'`으로 채웁니다.
4. 알 수 없는 형식의 줄은 오류 발생 없이 무시합니다.
5. `Date.now()` 등 현재 시각이나 외부 I/O를 절대 호출하지 않습니다.
