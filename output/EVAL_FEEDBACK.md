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
- Issues found: 없음 (아래 재검증 참고)

### 실측 재검증 (독립 검증, 이번 라운드)

TEST_RESULT.md 의 서술을 신뢰하지 않고 직접 재실행했다.

| 확인 | 명령/방법 | 결과 |
|---|---|---|
| 소스 대조 | `lib/env.js` 전문 열람 | 의존 0, `parseInt`/`trim`/캐시 없음, `!== undefined` 판정만 사용(truthiness 아님), 임계값·포트 리터럴 없음 |
| 소스 대조 | `lib/config.js` 전문 열람 | `envInt`/`envToken` 첫 줄만 `envRaw()` 경유, `''→null`/`NaN→fallback` 해석 로직 그대로, `readConfig()` never-throw 구조 그대로 |
| 배선 | `grep -n envRaw` in watch-loop.js/watch-once.js/lib/scrape.js | 3곳 모두 `envRaw('X') || 기본값` 형태, `??` 로 안 바뀜 |
| 직접 참조 잔재 | `grep -rn "process\.env\.BELLOWS_"` (test 제외) | **0건** |
| 이름 잔재 | `git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"` | **0건** |
| 패키지 이름 | `grep '"name"'` package.json/package-lock.json | 셋 다 `prominence-quaestor` 로 일치 |
| ps1 경로 | `grep -n "p-quaestor|p-bellows|BELLOWS_INTERVAL_MIN"` run-bellows.ps1/deploy-bellows.ps1 | `$ToolDir`·`$srcTool`·`$dstTool` → `p-quaestor`; `$env:BELLOWS_INTERVAL_MIN` 은 D11 대로 그대로 유지 |
| 전체 테스트 | `node p-quaestor/test/run-all.js` (직접 재실행) | **exit 0 · tests 176 · pass 176 · fail 0** |
| git 이력 | `git log --oneline --follow -- p-quaestor/watch-loop.js` | `fa38d14`(006 implement) → `58fc98d`(005 test) → `4ee7e75`(004) → `68bce28`(003) → 최초 커밋까지 이어짐 — `git mv` 이력 보존 실증 |
| 작업 트리 | `git status --porcelain -M` | `.p-forge/` 외 변경 없음(untracked, forge 자체 산출물) — Phase 1~3 결과가 이미 커밋됨 |
| ACCEPTANCE 무결성 | `output/ACCEPTANCE.md` 의 "006 Phase 1/2/3" 세 절 | 전량 존재, [SPEC] 항목이 `TEST_RESULT.md` 의 각 Phase 대조표와 1:1 대응, 삭제·완화 없음 |

전부 ACCEPTANCE.md · TEST_RESULT.md 의 서술과 일치했다. `output/PROGRESS.md` 는 이미 3개
Phase 모두 `DONE` 으로 표기돼 있어 이번 eval 에서 갱신할 것이 없다.

### ⚠️ 알려진 harness 충돌 (이 NNN 의 결함이 아님 — 재확인)

이전 라운드에서 forge 의 **Smoke Override** 가 `work/MASTER.md ## Work Verify` 에 박힌
`node p-bellows/test/run-all.js` 를 실행해 `exit 1`(옛 경로가 더 이상 존재하지 않음)을 이유로
verdict 를 강제로 `FIX` 로 뒤집었다. 이는 006 자체의 목적(`p-bellows` → `p-quaestor` 개명)과
정면으로 충돌하는 구조적 딜레마다:

- `p-bellows/` 를 되살리면 Phase 1 [SPEC]("`p-bellows/` 디렉토리는 존재하지 않는다")을 위반한다
- `work/MASTER.md` 를 고치면 forge 규칙("work/ 는 수정 금지")과 work 파일 자체("MASTER.md 는
  절대 불변")를 동시 위반한다

즉 006 이 코드로 이 smoke 실패를 "고칠" 방법 자체가 acceptance 기준과 상충해 존재하지 않는다.
직전 fix 라운드는 이를 정확히 진단하고 **소스 변경 없이** 결과를 그대로 재확인했다
(`git show cc7c764 --stat` 이 산출물 문서 외 변경이 없음을 보여준다). 이번 라운드도 동일하게
소스는 무변경이었고, 재실행으로 위 표 전체를 독립 재확인했다. 콘텐츠 기준으로는 결함이 없으며,
이 harness 충돌은 forge 러너 설정(`work/MASTER.md` 의 Work Verify 갱신)을 사람이 처리해야
풀리는 문제다 — 코드 수정으로 풀 수 없는 종류라고 판단해 PASS 를 유지한다.

## Work Detail
- Files created/modified (Phase 3, 이미 커밋 `fa38d14`): `p-quaestor/lib/env.js`(신규),
  `p-quaestor/lib/config.js`, `p-quaestor/watch-loop.js`, `p-quaestor/watch-once.js`,
  `p-quaestor/lib/scrape.js`, `p-quaestor/test/env.test.js`(신규, 진리표 6종 + config
  행동검증 + 구조단언 3종)
- Key changes: 환경변수 조회를 `QUAESTOR_<suffix>` 우선/`BELLOWS_<suffix>` 폴백으로 바꾸는
  단일 선택층(`envRaw()`)을 신설하고 9개 호출부를 그것으로 배선. 해석 로직(`envInt`/`envToken`/
  `|| 기본값`)은 한 글자도 바꾸지 않았다. Phase 1·2 의 폴더 이동(`git mv`)·경계 검증(PS 5.1
  파싱·경로 실존) 결과는 무회귀로 유지.

## Issues
없음. 알려진 harness 충돌(위 "⚠️" 절)은 코드 결함이 아니라 러너 설정 문제로 분류했다.

## Good Points
- Phase 3 는 이 NNN 에서 유일하게 코드 동작을 건드리는 부분인데도, "새 이름이 없으면 조용히
  기본값으로 떨어져 차단기가 풀린다"는 구체적 사고 시나리오(work §4)를 정확히 겨냥해
  `undefined` 여부 판정 + `|| 기본값` 유지로 막았다. truthiness 로 골랐다면 조용히 깨졌을
  `envToken('')→null` 의미도 보존했다(E1 케이스까지 진리표로 명문화).
- `lib/env.js` 를 "이왕 만든 김에" 설정 로더로 확장하지 않고 순수 조회 함수 하나로 멈췄다 —
  설계 D10 의 자기 구속을 실제로 지켰다.
- 004 의 기존 `BELLOWS_CONTROL_PORT`/`TOKEN` 테스트를 **삭제하지 않고 그대로 통과**시켜
  폴백의 회귀 증거로 남긴 것이 검증으로서 가장 강하다.
- `git mv` 가 최상위 디렉토리 rename 에서 살아있는 감시자 프로세스(PID 4260, CWD 잠금)에
  막히자, 프로세스를 강제 종료하지 않고 항목별 `git mv` 로 우회해 이력을 동일하게 보존했다 —
  안전장치에 대한 태도가 일관적이다.
- 스모크 오버라이드 충돌을 임의로 우회(옛 경로 되살리기, MASTER.md 수정)하지 않고 왜 코드로
  고칠 수 없는지 근거와 함께 정직하게 문서화했다.

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
  불변이라 이 NNN 이 못 고친다 — **러너(forge Smoke Override) 설정 갱신을 사람이 처리해야
  이후 라운드에서 이 충돌이 재발하지 않는다**
