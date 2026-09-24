feat: 상태 페이지에 파비콘과 머리글 로고 마크를 단다

사용자가 로고 시안 C(두 계기와 정지선)를 골랐고, 그 그림이 서야 할 표면 중
상태 페이지(GET /)의 탭 파비콘과 머리글이 아직 비어 있었다. 파비콘은
단독 SVG 문서라 xmlns 없이는 그려지지 않는데, 기존 테스트는 렌더된 HTML에
"http://" 문자열이 0개임을 단언하고 있어 두 요구가 충돌한다. base64 data URI로
실어 문자열 단언과 "외부 요청 0건"이라는 원래 취지를 동시에 지켰다.

로고 문자열은 lib/brand.js 한 곳에서만 나오게 하여(MARK_BODY가 원본,
ICON_SVG·MARK_INLINE·FAVICON_HREF는 그 파생), 상태 페이지·파비콘·Armory
카탈로그용 assets/icon.svg가 서로 갈라질 수 없게 했다. 감독 계약
(supervised-v1 1.5.0)과 /api/health·/api/status 응답은 이 라운드에서
건드리지 않는다 — 상태 페이지는 계약의 일부가 아니다.
