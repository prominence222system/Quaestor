# TEST_RESULT — 014 Phase 1: `lib/agy-usage.js` 신설

## 실행 결과 요약

```
node p-quaestor/test/run-all.js
tests 402
pass 402
fail 0
cancelled 0
duration_ms ≈ 4770
```

이 중 `p-quaestor/test/agy-usage.test.js` 가 신규 35개 테스트를 추가했고 전부 통과했다.
나머지 367개는 기존(001~013) 테스트로, **회귀 0**을 확인했다.

## Phase 1 Acceptance 기준별 판정

### 파서 — 실측 벡터
| 기준 | 결과 |
|---|---|
| 파이프 형식(TAB) → `ok:true, weekly=45, five_hour=100` | ✅ PASS |
| 파이프 형식 `weekly_reset_raw`/`five_hour_reset_raw` 원문 그대로 | ✅ PASS |
| 콘솔 형식(공백 2칸+ + `Quota:`) → `ok:true, weekly=51, five_hour=89` | ✅ PASS |
| 두 형식이 같은 키 집합 | ✅ PASS |

### 파서 — 엄격성
| 기준 | 결과 |
|---|---|
| weekly-only / `150%` / 같은 metric 다른 값 / 빈 문자열 / 로그인 문구 → 전부 `ok:false` | ✅ PASS |
| Gemini 두 줄 순서 바꿔도 metric 문자열로 값이 짝지어짐 | ✅ PASS |
| `Claude and GPT models` 값이 결과·로그 어디에도 없음(센티넬 픽스처 `37/23/2031-01-01/2032-02-02`) | ✅ PASS |
| 4칸 아닌 줄/빈 줄/`Quota:` 조용히 skip | ✅ PASS |
| `parseUsage` 순수 함수(비문자열 입력에도 예외 없이 `{ok:false}`, 같은 입력→같은 출력) | ✅ PASS |

### 인자 고정
| 기준 | 결과 |
|---|---|
| `AGY_ARGS` deepStrictEqual `['-p','/usage']` + `Object.isFrozen === true` | ✅ PASS |
| 실행기에 넘기는 인자가 진짜 자식 프로세스 경계를 넘어 `['-p','/usage']` 로 검증(가짜 스크립트가 argv 불일치 시 exit 3) | ✅ PASS |
| `measureAgy` 가 인자 주입 경로를 노출하지 않음(소스에 `['-p'` 리터럴 1회) | ✅ PASS |

### `measureAgy` — 실패 분류
| 기준 | 결과 |
|---|---|
| 실행기 동기 throw → `spawn-failed`, 예외가 밖으로 안 샘 | ✅ PASS |
| `error.code` 문자열(비-ENOENT, 예 `EINVAL`) → `spawn-failed` | ✅ PASS |
| 존재하지 않는 절대경로 + 기본 실행기 → `not-installed` | ✅ PASS |
| 60초 hang + `timeoutMs=1000` → 3.5초 내 `timeout` (실측 ≈1017ms) | ✅ PASS |
| exit0+에러문구→`parse-failed`(+hint), exit0+빈stdout→`parse-failed`(hint 없음), exit1+에러문구→`exit-nonzero`(+hint) | ✅ PASS |
| 모든 경우에서 reject 하지 않음(always resolve) | ✅ PASS |
| 성공/실패 결과 형태(`{ok,at,...}` / `{ok:false,at,kind[,hint]}`) | ✅ PASS |
| `hint` 는 판정에 안 쓰임(exit0 vs exit1 로 같은 로그인 문구가 다른 kind로 갈림) | ✅ PASS |
| `hint: 'login-required'` 유무 | ✅ PASS |
| `at` 이 주입한 `nowFn` 반영 | ✅ PASS |
| 자체 마감 타이머, 이중 resolve 없음(콜백 2회 호출돼도 1회만 반영) | ✅ PASS |
| 실행기 옵션에 `shell:false` 포함 | ✅ PASS |

