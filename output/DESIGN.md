# Quaestor 015: agy(Gemini) 잔량 노출

## 전체 프로젝트 아키텍처
Quaestor는 Claude와 Gemini의 토큰 사용량을 감시하고, 한도에 도달하기 전에 시스템을 정지시키는 차단기입니다.
이번 태스크(015)는 선행 태스크(014)에서 구축한 agy(Gemini) 사용량 모니터 데이터를 소비하여, 기계와 사람이 모두 읽을 수 있게 노출하는 작업입니다.
1. **관측(Observation)**: `lib/observation.js`는 `deriveAgy` 순수 함수를 통해 모니터의 스냅샷을 응답용 포맷으로 변환합니다. 또한 `deriveState` 내에서 기존의 `fields` 배열에 Gemini 행을 덧붙여 UI 및 하위 호환성을 만족시킵니다.
2. **제어 루프(Control Loop)**: `watch-loop.js`는 014에서 생성한 `agyMonitor`로부터 매번 스냅샷을 가져와 `ctx.agy`로 주입합니다.
3. **HTTP 서버**: `lib/control-server.js`는 기계(Foreman 등)를 위해 `/api/status`의 최상위에 `agy` 블록을 추가하고, `/api/health`의 계약 버전을 `1.5.0`으로 갱신합니다. 
4. **상태 페이지(UI)**: `lib/status-page.js`는 추가된 `agy` 블록을 소비하여 `/` 상태 페이지에 Gemini 구역을 렌더링합니다.

## 디렉터리 구조
- `watch-loop.js`: 루프마다 모니터 스냅샷을 읽어 제어 상태에 전달
- `lib/observation.js`: 스냅샷 처리(`deriveAgy`) 및 응답 상태(`deriveState`) 생성
- `lib/control-server.js`: HTTP 엔드포인트 응답 조립 및 상태 반환
- `lib/status-page.js`: 루트 경로 HTML 페이지 렌더링 함수

## 기술적 결정 및 근거
1. **순수 함수 `deriveAgy`**: 모듈 간 의존성(특히 `child_process`나 `agy-usage.js`) 없이 스냅샷 객체와 현재 시간만 입력받아 응답용 구조체를 반환하게 설계합니다. 이로써 부수효과 없는 테스트가 가능합니다.
2. **`deriveState` 내부에서 행 추가**: 기존 통합 테스트(`control-server.test.js`)들이 서버 본문의 `fields`와 `deriveState` 출력의 `fields`를 `deepStrictEqual`로 꼼꼼히 비교하고 있습니다. `control-server.js`에서 덧붙일 경우 이 테스트들이 전부 실패하게 되므로, 행 추가 로직은 반드시 `deriveState` 내부에서 처리하여 검증 안전성을 확보합니다.
3. **HTML 요소 내 `agy` 문자열 배제**: 상태 페이지 HTML 클래스/ID 등에 `agy`가 섞여 들어가면 `control-server.test.js:1510` 테스트(HTML 내 `agy` 0회)가 깨집니다. 낡음 상태 표기 시에도 기존 클래스(`st-*`)를 재사용하지 않고 텍스트로만 표시하여 의도치 않은 전역 상태 오염을 피합니다.
4. **`covers` 속성 유지**: `/api/status`의 기존 `usage.covers`와 `allowance.covers`는 `["claude"]`를 유지합니다. 새 값은 독립된 최상위 `agy` 블록에 담아 Foreman의 화이트리스트 검사와 기존 계약(`supervised-v1`)의 호환성을 100% 만족시킵니다.

## 데이터 흐름
1. **스냅샷 수집**: `createAgyMonitor().snapshot()` (014)
2. **주입**: `watch-loop.js`가 스냅샷을 받아 `ctx.agy`로 넘김
3. **가공**: `lib/observation.js` 안에서:
   - `deriveAgy(ctx.agy)` => 최상위 `agy` 블록(기계용)
   - `deriveState(obs, ctx)` => `fields` 끝에 두 줄 덧붙임(사람용)
4. **API 반환**: `control-server.js`가 조립 후 반환
5. **UI 렌더링**: `status-page.js`가 HTML 구역으로 표시

## 상세 설계: Phase 1 (`lib/observation.js`)

**목표**: `deriveAgy` 구현 및 `deriveState`의 `fields` 행 추가

1. **`deriveAgy(snapshot, nowMs)`**:
   - 의존성 없는 순수 함수. `STALE_WARN_MS` 상수 활용.
   - 응답 스키마는 스펙에 명시된 1.5.0 규격(`covers`, `bucket`, `weekly_remaining_pct`, `five_hour_remaining_pct`, `weekly_reset`, `five_hour_reset`, `measured_at`, `age_sec`, `stale`, `last_error`)을 따름.
   - 4가지 진리표 케이스를 정확히 구현: 스냅샷이 없거나 실패만 있으면 전부 `null`, 성공 후 실패 시 과거 성공값 유지, `age_sec` 기반 `stale` 판정.
   - 100% 잔량인 버킷의 리셋 시각은 `null`로 처리.
   
