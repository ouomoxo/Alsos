import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { domainById } from "@/lib/content/curriculum";
import { LABS, labById } from "@/lib/content/labs";

import styles from "./page.module.css";

type Params = { params: Promise<{ labId: string }> };

export function generateStaticParams() {
  return LABS.map((lab) => ({ labId: lab.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lab = labById((await params).labId);
  return { title: lab ? lab.title : "실습 Lab" };
}

/**
 * The Lab screen — visual intensity 1/10 (§1, §8.3).
 *
 * This is a static presentation of the workspace, not a working environment.
 * Even so it follows the Lab rules exactly, because the layout is the point:
 * monospace only in the code area, 14px minimum, no decorative particles, no
 * ambient motion, high contrast held separately from the marketing palette.
 */
export default async function LabPage({ params }: Params) {
  const lab = labById((await params).labId);
  if (!lab) notFound();

  const domain = domainById(lab.domain);

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="위치">
        <Link href="/labs">실습 Lab</Link>
        <PixelIcon name="chevronRight" size={16} />
        <span>{domain.nameKo}</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.number}>LAB {String(lab.number).padStart(3, "0")}</p>
        <h1 className={styles.heading}>{lab.title}</h1>
        <p className={styles.notice}>
          <PixelIcon name="boundary" size={16} />
          화면 구성 미리보기입니다. 터미널은 동작하지 않습니다.
        </p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.terminalPanel} aria-labelledby="terminal-heading">
          <h2 className={styles.panelHeading} id="terminal-heading">
            터미널
          </h2>
          <div className={styles.terminal}>
            <p className={styles.prompt}>alsos@lab:~$ whoami</p>
            <p className={styles.output}>learner</p>
            <p className={styles.prompt}>alsos@lab:~$ cat /etc/alsos/lab.conf</p>
            <p className={styles.output}>target = https://target.lab</p>
            <p className={styles.output}>scope  = session, cookies</p>
            <p className={styles.prompt}>
              alsos@lab:~$ <span className={styles.cursor} />
            </p>
          </div>
        </section>

        <aside className={styles.brief}>
          <section aria-labelledby="objective-heading">
            <h2 className={styles.panelHeading} id="objective-heading">
              목표
            </h2>
            <p className={styles.objective}>{lab.objectiveKo}</p>
          </section>

          <section aria-labelledby="steps-heading">
            <h2 className={styles.panelHeading} id="steps-heading">
              단계
            </h2>
            <ol className={styles.steps}>
              {Array.from({ length: lab.steps }, (_, i) => (
                <li key={i} className={styles.step} data-state={i < 2 ? "done" : i === 2 ? "current" : "todo"}>
                  <PixelIcon name={i < 2 ? "check" : "boundary"} size={16} selected={i <= 2} />
                  <span>{i + 1}단계</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="hint-heading">
            <h2 className={styles.panelHeading} id="hint-heading">
              힌트
            </h2>
            <p className={styles.hint}>힌트는 단계별로 순차 공개됩니다.</p>
          </section>
        </aside>
      </div>

      <div className={styles.progress}>
        <span className={styles.progressLabel}>진행</span>
        <span className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ inlineSize: `${(2 / lab.steps) * 100}%` }} />
        </span>
        <span className={styles.progressValue}>
          2 / {lab.steps}
        </span>
      </div>
    </div>
  );
}
