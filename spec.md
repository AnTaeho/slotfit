# SlotFit 기획서

> **Claude Code에게**: 이 문서 하나가 이 프로젝트의 전부다.
> 모든 작업 전에 이 문서를 먼저 읽고 "0. 작업 규칙"을 따른다.
> Step을 마칠 때마다 다음 세 곳을 갱신한다.
> - 문서 맨 아래 "부록 A. 실패 카탈로그"
> - "부록 B. 결정 로그"
> - "부록 C. 진행 상황"

---

## 0. 작업 규칙 (Claude Code)

### 진행 방식
- **속도 우선.** 한 Step을 한 번에 크게 구현한다. 세부 구현은 합리적으로 정하고, 가정은 코드 주석에 남긴다.
- **정책 판단은 사용자에게.** 다음 항목은 선택지 2~3개와 트레이드오프만 짧게 제시하고, 사용자가 고른다.
  - cost 가중치
  - 실패/거절 기준, severity
  - fallback 순서
  - 그 밖에 "결정 필요"로 표시된 항목

  결정은 부록 B에 기록한다.
- **새 알고리즘을 도입할 때**는 코드를 쓰기 전에 5문장 이내로, 비유를 들어 설명한다. 알고리즘을 처음 보는 사람도 따라올 수 있게 쓴다.

### Step 완료 시 보고 형식
1. 바뀐 파일 목록. **[핵심]** / [보조]로 표시
2. 사용자가 꼭 읽어야 할 함수 3개 이내 (읽는 순서대로)
3. 예상 질문 1개

### 코드 규칙
- TypeScript strict, `any` 금지
- 핵심 로직(matcher, scoring, validation, fallback)은 순수 함수로 만들고 입력을 변경하지 않는다. 파일 I/O는 `io/`, `scripts/`, `bench/`에만 둔다.
- 매직 넘버는 `src/scoring/weights.ts`에만 두고, 결정 로그 ID를 주석으로 단다. (예: `// D-3`)
- 모든 matcher는 같은 `Matcher` 인터페이스를 따른다.
- 미구현 함수에는 `// TODO(Step N): 할 일`과 알고리즘 개요를 3줄 이내로 적는다.
- 파일 상단에 역할을 한 줄 주석으로 적는다.
- 의존성은 typescript, tsx, vitest, fast-check, zod만 쓴다(타입 전용 `@types/node`는 예외, D-2). 추가가 필요하면 먼저 묻는다.
- 핵심 알고리즘(Hungarian 등)은 라이브러리 없이 직접 구현한다.

---

## 1. 개요

### 한 줄 정의
구조가 다른 콘텐츠를 디자인 템플릿의 빈칸(slot)에 배치하고, 결과를 써도 되는지 판정하는 TypeScript 엔진.

### 배경
AI가 콘텐츠(예: 포스터 문구)를 생성한 뒤에는 세 가지 판단이 필요하다.
- **matching**: 무엇을 어디에 넣을지
- **validation**: 규칙을 지키는지
- **fallback**: 안 지키면 어떻게 대응할지

이 프로젝트는 이 판단을 계산 가능한 구조로 만든다.

### 목적
포트폴리오 프로젝트. 기능의 양보다 **"왜 이 방식이 이전 방식보다 나은가"를 실패 사례와 수치로 보여주는 것**이 목적이다.

### 핵심 스토리 (포기하지 않는 것)
```
greedy → 실패 분류 → Hungarian(점수 최적 배치) → 그래도 남는 구조적 실패(카드 섞임)
→ 계층 매칭 → validation/fallback로 "거절"까지 판단
```

### 포기하는 것
- 예쁜 UI. SVG는 박스와 텍스트만 그린다.
- 정확한 폰트 측정. 글자 종류별 근사로 대신한다.
- 많은 fixture. 템플릿 8개, 콘텐츠 8개면 충분하다.
- 세밀한 테스트 커버리지. invariant 테스트와 oracle 비교 테스트 두 종류만 둔다.
- 설정, 로깅, 에러 처리의 완성도.

### 용어
| 용어 | 뜻 | 비유 |
|---|---|---|
| Template | 빈칸이 있는 디자인 양식. 중첩 JSON(tree) | API 응답 JSON |
| Slot | 템플릿 안의 채울 수 있는 빈칸 | 자리 |
| Group | 함께 움직여야 하는 슬롯 묶음 (카드 한 장) | 반 |
| Cost | 콘텐츠를 특정 슬롯에 넣었을 때의 나쁨 점수 | 궁합의 반대 |
| Assignment problem | 전체 cost 합이 최소가 되게 짝짓는 문제 | 회식 자리 배치 |
| Dummy | 개수 불일치를 표현하는 가짜 슬롯/콘텐츠. dummy와 짝 = 버림/비움 | NULL |
| Oracle | 느리지만 확실히 정답인 기준 구현 (brute force) | 테스트 기준값 |
| Invariant | 어떤 입력이든 항상 참이어야 하는 성질 | DB 제약조건 |
| Fallback | 규칙 위반 시 단계적 대응 | 에러 처리 / 재시도 |

