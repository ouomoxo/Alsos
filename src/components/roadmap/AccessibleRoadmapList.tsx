import Link from "next/link";

import { PixelIcon, type PixelIconName } from "@/components/brand/PixelIcon";
import { DOMAINS, domainById, type DomainId } from "@/lib/content/curriculum";

import styles from "./AccessibleRoadmapList.module.css";

/**
 * The roadmap as a real, navigable, hierarchical list.
 *
 * This — not the SVG — is the roadmap. Keyboard users, screen readers and
 * anyone with the canvas disabled get the identical information and the
 * identical destinations (§8.2).
 */

export type NodeState = "locked" | "available" | "in-progress" | "complete" | "mastered" | "review";

const STATE_META: Record<NodeState, { label: string; icon: PixelIconName; pattern: string }> = {
  // Every state carries an icon, a word and a border pattern — never colour
  // alone (§8.2, §15).
  locked: { label: "잠김", icon: "locked", pattern: "dotted" },
  available: { label: "학습 가능", icon: "branch", pattern: "solid" },
  "in-progress": { label: "진행 중", icon: "spore", pattern: "solid" },
  complete: { label: "완료", icon: "check", pattern: "solid" },
  mastered: { label: "숙련", icon: "ring", pattern: "double" },
  review: { label: "재학습 권장", icon: "arrowDown", pattern: "dashed" },
};

type Props = {
  /** Server-owned progress. Absent entries render as `locked`/`available`. */
  states?: Partial<Record<DomainId, NodeState>>;
  headingLevel?: "h2" | "h3";
};

export function AccessibleRoadmapList({ states = {}, headingLevel = "h3" }: Props) {
  const tiers = [1, 2, 3] as const;

  return (
    <div className={styles.wrapper}>
      {tiers.map((tier) => {
        const domains = DOMAINS.filter((d) => d.tier === tier);
        if (domains.length === 0) return null;
        const Heading = headingLevel;

        return (
          <section key={tier} className={styles.tier} aria-labelledby={`tier-${tier}`}>
            <Heading className={styles.tierHeading} id={`tier-${tier}`}>
              <span className={styles.tierIndex}>{String(tier).padStart(2, "0")}</span>
              <span>
                {tier === 1 ? "지반" : tier === 2 ? "줄기" : "가지"}
                <span className={styles.tierEn}>
                  {tier === 1 ? "Ground" : tier === 2 ? "Trunk" : "Branches"}
                </span>
              </span>
            </Heading>

            <ul className={styles.list}>
              {domains.map((domain) => {
                const state: NodeState =
                  states[domain.id] ?? (domain.requires.length === 0 ? "available" : "locked");
                const meta = STATE_META[state];

                return (
                  <li key={domain.id} className={styles.item} data-pattern={meta.pattern}>
                    <Link href={`/roadmap#${domain.id}`} className={styles.link} id={domain.id}>
                      <span className={styles.name}>
                        {domain.nameKo}
                        <span className={styles.nameEn}>{domain.name}</span>
                      </span>
                      <span className={styles.summary}>{domain.summaryKo}</span>
                      <span className={styles.state}>
                        <PixelIcon name={meta.icon} size={16} selected={state !== "locked"} />
                        {meta.label}
                      </span>
                    </Link>

                    {domain.requires.length > 0 && (
                      <p className={styles.requires}>
                        선행:{" "}
                        {domain.requires.map((id, index) => (
                          <span key={id}>
                            {index > 0 && ", "}
                            {domainById(id).nameKo}
                          </span>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
