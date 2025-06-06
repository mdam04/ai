
"use client";

import type { PlaywrightExecutionResult } from "@/app/actions/execute-playwright-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import { CheckCircle, XCircle, FileText, ServerCrash, Clock, Film, Image as ImageIcon } from 'lucide-react';
import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface TestExecutionDisplayProps {
  report: PlaywrightExecutionResult;
  onBackToReview: () => void;
}

export default function TestExecutionDisplay({ report, onBackToReview }: TestExecutionDisplayProps) {

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          {report.success ? <CheckCircle className="h-7 w-7 text-green-500 mr-2" /> : <XCircle className="h-7 w-7 text-red-500 mr-2" />}
          Test Execution Report: {report.scenario}
        </CardTitle>
        <CardDescription>
          Detailed results of the actual Playwright test execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant={report.success ? "default" : "destructive"} className={report.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}>
          {report.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
          <AlertTitle className="font-headline">
            Status: {report.success ? "Passed" : "Failed"}
            {report.duration && <span className="text-sm font-normal text-muted-foreground ml-2">({(report.duration / 1000).toFixed(2)}s)</span>}
          </AlertTitle>
          {report.error && <AlertDescription className="mt-1 font-code text-xs">{report.error}</AlertDescription>}
        </Alert>

        {report.screenshotDataUri && (
          <div>
            <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
              <ImageIcon className="mr-2 h-5 w-5 text-primary" />
              Final Screenshot
            </h3>
            <div className="border rounded-md overflow-hidden shadow-md">
              <Image 
                src={report.screenshotDataUri} 
                alt={`Screenshot for test: ${report.scenario}`} 
                width={800} 
                height={600}
                layout="responsive"
                className="object-contain"
                data-ai-hint="test screenshot"
              />
            </div>
          </div>
        )}
        
        {report.videoPath && (
            <div>
              <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
                <Film className="mr-2 h-5 w-5 text-primary" />
                Video of Execution (on failure)
              </h3>
              <Alert variant="default">
                <Film className="h-4 w-4" />
                <AlertTitle>Video Recorded</AlertTitle>
                <AlertDescription>
                  A video of the test execution was recorded because the test failed or video is set to always retain. Path on server: {report.videoPath}.
                  <br />
                  (Displaying video directly in the browser from this path is not implemented in this version.)
                </AlertDescription>
              </Alert>
            </div>
          )}


        {report.logs && report.logs.length > 0 && (
           <div>
            <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-primary" />
              Execution Logs & Output
            </h3>
            <ScrollArea className="h-48 rounded-md border p-3 bg-secondary/30">
              <pre className="text-xs font-code whitespace-pre-wrap">
                {report.logs.join('\n')}
                {report.stdout && `\n--- STDOUT ---\n${report.stdout}`}
                {report.stderr && `\n--- STDERR ---\n${report.stderr}`}
              </pre>
            </ScrollArea>
          </div>
        )}
        
        {report.attachments && report.attachments.length > 0 && (
          <div>
            <h3 className="font-headline text-lg font-semibold mb-2 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-primary" />
              Attachments
            </h3>
            <ScrollArea className="h-32 rounded-md border p-3 bg-secondary/30">
              <ul className="text-xs font-code space-y-1">
                {report.attachments.map((att, index) => (
                  <li key={index}>
                    <strong>{att.name}</strong> ({att.contentType})
                    {att.path && <span> - Path: {att.path}</span>}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}


      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={onBackToReview}>
          Back to Test Cases
        </Button>
      </CardFooter>
    </Card>
  );
}