---

## 2. 일정 (1주)

| 기간 | Step | 내용 |
|---|---|---|
| Day 1 오전 | Step 0 | 뼈대: 타입, 계약, greedy end-to-end |
| Day 1 오후 | Step 1 | fixture 확장, golden, bench 지표 완성 |
| Day 2 | Step 2 | 실패 분류 + cost + Hungarian + oracle |
| Day 3–4 | Step 3 ⭐ | 계층 매칭 |
| Day 5 | Step 4 | validation + invariant + fallback + 최종 판정 |
| Day 6–7 | Step 5 | 평가, README, 설명 리허설 |

---

## 3. 아키텍처

### 3.1 데이터 흐름
```
fixtures/templates/*.json ─┐
                           ├─▶ loader (zod 검증) ─▶ buildContext
fixtures/contents/*.json ──┘                            │
                                                        ▼
                                    Matcher.match(ctx) → MatchResult
                                    (greedy | bruteForce | hungarian | hierarchical)
                                                        │
                                                        ▼
                                    validate(ctx, result, adj) → Violation[]
                                                        │
                                  위반 있음 → fallback 단계 → 다시 validate (최대 N회)
                                                        │
                                                        ▼
                    PipelineResult { status, assignment, dropped, adjustments, violations, trace }
                                                        │
                                   ┌────────────────────┴────────────────────┐
                                   ▼                                         ▼
                             render → out/*.svg                 bench → bench/results/*.md
```

### 3.2 디렉터리 구조
```
slotfit/
├─ spec.md                    # 이 문서
├─ CLAUDE.md                  # 작업 지침 (브랜치·커밋·결정 규칙)
├─ docs/handoff.md            # 이어받는 세션용 지시서
├─ README.md                  # Step 5에서 작성
├─ package.json / tsconfig.json / vitest.config.ts
├─ src/
│  ├─ schema/                 # zod 스키마 + 타입
│  │  ├─ template.ts
│  │  ├─ content.ts
│  │  ├─ result.ts
│  │  └─ index.ts
│  ├─ io/loader.ts            # fixture 로드 + 검증
│  ├─ tree/traverse.ts        # 슬롯/그룹 수집
│  ├─ context.ts              # buildContext
│  ├─ text/measure.ts         # 텍스트 줄 수 근사
│  ├─ scoring/
│  │  ├─ weights.ts           # 모든 가중치/임계값
│  │  └─ cost.ts
│  ├─ matchers/
│  │  ├─ types.ts
│  │  ├─ greedy.ts            # Step 0
│  │  ├─ bruteForce.ts        # Step 2
│  │  ├─ hungarian.ts         # Step 2
│  │  ├─ hierarchical.ts      # Step 3
│  │  └─ index.ts             # 이름 → matcher 레지스트리
│  ├─ validation/
│  │  ├─ types.ts
│  │  ├─ validate.ts
│  │  └─ rules/
│  │     ├─ overflow.ts       # Step 0
│  │     ├─ titleMissing.ts   # Step 4
│  │     ├─ priorityDropped.ts # Step 4
│  │     ├─ groupSplit.ts     # Step 3
│  │     └─ roleMismatch.ts   # Step 4
│  ├─ fallback/
│  │  ├─ types.ts
│  │  ├─ policy.ts
│  │  └─ steps/               # Step 4: shrinkFont, dropLowPriority
│  ├─ pipeline.ts
│  └─ render/svg.ts
├─ scripts/render.ts          # CLI
├─ bench/
│  ├─ evaluate.ts
│  └─ results/
├─ fixtures/
│  ├─ templates/
│  ├─ contents/
│  └─ golden/
├─ out/                       # .gitignore
└─ tests/
   ├─ smoke.test.ts
   ├─ schema.test.ts
   ├─ invariants.test.ts
   ├─ oracle.test.ts          # Step 2
   └─ arbitraries.ts          # fast-check 랜덤 입력 생성기
```

