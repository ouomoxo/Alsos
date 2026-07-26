import styles from "./Seasons.module.css";

/**
 * Section 07 — Community and Seasons.
 *
 * §7 is explicit: with no real community data, no partner logos, no
 * testimonials and no activity counts. So this section describes the *system* —
 * how events change the forest — and claims nothing about participation that we
 * cannot currently substantiate. When real seasons run, the copy stays and the
 * numbers arrive underneath it.
 */

const SEASONS = [
  {
    id: "ctf",
    name: "CTF",
    nameKo: "정기 CTF",
    effectKo: "참가하면 정원에 해당 시즌의 식물이나 기념물이 해금됩니다.",
  },
  {
    id: "season",
    name: "Season",
    nameKo: "시즌 전환",
    effectKo: "안개의 밀도, 빛의 각도, 포자의 양이 시즌마다 달라집니다.",
  },
  {
    id: "collective",
    name: "Collective",
    nameKo: "공동 목표",
    effectKo: "커뮤니티 전체가 하나의 숲을 함께 키웁니다.",
  },
  {
    id: "titles",
    name: "Titles",
    nameKo: "칭호",
    effectKo: "정원 안의 작은 석판과 문양으로 남습니다. 배지가 아닙니다.",
  },
] as const;

export function Seasons() {
  return (
    <section className={styles.section} aria-labelledby="seasons-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="seasons-heading">
            Seasons
            <br />
            Change the Forest.
          </h2>
          <p className={styles.lede}>
            커뮤니티 활동은 순위표가 아니라 계절로 나타납니다. 시즌이 바뀌면 숲의 빛과 공기가
            달라지고, 그 시기에 참여한 흔적이 정원에 남습니다.
          </p>
        </header>

        {/* A horizontal band — one continuous year, not four cards. */}
        <ol className={styles.band}>
          {SEASONS.map((season, index) => (
            <li key={season.id} className={styles.season}>
              <span className={styles.marker} aria-hidden="true" />
              <p className={styles.seasonIndex}>{String(index + 1).padStart(2, "0")}</p>
              <h3 className={styles.seasonName}>
                {season.nameKo}
                <span className={styles.seasonNameEn}>{season.name}</span>
              </h3>
              <p className={styles.seasonBody}>{season.effectKo}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
