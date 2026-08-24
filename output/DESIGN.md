# Quaestor 설계 문서 (007-usage-allowance-api)

## 전체 프로젝트 아키텍처
Quaestor는 Claude 사용량을 주기적으로 스크레이핑하여 한도에 도달하기 전에 시스템 사용을 차단하는 감시자(Observer) 및 차단기(Breaker) 역할을 합니다.
현재 시스템은 Foreman 계약에 따른 상태(status) 정보를 `/api/status`를 통해 제공하고 있으나, 기존 응답의 `fields`는 화면 표시(Presentation) 목적에 맞춰져 있어 기계적인 사용량(usage) 파악과 토큰 사용 허가(allowance) 여부를 결정하기 어렵습니다. 
따라서 본 설계는 기존 아키텍처를 유지하면서, 외부 소비자가 기계적으로 읽고 판단할 수 있는 순수 데이터(`usage`, `allowance`)를 API 응답에 추가합니다.

## 디렉터리 구조 (관련된 부분)
- `p-quaestor/lib/observation.js`: 상태 판정 및 사용량/허용량 데이터 가공 함수 (`deriveUsage`, `deriveAllowance` 추가 예정)
- `p-quaestor/lib/control-server.js`: `/api/status` API 엔드포인트 핸들러
- `p-quaestor/test/`: 단위 테스트 및 통합 테스트 (변경 및 추가)

## 기술적 결정 및 근거
- **하위 호환성 유지**: 기존의 `fields`, `summary`, `state` 응답 속성은 전혀 변경하지 않습니다. 기존 소비자(Foreman)의 동작을 보장하기 위함입니다.
- **수치형 데이터 제공**: 퍼센트 값들은 문자열(예: `"24%"`)이 아닌 순수 숫자(number)로 제공합니다. 이를 통해 기계적 파싱의 오류를 막습니다.
- **`null`을 통한 상태 표현**: 관측 이력이 없거나 알 수 없는 경우 `0`이나 `false`/`true`를 반환하지 않고 `null`을 반환합니다. 무지를 특정 상태로 승격시키지 않고 클라이언트가 자체적인 정책을 적용할 수 있도록 합니다.
- **상태 재판정 금지**: API 자체적으로 새로운 차단 정책이나 임계값 검사를 수행하지 않습니다. 기존에 작성된 `STOP.json` 및 `deriveDesired()` 로직의 결과를 그대로 반영합니다.

## 데이터 흐름
1. `watch-loop.js`가 주기적으로 사용량을 스크레이핑하여 상태 정보를 갱신합니다.
2. 외부에서 `/api/status`를 호출하면 `control-server.js`가 요청을 받습니다.
3. `control-server.js`는 `observation.js`의 `deriveUsage()` 및 `deriveAllowance()`를 호출하여 최신 사용량 및 허가 데이터를 가공합니다.
4. 가공된 데이터를 기존 응답 객체에 병합하여 반환합니다.

---

## Phase 1 상세 설계: `observation.js` 데이터 가공 함수 구현

이 단계에서는 상태(state) 데이터와 차단 설정(thresholds)을 입력으로 받아 `usage`와 `allowance` 객체를 반환하는 순수 함수를 `lib/observation.js`에 추가합니다.

### 1. `deriveUsage(obs, thresholds, nowMs)`
관측 데이터(`obs`)를 기반으로 현재 사용량을 계산합니다.
- `session_pct`, `weekly_pct`: 퍼센트 기호를 제거한 순수 숫자(number)로 추출. 측정값이 없으면 `null`.
- `session_headroom`, `weekly_headroom`: `stop_threshold - 현재치`로 계산하되, 음수일 경우 `0`으로 처리. 측정값이 없으면 `null`.
- `session_reset`, `weekly_reset`: 원본 문자열을 그대로 사용.
- `measured_at`: 측정 시간(ISO 문자열), 없으면 `null`.
- `age_sec`: 현재 시간(`nowMs`)과 측정 시간의 차이를 초 단위로 계산. 측정값이 없으면 `null`.
- `stale`: 기존 `deriveState()`에서 사용하는 `STALE_WARN_MS` 등을 기준으로 신선도를 판정하는 로직을 재사용. 측정 이력이 없으면 `true`.
- `thresholds`: 인자로 받은 설정값을 그대로 포함시킴.

