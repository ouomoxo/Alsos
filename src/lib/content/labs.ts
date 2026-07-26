import type { DomainId } from "./curriculum";

/** Lab catalogue metadata. Presentation only — no execution backend exists. */
export type LabSummary = {
  id: string;
  number: number;
  domain: DomainId;
  title: string;
  objectiveKo: string;
  difficulty: 1 | 2 | 3;
  steps: number;
};

export const LABS: readonly LabSummary[] = [
  {
    id: "session-fixation",
    number: 14,
    domain: "web-security",
    title: "세션 고정 공격",
    objectiveKo: "세션 식별자가 인증 전후로 갱신되지 않을 때 무엇이 가능한지 확인합니다.",
    difficulty: 2,
    steps: 4,
  },
  {
    id: "idor-enumeration",
    number: 15,
    domain: "web-security",
    title: "객체 참조 열거",
    objectiveKo: "예측 가능한 식별자와 누락된 권한 검사를 결합해 접근 범위를 넓힙니다.",
    difficulty: 2,
    steps: 5,
  },
  {
    id: "arp-poisoning",
    number: 21,
    domain: "network-security",
    title: "ARP 캐시 오염",
    objectiveKo: "로컬 세그먼트에서 신뢰가 어떻게 만들어지고 무너지는지 관찰합니다.",
    difficulty: 3,
    steps: 6,
  },
  {
    id: "padding-oracle",
    number: 33,
    domain: "cryptography",
    title: "패딩 오라클",
    objectiveKo: "오류 메시지 하나가 평문 전체를 어떻게 노출시키는지 확인합니다.",
    difficulty: 3,
    steps: 5,
  },
  {
    id: "shell-basics",
    number: 3,
    domain: "foundations",
    title: "셸과 권한",
    objectiveKo: "파일 권한, 소유권, 실행 비트가 실제로 무엇을 결정하는지 다룹니다.",
    difficulty: 1,
    steps: 3,
  },
];

export function labById(id: string): LabSummary | undefined {
  return LABS.find((lab) => lab.id === id);
}
