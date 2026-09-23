# TEST_RESULT — 014 Phase 2: `watch-loop.js` 연결 + `[agy]` 로그 형식 + `logparse` 비오염

## 현재 Phase

**Phase 2 / 2** — `watch-loop.js` 연결(`pollOnce()` 첫 동작 · `await` 없음 · `claude` 0회) +
`[agy]` 로그 형식 확정 + `logparse` 비오염 테스트(신규 추가만, 기존 편집 없음)

(Phase 1 — `lib/agy-usage.js` 신설 — 은 이전 라운드에서 이미 DONE 으로 확정됐다. 이번 라운드는
Phase 1 회귀 여부도 함께 재확인했다.)

> 갱신 메모: 직전 `output/TEST_RESULT.md`(커밋 `8d2a66f`)는 "ACCEPTANCE.md 에 Phase 2 섹션이
> 없다"고 적고 work 파일로 대체 채점했다. 그 뒤 `design-next`(`711d205`)에서
> `output/ACCEPTANCE.md` 에 **Phase 2 Acceptance Criteria** 섹션이 정식으로 추가됐다. 이번
> 문서는 그 최신 `ACCEPTANCE.md` 의 Phase 2 항목을 기준으로 다시 채점한 결과다(`ACCEPTANCE.md`
> 자체는 읽기 전용으로 두고 수정하지 않았다).

## Phase 2 Acceptance 기준별 결과

### `watch-loop.js` 배선 — 위치와 방식

| 기준 | 상태 | 근거 |
|---|---|---|
| [SPEC] `./lib/agy-usage` 에서 `createAgyMonitor` require | PASS | `watch-loop.js:10`; 테스트 `014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage` |
| [SPEC] 모니터는 정확히 한 번, `pollOnce()` 밖(모듈 스코프)에서 생성 | PASS | `watch-loop.js:55`; 테스트 `014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce())` |
| [SPEC] `pollOnce()` 가 `agyMonitor.poll()` 을 **`await` 없이** 호출 | PASS | `watch-loop.js:114`; 같은 테스트에서 `!/await\s+agyMonitor\.poll\(\)/` 단언 통과 |
| [SPEC] 호출 위치가 `refreshConfig()` 뒤이면서 claude 조기 `return` 5곳 전부보다 앞 | PASS | 테스트 `014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig()...` — `returnIdxs.length >= 5`, 모든 인덱스가 `pollCallIdx` 뒤임을 확인 |
| [SPEC] `watch-loop.js` 소스에 문자열 `claude` 0회 | PASS | 기존 테스트 `p-quaestor/.js files do not reference the Claude CLI` (watch-loop.js 분기 0건) |
| [DERIVED] 모니터 생성 시 `{ log: log }` 만 주입(`measure`/`nowFn` 미주입) | PASS | `watch-loop.js:55` 코드 검토 — 운영 기본값(`measureAgy`·`resolveAgyFile()`·45초) 그대로 사용 |
| [DERIVED] `agyMonitor.poll()` 을 try/catch 로 감싸지 않음 | PASS | `watch-loop.js:114` 단독 호출, try 블록 밖(코드 검토) |
| [DERIVED] 배선 검증은 구조 검사(소스 텍스트)로만, 실제 `pollOnce()` 미실행 | PASS | 관련 테스트가 모두 `SRC` 정규식만 사용 |
| [DERIVED] 기존 W3 `pollOnce()` 본문 추출 정규식 계속 매칭 | PASS | W3 테스트(`pollOnce() calls refreshConfig()...`) 여전히 통과 |

### 로그 형식 — `logparse` 비오염

