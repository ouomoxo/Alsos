import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { ProfileTree } from "@/components/growth/ProfileTree";
import { GROWTH_STAGES, domainById, type DomainId } from "@/lib/content/curriculum";
import { SAMPLE_LEARNER, SAMPLE_SNAPSHOT } from "@/lib/content/sample-learner";
import { nextStageXp, stageProgress } from "@/lib/growth/growth-model";

import styles from "./page.module.css";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `${(await params).username} 프로필` };
}

/**
 * §8.5: the profile tree reflects capability structure, not a level avatar.
 *
 * The same `buildTreeGeometry` used on the marketing page draws it, seeded by
 * the snapshot's `visualSeed`, so this learner's tree is identical on every
 * visit and every device — the determinism requirement is the whole reason the
 * geometry is a pure function of the snapshot.
 */
export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  if (username !== SAMPLE_LEARNER.username) notFound();

  const snapshot = SAMPLE_SNAPSHOT;
  const stage = GROWTH_STAGES.find((s) => s.id === snapshot.stage)!;
  const next = nextStageXp(snapshot.totalXp);
  const progress = stageProgress(snapshot.totalXp);

  const domainEntries = Object.entries(snapshot.domainProgress) as [DomainId, number][];

  return (
    <div className={styles.page}>
      <p className={styles.notice}>
        <PixelIcon name="boundary" size={16} />
        샘플 프로필입니다.
      </p>

      <header className={styles.header}>
        <div className={styles.figure}>
          <ProfileTree
            snapshot={snapshot}
            size={260}
            label={`${stage.labelKo} 단계의 성장 나무`}
          />
        </div>

        <div className={styles.identity}>
          <h1 className={styles.name}>{SAMPLE_LEARNER.displayName}</h1>
          <p className={styles.handle}>@{SAMPLE_LEARNER.username}</p>

          <p className={styles.stage}>
            <span className={styles.stageLabel}>{stage.label}</span>
            <span className={styles.stageKo}>{stage.labelKo}</span>
          </p>
          <p className={styles.structure}>{stage.structureKo}</p>

          <div className={styles.xpRow}>
            <span className={styles.xp}>{snapshot.totalXp.toLocaleString("ko-KR")} XP</span>
            {next && (
              <span className={styles.xpNext}>
                다음 단계까지 {(next - snapshot.totalXp).toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          <span className={styles.track}>
            <span className={styles.fill} style={{ inlineSize: `${Math.round(progress * 100)}%` }} />
          </span>
        </div>
      </header>

      <section aria-labelledby="domains-heading">
        <h2 className={styles.sectionHeading} id="domains-heading">
          전문 분야
        </h2>
        <ul className={styles.domains}>
          {domainEntries.map(([id, value]) => (
            <li key={id} className={styles.domainItem}>
              <span className={styles.domainName}>{domainById(id).nameKo}</span>
              <span className={styles.track}>
                <span className={styles.fill} style={{ inlineSize: `${Math.round(value * 100)}%` }} />
              </span>
              <span className={styles.domainValue}>{Math.round(value * 100)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rings-heading">
        <h2 className={styles.sectionHeading} id="rings-heading">
          나이테
        </h2>
        <p className={styles.rings}>
          완료한 Lab {snapshot.completedLabIds.length}개 · 나이테{" "}
          {Math.floor(snapshot.completedLabIds.length / 5)}줄
        </p>
        <p className={styles.ringsNote}>배움은 나이테로 남습니다.</p>
      </section>
    </div>
  );
}
