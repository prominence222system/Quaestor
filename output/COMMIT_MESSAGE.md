feat: /api/health 엔드포인트에 계약 버전(contracts) 노출

Agora 버전 관측기(Agora 021/022)가 구현 중인 계약 버전을 판별할 수 있도록 /api/health 응답 최상위에 contracts 객체({ "supervised-v1": "1.2.0" })를 추가했습니다.

소프트웨어 버전(package.json의 version: "0.1.0")과 계약 인터페이스 버전("1.2.0")은 완전히 독립적인 축이므로 두 축을 분리하여 함께 전달합니다. 이를 통해 Agora 관측기에서 발생하는 영구적인 drifted 경보를 원천 차단하고 기존 소비자인 Foreman의 하위 호환성을 100% 보존합니다.
