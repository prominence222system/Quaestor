# TEST_RESULT — 014 Phase 2: `watch-loop.js` 연결 + `[agy]` 로그 형식 + `logparse` 비오염

## 현재 Phase

**Phase 2 / 2** — `watch-loop.js` 연결(`pollOnce()` 첫 동작 · `await` 없음 · `claude` 0회) +
`[agy]` 로그 형식 확정 + `logparse` 비오염 테스트(신규 추가만, 기존 편집 없음)

(Phase 1 — `lib/agy-usage.js` 신설 — 은 이전 라운드에서 이미 DONE 으로 확정됐다. 이번 라운드는
Phase 1 회귀 여부도 함께 재확인했다.)

## 참고 — `output/ACCEPTANCE.md` 범위

`output/ACCEPTANCE.md` 에는 **Phase 1 기준만** 적혀 있고 Phase 2 전용 섹션이 없다. QA 규칙에
따라(ACCEPTANCE.md 가 현재 Phase 기준을 담고 있지 않으면 work 파일 요구사항으로 대체) Phase 2 는
`work/014-measure-agy-gemini-quota.md` 의 §2("watch-loop.js 에 붙인다") · §3("로그 한 줄") ·
Acceptance 7·8번 항목으로 검증했다. `output/ACCEPTANCE.md` 자체는 수정하지 않았다.

## Phase 2 채점 기준별 결과

| # | 기준 (work/014 §2·§3, Acceptance 7·8) | 상태 | 근거 |
|---|---|---|---|
| 1 | 모니터는 **한 번만** 생성한다(`createAgyMonitor` 가 `pollOnce()` 밖, 모듈 스코프에서 1회) | PASS | `watch-loop.js:55`; 신규 테스트 `014 §2: createAgyMonitor( is called exactly once...` |
| 2 | `pollOnce()` 의 **첫 동작 부근**(`refreshConfig()` 직후) · **모든 early return 보다 앞**에서 `agyMonitor.poll()` 호출 | PASS | `watch-loop.js:113-114`; 신규 테스트 `014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig()...` — 5개 `return;` 지점(스크레이프 실패·추출 실패·설정 비활성·수동 STOP·자동 STOP 유지) 전부보다 앞임을 인덱스 비교로 검증 |
| 3 | `agyMonitor.poll()` 은 **`await` 하지 않는다**(fire-and-forget) | PASS | 같은 신규 테스트에서 `await agyMonitor.poll()` 부재 단언 |
| 4 | `watch-loop.js` 에 문자열 `claude` 가 **0회** | PASS | 기존 테스트 `p-quaestor/.js files do not reference the Claude CLI` (watch-loop.js 분기 `matches.length === 0`) |
| 5 | `watch-loop.test.js` 의 기존 구조 검사(정규식 기반)를 깨지 않는다 | PASS | 기존 구조 테스트 전부 그대로 통과, 이번 라운드는 **테스트 추가만** 수행 |
| 6 | 로그 형식 `[agy] gemini weekly_left=..% five_hour_left=..%` / `[agy] fail kind=..`(+`hint=`) | PASS (Phase 1 산출물 재확인) | `lib/agy-usage.js` `formatLogLine()` — Phase 1 테스트가 커버, 이번 라운드 회귀 없음 |
| 7 | `logparse.js` 비오염 — `[agy]` 줄이 섞여도 `parseLogTail()` 결과가 순수 claude 줄만 있을 때와 **deepStrictEqual**, claude 성공 줄은 여전히 복원됨 | PASS | `logparse.test.js` 의 `014: agy success/failure log lines mixed into the tail do not change parseLogTail() output` (신규 **추가**, 기존 테스트 편집 없음) |
| 8 | 기존 테스트 파일 편집 0, `lib/logparse.js`·`lib/control-server.js`·`lib/status-page.js` 무수정, `/api/status`·`fields`·상태 페이지·계약 버전 **무변경**, 회귀 0 | PASS | `git diff --stat HEAD` — 이번 라운드 변경분은 `p-quaestor/test/watch-loop.test.js` 테스트 **추가**뿐, 구현 파일은 손대지 않음 |

## 전체 테스트 목록/결과

`node p-quaestor/test/run-all.js` (13개 `*.test.js` 파일 전수 로드):

```
tests 406
pass 406
fail 0
cancelled 0
skipped 0
todo 0
```

이번 QA 라운드에서 `p-quaestor/test/watch-loop.test.js` 에 Phase 2 §2 배선을 구조적으로
검증하는 신규 테스트 3개를 **추가**했다(기존 테스트는 한 줄도 편집하지 않음):
- `014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce())`
- `014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return`
- `014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage`

추가 전: 403 pass / 0 fail. 추가 후: 406 pass / 0 fail. 신규 테스트도 즉시 PASS했다 —
구현(`watch-loop.js`)이 이미 §2 규율을 정확히 지키고 있어 **구현 코드 수정은 없었다.**

## 구현 코드에서 고친 버그

없음. 이번 라운드는 Phase 2 구현이 이미 규격대로 되어 있음을 확인하고, 그중 테스트로
고정되어 있지 않았던 조항(모니터 1회 생성 · 호출 위치 · `await` 없음)에 대한 회귀 방지
테스트만 추가했다.

## 이전 Phase(1) 통합 검증

- `lib/agy-usage.js` 의 `AGY_ARGS`·`parseUsage`·`measureAgy`·`createAgyMonitor` 관련 Phase 1
  테스트(`agy-usage.test.js`)가 이번 라운드에서도 전부 PASS — Phase 2 연결 작업이 Phase 1 계약을
  건드리지 않았다.
- `test/scrape-classify.test.js` 의 lib/ 전수 검사(`https://claude.ai appears exactly once
  across all files in lib/`)가 `lib/agy-usage.js` 를 포함해 PASS — `lib/source.js` 외 어디에도
  도메인 문자열이 없다.
- 012/013 라운드의 threshold·contract 관련 테스트(`thresholds*.test.js`, `control-server.test.js`)
  전부 PASS — `/api/status`·`/api/health` 응답·계약 버전 무변경.
- `logparse.test.js` 의 005 26일 침묵 복원 테스트, `watch-loop.test.js` 의 Phase 2(005) 복원
  테스트 전부 PASS — agy 로그 줄 도입이 005 복원 로직을 오염시키지 않는다.

## 결론

**PASS.** Phase 2(및 Phase 1 재확인 포함) 의 모든 채점 기준이 충족되었고, 전체 스위트
406/406 통과, 회귀 0.
