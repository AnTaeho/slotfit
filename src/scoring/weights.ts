// 모든 가중치/임계값/근사 상수. 매직 넘버는 이 파일에만 둔다.
import type { Role } from '../schema';

// ---------- 텍스트 근사 (D-1) ----------
export const CHAR_WIDTH_HANGUL_EM = 1.0; // D-1: 한글 한 글자 너비
export const CHAR_WIDTH_LATIN_EM = 0.55; // D-1: 영문/숫자 한 글자 너비
export const CHAR_WIDTH_SPACE_EM = 0.3; // D-1: 공백 너비
export const CHAR_WIDTH_OTHER_EM = 0.55; // D-1: 문장부호·기호 등 그 외 문자는 영문과 같게 본다
export const LINE_HEIGHT_RATIO = 1.4; // D-1: 줄 높이 = fontSize × 1.4
export const MIN_LINES_PER_PARAGRAPH = 1; // D-1: 빈 문단도 한 줄을 차지한다

// ---------- cost (D-13 항목 구성, D-14 가중치 값) ----------
// cost = role + 넘침 + 너무 짧음 + 입력 순서. 단위는 「나쁨 점수」이고 서로 더해 비교한다.
export const ROLE_MISMATCH_COST = 20; // D-14: roleHint가 있는데 슬롯 role과 다르다
export const ROLE_UNKNOWN_COST = 0; // D-8·D-14: roleHint가 없으면 role 항은 0. 길이·순서 항으로 자리를 찾는다
export const SHRINK_NEEDED_COST = 2; // D-14: 기본 fontSize로는 안 들어가 글자를 줄여야 한다
export const OVERFLOW_PER_LINE_COST = 15; // D-14: minFontSize로 줄여도 넘치는 줄 하나마다
export const UNDERFILL_COST = 4; // D-14: 슬롯을 하나도 못 채울 때(underfill = 1)의 비용. 0~1 비율을 곱한다
export const ORDER_COST = 3; // D-14·D-16: 항목과 슬롯의 상대 위치가 끝과 끝일 때(차이 = 1)의 비용. 차이의 제곱에 곱한다

// D-15: kind 불일치(text↔image) 짝. Infinity 대신 큰 유한값을 쓴다.
// 이유 1: Hungarian은 잠재값을 빼고 더하므로 Infinity − Infinity = NaN이 생겨 계산이 깨진다.
// 이유 2: FORBIDDEN_COST > (최대 버림 비용 + 최대 비움 비용) = 1000 + 50 이면
//   최적해는 금지 칸을 절대 고르지 않는다. 금지 짝 하나를 「항목 버림 + 슬롯 비움」으로 바꾸면
//   항상 더 싸기 때문이다. tests/oracle.test.ts가 이 부등식을 검사한다.
export const FORBIDDEN_COST = 1_000_000;

// D-14: 항목을 버리는 비용(dummy 슬롯과 짝). priority 1은 사실상 버리면 안 된다.
export const DROP_COST_BY_PRIORITY: Record<1 | 2 | 3, number> = {
  1: 1000,
  2: 30,
  3: 10,
};

// D-14: 슬롯을 비워 두는 비용(dummy 항목과 짝). 제목이 빈 결과가 가장 나쁘다.
export const EMPTY_COST_BY_ROLE: Record<Role, number> = {
  title: 50,
  subtitle: 10,
  body: 10,
  caption: 5,
  image: 10,
};

// ---------- oracle 크기 상한 ----------
// D-17: bruteForce는 전수 탐색이라 이보다 크면 느리다. oracle 전용으로 tests/oracle.test.ts에서만 실행한다.
export const BRUTE_FORCE_MAX_SLOTS = 6; // D-17: spec Step 2의 「슬롯 ≤ 6」
export const BRUTE_FORCE_MAX_ITEMS = 7; // D-17: 항목 7개 × 슬롯 6개 ≈ 3.8만 가지 배치

// ---------- fallback ----------
export const MAX_ITERATIONS = 5; // validate ↔ fallback 반복 상한 (spec 3.4)

// ---------- render (점수와 무관한 그림 치수) ----------
export const RENDER_FOOTER_HEIGHT = 44; // 하단 status 표시 영역 높이(px)
export const RENDER_FOOTER_FONT_SIZE = 14;
export const RENDER_FOOTER_PADDING = 12;
export const RENDER_IMAGE_LABEL_FONT_SIZE = 12;
export const RENDER_SLOT_FILL_OPACITY = 0.12;
