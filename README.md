# ALSOS

> ἄλσος — grove, sacred grove.

사이버보안 학습 생태계. 학습이 XP가 되고, XP가 나무의 성장으로 남고, 성장이 개인의 숲으로 축적됩니다.

---

## 실행

```bash
npm install
npm run assets:hero   # 히어로 아트 생성 (최초 1회, 약 3분)
npm run dev
```

`public/assets/hero`의 결과물은 저장소에 포함되어 있으므로, 아트를 수정하지 않는 한
`assets:hero`를 다시 실행할 필요는 없습니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run typecheck` | TypeScript strict 검사 |
| `npm test` | 유닛 테스트 (Vitest) |
| `npm run test:e2e` | 브라우저 테스트 (Playwright, 8개 해상도) |
| `npm run assets:hero` | 히어로 아트·마스크·트리 스켈레톤 재생성 |

---

## 구조

```
scripts/               히어로 아트 생성 파이프라인 (빌드 타임 전용)
  lib/rng.mjs          시드 기반 난수 · 밸류 노이즈 · fbm
  lib/tree.mjs         L-system 나무 골격 + 경로 거리(aBirth) 베이킹
  lib/raster.mjs       float 래스터 · 캡슐 · 스플랫 · 디더 · 인코딩
  lib/hand.mjs         손 실루엣
src/
  app/(marketing)/     홈페이지 — 시각 강도 9/10
  app/dashboard/       대시보드 — 4/10
  app/roadmap/         로드맵 — 5/10
  app/labs/            Lab — 1/10
  app/garden/          정원 — 7/10
  app/profile/         프로필 — 5/10
  components/hero/     3개 레이어 (포스터 / WebGL / DOM)
  lib/growth/          성장 모델 + 결정적 시각화
  lib/webgl/           셰이더 · 성능 티어 · 포인트 클라우드
  styles/tokens.css    디자인 토큰 단일 원본
art/                   마스크·뎁스맵 (git 제외, 재생성 가능)
```

---

## 히어로 렌더링

지시서 §9의 3레이어 구조를 그대로 따릅니다.

| 레이어 | 내용 | 실패 시 |
| --- | --- | --- |
| 1. `HeroPoster` | 정적 아트 (AVIF/WebP, LCP 대상) | — |
| 2. `HeroScene` | 투명 WebGL 포인트 클라우드 | 렌더 안 함 |
| 3. DOM | 로고·내비·헤드라인·CTA·지표·마이크로카피 | — |

**레이어 2는 언제든 사라져도 됩니다.** WebGL 미지원, 스켈레톤 fetch 실패, `prefers-reduced-motion`,
저성능 기기 — 모든 경로가 "아무것도 렌더링하지 않음"으로 끝나고 포스터가 그대로 완성된 히어로로 남습니다.

### 아트 파이프라인

레퍼런스 수준의 밀도를 위해 **포스터와 파티클이 같은 나무 골격에서 생성됩니다.**

```
seed ──> L-system 골격 ──┬──> 포스터 합성 (Node, sharp) ──> AVIF/WebP × 4 해상도 × 3 비율
                         └──> tree-skeleton.json (63KB gz) ──> 브라우저에서 포인트 클라우드로 확장
