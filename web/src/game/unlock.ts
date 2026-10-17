// The dial's locks (Gaylord, 2026-10-17): tracks 1 to 5 play for anyone; track n from 6 up opens once this wallet has
// posted n-5 records with one at (n-5) x 1000 points or more. Any track's record counts, open, smashed or expired alike.
export const FREE = 5;
/** What dial position i (0-based) asks for, or null when it is free */
export const need = (i: number) => (i < FREE ? null : { records: i + 1 - FREE, score: (i + 1 - FREE) * 1000 });
/** Whether position i plays, given the scores of the records this wallet posted */
export const unlocked = (i: number, scores: number[]) => { const n = need(i); return !n || (scores.length >= n.records && scores.some((x) => x >= n.score)); };
