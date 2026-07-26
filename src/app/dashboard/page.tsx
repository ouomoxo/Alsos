import type { Metadata } from "next";
import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { ProfileTree } from "@/components/growth/ProfileTree";
import { GROWTH_STAGES, domainById } from "@/lib/content/curriculum";
import { SAMPLE_CONTINUE, SAMPLE_SNAPSHOT } from "@/lib/content/sample-learner";
import { nextStageXp, stageProgress } from "@/lib/growth/growth-model";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "대시보드" };

/**
 * §8.1: the first thing on this page is what to learn next — not XP.
 *
 * The XP figure is present but deliberately small and low in the order. A big
 * animated points counter is the casino-reward pattern the brief rules out.
 */
export default function DashboardPage() {
  const snapshot = SAMPLE_SNAPSHOT;
  const stage = GROWTH_STAGES.find((s) => s.id === snapshot.stage)!;
  const progress = stageProgress(snapshot.totalXp);
  const next = nextStageXp(snapshot.totalXp);
  const continueDomain = domainById(SAMPLE_CONTINUE.domain);

  return (
    <div className={styles.page}>
      <p className={styles.sampleNotice}>
        <PixelIcon name="boundary" size={16} />
        샘플 데이터로 구성된 화면입니다. 실제 학습 기록이 연결되면 이 표시는 사라집니다.
      </p>

      {/* 1. Continue learning — the single most important thing here. */}
      <section className={styles.continue} aria-labelledby="continue-heading">
        <h1 className={styles.continueHeading} id="continue-heading">
          이어서 학습하기
        </h1>
        <Link href={`/labs/${SAMPLE_CONTINUE.labId}`} className={styles.continueCard}>
          <span className={styles.continueMeta}>
            {continueDomain.nameKo} · LAB {String(SAMPLE_CONTINUE.labNumber).padStart(3, "0")}
          </span>
          <span className={styles.continueTitle}>{SAMPLE_CONTINUE.title}</span>
          <span className={styles.continueProgress}>
            <span className={styles.continueTrack}>
              <span
                className={styles.continueFill}
                style={{ inlineSize: `${(SAMPLE_CONTINUE.step / SAMPLE_CONTINUE.totalSteps) * 100}%` }}
              />
            </span>
            <span className={styles.continueStep}>
              {SAMPLE_CONTINUE.step} / {SAMPLE_CONTINUE.totalSteps} 단계
            </span>
          </span>
        </Link>
      </section>

      <div className={styles.columns}>
        {/* 2. Where you are on the roadmap. */}
        <section className={styles.block} aria-labelledby="position-heading">
          <h2 className={styles.blockHeading} id="position-heading">
            현재 로드맵 위치
          </h2>
          <ul className={styles.positionList}>
            {Object.entries(snapshot.domainProgress).map(([id, value]) => {
              const domain = domainById(id as Parameters<typeof domainById>[0]);
              const percent = Math.round((value ?? 0) * 100);
              return (
                <li key={id} className={styles.positionItem}>
                  <span className={styles.positionName}>{domain.nameKo}</span>
                  <span className={styles.positionTrack}>
                    <span className={styles.positionFill} style={{ inlineSize: `${percent}%` }} />
                  </span>
                  <span className={styles.positionValue}>{percent}%</span>
                </li>
              );
            })}
          </ul>
          <Link href="/roadmap" className={styles.blockLink}>
            <PixelIcon name="arrowRight" size={16} />
            로드맵 열기
          </Link>
        </section>

        {/* 3. Growth state — structural, quiet, no confetti. */}
        <section className={styles.block} aria-labelledby="growth-heading">
          <h2 className={styles.blockHeading} id="growth-heading">
            나무 성장 상태
          </h2>
          <div className={styles.growth}>
            <ProfileTree snapshot={snapshot} size={148} label={null} />
            <div className={styles.growthMeta}>
              <p className={styles.growthStage}>
                {stage.label}
                <span className={styles.growthStageKo}>{stage.labelKo}</span>
              </p>
              <p className={styles.growthXp}>
                {snapshot.totalXp.toLocaleString("ko-KR")} XP
                {next && (
                  <span className={styles.growthNext}>
                    다음 단계까지 {(next - snapshot.totalXp).toLocaleString("ko-KR")}
                  </span>
                )}
              </p>
              <span className={styles.positionTrack}>
                <span
                  className={styles.positionFill}
                  style={{ inlineSize: `${Math.round(progress * 100)}%` }}
                />
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
