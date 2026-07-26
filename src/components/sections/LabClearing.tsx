import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";

import styles from "./LabClearing.module.css";

/**
 * Section 04 — Labs: Clearings in the Forest.
 *
 * One large lab surface rather than a row of feature cards (§7). The panel is a
 * faithful still of the real Lab chrome: terminal on the left, brief on the
 * right, progress underneath. Note what is *absent* — no particles, no noise,
 * no ambient motion inside the terminal. §8.3 makes the Lab a workspace, and
 * showing it any other way would be advertising a product we should not build.
 */

const TRANSCRIPT = [
  { kind: "prompt", text: "alsos@lab:~$ curl -s -I https://target.lab/session" },
  { kind: "output", text: "HTTP/2 200" },
  { kind: "output", text: "set-cookie: sid=8f2a...; Path=/; HttpOnly" },
  { kind: "note", text: "# Secure 플래그가 없습니다. 어떤 상황에서 문제가 되는지 확인하세요." },
  { kind: "prompt", text: "alsos@lab:~$ " },
] as const;

const OBJECTIVES = [
  { done: true, text: "세션 쿠키의 속성을 확인한다" },
  { done: true, text: "누락된 보안 플래그를 식별한다" },
  { done: false, text: "평문 채널에서 세션을 가로챈다" },
  { done: false, text: "완화 방안을 서술한다" },
] as const;

export function LabClearing() {
  return (
    <section className={styles.section} aria-labelledby="labs-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="labs-heading">
            Clearings
            <br />
            in the Forest.
          </h2>
          <p className={styles.lede}>
            Lab은 숲속의 빈 공간입니다. 장식이 없고, 조명이 균일하며, 화면 안의 모든 것이 작업에
            필요한 것뿐입니다. 읽고, 시도하고, 증명합니다.
          </p>
        </header>

        {/* A still of the Lab surface. aria-hidden: the real thing lives at
            /labs, and duplicating its content here would just be noise for a
            screen reader. */}
        <div className={styles.panel} aria-hidden="true">
          <div className={styles.panelBar}>
            <span className={styles.panelTitle}>
              <PixelIcon name="clearing" size={16} selected />
              WEB-SECURITY / SESSION-FIXATION
            </span>
            <span className={styles.panelMeta}>LAB 014</span>
          </div>

          <div className={styles.panelBody}>
            <div className={styles.terminal}>
              {TRANSCRIPT.map((line, i) => (
                <p key={i} className={styles.line} data-kind={line.kind}>
                  {line.text}
                  {line.kind === "prompt" && i === TRANSCRIPT.length - 1 && (
                    <span className={styles.cursor} />
                  )}
                </p>
              ))}
            </div>

            <div className={styles.brief}>
              <h3 className={styles.briefHeading}>목표</h3>
              <ul className={styles.objectives}>
                {OBJECTIVES.map((objective) => (
                  <li key={objective.text} className={styles.objective} data-done={objective.done}>
                    <PixelIcon name={objective.done ? "check" : "boundary"} size={16} selected={objective.done} />
                    <span>{objective.text}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>힌트는 단계적으로 열립니다.</p>
            </div>
          </div>

          <div className={styles.progress}>
            <span className={styles.progressLabel}>진행</span>
            <span className={styles.progressTrack}>
              <span className={styles.progressFill} style={{ inlineSize: "50%" }} />
            </span>
            <span className={styles.progressValue}>2 / 4</span>
          </div>
        </div>

        <p className={styles.completion}>
          Lab을 완료하면 폭죽이 터지지 않습니다. 화면 가장자리에서 가지 하나가 조용히 자랍니다.
        </p>

        <Link href="/labs" className={styles.link}>
          <PixelIcon name="arrowRight" size={16} />
          Lab 살펴보기
        </Link>
      </div>
    </section>
  );
}