### 3.3 타입 정의
```ts
// ---------- template ----------
export type Box = { x: number; y: number; w: number; h: number };
export type Role = 'title' | 'subtitle' | 'body' | 'caption' | 'image';

export type FrameNode = { id: string; type: 'frame'; box: Box; children: TemplateNode[] };
export type GroupNode = { id: string; type: 'group'; box: Box; children: TemplateNode[] };
export type TextSlot = {
  id: string; type: 'text'; role: Exclude<Role, 'image'>; box: Box;
  fontSize: number; minFontSize: number; maxLines: number;
};
export type ImageSlot = { id: string; type: 'image'; role: 'image'; box: Box };
export type TemplateNode = FrameNode | GroupNode | TextSlot | ImageSlot;
export type Slot = TextSlot | ImageSlot;

export type Template = { id: string; description: string; root: FrameNode };

// ---------- content ----------
export type ContentItem = {
  id: string;
  kind: 'text' | 'image';
  roleHint?: Role;
  text?: string;          // kind === 'text'이면 필수
  groupId?: string;       // 같은 카드에 속해야 하는 항목
  priority: 1 | 2 | 3;    // 1 = 절대 버리면 안 됨
};
export type Content = { id: string; description: string; items: ContentItem[] }; // 배열 순서 = 들어온 순서

// ---------- result ----------
export type Assignment = { slotId: string; contentId: string | null }[];
export type MatchResult = {
  assignment: Assignment;   // 모든 슬롯이 정확히 한 번 등장
  dropped: string[];
  totalCost: number;
};
export type Severity = 'error' | 'warn';
export type Violation = {
  ruleId: string; severity: Severity; slotId?: string; contentId?: string; detail: string;
};
export type Adjustments = { fontSize: Record<string, number> }; // fallback이 조정하는 렌더 상태
export type Status = 'accepted' | 'degraded' | 'rejected';
export type PipelineResult = {
  status: Status; matcher: string;
  assignment: Assignment; dropped: string[]; adjustments: Adjustments;
  violations: Violation[]; trace: string[];
};

// ---------- context ----------
export type MatchContext = {
  template: Template; content: Content;
  slots: Slot[];                               // DFS 순서
  slotGroup: Record<string, string | null>;    // slotId → GroupNode id
  itemsById: Record<string, ContentItem>;
};
```

### 3.4 모듈 계약
| 모듈 | 시그니처 | 역할 |
|---|---|---|
| tree/traverse | `collectSlots(root): Slot[]` | DFS 순서 슬롯 |
| | `collectGroups(root): GroupNode[]` | 그룹 노드 |
| | `slotGroupMap(root)` | 슬롯 → 소속 그룹 |
| context | `buildContext(t, c): MatchContext` | 한 번 계산해 재사용 |
| text/measure | `measureLines(text, fontSize, width): number` | 근사 줄 수 |
| | `fits(text, slot, fontSize): boolean` | 줄 수 ≤ maxLines이고 높이 ≤ box.h |
| scoring/cost | `cost(item, slot, ctx): number` | 짝의 나쁨 점수 |
| | `DUMMY_SLOT_COST(item)` / `DUMMY_ITEM_COST(slot)` | 버림/비움 비용 |
| matchers | `Matcher = { name; match(ctx): MatchResult }` | 배치 알고리즘 |
| validation | `Rule = { id; severity; check(ctx, r, adj): Violation[] }` | 규칙 1개 |
| | `validate(ctx, r, adj, rules?)` | 전체 검사 |
| fallback | `FallbackStep = { id; applies(v); apply(ctx, r, adj) → { r, adj, note } }` | 대응 1단계 |
| | `POLICY: FallbackStep[]`, `MAX_ITERATIONS = 5` | 순서와 반복 제어 |
| pipeline | `run(t, c, matcher): PipelineResult` | 전체 실행 |
| render | `renderSvg(ctx, result): string` | 시각화 |

**텍스트 근사 규칙**
- 문자 너비: 한글 1.0em, 영문/숫자 0.55em, 공백 0.3em
- 줄 높이: fontSize × 1.4
- 실제 폰트와 다르다는 점을 README에 명시한다.

**pipeline status 판정** (초안. Step 4에서 확정)
- error 0개 & warn 0개 → `accepted`
- error 0개 & warn 있음 → `degraded`
- error 남음 → `rejected`

**render 색**
- error = 빨강, warn = 주황, 정상 = 초록, 빈 슬롯 = 회색 점선
- 그룹은 점선 테두리
- 하단에 status와 matcher 이름 표시

### 3.5 bench 지표
결과는 `bench/results/YYYYMMDD-HHmm.md`에 저장한다. 미구현 matcher는 "-"로 표시한다.

| 지표 | 정의 |
|---|---|
| goldenMatch | golden이 있는 쌍에서 정답과 일치하는 슬롯 비율 |
| errors / warns | 최종 위반 수 |
| p1Dropped | priority-1 유실 수 |
| groupSplit | 그룹 찢어짐 수 |
| status | accepted / degraded / rejected 개수 |
| ms | 평균 실행 시간 |

