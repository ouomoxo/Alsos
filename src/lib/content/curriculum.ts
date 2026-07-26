/**
 * Product content, and the only place counts come from.
 *
 * §3.2 forbids inventing platform statistics. Everything a visitor sees on the
 * marketing page is therefore either copy or a count derived from this file —
 * "7 learning paths" is true because there are seven entries below. No learner
 * counts, no success rates, no partner logos until real data exists.
 */

export type DomainId =
  | "foundations"
  | "web-security"
  | "network-security"
  | "reverse-engineering"
  | "digital-forensics"
  | "cloud-security"
  | "cryptography";

export type Domain = {
  id: DomainId;
  /** Latin name used as the system label. */
  name: string;
  nameKo: string;
  /** One line, in the platform's voice. */
  summaryKo: string;
  /** Where this domain sits in the root network. */
  tier: 1 | 2 | 3;
  /** Which domains must be underway before this one opens. */
  requires: DomainId[];
  /**
   * How growth in this domain shows up in the learner's garden (§6 Section 06).
   * This is the mapping that ties ornament to capability.
   */
  gardenExpression: string;
  gardenExpressionKo: string;
};

export const DOMAINS: readonly Domain[] = [
  {
    id: "foundations",
    name: "Foundations",
    nameKo: "기초",
    summaryKo: "네트워크, 운영체제, 명령줄. 나머지 모든 것이 서 있을 지반입니다.",
    tier: 1,
    requires: [],
    gardenExpression: "Root spread and soil depth",
    gardenExpressionKo: "뿌리의 폭과 토양의 깊이",
  },
  {
    id: "web-security",
    name: "Web Security",
    nameKo: "웹 보안",
    summaryKo: "요청 하나가 어디까지 갈 수 있는지. 인증, 세션, 주입, 접근 제어.",
    tier: 2,
    requires: ["foundations"],
    gardenExpression: "Climbing vines and branching growth",
    gardenExpressionKo: "덩굴과 분기형 식생",
  },
  {
    id: "network-security",
    name: "Network Security",
    nameKo: "네트워크 보안",
    summaryKo: "패킷의 경로를 읽고, 경계가 어디서 무너지는지 확인합니다.",
    tier: 2,
    requires: ["foundations"],
    gardenExpression: "Connected root mesh",
    gardenExpressionKo: "연결된 뿌리망",
  },
  {
    id: "cryptography",
    name: "Cryptography",
    nameKo: "암호학",
    summaryKo: "무엇이 비밀을 지키고, 무엇이 지키는 척만 하는지.",
    tier: 2,
    requires: ["foundations"],
    gardenExpression: "Crystalline seed forms",
    gardenExpressionKo: "결정형 씨앗",
  },
  {
    id: "reverse-engineering",
    name: "Reverse Engineering",
    nameKo: "리버스 엔지니어링",
    summaryKo: "소스가 없는 것을 읽는 법. 바이너리, 디스어셈블리, 동작 분석.",
    tier: 3,
    requires: ["foundations", "network-security"],
    gardenExpression: "Cut wood and growth rings",
    gardenExpressionKo: "나무 단면과 나이테",
  },
  {
    id: "digital-forensics",
    name: "Digital Forensics",
    nameKo: "디지털 포렌식",
    summaryKo: "사건이 끝난 뒤 남은 흔적으로 사건을 복원합니다.",
    tier: 3,
    requires: ["foundations", "network-security"],
    gardenExpression: "Mycelium and spore fields",
    gardenExpressionKo: "균사와 포자",
  },
  {
    id: "cloud-security",
    name: "Cloud Security",
    nameKo: "클라우드 보안",
    summaryKo: "다른 사람의 컴퓨터 위에서 권한과 신뢰가 어떻게 새는지.",
    tier: 3,
    requires: ["foundations", "web-security"],
    gardenExpression: "Mist above the canopy",
    gardenExpressionKo: "수관 위의 안개",
  },
];

/* --------------------------------------------------------------- growth --- */

export type GrowthStage = "seed" | "rooted" | "sprout" | "sapling" | "canopy" | "sacred-grove";

export type GrowthStageSpec = {
  id: GrowthStage;
  label: string;
  labelKo: string;
  /** What structurally changes — not just scale (§7 Section 05). */
  structureKo: string;
  /** Lower XP bound. Authoritative values live on the server; these describe. */
  minXp: number;
};

export const GROWTH_STAGES: readonly GrowthStageSpec[] = [
  {
    id: "seed",
    label: "SEED",
    labelKo: "씨앗",
    structureKo: "구조 없음. 껍질과 그 안의 가능성뿐입니다.",
    minXp: 0,
  },
  {
    id: "rooted",
    label: "ROOTED",
    labelKo: "정착",
    structureKo: "첫 뿌리 세 가닥이 내려가고, 방향이 정해집니다.",
    minXp: 500,
  },
  {
    id: "sprout",
    label: "SPROUT",
    labelKo: "발아",
    structureKo: "줄기가 지면 위로 올라오고 첫 잎이 열립니다.",
    minXp: 2000,
  },
  {
    id: "sapling",
    label: "SAPLING",
    labelKo: "묘목",
    structureKo: "가지가 전문 분야 방향으로 갈라지기 시작합니다.",
    minXp: 6000,
  },
  {
    id: "canopy",
    label: "CANOPY",
    labelKo: "수관",
    structureKo: "수관이 닫히고, 나이테가 읽히며, 그늘이 생깁니다.",
    minXp: 15000,
  },
  {
    id: "sacred-grove",
    label: "SACRED GROVE",
    labelKo: "신성한 숲",
    structureKo: "한 그루가 아니라 생태계입니다. 주변 식생이 함께 자랍니다.",
    minXp: 40000,
  },
];

/* ---------------------------------------------------------- structure ----- */

/** §7 Section 02 — the learning system explained as one root structure. */
export const STRUCTURE_MAP = [
  { part: "뿌리", partEn: "Roots", meaningKo: "기초 지식" },
  { part: "줄기", partEn: "Trunk", meaningKo: "핵심 능력" },
  { part: "가지", partEn: "Branches", meaningKo: "전문 분야" },
  { part: "잎", partEn: "Leaves", meaningKo: "실습 Lab" },
  { part: "나이테", partEn: "Rings", meaningKo: "자격과 업적" },
  { part: "계절", partEn: "Seasons", meaningKo: "이벤트" },
] as const;

export const DOMAIN_COUNT = DOMAINS.length;
export const GROWTH_STAGE_COUNT = GROWTH_STAGES.length;

export function domainById(id: DomainId): Domain {
  const found = DOMAINS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown domain: ${id}`);
  return found;
}
