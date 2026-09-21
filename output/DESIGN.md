# Quaestor 013: `/api/status` 엔진 범위 선언 설계 문서

## 1. Overall Project Architecture
Quaestor는 Claude 사용량을 주기적으로 스크래핑하여 시스템의 지속 사용 가능 여부를 판단하고, 이를 기반으로 차단기를 제어하며 상태를 HTTP API(`/api/status`, `/api/health`)로 제공하는 감시 프로세스다.
본 013 라운드의 핵심 설계는 기존 관측 및 판정 로직(차단기)은 전혀 변경하지 않되, 응답 페이로드의 `usage` 및 `allowance` 객체에 해당 수치들이 '어느 엔진'(`claude`)의 것인지를 명시하는 것이다. 이를 통해 다중 엔진을 교대로 사용하는 소비자(forge 등)가 다른 엔진의 잔량으로 오인하는 문제를 구조적으로 방지한다.

## 2. Directory Structure
```text
F:\Workspace\Automatic\projects\Quaestor\
  ├─ p-quaestor\
  │  ├─ lib\
  │  │  ├─ source.js (신설: origin 및 엔진 라벨을 담은 순수 모듈)
  │  │  ├─ scrape.js (수정: source.js를 require하여 사용, 리터럴 제거)
  │  │  ├─ observation.js (수정: usage/allowance 조립 시 covers 필드 삽입)
  │  │  ├─ status-page.js (수정: payload의 covers 렌더링 추가)
  │  │  └─ control-server.js (수정: CONTRACTS 버전 1.4.0 승격)
  │  ├─ test\
  │  │  ├─ scrape-classify.test.js (수정: 소스 문자열 단언 이관)
  │  │  └─ control-server.test.js (수정: 버전 핀 테스트 갱신, 검증 추가)
  │  └─ ...
```

## 3. Technical Decisions and Rationale
1. **`lib/source.js` 분리 및 무의존성 유지**: `observation.js`는 순수 함수로 설계되어 있어 외부 I/O가 있는 `scrape.js`를 require할 수 없다. 엔진 라벨(`ENGINE`)과 `ORIGIN` 상수를 완전히 독립된 `source.js`에 배치함으로써, 의존성 오염 없이 엔진 정보를 `observation.js`에서 참조할 수 있게 한다.
2. **`covers` 필드의 일관된 추가**: `usage`와 `allowance` 모두에 `covers: ["claude"]` 배열을 추가한다. 소비자가 `allowance`만 읽더라도 엔진 범위를 누락 없이 파악할 수 있도록 하며, 단일 문자열이 아닌 배열을 사용하여 향후 확장에 대비하고 '목록에 없으면 모른다'는 의미를 명확히 한다.
3. **상태 페이지의 읽기 전용 렌더링 유지**: `status-page.js`는 자체적인 문자열 리터럴을 추가하지 않고 오로지 API payload에서 받은 `covers` 정보를 화면에 렌더링하여 화면이 거짓말을 하지 않도록 보증한다.
4. **계약 버전(1.4.0) 분리 명시**: 소프트웨어 버전과 인터페이스 계약 버전을 분리하려는 원칙을 지키며, 응답 포맷이 확장되었음을 나타내기 위해 `health` 응답의 계약 버전을 1.4.0으로 갱신한다.

## 4. Data Flow
1. **상수 제공**: `lib/source.js`가 `ORIGIN`('https://claude.ai')과 `ENGINE`('claude') 값을 제공.
2. **스크래핑**: `lib/scrape.js`는 `ORIGIN` 상수를 사용하여 데이터를 스크래핑.
3. **상태 판정 객체 구성**: `lib/observation.js`의 `deriveUsage`, `deriveAllowance`가 호출될 때 `source.js`의 `ENGINE` 값을 사용하여 `covers: ["claude"]` 필드를 객체에 포함.
4. **HTTP API 응답**: `GET /api/status` 호출 시 `control-server.js`가 상기 구성된 객체를 그대로 반환. (하위 호환성 유지)
5. **웹 UI 렌더링**: `GET /` 호출 시 `status-page.js`가 `/api/status` 페이로드를 전달받아 `covers` 값을 사용자에게 표시.

## 5. Phase 1 Detailed Design: `lib/source.js` 신설
- **목표**: `lib/scrape.js`에 존재하는 도메인 문자열 리터럴을 독립된 모듈로 분리하여 코드베이스 내 리터럴 사용을 통제한다.
- **상세 구현 계획**:
  1. `lib/source.js` 신설: 외부 require 없이 순수하게 `ORIGIN`('https://claude.ai')과 `ENGINE`('claude')만을 export 하도록 작성.
  2. `lib/scrape.js` 리팩터링: 자체 정의된 `ORIGIN` 리터럴을 지우고 `const { ORIGIN } = require('./source.js');`로 대체한다.
  3. `test/scrape-classify.test.js` 단언 갱신: 기존 `lib/scrape.js` 파일 내용 중 `/claude/g` 매치 횟수를 0으로 단언하도록 수정하고, 해당 단언 로직을 `lib/source.js`를 대상으로 하여 이관한다 (단, 요구사항의 "강도 동일" 조건과 `ENGINE` 추가로 인한 실제 매치 횟수에 유의하여 테스트 코드 갱신).

