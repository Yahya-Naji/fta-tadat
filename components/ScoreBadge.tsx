type ScoreLetter = "A" | "B" | "C" | "D" | "B+" | "C+" | "D+" | string;

const cls: Record<string, string> = {
  A: "score-badge score-badge-a",
  "B+": "score-badge score-badge-b",
  B: "score-badge score-badge-b",
  "C+": "score-badge score-badge-c",
  C: "score-badge score-badge-c",
  "D+": "score-badge score-badge-d",
  D: "score-badge score-badge-d",
};

export function ScoreBadge({ score }: { score: ScoreLetter | undefined }) {
  if (!score) return <span className="score-badge score-badge-d">—</span>;
  return <span className={cls[score] ?? "score-badge score-badge-d"}>{score}</span>;
}
