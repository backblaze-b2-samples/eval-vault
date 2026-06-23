"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtifact } from "@/lib/queries";

type Kind = "input" | "output" | "score" | "trace";
const KINDS: Kind[] = ["input", "output", "score", "trace"];

interface ArtifactViewerProps {
  runId: string;
  caseId: string | undefined;
  targetId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ArtifactPane({
  runId,
  caseId,
  targetId,
  kind,
  active,
}: {
  runId: string;
  caseId: string | undefined;
  targetId: string | undefined;
  kind: Kind;
  active: boolean;
}) {
  const { data, isLoading, error } = useArtifact(runId, caseId, targetId, kind, active);
  return (
    <ScrollArea className="h-[50vh] rounded-md border bg-muted/30">
      {isLoading ? (
        <Skeleton className="h-40 w-full m-3" />
      ) : error ? (
        <p className="p-4 text-sm text-destructive">{error.message}</p>
      ) : (
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </ScrollArea>
  );
}

export function ArtifactViewer({
  runId,
  caseId,
  targetId,
  open,
  onOpenChange,
}: ArtifactViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {caseId} × {targetId}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="output" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="capitalize">
                {k}
              </TabsTrigger>
            ))}
          </TabsList>
          {KINDS.map((k) => (
            <TabsContent key={k} value={k}>
              <ArtifactPane
                runId={runId}
                caseId={caseId}
                targetId={targetId}
                kind={k}
                active={open}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
