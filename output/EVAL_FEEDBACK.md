## Verdict
PASS

## Verdict Criteria (current work file only)
- NEXT: a phase REMAINS WITHIN the current work file (not for other work files)
- FIX: Current Phase has bugs or missing features
- REDESIGN: Fundamental design issues require architecture change
- INTEGRATE: ALL phases of the current work file are DONE, need an integration test
- PASS: the current work file is complete (all its phases DONE, tests pass); forge advances to the next work file

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 3 (마지막 Phase — Phase 1·2 는 이미 DONE)
- Feature: 환경변수 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백(의미 불변)
- Complete: yes
- Issues found: 없음. `output/ACCEPTANCE.md` "# ACCEPTANCE — 006 Phase 3" 전 항목을 실측 재대조했다
  (아래 "실측 재검증" 참고). `output/PROGRESS.md` 가 Phase 3 를 아직 `CURRENT` 로 표기하고
  있었으나 TEST_RESULT.md 의 Phase 3 결과와 실측이 이미 PASS 이므로 이 eval 에서 `DONE` 으로 갱신했다.

### 실측 재검증 (독립 검증)

TEST_RESULT.md 의 서술을 신뢰하지 않고 직접 재실행했다.

| 확인 | 명령/방법 | 결과 |
|---|---|---|
| 디렉토리 이동 | `ls p-quaestor` / `find p-bellows -type f` | `p-quaestor` 존재, 옛 `p-bellows` 는 **내용물 0개**(문서화된 이월 사항과 일치) |
| 패키지 이름 | `grep '"name"' package.json package-lock.json` | 셋 다 `prominence-quaestor` |
| 이름 잔재 | `git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"` | **0건** |
| 전체 테스트 | `node p-quaestor/test/run-all.js` | **exit 0 · tests 176 · pass 176 · fail 0** |
| git 이력 | `git log --oneline --follow -- p-quaestor/watch-loop.js` | 이동 이전 커밋까지 이어짐(`git mv` 증거) |
| ps1 무수정 | `git status --porcelain -- run-bellows.ps1 deploy-bellows.ps1` | 빈 출력 |
| `lib/env.js` | 소스 직접 열람 | 의존 0, `parseInt`/`trim`/캐시 없음, `!== undefined` 판정만 사용(truthiness 아님) |
| 배선 | `grep envRaw` in config.js/watch-loop.js/watch-once.js/scrape.js | 9개 접미사 전부 `envRaw()` 경유, `\|\| 기본값` 유지(`??` 로 안 바뀜) |
| claude CLI | `git grep "claude"` in `p-quaestor/*.js` `lib/*.js`(test 제외) | 0건 |

전부 ACCEPTANCE.md · TEST_RESULT.md 의 서술과 일치했다.

## Work Detail
- Files created/modified (Phase 3): `p-quaestor/lib/env.js`(신규), `p-quaestor/lib/config.js`,
  `p-quaestor/watch-loop.js`, `p-quaestor/watch-once.js`, `p-quaestor/lib/scrape.js`,
  `p-quaestor/test/env.test.js`(신규, 진리표 6종 + config 행동검증 + 구조단언 3종)
- Key changes: 환경변수 조회를 `QUAESTOR_<suffix>` 우선/`BELLOWS_<suffix>` 폴백으로 바꾸는
  단일 선택층(`envRaw()`)을 신설하고 9개 호출부를 그것으로 배선. 해석 로직(`envInt`/`envToken`/
  `|| 기본값`)은 한 글자도 바꾸지 않았다. Phase 1·2 의 폴더 이동·경계 검증 결과는 무회귀로 유지.

## Issues
없음.

## Good Points
- Phase 3 는 이 NNN 에서 유일하게 코드 동작을 건드리는 부분인데도, "새 이름이 없으면 조용히
  기본값으로 떨어져 차단기가 풀린다"는 구체적 사고 시나리오(work §4)를 정확히 겨냥해
  `undefined` 여부 판정 + `|| 기본값` 유지로 막았다. truthiness 로 골랐다면 조용히 깨졌을
  `envToken('')→null` 의미도 보존했다(E1 케이스까지 진리표로 명문화).
- `lib/env.js` 를 "이왕 만든 김에" 설정 로더로 확장하지 않고 순수 조회 함수 하나로 멈췄다 —
  설계 D10 의 자기 구속을 실제로 지켰다.
- 004 의 기존 `BELLOWS_CONTROL_PORT`/`TOKEN` 테스트를 **삭제하지 않고 그대로 통과**시켜
  폴백의 회귀 증거로 남긴 것이 검증으로서 가장 강하다.
- 검증 방법의 정직성 절 — `watch-loop.js`/`watch-once.js`/`scrape.js` 는 모듈 로드 시 1회
  평가라는 한계를 구조 단언으로만 확인하고, 그 한계를 산출물에 명시했다(간접 증거를
  직접 증거처럼 적지 않음).
- 빈 `p-bellows/` 디렉토리(살아있는 감시자 프로세스가 CWD 로 잠금)를 임의로 강제 삭제하거나
  프로세스를 죽이지 않고 USER_GATE 로 정직하게 넘겼다 — 안전장치에 대한 태도가 일관적이다.

## How to Run
```
node p-quaestor/test/run-all.js
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun
```
실기동(사람 확인, USER_GATE): `run-bellows.ps1` 실행 — Chrome 을 `--remote-debugging-port=9222` 로
띄운 뒤 루프가 돈다. `QUAESTOR_*` 환경변수를 주면 그 값이 우선 적용되고, 옛 `BELLOWS_*` 만
설정돼 있어도 그대로 쓰인다(동작 변경 없음). `p-quaestor/node_modules`(puppeteer)가 이미 저장소에
있어 별도 설치 불필요.

### 인수인계 (USER_GATE, 자동 테스트 대체 불가)
- Synology `products\Bellows\` 에 옛 `p-bellows\` 폴더가 남아 있는지 확인 후 정리
- 워크스페이스의 빈 `p-bellows/` 디렉토리: 감시자(PID 4260) 재기동 후 잠금 해제되면 `rmdir p-bellows`
- `run-bellows.ps1` 실기동 시 이전과 같은 실패 서명(로그인 만료)으로 뜨는지, `bellows.log` 의
  `[start] bellows watcher. interval=NNm config=...` 형식이 그대로인지 확인
- 런처의 `$env:BELLOWS_INTERVAL_MIN` 을 `QUAESTOR_` 로 언제 옮길지는 폴더 이동·Foreman 설정
  작업(다른 주인)에서 판단
- `work/MASTER.md` 의 `Smoke: node p-bellows/test/run-all.js` 는 낡은 줄이 됐다. MASTER.md 는
  불변이라 이 NNN 이 못 고친다 — 러너 설정 갱신은 사람 몫
