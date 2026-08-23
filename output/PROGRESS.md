## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `git mv p-bellows p-quaestor` + 패키지 이름(`prominence-quaestor`) + 저장소 내 `p-bellows` 문자열 전수 갱신(ps1 경로 참조 포함) | DONE |
| 2 | 경계 검증 — PS 5.1 파싱 0 errors · `deploy-bellows.ps1 -DryRun` · `run-bellows.ps1` 참조 경로의 파일시스템 실존 확인 | CURRENT |
| 3 | 환경변수 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백(의미 불변) + hermetic 3케이스 검증 | PENDING |

## Phase 1 완료 기록 (2026-08-23)

- `node p-quaestor/test/run-all.js` → **exit 0 · tests 146 · pass 146 · fail 0** ([SPEC] 146 이상 충족)
- 005 의 26일 침묵 fixture 가 `crit` 으로 계속 통과 — 로그 형식 불변의 기계적 증거
- 소스 트리 `p-bellows` 문자열 **0건** (D5 범위)
- `git diff --cached -M --summary` 가 17개 파일 전부를 **rename … (100%)** 로 인식 — 이력 보존(D1)
- `package.json` · `package-lock.json` 루트/`packages[""]` 모두 `prominence-quaestor` 로 일치
- `run-bellows.ps1` · `deploy-bellows.ps1` **파일명 유지**, PS 5.1 파싱 **0 errors**
- 내용 변경은 이름 문자열 7줄 + edit-gate 훅이 요구한 ASCII 치환 1줄뿐. 로직 변경 0건

### ⚠️ 이월 사항 — 빈 `p-bellows/` 디렉토리

실행 중인 감시자(**PID 4260**, `node watch-loop.js`, 2026-08-19 기동)의 **CWD 가 `p-bellows`** 라
Windows 가 최상위 디렉토리의 rename·삭제를 거부한다(`Device or resource busy`).
그래서 디렉토리 통째 rename 대신 **항목별 `git mv`** 로 옮겼고, 결과·이력은 동등하다.
남은 것은 내용물 0개인 빈 껍데기이며, git 은 빈 디렉토리를 추적하지 않으므로 커밋에 영향이 없다.
🔒 살아 있는 차단기 프로세스는 사용자 승인 없이 종료하지 않았다.
→ 감시자 재기동 시 잠금 해제 후 `rmdir p-bellows`. 상세는 TEST_RESULT.md 의 USER_GATE 참고.
