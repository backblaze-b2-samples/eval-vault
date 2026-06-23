import { Badge } from "@/components/ui/badge";

interface ScoreBadgeProps {
  // 0..1 score, or null when no value exists for a cell.
  score: number | null;
  passed?: boolean;
}

/** Renders a 0..1 score as a colored percentage badge. */
export function ScoreBadge({ score, passed }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <Badge variant="outline" className="font-mono text-muted-foreground">—</Badge>;
  }
  const pct = Math.round(score * 100);
  const isGood = passed ?? score >= 0.5;
  return (
    <Badge
      variant="outline"
      className="font-mono tabular-nums"
      style={{
        borderColor: isGood ? "var(--success)" : "var(--destructive)",
        color: isGood ? "var(--success)" : "var(--destructive)",
      }}
    >
      {pct}%
    </Badge>
  );
}
