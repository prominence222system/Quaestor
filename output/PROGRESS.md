

===========================================
NNN: 003-observation-state-and-failure-classification
Started: 2026-08-19T04:35:13Z
===========================================

## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/observation.js` 순수 모듈 — 관측 구조체(`createObservation`/`recordSuccess`/`recordFailure`) + `deriveState()` 판정 + `fields` 구성 · `test/run-all.js` 하네스 | DONE |
| 2 | `lib/scrape.js` 실패 분류 — `err.kind` 부착 + `anchor-timeout` 진단 수집(`hint`: login-expired / anchor-missing / unknown) | DONE |
| 3 | `watch-loop.js` 배선 — 성공/실패 관측 갱신 · `kind`·`hint` 로그 · `require.main` 가드 · 모듈 로드 경계 검증 | DONE |

## 비고
- 모든 검증은 hermetic (Chrome·네트워크·claude.ai 없이 실행).
- Work Verify: `node p-bellows/test/run-all.js` — 🔒 `npm` 을 쓰지 않는다.
- 🔒 불변: STOP.json 의 위치·이름·스키마, `deriveDesired()` 임계 판정과 히스테리시스,
  수동 STOP(`source === 'manual'`) 우선 규칙.


===========================================
NNN: 004-control-http-contract
Started: 2026-08-19T05:10:46Z
===========================================

## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/control-server.js` 코어 — `127.0.0.1` 고정 리스너 · 라우팅 · `GET /api/health`(id=`quaestor`) · `GET /api/status`(`deriveState()` 투영, 부작용 0) · never-throw 기동 계약 | DONE |
| 2 | 인증 — `Authorization: Bearer` + `crypto.timingSafeEqual` 상수시간 비교 · `config.js` 의 `control`(port·authToken) 블록 · 비밀 미유출 · `POST /api/stop` 의도적 미구현 명문화 | PENDING |
| 3 | `watch-loop.js` 배선(never-brick — 기동 실패해도 루프 계속) + `test/control-server.test.js` 실포트 통합 검증 | PENDING |

## 비고
- 모든 검증은 hermetic (Chrome·claude.ai·Foreman 없이 실행). 🔒 실제 포트를 열고 실제 요청을 보낸다.
- Work Verify: `node p-bellows/test/run-all.js` — 🔒 `npm` 을 쓰지 않는다.
- 🔒 불변: STOP.json 의 위치·이름·스키마, `deriveDesired()` 임계 판정과 히스테리시스,
  수동 STOP 우선 규칙, `lib/observation.js` 본문(이 NNN 은 소비자일 뿐이다).
- 🔒 `/api/health` 의 `ok`(HTTP 생존) ≠ `/api/status` 의 `state`(측정 건강) — 합치지 않는다.
- 🔒 `POST /api/stop` 은 계약상 선택 조항이며 **의도적으로 구현하지 않는다**(안전장치를 확인 없이
  끌 수 있으면 안 된다). 이 결정은 코드 주석과 `PROJECT_INTENT.md` 에 남긴다.
- `deploy.json` 갱신은 이 NNN 의 범위 밖(데이터 파일 — 사람이 직접 쓴다).
- ⚠️ 이 NNN 이 끝나도 화면에는 변화가 없다(Foreman 클라이언트 미구현). 실패가 아니다.
