import Link from "next/link";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentRunsTable } from "@/components/dashboard/recent-uploads-table";
import { ScoreTrendChart } from "@/components/dashboard/upload-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Eval Scoreboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Every eval run is archived to Backblaze B2 — inputs, outputs, scores, and traces.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/evals">
            <Play className="h-3.5 w-3.5" />
            Run an eval
          </Link>
        </Button>
      </div>
      <StatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <ScoreTrendChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentRunsTable />
        </div>
      </div>
    </div>
  );
}