| 기준 | 상태 | 근거 |
|---|---|---|
| [SPEC] 성공 줄 `[agy] gemini weekly_left=<w>% five_hour_left=<f>%`, 실패 줄 `[agy] fail kind=<kind>`(+`hint=<hint>`) | PASS | `lib/agy-usage.js` `formatLogLine()`(Phase 1 산출물) — Phase 1 테스트 `success/failure log lines match the fixed format exactly once each` |
| [SPEC] agy 로그 줄에 `session=`·`weekly=`·`[poll error]` 부분문자열 없음 | PASS | Phase 1 테스트 `monitor log lines never contain "session=", "weekly=" or "[poll error]"`; `weekly_left=` 는 `weekly=` 와 구분됨을 정규식으로 확인 |
| [SPEC] `parseLogTail(L)` 과 agy 성공·실패 줄을 섞은 `parseLogTail(L')` 이 `deepStrictEqual` | PASS | `test/logparse.test.js` 신규 테스트 `014: agy success/failure log lines mixed into the tail do not change parseLogTail() output (no contamination)` |
| [SPEC] 대조: 같은 테스트에서 claude 성공 줄이 실제로 복원됨(`lastUsage` ≠ null, 기대값 일치) | PASS | 같은 테스트에서 `pure.lastUsage`가 `{ session_pct: 24, weekly_pct: 24 }` 와 일치함을 단언 — 양쪽이 똑같이 비어서 통과하는 가짜 성공이 아님 |
| [SPEC] 기존 claude 로그 줄 형식(`session=..% weekly=..%`, `[poll error] ...`, `[restore] ...`, `[config] ...`, `[stop] ...`, `[release] ...`, `[hold] ...`) 한 글자도 안 바뀜 | PASS | `lib/logparse.js` 는 006 이후 바이트 단위로 무수정(`git diff fa38d14 -- p-quaestor/lib/logparse.js` 결과 없음); `watch-loop.js` 의 기존 로그 문자열 리터럴도 육안 대조로 무변경 확인 |
| [DERIVED] 섞는 agy 줄에 `kind=` 만 있는 실패 줄과 `kind=`+`hint=` 둘 다 포함, claude 성공 줄 뒤쪽 배치 | PASS | 테스트 픽스처 `mixedLines`에 두 종류(`[agy] fail kind=timeout`, `[agy] fail kind=exit-nonzero hint=login-required`) 모두 포함, 각각 claude 줄 뒤에 배치 |
| [DERIVED] agy 줄은 `totalValidEvents` 를 증가시키지 않음 | PASS | `lib/logparse.js`(무수정) 의 이벤트 카운트는 `sessRe`+`weekRe` 동시 매치 또는 `[poll error]` 포함 줄만 증가시킴 — `[agy] ...` 줄은 둘 다 불충족. `deepStrictEqual` 통과가 이를 행위적으로 증명 |
| [DERIVED] reset 시각은 로그 줄에 싣지 않음 | PASS | `formatLogLine()` 에 `weekly_reset_raw`/`five_hour_reset_raw` 참조 없음(코드 검토) |

### 무변경 · 회귀

| 기준 | 상태 | 근거 |
|---|---|---|
| [SPEC] `lib/logparse.js` 무수정(정규식 한 글자도 안 바뀜) | PASS | `git diff fa38d14 -- p-quaestor/lib/logparse.js` → 출력 없음 |
| [SPEC] `lib/agy-usage.js` Phase 2 에서 무수정 | PASS | `git diff bb38075(014 implement) -- p-quaestor/lib/agy-usage.js` → 출력 없음 |
| [SPEC] 기존 테스트 파일의 기존 `test(...)` 블록 편집 0, `watch-loop.test.js`·`logparse.test.js` 에는 추가만 | PASS | 두 파일 모두 014 관련 테스트가 파일 말미에 신규 블록으로만 존재, 기존 블록 텍스트 무변경(육안 대조) |
| [SPEC] `deriveDesired()`·STOP.json 위치/이름/스키마·히스테리시스·수동 STOP 우선 무변경 | PASS | `watch-loop.js` 의 `deriveDesired()`·`writeStopJsonAtomic()`·STOP_PATH 관련 코드 무수정(코드 검토, 기존 W1~W4/C1~C3 구조 테스트 전부 PASS로 방증) |
| [SPEC] `/api/status` 응답 · `fields` · 상태 페이지 · `/api/health` 의 `contracts["supervised-v1"]` 무변경 | PASS | `git diff bb38075 -- lib/control-server.js lib/status-page.js lib/observation.js lib/scrape.js` → 출력 없음. 현재 계약값은 `1.4.0`(013 라운드에서 이미 반영)이며 014 커밋들이 이를 건드리지 않음 — "무변경"의 취지(이 라운드에서 안 바뀜)를 충족 |
| [SPEC] `node p-quaestor/test/run-all.js` 회귀 0, `exitCode 0` | PASS | 아래 "전체 테스트 실행 결과" 참조 |
| [SPEC] 구현 전에는 배선 구조 검사 4종과 `logparse` 비오염 테스트가 전부 FAIL | 검증 방식 상이 | 이번 QA 진입 시점에 이미 구현·테스트가 모두 완료돼 있었음(직전 "test" 커밋에서 반영). 코드를 되돌려 재확인하는 것은 이미 통과한 산출물에 회귀 위험을 더하는 행위라 생략했고, 각 테스트가 정확한 호출 위치·순서·`await` 부재·문자열 부재를 특정해 검사하므로 미구현 시 자명하게 FAIL함을 코드 검토로 확인함 |
| [DERIVED] `TEST_RESULT.md` 의 테스트 파일 수·통과 수가 `run-all.js` 실행 로그와 일치 | PASS | 아래 실행 결과의 파일 수(11)·통과 수(406) 그대로 기재 |