### 3.6 스크립트
| 명령 | 동작 |
|---|---|
| `pnpm test` | vitest |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm bench` | 모든 template × content × matcher 실행 → 표 |
| `pnpm render <templateId> <contentId> <matcher>` | `out/<t>__<c>__<m>.svg` 생성 |

실행기는 `tsx`를 사용한다.

### 3.7 Fixture 형식

**fixtures/templates/t01-sale-cards.json**
```json
{
  "id": "t01-sale-cards",
  "description": "제목 + 카드 2장(소제목/설명). 그룹 찢어짐 테스트용",
  "root": {
    "id": "root", "type": "frame", "box": { "x": 0, "y": 0, "w": 600, "h": 400 },
    "children": [
      { "id": "title", "type": "text", "role": "title",
        "box": { "x": 40, "y": 30, "w": 520, "h": 60 }, "fontSize": 32, "minFontSize": 22, "maxLines": 1 },
      { "id": "cardA", "type": "group", "box": { "x": 40, "y": 120, "w": 250, "h": 240 }, "children": [
        { "id": "cardA-sub", "type": "text", "role": "subtitle",
          "box": { "x": 56, "y": 136, "w": 218, "h": 40 }, "fontSize": 20, "minFontSize": 16, "maxLines": 1 },
        { "id": "cardA-body", "type": "text", "role": "body",
          "box": { "x": 56, "y": 186, "w": 218, "h": 150 }, "fontSize": 16, "minFontSize": 12, "maxLines": 4 }
      ]},
      { "id": "cardB", "type": "group", "box": { "x": 310, "y": 120, "w": 250, "h": 240 }, "children": [
        { "id": "cardB-sub", "type": "text", "role": "subtitle",
          "box": { "x": 326, "y": 136, "w": 218, "h": 40 }, "fontSize": 20, "minFontSize": 16, "maxLines": 1 },
        { "id": "cardB-body", "type": "text", "role": "body",
          "box": { "x": 326, "y": 186, "w": 218, "h": 150 }, "fontSize": 16, "minFontSize": 12, "maxLines": 4 }
      ]}
    ]
  }
}
```

**fixtures/contents/c01-summer-sale.json**
```json
{
  "id": "c01-summer-sale",
  "description": "순서가 뒤섞인 카드형 콘텐츠",
  "items": [
    { "id": "c1-sub",  "kind": "text", "roleHint": "subtitle", "text": "무료배송", "groupId": "g1", "priority": 2 },
    { "id": "c1-body", "kind": "text", "roleHint": "body", "text": "3만원 이상 구매 시 전국 무료배송", "groupId": "g1", "priority": 2 },
    { "id": "title",   "kind": "text", "roleHint": "title", "text": "여름 세일", "priority": 1 },
    { "id": "c2-sub",  "kind": "text", "roleHint": "subtitle", "text": "할인", "groupId": "g2", "priority": 2 },
    { "id": "c2-body", "kind": "text", "roleHint": "body", "text": "전 품목 20% 할인", "groupId": "g2", "priority": 2 }
  ]
}
```

**fixtures/golden/t01-sale-cards__c01-summer-sale.json**
```json
{
  "templateId": "t01-sale-cards",
  "contentId": "c01-summer-sale",
  "assignment": [
    { "slotId": "title", "contentId": "title" },
    { "slotId": "cardA-sub", "contentId": "c1-sub" },
    { "slotId": "cardA-body", "contentId": "c1-body" },
    { "slotId": "cardB-sub", "contentId": "c2-sub" },
    { "slotId": "cardB-body", "contentId": "c2-body" }
  ],
  "note": "카드 A/B 순서는 바뀌어도 정답으로 인정할지 결정 필요"
}
```

---

## 4. Step별 실행 계획

> 🙋 표시는 **사용자가 직접 해야 하는 판단**이다. Claude Code는 이 부분을 대신 정하지 않는다.

### Step 0. 뼈대 (Day 1 오전)

**목표**: 모든 모듈의 자리와 계약을 확정하고, greedy 하나는 end-to-end로 돌아가게 한다.

**구현 범위**
- 셋업 + 3장의 전체 구조와 타입
- 끝까지 구현할 것: loader, traverse, context, measure, greedy, overflow 규칙, validate, pipeline, render, bench, render 스크립트
- 빈 상태로 둘 것
  - `cost.ts`: kind 불일치 = Infinity, 나머지 = 0인 placeholder
  - 나머지 matcher: `throw new Error('TODO: Step N')`
  - 나머지 규칙: `[]` 반환
  - `POLICY`: 빈 배열
- fixture: 3.7의 t01/c01/golden + "본문 과다" 상황의 템플릿/콘텐츠 1쌍
- greedy 동작: 슬롯을 DFS 순서로 돌며, 같은 kind의 아직 안 쓴 첫 콘텐츠를 넣는다.

**테스트**
- smoke
  - t01 × c01 × greedy가 PipelineResult를 반환한다.
  - title 슬롯에 "무료배송"이 들어간다. (의도된 실패를 고정해두는 테스트)
- schema
  - 모든 fixture가 zod 검증을 통과한다.
  - text 콘텐츠에 text 필드가 없으면 실패한다.
- invariants (레지스트리의 구현된 matcher 전체 대상, TODO matcher는 skip)
  - 모든 슬롯이 assignment에 정확히 1번 등장
  - 한 contentId는 최대 1번 배치
  - kind 일치 (text↔text, image↔image)
  - 배치된 콘텐츠 + dropped = 전체 콘텐츠

**완료 기준**
- [ ] `pnpm test`, `pnpm typecheck` 통과
- [ ] `pnpm render t01-sale-cards c01-summer-sale greedy` → SVG 생성
- [ ] `pnpm bench` → greedy 행 채워짐, 나머지 matcher "-"
- [ ] 모든 TODO에 Step 번호 표시

**결정 필요** (선택지만 제시)
1. 이미지 슬롯/콘텐츠를 실제로 다룰지, 텍스트만 다룰지
2. golden 비교: 정확 일치로 할지, 그룹 순서 교환을 허용할지
3. roleHint가 없는 콘텐츠: 길이 기반으로 추정할지, 역할 미상으로 둘지
4. degraded 기준: warn이 1개라도 있으면 degraded로 볼지, 임계값을 둘지

---

### Step 1. 데이터와 관찰 도구 완성 (Day 1 오후)

**구현**
- fixture를 템플릿 8개, 콘텐츠 8개로 확장한다. 다음 상황이 반드시 포함되어야 한다.
  - 개수 일치 / 본문 과다 / 본문 부족
  - 긴 제목 / roleHint 없음
  - 카드형(groupId) / 이미지 없음
  - 좁은 슬롯
- 각 fixture의 description에 테스트하려는 상황을 한 줄로 적는다.
- bench 지표를 완성한다.
- Step 0의 결정 사항을 반영한다.

**🙋 사용자**: golden 5쌍을 "내가 디자이너라면" 기준으로 직접 작성한다.

---

### Step 2. 실패 분류 + Hungarian (Day 2)

**🙋 먼저 사용자 (1시간)**
greedy SVG를 전부 보고 부록 A에 실패 유형 3~5개를 적는다. 각 유형의 종류를 표시한다.
- **cost**: 점수로 풀 문제
- **구조**: 제약으로 풀 문제
- **사후**: validation/fallback으로 풀 문제

**Claude Code**
1. assignment problem과 Hungarian을 회식 자리 배치 비유로 먼저 설명한다. 개수가 다를 때 dummy로 처리하는 법도 작은 예시 행렬로 보여준다.
2. cost 항목 후보와 가중치 선택지를 제시한다. 후보 예시:
   - role 불일치
   - 넘침 정도
   - 슬롯 대비 너무 짧은 텍스트
   - 입력 순서 역전
   - priority별 dummy 비용
3. 🙋 사용자가 결정한다 → 부록 B에 기록
4. 구현
   - `cost.ts`, `weights.ts`
   - `bruteForce.ts`: 모든 순열을 탐색하는 oracle
   - `hungarian.ts`: 직접 구현, 단계별 주석
5. `oracle.test.ts`: 슬롯 ≤ 6인 랜덤 입력에서 hungarian과 bruteForce의 totalCost가 일치하는지 fast-check로 검사한다.
6. bench를 재실행하고, 부록 A 유형별로 해결/미해결을 표시한다.

**완료 기준**: Hungarian이 고친 실패와 **못 고친 실패**(특히 카드 섞임)가 수치로 드러난다.

---

### Step 3. 계층 매칭 ⭐ (Day 3–4)

**문제**
Hungarian은 슬롯을 독립적으로 본다. 그래서 "카드1 소제목 + 카드2 설명" 같은 그룹 찢어짐을 구조적으로 막지 못한다.

**접근: 2단계 계층 매칭**
1. 그룹 ↔ 그룹 cost를 정의한다. 이 값은 "그 그룹 쌍 내부에서 Hungarian을 돌렸을 때의 최적 cost"다.
2. 그룹끼리 Hungarian으로 매칭한다.
3. 각 그룹 내부를 매칭한다.
4. 그룹에 속하지 않은 항목과 슬롯을 마지막에 매칭한다.

**Claude Code**
1. flat Hungarian이 그룹 찢어짐을 못 막는 이유를 작은 반례로 먼저 보여준다.
2. `hierarchical.ts`와 `rules/groupSplit.ts`를 구현한다.
3. 이 방식이 전역 최적이 아닐 수 있는 경우를 예시로 설명하고, 그 예시를 fixture로 추가한다.
4. bench를 재실행한다.
   - greedy / hungarian / hierarchical 비교표
   - before/after SVG 2쌍을 `out/`에 저장

**🙋 사용자**: 전역 최적이 아닌데도 이 방식을 택한 이유를 부록 B에 적는다.

---

### Step 4. Validation + Fallback + 최종 판정 (Day 5)

**Claude Code**
1. 나머지 규칙을 구현한다: `titleMissing`, `priorityDropped`, `roleMismatch`.
   - 🙋 severity는 사용자가 결정한다.
2. fallback 단계를 구현한다: `shrinkFont`(minFontSize까지), `dropLowPriority`(priority 3 → 2 순).
   - 🙋 순서와 허용 범위는 사용자가 결정한다.
3. pipeline이 validate ↔ fallback을 최대 `MAX_ITERATIONS`회 반복하고, 모든 단계를 `trace`에 기록한다.
4. "거절이 올바른 결과"인 fixture 2개를 추가한다.
   - 예: 본문 12개를 카드 3장 템플릿에 넣는 경우

**🙋 사용자**: accepted / degraded / rejected 경계를 확정한다.

---

### Step 5. 정리 + 설명 리허설 (Day 6–7)

**Claude Code**: 최종 bench, 부록 A, 부록 B를 바탕으로 README를 작성한다.

README 구성:
1. 문제 정의
2. 모델링 (tree + assignment)
3. 실패 분류
4. greedy → Hungarian → 계층 매칭의 진화 (각 단계에서 해결된 것 / 남은 것)
5. validation/fallback과 거절 기준
6. 수치
7. 한계와 가정 (텍스트 근사, 계층 매칭의 비최적 케이스, golden의 주관성)
8. 다음에 한다면 (실제 폰트 측정, LLM 생성 콘텐츠 연결, 템플릿 추천)
9. AI 활용 방식: 맡긴 것 vs 직접 판단한 것

작성 규칙: 사용자의 결정과 Claude의 제안을 구분해서 쓰고, 과장 표현은 쓰지 않는다.

**🙋 사용자**: 5장의 질문에 코드를 보지 않고 소리 내어 답해본다. 막히는 부분만 다시 설명을 요청한다.

---

## 5. 사용자용 가이드

### 코드 읽기 전략
| 깊이 | 대상 | 목표 |
|---|---|---|
| 정독 | `cost.ts`, `hungarian.ts`, `hierarchical.ts`, `validation/rules/*`, `fallback/policy.ts` | 손으로 예시를 따라가며 설명할 수 있을 때까지 |
| 훑기 | schema, loader, traverse, render, bench, 테스트 | "무엇을 하는지" 한 줄로 말할 수 있으면 충분 |

추천 읽기 순서: `schema/` → `matchers/types.ts` → `pipeline.ts` → 각 Step의 핵심 파일

### 예상 질문
- greedy가 왜 부족했나? 구체적 실패 사례는?
- cost 가중치는 어떻게 정했나? 바꾸면 결과가 어떻게 달라지나?
- Hungarian의 시간복잡도는? 슬롯이 1,000개라면?
- Hungarian이 맞게 동작한다는 걸 어떻게 확인했나? (oracle 테스트)
- 계층 매칭이 최적이 아닌 경우는? 왜 감수했나?
- invariant와 validation rule의 차이는?
- 무엇을 거절했고, 그 기준은?
- golden 정답의 주관성은 어떻게 다뤘나?
- AI에게 맡긴 것과 직접 판단한 것은?

---

## 부록 A. 실패 카탈로그

> 분류(종류 열)는 🙋 사용자 몫이지만 사용자가 위임해 Claude가 정했다(2026-10-05). 고치면 이 표와 D-13을 함께 고친다.

| ID | 유형 | 증상 | 종류 (cost/구조/사후) | 재현 fixture | 발견 matcher | 해결 Step |
|---|---|---|---|---|---|---|
| F-1 | role 무시 | 들어온 순서대로 넣어 title 칸에 소제목(「무료배송」), 소제목 칸에 제목이 들어간다 | cost | t01×c01, t04×c05, t03×c08, t06×c06 | greedy | Step 2 해결: hungarian은 hint가 있는 항목을 맞는 role 칸에 넣는다(golden t01×c01 2/5 → 5/5) |
| F-2 | 길이 무시 넘침 | 긴 문장을 한 줄짜리 칸에 넣어 넘친다(설명 → 소제목 칸, 본문 → 제목 칸) | cost | t01×c01, t05×c04 | greedy | Step 2 일부 해결: errors 27 → 14. roleHint 없는 t05×c04는 긴 글이 좁은 본문 칸에서 여전히 넘침(D-8의 한계) |
| F-3 | 카드 섞임 | 한 카드에 다른 제품의 사진·이름·설명이 섞인다(card1 = p3 사진 + p1 이름), 사진과 다른 사진의 캡션이 짝지어진다 | 구조 | t04×c05, t08×c07 | greedy, hungarian | Step 2 미해결: hungarian도 t04×c05에서 card1 = p3 사진 + p1 이름·설명(golden 8/10). 순서 항이 사진을 p3→card1로 보낸다. Step 3 (TBD) |
| F-4 | 맞는 자리인데 넘침 | 제목이 제목 칸에 들어갔지만 기본 글자 크기에서 한 줄을 넘는다. 글자를 줄이면 들어간다 | 사후 | t02×c03, t03×c03 | greedy | Step 4 (TBD) |
| F-5 | 틀린 배치가 통과 | role이 다 틀린 배치(t04×c05)도 overflow만 없으면 accepted가 된다 | 사후 | t04×c05, t03×c08 | greedy | Step 4 (TBD) |
| F-6 | priority와 role의 충돌 | p2 소제목·본문을 버리는 비용(30)이 role 불일치(20+α)보다 커서, p3 캡션을 버리고 기간·본문을 사진 캡션 칸에 넣는다. 캡션 칸에서 본문이 넘친다 | 사후 | t08×c07 | hungarian | Step 2에서 발견. 가중치를 이 fixture에 맞추지 않고 Step 4 roleMismatch·overflow가 잡게 둔다 |

## 부록 B. 결정 로그

| ID | 결정 | 선택지 | 이유 / 감수한 점 |
|---|---|---|---|
| D-1 | 텍스트 크기는 글자 종류별 근사로 계산 | 근사 / canvas 측정 / 글자 수만 | 매칭 로직 검증이 목적. 실제 폰트와 오차 있음 |
| D-2 | `@types/node`를 여섯 번째 devDependency로 추가 (Claude 결정, Step 0) | 추가 / `node:fs` 타입을 직접 선언 | loader·render 스크립트·bench가 `tsc --noEmit`을 통과하려면 필요. 타입 전용이라 런타임 의존성은 그대로 |
| D-3 | 줄 수 = 문단 너비 ÷ 슬롯 폭을 올림 (Claude 결정, Step 0) | 너비 나눗셈 / 단어 단위 줄바꿈 / 글자 단위 줄바꿈 | 손으로 검산하기 쉽다. 단어가 줄 끝에서 잘리는 경우를 무시하므로 실제보다 줄 수가 적게 나올 수 있음 |
| D-4 | 미구현 matcher는 레지스트리의 `implemented` 플래그로 표시 (Claude 결정, Step 0) | 플래그 / `match()` 예외를 잡아 skip | `Matcher` 인터페이스를 그대로 둔다. 예외를 잡으면 진짜 버그도 skip으로 숨는다 |
| D-5 | fixture 스키마를 spec보다 엄격하게 (Claude 결정, Step 0) | strict / 느슨 | 모르는 키·중복 id·0 이하 치수를 로드 시점에 막는다. fixture 오타가 조용히 통과하지 않음 |
| D-6 | 이미지 슬롯·콘텐츠를 fixture에 실제로 넣는다 (사용자 결정, 2026-10-05) | 글만 / fixture에 포함 | 학습용이기도 해서 다양한 상황을 담는다. 비율 맞춤 같은 이미지 고유 규칙은 없음 |
| D-7 | golden 비교는 모양이 같은 카드끼리 통째로 교환한 배치도 정답으로 본다 (사용자 결정, 2026-10-05) | 카드 교환 허용 / 정확 일치 | 카드 순서만 다른 올바른 배치를 틀렸다고 세지 않는다. 비교 코드가 조금 복잡해짐 |
| D-8 | roleHint가 없는 콘텐츠는 역할 미상으로 둔다 (사용자 결정, 2026-10-05) | 미상 / 길이로 추정 | 추정을 코드에 숨기지 않고 cost 항목으로 자리를 찾게 한다. 배치 품질은 떨어질 수 있음 |
| D-9 | error 없이 warn이 1개라도 있으면 degraded (사용자 결정, 2026-10-05, Step 4에서 재확정) | warn 1개부터 / 임계값 | 기준이 한 문장. warn 1건과 5건이 같은 등급 |
| D-10 | golden 5쌍: t01×c01(카드 2장), t02×c02(본문 과다), t04×c05(이미지 든 카드 3장), t05×c04(roleHint 없음 + 좁은 슬롯), t08×c07(사진·캡션 짝) (Claude 결정 — 🙋 사용자 위임, Step 1) | 카드·이미지·roleHint 없음을 고루 / 단순 쌍 위주 | 핵심 스토리(카드 섞임)와 D-6·D-8 상황을 golden으로 잴 수 있게 골랐다. 디자이너 판단 대신 Claude 판단이라 주관이 섞여 있음. 각 파일 note에 기준을 적었다. 사용자가 고치면 이 줄을 갱신 |
| D-11 | D-7의 「모양이 같은 카드」 = 그 그룹에 직접 속한 슬롯의 수와 role 순서(DFS)가 같은 그룹 (Claude 결정, Step 1) | 슬롯 수·role 순서 / 슬롯 수만 / 박스 크기까지 | 손으로 판정하기 쉽다. 박스 크기가 달라도 같은 모양으로 봄. 카드 수가 적다는 가정으로 순열을 전부 돈다(`bench/golden.ts`) |
| D-12 | bench에 쌍별 표(status·e/w/d·golden 점수)를 더하고 `pnpm render:all`로 전체 SVG를 한 번에 그린다 (Claude 결정, Step 1) | 추가 / matcher별 합계만 | Step 2의 실패 관찰을 쌍 단위로 할 수 있다. 결과 파일이 길어짐 |
| D-13 | cost 항목 = role 불일치 + 넘침 정도 + 너무 짧은 텍스트 + 입력 순서 차이, dummy 비용 = priority별 버림 / role별 비움 (Claude 결정 — 🙋 사용자 위임, Step 2) | 네 항 모두 / role+넘침만 / role만 | spec 후보 다섯을 다 넣었다. roleHint 없음(D-8)은 role 항 0이라 길이·순서 항이 자리를 정한다. 항이 많아 손 계산이 길어짐 |
| D-14 | 가중치: role 불일치 20, 줄여야 들어감 2, minFontSize에서도 넘치는 줄당 15, 짧음 최대 4, 순서 차이 최대 3 / 버림 p1 1000·p2 30·p3 10 / 비움 title 50·subtitle·body·image 10·caption 5 (Claude 결정 — 🙋 사용자 위임, Step 2) | 이 값 / role을 순서보다 약하게 / 넘침을 role보다 강하게 | 우선순위: p1 보존 ≫ 제목 칸 채움 > p2 보존 > role > 넘침 > 순서·짧음. 순서 항이 카드 순서를 정해 t04×c05에서 카드 섞임이 남는다(F-3) — Step 3의 동기 |
| D-15 | kind 불일치는 Infinity 대신 큰 유한값 1,000,000 (Claude 결정, Step 2) | 유한 큰 값 / 금지 칸을 따로 표시 | Hungarian이 값을 빼고 더해 Infinity−Infinity=NaN이 난다. 1,000,000 > 최대 버림 + 최대 비움이라 최적해는 금지 짝을 고르지 않는다(oracle 테스트로 확인) |
| D-16 | 「입력 순서 역전」을 쌍별 상대 위치 차이의 제곱 (i/(n−1) − j/(m−1))²로 근사 (Claude 결정, Step 2) | 위치 차이 제곱 / 위치 차이 절댓값 / 역전 쌍 수 | 역전 쌍 수는 두 짝을 함께 봐야 해서 쌍별 cost 합(assignment problem)으로 못 쓴다. 처음엔 절댓값으로 했으나 t02×c02에서 바른 순서와 엇갈린 순서가 동점(2.25)이 되어 순서가 뒤집혔다. 제곱(볼록)이면 엇갈린 배치가 항상 더 비싸다. 근사라 순서가 조금 어긋난 배치를 정확히 세지는 못함 |
| D-17 | bruteForce는 oracle 전용: 슬롯 ≤ 6·항목 ≤ 7에서만 실행, bench·render:all에서 뺀다 (Claude 결정, Step 2) | oracle 전용 / bench에서 작은 쌍만 | fixture 최대 10×10은 전수 탐색이 수천만 가지. bench 합계를 다른 쌍 집합으로 내면 다른 행과 비교가 안 된다 |

## 부록 C. 진행 상황

- 현재 Step: 2 완료 (2026-10-05)
- 마지막 작업: cost 네 항 + dummy 비용(D-13~D-16), Hungarian 직접 구현, bruteForce oracle(D-17), oracle 테스트. `pnpm test` 통과 24 / skip 4(hierarchical), typecheck 0
- bench(64쌍): greedy goldenMatch 0.43 · errors 27 · 40/0/24 → hungarian 0.75 · errors 14 · 51/0/13. 카드 섞임(F-3)은 hungarian에서도 남음(t04×c05 golden 8/10)
- Step 1 메모: fixture 상황표 — 개수 일치 t01×c01·t04×c05 / 본문 과다 t02×c02 / 본문 부족 t06×c06 / 긴 제목 c03 / roleHint 없음 c04 / 카드형 c01·c05·c07 / 이미지 없음 c08 / 이미지가 남는 쌍 t03×c05·t03×c07 / 좁은 슬롯 t05
- 브랜치 메모: 이 저장소의 클라우드 세션은 지정 브랜치 하나에만 푸시할 수 있어, Step마다 로컬 `step-N-*` 브랜치를 `--no-ff`로 세션 브랜치에 합쳐 Step 경계를 남긴다. `main` 병합은 사용자가 한다
- 다음 할 일: Step 3 (계층 매칭 + groupSplit)