```

베이크된 포인트 클라우드 대신 골격을 전송하기 때문에, 하나의 작은 에셋이 모든 성능 티어를
커버하고 캔버스가 교차 표시될 때 포스터와 어긋나지 않습니다.

`manifest.json`이 두 레이어 사이의 계약입니다. 손으로 그린 아트로 교체할 때는
**동일한 형태의 manifest를 만들면 되고, 컴포넌트는 수정하지 않습니다.**

### 성장 애니메이션

마스크 와이프가 아니라 실제 가지 경로를 따라 자랍니다 (§10.1).

각 입자는 뿌리로부터 **나무를 따라 잰 거리**를 `aBirth`(0–1)로 가지고 있고,
셰이더가 이를 `uGrowth`와 비교해 성장 전선을 만듭니다.

```glsl
float reveal = smoothstep(aBirth - 0.035, aBirth + 0.035, uGrowth);
```

### 성능

입자 수는 기기 이름이 아니라 **실측 프레임 시간**으로 조정됩니다. 포인트 클라우드는
셔플되어 있어서 앞에서 N개만 그려도 전체 나무의 균일한 표본이 되고, 따라서 품질 조절이
`setDrawRange` 호출 하나로 끝납니다 (버퍼 재생성 없음).

| 항목 | 예산 | 실측 |
| --- | --- | --- |
| 초기 라우트 JS | 180KB gz 이하 | 110KB (WebGL 청크 제외) |
| 히어로 포스터 | 350–500KB | 1440px 기준 ~55KB (AVIF) |
| Canvas DPR | 최대 1.5 | 1.5 |
| 드로우 콜 | 1 | 1 |

---

## 데이터에 관한 원칙

지시서 §3.2에 따라 **가짜 지표를 쓰지 않습니다.**

- 홈페이지의 숫자(학습 경로 07, 성장 단계 06)는 `src/lib/content/curriculum.ts`를
  실제로 센 값입니다. 학습자 수, 성공률, 파트너 로고는 실제 데이터가 생기기 전까지 없습니다.
- 제품 화면의 샘플 상태는 `src/lib/content/sample-learner.ts` 한 곳에 모여 있고,
  화면에도 샘플이라고 표시됩니다.
- XP·해금 판정은 서버 권한입니다. `visualSeed`는 사용자 ID가 아닌 서버 발급 식별값입니다.

---

## 접근성

- 모든 텍스트·링크·상태는 DOM에 존재합니다. Canvas는 `aria-hidden="true"` 장식입니다.
- 로드맵은 뿌리 다이어그램과 **접근 가능한 계층형 목록**을 동시에 제공합니다.
  Canvas 전용 내비게이션은 없습니다.
- 상태는 색상만으로 구분하지 않습니다 — 아이콘 + 텍스트 + 선 패턴을 함께 씁니다.
- `prefers-reduced-motion: reduce`에서 나무는 최종 성장 상태로 정지합니다.
- 포커스 링을 제거하지 않으며, 인터랙션 타깃은 최소 44×44px입니다.

---

## 테스트

```bash
npm test        # 성장 모델 결정성, 포인트 클라우드 표본 균일성
npm run test:e2e
```

E2E는 §18의 8개 해상도(1920×1080 → 360×800)에서 전부 실행되며,
가로 스크롤 없음 · 랜드마크 · 스킵 링크 · 리듀스드 모션 · **WebGL 차단 시 히어로 완결성**을 검증합니다.

시각 회귀는 결정적 모드에서 캡처합니다:

```
?visualTest=1   시간·성장·포인터 고정
?seed=42        구조 고정
?motion=0       리듀스드 모션 강제
```

---

## 보안

외부 CDN 스크립트 없음. 폰트·에셋 전부 자체 호스팅. nonce 기반 CSP를
`src/middleware.ts`에서 적용하며 `script-src`에 외부 오리진이 없습니다.

---

## 알려진 범위

- **Lab / Garden은 화면 구성만** 제공합니다. 터미널 실행 환경과 정원 배치 편집기는
  연결되어 있지 않으며, 동작하지 않는 컨트롤은 비활성 상태로 표시됩니다.
- 히어로 아트는 시드 기반으로 **절차적 생성**됩니다. §13의 회화 에셋으로 교체할 때는
  manifest 계약만 맞추면 됩니다.
- 디스플레이 서체는 커스텀 "ALSOS Grid"가 제작되기 전까지 Silkscreen을 대역으로 씁니다.
  워드마크는 서체가 아니라 12×12 모듈 그리드 위의 SVG 패스입니다.
