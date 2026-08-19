# TEST_RESULT — Phase 1

**대상 NNN**: 003-observation-state-and-failure-classification
**대상 Phase**: Phase 1 — `lib/observation.js` 순수 모듈(관측 구조체 + `deriveState()` 판정 + `fields` 구성) · `test/run-all.js` 하네스
**판정**: **PASS** (29/29 통과, 종료 코드 0)

## 검증 방법

- `output/ACCEPTANCE.md` 의 Phase 1 기준 전체를 기존 `p-bellows/test/observation.test.js` (29개 테스트, `node:test`)와
  대조해 항목별 커버리지를 확인했다.
- 하네스 자체의 [SPEC] 동작 두 가지(테스트 실패 시 비-0 종료, 로드 예외 시 비-0 종료)는
  `observation.test.js` 로는 검증할 수 없는 하네스-레벨 동작이라 임시 테스트 파일을 만들어
  실제로 실행 → 종료 코드 확인 → 즉시 삭제하는 방식으로 별도 검증했다(저장소에 남지 않음).
- `node p-bellows/test/run-all.js` 를 저장소 루트/`p-bellows`/`p-bellows/test` 세 위치에서 각각 실행해
  `__dirname` 기반 동작을 확인했다.
- `git show --stat` 으로 이번 NNN 구현 커밋(4c00e01)이 건드린 파일을 확인해 회귀 금지 조항을 검증했다.

## Acceptance Criteria 결과

### 순수성 · 결정성
| 기준 | 결과 |
|---|---|
| deriveState 순수·결정적 (동일 입력 → 동일 결과, 실제 시간 무관) | PASS |
| Date.now()/new Date()/require('fs') 미사용 (소스 검사) | PASS |
| deriveState 가 obs/ctx 를 변형하지 않음 | PASS |
| recordSuccess/recordFailure 가 obs 를 변형하지 않음 (DERIVED) | PASS |
| TZ 변경에도 fields 값 동일 (DERIVED) | PASS |

### 상태 판정
| 기준 | 결과 |
|---|---|
| lastSuccessAt=null → ok 이면 FAIL (실제: warn) | PASS |
| consecutiveFailures≥crit → ok 이면 FAIL (실제: crit) | PASS |
| 오래된 마지막 성공 → ok 이면 FAIL (실제: crit) | PASS |
| state ∈ {ok,warn,crit,idle} | PASS |
| summary 비어있지 않은 문자열, fields 는 배열, 예외 없음(빈 obs/ctx 누락 포함) | PASS |
| enabled=false → idle (다른 조건 무관, DERIVED) | PASS |
| consecutiveFailures≥4 → crit, 성공 이력 없어도 crit (DERIVED) | PASS |
| 2시간 초과 → crit, 45분 초과(2시간 이내) → warn (DERIVED) | PASS |
| lastSuccessAt=null 이고 실패<crit → warn (DERIVED) | PASS |
| 신선+임계 90% 이상 → warn, 미만 → ok (주간 79%/24% 케이스, DERIVED) | PASS |
| first-match-wins 우선순위 (DERIVED) | PASS — 코드가 if/else-if 체인으로 구현되어 구조적으로 순서 보장. `enabled=false`가 실패 10회 누적을 덮는 테스트, `consecutiveFailures≥4`가 `lastSuccessAt=null`(성공 이력 없음)을 덮는 테스트로 상위 두 우선순위 교차 확인됨 |

### 관측 기록
| 기준 | 결과 |
|---|---|
| 성공→실패→실패→성공 → consecutiveFailures=0 | PASS |
| recordFailure: consecutiveFailures/totalFailures +1, lastSuccessAt 보존 | PASS |
| recordSuccess: lastSuccessAt=now, consecutiveFailures=0 | PASS |
| createObservation 초기 상태 필드값 | PASS |
| totalPolls 각각 +1 (DERIVED) | PASS |
| kind falsy/비문자열 → 'unknown' 정규화 (DERIVED) | PASS |
| recordSuccess 가 lastFailure 유지 (DERIVED) | PASS |

