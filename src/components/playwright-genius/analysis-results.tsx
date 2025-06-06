
"use client";

import type { AnalyzeAndGenerateTestsOutput } from "@/ai/flows/analyze-github-repo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Code, Users, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AnalysisResultsProps {
  results: Omit<AnalyzeAndGenerateTestsOutput, 'testCases'>;
  debugInfo: AnalyzeAndGenerateTestsOutput['debugInfo'] | null;
}

export default function AnalysisResults({ results, debugInfo }: AnalysisResultsProps) {
  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Analysis Results</CardTitle>
        <CardDescription>
          Summary of the application based on repository and URL analysis.
        </CardDescription>
        {results.analysisSource && (
            <div className="pt-2">
                <Badge variant={results.analysisSource.startsWith("GitHub API") ? "default" : "secondary"}>
                    Source: {results.analysisSource}
                </Badge>
            </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
            <Brain className="mr-2 h-5 w-5 text-primary" />
            Application Logic Summary
          </h3>
          <ScrollArea className="h-32 rounded-md border p-3 bg-secondary/30">
            <p className="text-sm font-code whitespace-pre-wrap">{results.applicationLogicSummary}</p>
          </ScrollArea>
        </div>
        <div>
          <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
            <Code className="mr-2 h-5 w-5 text-primary" />
            DOM Structure Summary
          </h3>
          <ScrollArea className="h-32 rounded-md border p-3 bg-secondary/30">
            <p className="text-sm font-code whitespace-pre-wrap">{results.domStructureSummary}</p>
          </ScrollArea>
        </div>
        <div>
          <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
            <Users className="mr-2 h-5 w-5 text-primary" />
            Potential User Flows
          </h3>
          <ScrollArea className="h-32 rounded-md border p-3 bg-secondary/30">
            <p className="text-sm font-code whitespace-pre-wrap">{results.potentialUserFlows}</p>
          </ScrollArea>
        </div>
        {debugInfo && (
          <div>
            <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
              <Info className="mr-2 h-5 w-5 text-muted-foreground" />
              Repository Fetch Details
            </h3>
            <div className="text-xs p-3 rounded-md border bg-secondary/30 text-muted-foreground font-code space-y-1">
              <p>Files Processed: {debugInfo.filesFetched ?? 'N/A'}</p>
              <p>Total Content Size (approx chars): {debugInfo.totalContentLength ?? 'N/A'}</p>
              {debugInfo.repoServiceMessage && <p>Message: {debugInfo.repoServiceMessage}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
