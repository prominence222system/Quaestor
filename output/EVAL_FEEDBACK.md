# EVAL_FEEDBACK — 015 Phase 3 Complete

## How to Run
이 Quaestor 015 기능은 다음 명령으로 로컬에서 실행하고 브라우저에서 확인할 수 있습니다.

1. 제품 실행:
```powershell
# 프로젝트 루트에서
.\run-quaestor.ps1
```
*(Chrome 전용 프로필 디버깅 포트 9222가 열린 상태에서 정상 작동합니다.)*

2. API 상태 확인:
- `http://127.0.0.1:4010/api/status` 에 접근해 JSON 응답 최상위에 `agy` 블록이 있고, `fields` 배열 끝에 `Gemini 주간 잔량`, `Gemini 5시간 잔량` 두 행이 추가된 것을 확인합니다.
- `http://127.0.0.1:4010/api/health` 에 접근해 `contracts["supervised-v1"]` 이 `"1.5.0"` 인지 확인합니다.

3. 상태 페이지 화면 확인:
- 브라우저에서 `http://127.0.0.1:4010/` 에 접속합니다.
- 상태 페이지 하단에 `Gemini` 구역이 렌더링되어 주간 잔량, 5시간 잔량 수치 및 마지막 측정 상태(한국어 표기)가 정상 노출되는 것을 확인합니다.