### 비밀 미유출
| 기준 | 결과 |
|---|---|
| JSON.stringify(deriveState) 에 .profile/authToken/cookie/@ 없음 (이메일 섞인 detail 포함) | PASS |
| 디버그 포트(9222)·페이지 원문 텍스트 없음 | PASS |
| lastFailure 필드는 kind+hint 뿐, 고정 어휘 화이트리스트 (DERIVED) | PASS — 미지정 hint('totally-made-up')는 드롭됨을 별도 확인 |

### fields 형식과 내용
| 기준 | 결과 |
|---|---|
| 각 원소 label/value 문자열, state 있으면 유효 열거값 | PASS |
| 8개 필수 항목 모두 포함(마지막 성공·세션%·주간%·연속실패·마지막실패·STOP·임계값·설정출처) | PASS |
| STOP 필드가 없음/auto/manual 구분, manual 이 값에서 드러남 | PASS |
| 설정 출처 필드가 ctx.configSource 반영 (DERIVED) | PASS |
| lastUsage=null 이어도 세션/주간% 칸이 '-'로 유지 (DERIVED) | PASS |
| fields 순서가 동일 입력에 항상 동일 (DERIVED) | PASS |

### 테스트 하네스
| 기준 | 결과 |
|---|---|
| `node p-bellows/test/run-all.js` 전체 실행, 실패 시 비-0 종료 | PASS — 저장소 루트에서 실행, 종료 코드 0(전부 통과). 임시 실패 테스트 주입 후 재실행 → 종료 코드 1 확인, 즉시 제거 |
| Chrome·네트워크·claude.ai 없이 완주 | PASS — 29/29 통과, 종료 코드 0 |
| 신규 .js 에 'claude' grep 매칭 없음(도메인 URL 예외) | PASS — `observation.test.js:191` 의 `https://claude.ai/login?...` 1건은 비밀 유출 방지 테스트의 fixture 데이터로 도메인 URL 예외에 해당. `lib/observation.js`·`run-all.js` 에는 매칭 없음 |
| __dirname 기준 동작, 실행 위치 무관 (DERIVED) | PASS — 저장소 루트/`p-bellows`/`p-bellows/test` 세 위치 모두 종료 코드 0 |
| 로드 중 예외 → 출력 후 비-0 종료 (DERIVED) | PASS — 임시로 load-time throw 파일 주입 후 재실행 → 종료 코드 1, 에러 스택 출력 확인, 즉시 제거 |
| 테스트 파일 0개 → 비-0 종료 (DERIVED) | PASS (코드 검토) — `run-all.js` 가 `files.length === 0` 분기에서 `process.exitCode = 1` 설정 |
| node:test/assert 만 사용, npm 미호출 (DERIVED) | PASS — `package.json` dependencies 는 puppeteer 뿐(변경 없음), 테스트 코드에 npm 호출 없음 |

### 회귀 금지 (never-brick)
| 기준 | 결과 |
|---|---|
| watch-loop.js/lib/scrape.js/lib/config.js/lib/extract.js/watch-once.js 미수정 | PASS — 구현 커밋(4c00e01)이 건드린 파일은 `output/PROGRESS.md`·`lib/observation.js`·`test/observation.test.js`·`test/run-all.js` 4개뿐 |
| STOP.json 스키마·deriveDesired·수동 STOP 우선 규칙 불변 | PASS — 위 항목에 의해 해당 로직을 담은 파일 자체가 미수정 |
| lib/observation.js 가 puppeteer 등 외부 모듈 미require | PASS |

## 테스트 전체 목록 (29개, 전부 PASS)

`p-bellows/test/observation.test.js` 의 29개 `node:test` 케이스 전부 — 실행 로그:
```
tests 29 / pass 29 / fail 0 / cancelled 0 / skipped 0 / duration_ms ~14ms
```

## 구현 수정 사항

없음 — 기존 구현이 Phase 1 Acceptance 전 항목을 이미 만족했다. 코드 수정 없이 검증만 수행했다.

## 이전 Phase 통합 검증

Phase 1 은 이 NNN 의 첫 Phase이므로 통합 대상인 이전 Phase 가 없다. 다만 회귀 금지 조항에 따라
기존 제품 코드(`watch-loop.js`·`lib/scrape.js`·`lib/config.js`·`lib/extract.js`·`watch-once.js`)가
전혀 수정되지 않았음을 git 커밋 diff 로 확인했다(위 표 참조) — STOP.json 계약과 기존 감시 루프 동작에
영향 없음.