### 2. `deriveAllowance(stopInfo, isStale, hasObservation)`
현재 차단(STOP) 상태와 관측값의 신선도를 조합하여 사용 가능 여부를 판정합니다.
- `stopInfo`: 파일 시스템에서 읽은 `STOP.json` 데이터 (없으면 null).
- `isStale`: `deriveUsage` 등에서 판정한 신선도 여부 (boolean).
- `hasObservation`: 한 번이라도 성공한 측정 이력이 있는지 여부 (boolean).
- **판정 로직**:
  - 측정 이력이 아예 없거나 오래 죽어있을 때(`!hasObservation`): `{ allowed: null, reason: 'unmeasurable', confidence: 'unknown' }`
  - `stopInfo`가 존재하고 수동(manual) 차단일 때: `{ allowed: false, reason: 'manual-stop', confidence: 'measured' }`
  - `stopInfo`가 존재하고 자동 차단일 때: `{ allowed: false, reason: stopInfo.reason, confidence: 'measured' }`
  - `stopInfo`가 없고 측정이 신선할 때(`!isStale`): `{ allowed: true, reason: 'under-threshold', confidence: 'measured' }`
  - `stopInfo`가 없고 측정이 지연되었을 때(`isStale`): `{ allowed: true, reason: 'under-threshold', confidence: 'stale' }`

---

## Phase 2 상세 설계: `control-server.js` `/api/status` 엔드포인트 응답 확장

이 단계에서는 Phase 1에서 구현한 `observation.js`의 `deriveUsage()` 및 `deriveAllowance()` 함수를 `control-server.js`에 통합하여 `/api/status` API의 응답 구조를 확장합니다.

### 1. 구현할 구체적 기능/컴포넌트
- `lib/control-server.js`의 `/api/status` 라우트 핸들러 수정.
- 메모리에 캐싱되어 있는 최신 관측 상태(observation), 에러 상태, 차단(STOP) 상태 등을 읽어옵니다.
- `observation.js`의 `deriveState()`, `deriveUsage()`, `deriveAllowance()`를 호출하여 필요한 데이터를 수집합니다.
- 기존 응답 객체의 `state`, `summary`, `fields` 속성을 **전혀 변경하지 않고** 유지합니다.
- 새로운 속성 `allowance`와 `usage`를 응답 객체 최상단에 추가합니다.

### 2. 이전 Phase와의 통합 (Integration)
- Phase 1에서 작성된 `deriveUsage()`와 `deriveAllowance()` 함수를 `require('./observation.js')`를 통해 가져와 호출합니다.
- `deriveUsage()`에 필요한 현재 적용 중인 임계값(`thresholds`) 정보와 현재 시간(`Date.now()`)을 전달합니다.
- 차단 파일(`STOP.json`)의 내용 유무와 신선도(`stale`) 여부를 파악하여 `deriveAllowance()`에 인자로 넘겨줍니다.

### 3. 데이터 흐름 (Data Flow)
1. 외부 클라이언트가 HTTP GET `/api/status`를 요청합니다.
2. `control-server.js`는 `ctx` (또는 전역 상태 관리 객체)에서 최근 관측된 스크레이핑 데이터(`obs`), 환경 설정(`thresholds`), 차단 정보(`stopInfo`)를 읽습니다.
3. `deriveState()`를 통해 현재 화면에 표시되는 계기판 상태(`stale` 여부 포함)를 확인합니다.
4. `deriveUsage()`를 호출하여 기계가 읽을 수 있는 숫자 형태의 사용량(`usage`) 데이터를 생성합니다.
5. `deriveAllowance()`를 호출하여 현재 토큰 사용 허가 여부(`allowance`) 데이터를 생성합니다.
6. 기존 JSON 구조에 `allowance`와 `usage`를 추가한 확장된 JSON 응답을 HTTP 200 OK와 함께 클라이언트에 반환합니다.