2. **`deriveState(obs, ctx, nowMs)`**:
   - `ctx.agy`를 안전하게 읽고 `deriveAgy`를 호출.
   - 기존의 8줄 뒤에 무조건 2줄(`Gemini 주간 잔량`, `Gemini 5시간 잔량`)을 덧붙임.
   - 값은 문자열이어야 함: 미측정은 `모름`, 낡음은 `45% (낡음)`, 정상은 `45%`.
   - `fields` 외의 속성(`summary`, `state`, `allowance`, `usage` 등)은 `ctx.agy` 유무에 절대 영향을 받지 않도록(독립성) 처리함.

3. **테스트 수정**:
   - `test/observation.test.js:236-244`에서 확인하는 라벨 배열의 맨 끝에 `'Gemini 주간 잔량'`과 `'Gemini 5시간 잔량'`을 순서대로 추가하여, 10개 행 모두가 올바르게 나오는지 검증하도록 업데이트함.

## 상세 설계: Phase 2 (`watch-loop.js` 및 `lib/control-server.js`)

**목표**: 제어 루프에서 스냅샷을 전달하고, HTTP API(`/api/status`, `/api/health`)에 `agy` 블록과 계약 버전 업데이트 적용

1. **`watch-loop.js` 수정**:
   - `controlSnapshot()` 함수가 반환하는 `ctx` 객체에 `agy: agyMonitor.snapshot()`을 덧붙임. 기존 키들은 절대 변경하지 않음.
   - 이 파일 내에 `claude`라는 문자열(변수명, 주석 포함)이 새로 유입되지 않도록 엄격히 통제함.

2. **`lib/control-server.js` 수정**:
   - `/api/status` 응답의 최상위 객체에 `agy` 필드를 추가하고 값으로 `deriveAgy(snap.ctx && snap.ctx.agy, nowMs)`의 결과를 할당함.
   - `usage.covers` 와 `allowance.covers` 값은 계속 `["claude"]` 로 유지하여 기존 하위 호환성을 보장함.
   - 파일 내 `CONTRACTS` 상수의 `supervised-v1` 값을 `1.4.0`에서 `1.5.0`으로 상향하고, 상수 위 주석에 `1.4.0 -> 1.5.0: 최상위 agy 블록 추가 (하위호환)`을 명시함.
   - 테스트(`test/control-server.test.js`)의 단언을 깨뜨리지 않기 위해 파일 내에 문자열 `claude`가 추가되지 않도록 유지함.

3. **테스트 수정 (`test/control-server.test.js`)**:
   - `:231`, `:501`, `:1632`, `:2425` 위치의 최상위 키 집합 검증 배열에 `'agy'` 원소를 추가함.
   - `:169`, `:176` 및 `:210`, `:217` 위치의 테스트 제목과 단언값에서 계약 버전을 `1.4.0`에서 `1.5.0`으로 모두 변경함.

## 상세 설계: Phase 3 (`lib/status-page.js`)

**목표**: 상태 페이지(`GET /`)에 Gemini 잔량 구역 추가 및 문자열 오염 방지

1. **Gemini 구역 렌더링 로직 추가**:
   - `lib/status-page.js` 내에 전달된 페이로드의 `agy` 객체를 소비하여 HTML을 구성합니다.
   - 제목과 라벨은 항상 "Gemini"로 출력하며, HTML 요소의 `class`나 `id` 이름에 부분문자열 `agy`가 1건도 들어가지 않도록 철저히 검열합니다.
   - `last_error` 코드는 "측정 전", "실행 파일 없음", "시간 초과", "실패(종료 코드)", "형식 불일치", "실행 실패" 등 한국어로 풀어 렌더링합니다.
   - 잔량이 없을 경우 "0%"가 아닌 "모름"으로 표기하며, 리셋 시각은 값이 `null`이 아닐 때만 노출합니다.

2. **기존 상태 관리 방식과의 격리**:
   - 기존 claude 영역에 사용된 `st-*` 클래스(상태 전역 클래스)를 Gemini 영역에서 재사용하지 않습니다. 이를 통해 Gemini "모름" 상태가 전체 UI의 색상을 낡음으로 덮어버리지 않게 합니다. 낡음 여부는 오직 Gemini 텍스트에만 "(낡음)" 형식으로 표현합니다.
   - 상태 갱신을 확인하는 `sigOf` 인라인 스크립트에 `agy`를 포함시키지 않아 의도적으로 시그니처 갱신 대상에서 배제(Claude 갱신 시 함께 반영되는 구조 수용)하며 HTML 오염을 막습니다.

3. **테스트 및 불변 속성 보호**:
   - `test/control-server.test.js:1510`에 정의된 부분문자열 `agy` 0회 규칙과 `test/status-page.test.js:230`의 `/claude/gi` 0회 규칙을 정확하게 통과하도록 설계합니다.
   - 루트 `<main>` 요소의 `class`, `style`, `data-sig` 속성은 어떠한 변경도 하지 않습니다.