### 실행 파일 해석
| 기준 | 결과 |
|---|---|
| 두 env var 모두 미정의 → `'agy'`(반환값만 단언, 실행 안 함) | ✅ PASS |
| `QUAESTOR_AGY_EXE` 가 `BELLOWS_AGY_EXE` 보다 우선 | ✅ PASS |
| 빈 문자열/공백 → `'agy'` 로 fallback | ✅ PASS |

### `createAgyMonitor`
| 기준 | 결과 |
|---|---|
| `.poll()` 즉시 반환(측정 60초 걸려도) | ✅ PASS |
| in-flight 중 재호출 시 `measure` 재호출 없음 | ✅ PASS |
| 성공 뒤 실패에도 `lastSuccess` 유지, `lastAttempt` 만 갱신 | ✅ PASS |
| `measure` 동기 throw/reject 해도 예외 안 새고 이후 `.poll()` 정상 동작 | ✅ PASS |
| `snapshot()` 매번 새 객체(변형해도 내부 오염 없음) | ✅ PASS |
| 초기 상태 `{lastSuccess:null, lastAttempt:null, inFlight:false}` | ✅ PASS |
| 성공/실패 로그 한 줄씩 정확한 포맷 | ✅ PASS |
| `log` 미정의/throw 해도 상태 갱신 정상 | ✅ PASS |

### 로그 형식 비오염 / 경계·격리
| 기준 | 결과 |
|---|---|
| 로그 줄에 `session=`/`weekly=`/`[poll error]` 부분문자열 없음 | ✅ PASS |
| Phase 1 실행 경로 테스트가 진짜 `agy` 를 실행하지 않음(가짜 스크립트 또는 존재하지 않는 경로만 사용) | ✅ PASS |
| 정상·콘솔·센티넬 검증이 진짜 `child_process`/파이프를 거침(TAB 바이트가 파이프로 전달) | ✅ PASS |
| 소스에 `Gemini Models` 외 벤더/엔진 버킷 이름 없음 | ✅ PASS |
| 소스에 `https://claude.ai` 0회(`scrape-classify.test.js:370` 의 lib/ 전수 검사 통과) | ✅ PASS |
| `run-all.js` 회귀 0, 기존 테스트 파일 편집 0, `watch-loop.js`/`logparse.js`/`control-server.js`/`status-page.js` 무수정, `/api/status`·`fields`·상태 페이지·계약 버전 무변경 | ✅ PASS |
| 가짜 agy 픽스처가 `test/fixtures/` 아래 있고 `.test.js` 로 끝나지 않아 `run-all.js` 가 오인하지 않음 | ✅ PASS |
| `process.env` 를 건드리는 테스트가 `try/finally` 로 원상복구 | ✅ PASS |

## 이번 라운드에서 수정한 구현 버그

없음. 구현(`lib/agy-usage.js`, `test/agy-usage.test.js`, `test/fixtures/fake-agy.js`)은 이전 커밋(`bb38075`)에서
이미 완료되어 있었고, QA 라운드에서 acceptance 기준 항목 전부에 대응하는 테스트가 이미 존재해 재작성 없이
그대로 통과함을 확인했다.

## 이전 단계(001~013) 통합 검증

`node p-quaestor/test/run-all.js` 1회 실행으로 `p-quaestor/test/*.test.js` 전체(15개 파일, 402개 테스트)를
로드·실행해 **367개 기존 테스트가 전부 그대로 통과**함을 확인했다(회귀 0). `git status` 로 `p-quaestor/**` 아래
어떤 기존 파일도 변경되지 않았음을 확인했다(신규 파일 3개만 추가된 상태로 이미 커밋됨).

## 결론

**Phase 1 PASS.** ACCEPTANCE.md 의 모든 [SPEC]/[DERIVED] 기준을 충족했고 회귀 없음.
