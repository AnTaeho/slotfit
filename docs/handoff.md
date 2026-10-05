# 이어받는 세션용 지시서

이 문서는 Step 0 이후를 이어서 개발하는 세션(클라우드 세션 포함)이 읽는다.
규칙은 `CLAUDE.md`, 명세는 `spec.md`에 있다. 이 문서는 그 둘에 없는 것만 적는다.

## 지금 상태 (2026-10-05, Step 0~5 완료)
- Step 1~5를 한 세션에서 끝냈다. 세션 브랜치 `claude/lucid-bell-n2rc8s`에 Step마다 `--no-ff` merge commit으로 합쳐 두었다(클라우드 세션은 지정 브랜치에만 푸시할 수 있어서). `main` 병합은 아직이다.
- 사용자가 「판단이 필요하면 알아서 정하고 기록하라」고 위임해서, 🙋 항목(golden, 실패 분류, cost 가중치, 계층 매칭 채택 이유, severity, fallback 순서, status 경계)을 Claude가 정했다. `spec.md` 부록 B에 「Claude 결정 — 🙋 사용자 위임」으로 표시돼 있다.
- `pnpm test` 40 통과, `pnpm typecheck` 0, 최종 bench는 `spec.md` 부록 C와 README 6장.
- 코드 읽기 가이드: `docs/guide/slotfit-guide.html` (아티팩트로 게시됨). Step 0 초안 `step0-draft.html`은 기록으로 남겨 둔다.
- 다음 할 일: 사용자의 위임 결정 검토 → 바뀌면 `weights.ts`·`policy.ts`·부록 B·README 갱신, `main` 병합, 설명 리허설. 남은 개선 거리 F-8·F-9.

## (이하 Step 0 직후에 쓴 원래 지시. 기록으로 남김)

## 할 일
Step 1부터 순서대로, 갈 수 있는 데까지 간다. 한 Step = 브랜치 하나 = PR 하나.

1. 시작 전에 `pnpm install`, `pnpm test`, `pnpm typecheck`로 위 상태가 재현되는지 확인한다.
2. `spec.md` 4장의 해당 Step을 구현한다.
3. Step 안의 🙋 지점에 닿으면 그 앞까지의 작업을 끝내 놓고 사용자에게 묻는다. 답을 받으면 이어 간다.
4. Step이 끝나면 `spec.md` 부록 A·B·C를 갱신하고, 0장의 보고 형식(바뀐 파일 [핵심]/[보조], 읽을 함수 3개 이내, 예상 질문 1개)으로 보고한 뒤 PR을 합치고 다음 Step으로 간다.
5. 모든 Step이 끝나면 코드 읽기 가이드 아티팩트를 한 번 만든다(Step 0 포함 전체, `CLAUDE.md`의 「코드 읽기 가이드」 기준). Step 0 몫의 초안이 `docs/guide/step0-draft.html`에 있다(아티팩트용 HTML 조각, 게시 전). 이 글의 깊이와 말투를 기준으로 삼아 이어 쓴다.

## 일하는 방식
- 판단·계획·검토·글쓰기는 메인 세션이 한다. 파일 수정·테스트 실행은 Opus 하위 에이전트(`Agent`, `model: "opus"`)에게, 커밋·푸시 같은 기계적인 일은 Sonnet 하위 에이전트에게 맡긴다. 한두 줄 고치는 일은 직접 해도 된다.
- 하위 에이전트에게는 배경·할 일·범위 밖·검증 명령과 기대 결과·보고 형식을 담은 지시서를 준다. 결과는 diff와 검증 출력 원문으로 확인한다.
- 지시서마다 저장소 규칙을 다시 적는다: git 명령 금지(커밋은 메인 세션이 따로 한다), 의존성은 `spec.md` 0장의 여섯 개까지, `any` 금지, 매직 넘버는 `weights.ts`에만, 예상 밖이면 멈추고 보고.
- 새 알고리즘은 코드를 쓰기 전에 5문장 이내 비유로 설명한다(`spec.md` 0장).

