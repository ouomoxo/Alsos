/**
 * The public site converts; the product app does the work.
 *
 * Every learning action leaves this origin, so these are the only two exits
 * that matter. Kept in one place because they are also the boundary of what
 * this repository is allowed to implement.
 */
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.alsos.io";

export const APP_URLS = {
  signup: `${APP_ORIGIN}/signup`,
  login: `${APP_ORIGIN}/login`,
} as const;