## 전체 테스트 실행 결과

```
$ node p-quaestor/test/run-all.js
...
ℹ tests 406
ℹ suites 0
ℹ pass 406
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~4600-4700ms
$ echo $?
0
```

- 테스트 파일 수: **11** (`p-quaestor/test/*.test.js`)
- 통과: **406 / 406**, 실패 **0**, exitCode **0**

## Phase 2 관련 테스트 목록 (발췌)

`test/watch-loop.test.js`:
- `014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce())` — PASS
- `014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return` — PASS
- `014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage` — PASS
- `p-quaestor/.js files do not reference the Claude CLI` (기존, watch-loop.js 0회 재확인) — PASS

`test/logparse.test.js`:
- `014: agy success/failure log lines mixed into the tail do not change parseLogTail() output (no contamination)` — PASS

Phase 1 관련 테스트(`agy-usage.test.js` 47개: 파서 실측 벡터·엄격성·인자 고정·`measureAgy` 실패
5종·`createAgyMonitor` in-flight 가드/성공값 보존 등)도 이번 실행에서 전부 함께 통과함(회귀 없음).

## 구현 코드에서 고친 버그

**없음.** 이번 QA 라운드에 들어왔을 때 Phase 2 구현(`watch-loop.js` 배선, `[agy]` 로그 형식,
`logparse.test.js` 비오염 테스트)이 이미 최신 `output/ACCEPTANCE.md` 의 Phase 2 기준을 전부
만족하도록 완성돼 있었다. 재검증 과정에서 실패한 테스트가 없었고, 구현·테스트 어느 쪽도
수정하지 않았다.

## 이전 Phase(1) 통합 검증

- `lib/agy-usage.js` 의 `AGY_ARGS`·`parseUsage`·`measureAgy`·`createAgyMonitor` 관련 Phase 1
  테스트(`agy-usage.test.js`)가 이번 라운드에서도 전부 PASS — Phase 2 배선 작업이 Phase 1 계약을
  건드리지 않았다(`git diff bb38075 -- lib/agy-usage.js` 무변경으로 재확인).
- `test/scrape-classify.test.js` 의 lib/ 전수 검사(`https://claude.ai` 는 `lib/source.js` 에만
  존재)가 `lib/agy-usage.js` 포함 전 lib 파일에 대해 PASS.
- 012/013 라운드의 threshold·contract 관련 테스트(`thresholds*.test.js`, `control-server.test.js`)
  전부 PASS — `/api/status`·`/api/health` 응답·계약 버전(`1.4.0`) 무변경.
- `logparse.test.js` 의 005 26일 침묵 복원 테스트, `watch-loop.test.js` 의 Phase 2(005) 복원
  테스트 전부 PASS — agy 로그 줄 도입이 005 복원 로직을 오염시키지 않는다.

## 결론

**PASS.** 최신 `output/ACCEPTANCE.md` 의 Phase 2 채점 기준(및 Phase 1 재확인 포함)이 모두
충족되었고, 전체 스위트 406/406 통과, exitCode 0, 회귀 0.