## 6. Phase 2 Detailed Design: `usage` 및 `allowance` 객체 확장 및 계약 버전 갱신
- **목표**: `lib/observation.js`의 `deriveUsage`와 `deriveAllowance` 함수가 `lib/source.js`의 엔진 정보를 활용하여 응답에 `covers: ["claude"]` 필드를 추가하고, API 계약 버전을 1.4.0으로 승격한다.
- **상세 구현 계획**:
  1. `lib/observation.js` 갱신:
     - `lib/source.js`에서 `ENGINE` 상수를 순수하게 require한다.
     - `deriveUsage`와 `deriveAllowance`가 반환하는 객체 내에 `covers: [ENGINE]` 항목을 추가한다.
     - 기존의 필드는 하나도 건드리지 않으며(하위 호환성 유지), 관측 이력이 없을 때(null일 때)도 `covers` 필드가 항상 출력되도록 설계한다.
  2. `lib/control-server.js` 계약 버전 갱신:
     - `CONTRACTS['supervised-v1']` 상수를 `1.4.0`으로 변경한다.
     - 상수 선언 위에 `1.3.0 -> 1.4.0: usage·allowance 에 covers 추가 (하위호환)` 주석을 추가한다.
  3. `test/control-server.test.js` 테스트 갱신 및 검증:
     - 기존의 버전 핀 테스트(176, 217 라인 단언값 및 169, 210 라인 제목)를 `1.4.0`으로 갱신한다.
     - 기 존재하는 실서버(127.0.0.1 바인딩) HTTP 엔드포인트 대상 테스트(`GET /api/status`, `GET /api/health`)에 `usage.covers`와 `allowance.covers`가 `deepStrictEqual`인지, 정확히 `["claude"]`인지, 그리고 `agy`가 포함되지 않았는지에 대한 단언을 추가한다.
- **Integration with previous Phases (Phase 1 통합)**:
  - Phase 1에서 만든 `lib/source.js`를 의존성으로 끌어들여 엔진 정보를 사용한다. 이 과정에서 `lib/observation.js`는 순수 함수 속성을 잃지 않는다(I/O 없음).
- **Data flow**:
  - `lib/source.js` (ENGINE) -> `lib/observation.js` (`deriveUsage`, `deriveAllowance`) -> `lib/control-server.js` (`GET /api/status`, `GET /api/health`) -> Test Validation.

## 7. Phase 3 Detailed Design: 상태 페이지 렌더링 갱신 및 실서버 UI 검증
- **목표**: `GET /` 호출 시 반환되는 웹 UI 상태 페이지가 `usage.covers` 정보를 통해 사용량 수치가 어느 엔진(`claude`)의 것인지를 하드코딩 없이 동적으로 화면에 표시한다.
- **상세 구현 계획**:
  1. `lib/status-page.js` 렌더링 로직 갱신:
     - `buildStatusPayload`를 거쳐 전달된 페이로드의 `usage.covers` 배열 값을 읽어온다.
     - 템플릿 리터럴 내에 `esc(payload.usage.covers.join(', '))` 등의 방식으로 안전하게 렌더링한다. (예: "엔진 범위: claude")
     - 파일 내에 `'claude'` 리터럴이나 `covers.includes('claude')`와 같은 조건부 분기를 절대 추가하지 않는다.
     - origin URL(`https://claude.ai`)을 렌더링 로직이나 HTML에 삽입하지 않는다.
  2. `test/control-server.test.js` 실서버 통합 테스트 갱신:
     - 127.0.0.1에 바인딩된 실서버로 `GET /` 요청을 보내어 응답 HTML 문자열을 가져오는 기존 테스트 경로(`1437`, `1450`, `1464`, `1491` 부근)에 단언을 추가한다.
     - 반환된 HTML 내에 렌더링된 `covers` 값(예: `claude`)이 시각적으로 포함되어 있는지 검증한다. (순수 렌더러 `renderStatusPage`만 테스트하는 것은 통합 실패를 유발할 수 있으므로 허용하지 않는다)
- **Integration with previous Phases (Phase 2 통합)**:
  - Phase 2에서 `usage` 객체에 추가된 `covers` 데이터를 그대로 활용하여 웹 화면에 매핑한다.
- **Data flow**:
  - `lib/control-server.js` (페이로드 구성) -> `lib/status-page.js` (`usage.covers` 데이터 렌더링) -> 브라우저(사용자 확인 및 실서버 테스트 통과).