## 사용자가 정해야 하는 지점 (미리 준비해 둘 것)
| Step | 지점 | 준비할 것 |
|---|---|---|
| 1 | golden 5쌍 | fixture 8+8을 만들고 greedy SVG를 전부 렌더한 뒤, 쌍마다 슬롯·콘텐츠 목록과 golden 초안을 「제안」으로 내고 사용자가 고쳐 확정한다 |
| 2 | 실패 유형 3~5개(부록 A) | greedy 결과에서 관찰한 사실을 쌍별로 정리해 주고, 분류(cost/구조/사후)는 사용자가 한다 |
| 2 | cost 항목과 가중치 | 후보 항목별 선택지 2~3개 + 바꾸면 어떤 fixture 결과가 달라지는지 |
| 3 | 전역 최적이 아닌데도 계층 매칭을 택한 이유 | 반례 fixture와 수치를 먼저 보여 준다. 이유 문장은 사용자가 쓴다 |
| 4 | 규칙별 severity, fallback 순서·허용 범위, accepted/degraded/rejected 경계 | 선택지별로 bench status 분포가 어떻게 바뀌는지 |

## 사용자 답을 기다리는 동안 할 수 있는 일
답이 필요한 지점에서 세션 전체를 세우지 않는다. 질문을 던져 놓고 답과 무관한 일을 먼저 한다.
- Step 2: `bruteForce.ts`·`hungarian.ts`의 알고리즘 본체와 `oracle.test.ts`는 가중치 값과 무관하다. placeholder cost(아래 `Infinity` 메모 반영)로 먼저 만들고 랜덤 cost 행렬로 두 구현의 totalCost가 같은지 검사해 둔다. 가중치는 사용자가 정한 뒤 `weights.ts`에만 넣는다.
- Step 3: 그룹 찢어짐 반례 fixture와 `groupSplit` 규칙은 사용자 답 없이 만들 수 있다.
- Step 4: 규칙 세 개의 `check` 본체와 fallback 단계 본체는 severity·순서와 무관하게 만들 수 있다. severity와 `POLICY` 순서만 사용자 답을 기다린다.
- 다만 사용자 답이 있어야 뜻이 정해지는 Step 완료 판정(bench 비교, 부록 A 해결 표시)과 PR 병합은 답을 받은 뒤에 한다.

## Step 0에서 넘어온 기술 메모
- `cost()`는 kind 불일치에 `Infinity`를 돌려준다. Hungarian은 행렬 값을 빼고 더하므로 `Infinity - Infinity = NaN`이 난다. Step 2에서 큰 유한값으로 바꾸거나 금지 칸을 따로 다룬다. oracle 테스트의 totalCost 비교에도 영향이 있으니 cost 선택지를 낼 때 같이 올린다.
- golden 비교는 지금 정확 일치다(`bench/evaluate.ts`). D-7에 따라 Step 1에서 「모양이 같은 카드끼리 통째로 교환한 배치도 정답」으로 바꾼다. 「모양이 같다」의 기준(슬롯 수·role 순서가 같은 그룹)은 코드 주석과 부록 B에 적는다.
- 이미지는 D-6에 따라 fixture에 실제로 넣는다. 이미지 슬롯/콘텐츠가 있는 쌍, 이미지가 남는 쌍, 이미지 슬롯이 비는 쌍이 각각 하나 이상 있게 한다.
- bench의 `groupSplit` 열은 Step 3에서 규칙이 생길 때까지 "-"다(0으로 적으면 「찢어짐 없음」으로 읽힌다).
- `FallbackStep.applies(v)`의 `v`는 남은 위반 전체(`Violation[]`)다. Step 4에서 단계별로 더 맞는 꼴이 있으면 바꾼다.
- 미구현 matcher는 `src/matchers/index.ts`의 `implemented` 플래그로 표시한다. 구현하면 `true`로 바꾸고, 그러면 `tests/invariants.test.ts`가 자동으로 그 matcher를 검사한다.
- pnpm 11은 esbuild 빌드 스크립트를 `pnpm-workspace.yaml`의 `allowBuilds`로 허용한다.

## 막히면
- 예상과 다른 결과(테스트가 이유 없이 깨짐, 의존성 추가가 필요함, spec끼리 어긋남)가 나오면 우회하지 말고 멈춰서 사용자에게 보고한다.
- 끝낼 때는 띄운 서버·백그라운드 명령을 모두 멈춘다.
