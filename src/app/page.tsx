
"use client";

import React, { useState, useEffect } from 'react';
import { analyzeGithubRepositoryAndGenerateTests, AnalyzeAndGenerateTestsInput, AnalyzeAndGenerateTestsOutput } from '@/ai/flows/analyze-github-repo';
import { executePlaywrightTest, PlaywrightExecutionResult } from '@/app/actions/execute-playwright-action';
import UrlInputForm, { UrlInputFormValues } from '@/components/playwright-genius/url-input-form';
import AnalysisResults from '@/components/playwright-genius/analysis-results';
import TestCaseReview from '@/components/playwright-genius/test-case-review';
import TestExecutionDisplay from '@/components/playwright-genius/test-execution-display';
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AppState = 
  | 'idle' 
  | 'analyzingAndGenerating'
  | 'reviewingTests' 
  | 'executingTest'
  | 'executingAllTests' // New state
  | 'viewingReport';

type AnalysisResultType = Omit<AnalyzeAndGenerateTestsOutput, 'testCases'>;
type TestCaseType = AnalyzeAndGenerateTestsOutput['testCases'][0];
type TestCasesOutputType = { testCases: AnalyzeAndGenerateTestsOutput['testCases'] };


export default function HomePage() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysisInput, setAnalysisInput] = useState<UrlInputFormValues | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultType | null>(null);
  const [testCasesOutput, setTestCasesOutput] = useState<TestCasesOutputType | null>(null);
  const [currentExecutingScenario, setCurrentExecutingScenario] = useState<TestCaseType | null>(null);
  const [executionReport, setExecutionReport] = useState<PlaywrightExecutionResult | null>(null);
  const [allExecutionReports, setAllExecutionReports] = useState<PlaywrightExecutionResult[]>([]);
  const [githubToken, setGithubToken] = useState<string>('');
  const [analysisDebugInfo, setAnalysisDebugInfo] = useState<AnalyzeAndGenerateTestsOutput['debugInfo'] | null>(null);


  const { toast } = useToast();

  useEffect(() => {
    const storedToken = localStorage.getItem('githubApiToken');
    if (storedToken) {
      setGithubToken(storedToken);
    }
  }, []);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setGithubToken(newToken);
    if (newToken) {
      localStorage.setItem('githubApiToken', newToken);
    } else {
      localStorage.removeItem('githubApiToken');
    }
  };

  const handleUrlSubmit = async (values: UrlInputFormValues) => {
    setAppState('analyzingAndGenerating');
    setError(null);
    setAnalysisInput(values);
    setAnalysisResult(null);
    setTestCasesOutput(null);
    setExecutionReport(null);
    setCurrentExecutingScenario(null);
    setAllExecutionReports([]);
    setAnalysisDebugInfo(null);

    try {
      const flowInput: AnalyzeAndGenerateTestsInput = {
        githubRepoUrl: values.githubRepoUrl,
        applicationUrl: values.applicationUrl,
        githubToken: githubToken || undefined,
      };
      toast({ title: "Starting Analysis & Test Generation", description: "Fetching repository data and generating tests..." });
      const result = await analyzeGithubRepositoryAndGenerateTests(flowInput);
      
      if (!result) {
        console.error("Analysis flow did not return a result:", result);
        const errorMessage = "AI analysis failed to return any data. This could be due to an issue with the AI model or the input provided. Please check server logs for more details and try again.";
        setError(errorMessage);
        toast({ variant: "destructive", title: "Analysis Error", description: errorMessage });
        setAppState('idle');
        return; 
      }
      
      setAnalysisResult({
        applicationLogicSummary: result.applicationLogicSummary,
        domStructureSummary: result.domStructureSummary,
        potentialUserFlows: result.potentialUserFlows,
        analysisSource: result.analysisSource, 
      });
      setTestCasesOutput({ testCases: result.testCases });
      setAnalysisDebugInfo(result.debugInfo || null);

      let toastTitle = "Analysis & Test Generation Complete";
      let toastDescription = result.debugInfo?.repoServiceMessage || 'Review the results below.';
      
      if (result.analysisSource.toLowerCase().includes("error") || 
          result.analysisSource.toLowerCase().includes("no repository data") ||
          (result.debugInfo?.repoServiceMessage && (result.debugInfo.repoServiceMessage.toLowerCase().includes("failed") || result.debugInfo.repoServiceMessage.toLowerCase().includes("error")))
         ) {
        toastTitle = "Analysis Issue";
      }

      toast({ 
        title: toastTitle, 
        description: toastDescription
      });
      setAppState('reviewingTests');

    } catch (e: any) {
      console.error("Analysis and test generation failed:", e);
      const errorMessage = `Analysis and test generation failed: ${e.message || 'Unknown error'}`;
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error", description: errorMessage });
      setAppState('idle');
    }
  };

  const handleExecuteScenario = async (scenario: TestCaseType | null) => {
    if (!scenario) {
      toast({ variant: "destructive", title: "Execution Error", description: "Please select a single scenario to execute." });
      return;
    }
    if (!analysisInput?.applicationUrl) {
      toast({ variant: "destructive", title: "Execution Error", description: "Application URL is missing." });
      return;
    }

    setAppState('executingTest');
    setCurrentExecutingScenario(scenario);
    setExecutionReport(null);
    setError(null);
    
    toast({ title: "Executing Test", description: `Running scenario: ${scenario.scenario}`});

    try {
      const report = await executePlaywrightTest(scenario, analysisInput.applicationUrl);
      setExecutionReport(report);
      if (report.success) {
        toast({ title: "Execution Complete", description: `${scenario.scenario} passed.` });
      } else {
        toast({ variant: "destructive", title: "Execution Failed", description: `${scenario.scenario} failed. ${report.error || ''}` });
      }
      setAppState('viewingReport');
    } catch (e: any) {
      console.error("Test execution failed:", e);
      const errorMessage = `Execution of '${scenario.scenario}' failed: ${e.message || 'Unknown server error'}`;
      setError(errorMessage);
      toast({ variant: "destructive", title: "Execution Error", description: errorMessage });
      setAppState('reviewingTests'); 
    }
  };

  const handleExecuteAllScenarios = async () => {
    if (!testCasesOutput || testCasesOutput.testCases.length === 0) {
      toast({ variant: "destructive", title: "Execution Error", description: "No test cases available to execute." });
      return;
    }
    if (!analysisInput?.applicationUrl) {
      toast({ variant: "destructive", title: "Execution Error", description: "Application URL is missing." });
      return;
    }

    setAppState('executingAllTests');
    setError(null);
    setAllExecutionReports([]);
    let overallSuccess = true;
    let failedCount = 0;

    toast({ title: "Starting All Tests", description: `Executing ${testCasesOutput.testCases.length} scenarios...`});

    for (let i = 0; i < testCasesOutput.testCases.length; i++) {
      const scenario = testCasesOutput.testCases[i];
      setCurrentExecutingScenario(scenario); // Visually indicate current test (optional, depends on UI)
      toast({ title: `Executing (${i + 1}/${testCasesOutput.testCases.length})`, description: scenario.scenario });
      try {
        const report = await executePlaywrightTest(scenario, analysisInput.applicationUrl);
        setAllExecutionReports(prev => [...prev, report]);
        if (report.success) {
          toast({ title: "Test Passed", description: `${scenario.scenario}` });
        } else {
          overallSuccess = false;
          failedCount++;
          toast({ variant: "destructive", title: "Test Failed", description: `${scenario.scenario}: ${report.error || 'Unknown reason'}` });
        }
      } catch (e: any) {
        overallSuccess = false;
        failedCount++;
        const errorMessage = `Execution of '${scenario.scenario}' failed: ${e.message || 'Unknown server error'}`;
        setError(prevError => prevError ? `${prevError}\n${errorMessage}` : errorMessage); // Accumulate errors
        toast({ variant: "destructive", title: `Execution Error (${scenario.scenario})`, description: errorMessage });
        setAllExecutionReports(prev => [...prev, { scenario: scenario.scenario, success: false, logs: [errorMessage], stdout: "", stderr: "" }]);
      }
    }
    
    setCurrentExecutingScenario(null);
    if (overallSuccess) {
      toast({ title: "All Tests Completed", description: "All scenarios passed successfully!" });
    } else {
      toast({ variant: "destructive", title: "All Tests Completed", description: `${failedCount} scenario(s) failed. Check individual toasts/logs.` });
    }
    setAppState('reviewingTests'); // Or a new state to view summary if implemented
  };
  
  const handleReset = () => {
    setAppState('idle');
    setError(null);
    setAnalysisInput(null);
    setAnalysisResult(null);
    setTestCasesOutput(null);
    setCurrentExecutingScenario(null);
    setExecutionReport(null);
    setAllExecutionReports([]);
    setAnalysisDebugInfo(null);
  };

  // CRUD handlers for scenarios and steps
  const handleAddScenario = () => {
    setTestCasesOutput(prev => {
      const newScenario: TestCaseType = { scenario: "New Scenario", steps: ["await page.goto('/'); // New step for new scenario"] };
      return { testCases: [...(prev?.testCases || []), newScenario] };
    });
  };

  const handleEditScenarioName = (scenarioIndex: number, newName: string) => {
    setTestCasesOutput(prev => {
      if (!prev) return null;
      const updatedTestCases = [...prev.testCases];
      if(updatedTestCases[scenarioIndex]) {
        updatedTestCases[scenarioIndex] = { ...updatedTestCases[scenarioIndex], scenario: newName };
      }
      return { testCases: updatedTestCases };
    });
  };

  const handleDeleteScenario = (scenarioIndex: number) => {
    setTestCasesOutput(prev => {
      if (!prev) return null;
      const updatedTestCases = prev.testCases.filter((_, index) => index !== scenarioIndex);
      return { testCases: updatedTestCases };
    });
  };

  const handleAddStep = (scenarioIndex: number) => {
    setTestCasesOutput(prev => {
      if (!prev) return null;
      const updatedTestCases = [...prev.testCases];
      if(updatedTestCases[scenarioIndex]) {
        updatedTestCases[scenarioIndex] = {
          ...updatedTestCases[scenarioIndex],
          steps: [...updatedTestCases[scenarioIndex].steps, "// New step"]
        };
      }
      return { testCases: updatedTestCases };
    });
  };

  const handleEditStep = (scenarioIndex: number, stepIndex: number, newStepText: string) => {
    setTestCasesOutput(prev => {
      if (!prev) return null;
      const updatedTestCases = [...prev.testCases];
      if(updatedTestCases[scenarioIndex] && updatedTestCases[scenarioIndex].steps[stepIndex] !== undefined) {
        const updatedSteps = [...updatedTestCases[scenarioIndex].steps];
        updatedSteps[stepIndex] = newStepText;
        updatedTestCases[scenarioIndex] = { ...updatedTestCases[scenarioIndex], steps: updatedSteps };
      }
      return { testCases: updatedTestCases };
    });
  };

  const handleDeleteStep = (scenarioIndex: number, stepIndex: number) => {
    setTestCasesOutput(prev => {
      if (!prev) return null;
      const updatedTestCases = [...prev.testCases];
      if(updatedTestCases[scenarioIndex]) {
        const updatedSteps = updatedTestCases[scenarioIndex].steps.filter((_, index) => index !== stepIndex);
        updatedTestCases[scenarioIndex] = { ...updatedTestCases[scenarioIndex], steps: updatedSteps };
      }
      return { testCases: updatedTestCases };
    });
  };


  const isLoading = appState === 'analyzingAndGenerating';
  const isExecuting = appState === 'executingTest';
  const isExecutingAll = appState === 'executingAllTests';


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center space-y-8">
      
      {(appState === 'idle' || appState === 'analyzingAndGenerating') && (
        <>
          <UrlInputForm onSubmit={handleUrlSubmit} isLoading={isLoading} />
          <div className="w-full max-w-xl space-y-2 mt-4 p-4 border rounded-md shadow-sm bg-card">
            <Label htmlFor="githubToken" className="flex items-center text-sm font-medium text-muted-foreground">
              <Github className="mr-2 h-4 w-4" />
              GitHub API Token (Optional)
            </Label>
            <Input
              id="githubToken"
              type="password"
              value={githubToken}
              onChange={handleTokenChange}
              placeholder="Enter GitHub PAT for private repos / higher rate limits"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Token is stored in your browser's local storage. Leave blank for public repositories (rate limits may apply).
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="w-full max-w-2xl p-4 bg-destructive/10 border border-destructive text-destructive rounded-md flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p className="whitespace-pre-wrap">{error}</p>
        </div>
      )}
      
      {appState === 'analyzingAndGenerating' && (
         <div className="flex flex-col items-center justify-center text-muted-foreground p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="font-headline text-lg">Fetching Repository & Generating Tests...</p>
          <p>This may take a moment, especially for larger repositories.</p>
        </div>
      )}
      
      {analysisResult && (appState !== 'idle' && appState !== 'analyzingAndGenerating') && (
        <>
          <AnalysisResults results={analysisResult} debugInfo={analysisDebugInfo} />
          <Separator className="my-8" />
        </>
      )}

      {testCasesOutput && (appState === 'reviewingTests' || appState === 'executingTest' || appState === 'executingAllTests' || appState === 'viewingReport') && (
        <TestCaseReview 
          testCasesOutput={testCasesOutput} 
          onExecuteTests={handleExecuteScenario}
          isExecuting={isExecuting}
          onAddScenario={handleAddScenario}
          onEditScenarioName={handleEditScenarioName}
          onDeleteScenario={handleDeleteScenario}
          onAddStep={handleAddStep}
          onEditStep={handleEditStep}
          onDeleteStep={handleDeleteStep}
          onExecuteAllTests={handleExecuteAllScenarios}
          isExecutingAll={isExecutingAll}
        />
      )}
      
      {isExecuting && currentExecutingScenario && (
         <div className="flex flex-col items-center justify-center text-muted-foreground p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="font-headline text-lg">Executing: {currentExecutingScenario.scenario}</p>
          <p>Running Playwright test on the server...</p>
        </div>
      )}

      {isExecutingAll && (
         <div className="flex flex-col items-center justify-center text-muted-foreground p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="font-headline text-lg">Executing All Test Cases...</p>
          {currentExecutingScenario && <p className="text-sm">Currently running: {currentExecutingScenario.scenario}</p>}
          <p>Please wait, this may take some time.</p>
        </div>
      )}
      
      {appState === 'viewingReport' && executionReport && (
         <TestExecutionDisplay 
            report={executionReport}
            onBackToReview={() => setAppState('reviewingTests')}
          />
      )}

      {(appState !== 'idle' && appState !== 'analyzingAndGenerating' && !isExecutingAll) && (
        <Button variant="outline" onClick={handleReset} className="mt-8">
          Start New Analysis
        </Button>
      )}
    </div>
  );
}

