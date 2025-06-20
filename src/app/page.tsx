"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Play, 
  History, 
  Plus, 
  Trash2, 
  Download,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

// Import components
import UrlInputForm, { UrlInputFormValues } from '@/components/playwright-genius/url-input-form';
import AnalysisResults from '@/components/playwright-genius/analysis-results';
import TestCaseReview from '@/components/playwright-genius/test-case-review';
import TestExecutionDisplay from '@/components/playwright-genius/test-execution-display';

// Import services and types
import { analyzeGithubRepositoryAndGenerateTests, AnalyzeAndGenerateTestsInput, AnalyzeAndGenerateTestsOutput } from '@/ai/flows/analyze-github-repo';
import { executePlaywrightTest, PlaywrightExecutionResult } from '@/app/actions/execute-playwright-action';
import { 
  createTestSession, 
  getTestSession, 
  updateTestSessionExecution, 
  getTestSessionSummaries,
  deleteTestSession 
} from '@/services/test-session-service';
import { TestSessionSummary } from '@/models/TestSession';

type AnalysisResultType = Omit<AnalyzeAndGenerateTestsOutput, 'testCases'>;
type TestCaseType = AnalyzeAndGenerateTestsOutput['testCases'][0];
type TestCasesOutputType = { testCases: AnalyzeAndGenerateTestsOutput['testCases'] };

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Analysis data
  const [analysisInput, setAnalysisInput] = useState<UrlInputFormValues | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultType | null>(null);
  const [testCasesOutput, setTestCasesOutput] = useState<TestCasesOutputType | null>(null);
  const [analysisDebugInfo, setAnalysisDebugInfo] = useState<AnalyzeAndGenerateTestsOutput['debugInfo'] | null>(null);
  
  // Execution data
  const [executionResults, setExecutionResults] = useState<PlaywrightExecutionResult[]>([]);
  const [currentExecutingScenario, setCurrentExecutingScenario] = useState<TestCaseType | null>(null);
  
  // History data
  const [sessionHistory, setSessionHistory] = useState<TestSessionSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { toast } = useToast();

  // Load session history on component mount
  useEffect(() => {
    loadSessionHistory();
  }, []);

  const loadSessionHistory = async () => {
    setLoadingHistory(true);
    try {
      const summaries = await getTestSessionSummaries();
      setSessionHistory(summaries);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load session history: ${error.message}`
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAnalyze = async (values: UrlInputFormValues) => {
    setIsAnalyzing(true);
    setAnalysisInput(values);
    setAnalysisResult(null);
    setTestCasesOutput(null);
    setExecutionResults([]);
    setCurrentSessionId(null);
    setAnalysisDebugInfo(null);

    try {
      const flowInput: AnalyzeAndGenerateTestsInput = {
        githubRepoUrl: values.githubRepoUrl,
        applicationUrl: values.applicationUrl,
        githubToken: values.githubToken || undefined,
      };

      toast({ title: "Starting Analysis", description: "Analyzing repository and generating tests..." });
      
      const result = await analyzeGithubRepositoryAndGenerateTests(flowInput);
      
      if (!result) {
        throw new Error("Analysis failed to return any data");
      }
      
      // Store analysis results
      setAnalysisResult({
        applicationLogicSummary: result.applicationLogicSummary,
        domStructureSummary: result.domStructureSummary,
        potentialUserFlows: result.potentialUserFlows,
        analysisSource: result.analysisSource,
      });
      setTestCasesOutput({ testCases: result.testCases });
      setAnalysisDebugInfo(result.debugInfo || null);

      // Save to MongoDB
      const sessionId = await createTestSession({
        githubRepoUrl: values.githubRepoUrl,
        applicationUrl: values.applicationUrl,
        githubToken: values.githubToken,
        analysisResult: {
          applicationLogicSummary: result.applicationLogicSummary,
          domStructureSummary: result.domStructureSummary,
          potentialUserFlows: result.potentialUserFlows,
          analysisSource: result.analysisSource,
        },
        testCases: result.testCases,
      });
      
      setCurrentSessionId(sessionId);
      
      toast({ 
        title: "Analysis Complete", 
        description: "Test cases generated and saved successfully!"
      });
      
      // Switch to test cases tab
      setActiveTab('test-cases');
      
      // Refresh history
      loadSessionHistory();

    } catch (error: any) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || 'Unknown error occurred'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteScenario = async (scenario: TestCaseType) => {
    if (!analysisInput?.applicationUrl || !currentSessionId) {
      toast({
        variant: "destructive",
        title: "Execution Error",
        description: "Missing application URL or session data"
      });
      return;
    }

    setIsExecuting(true);
    setCurrentExecutingScenario(scenario);
    
    toast({ title: "Executing Test", description: `Running: ${scenario.scenario}` });

    try {
      const result = await executePlaywrightTest(scenario, analysisInput.applicationUrl);
      
      // Add execution timestamp
      const executionResult = {
        ...result,
        executedAt: new Date(),
      };
      
      // Update local state
      setExecutionResults(prev => [...prev, executionResult]);
      
      // Save to MongoDB
      await updateTestSessionExecution(currentSessionId, executionResult);
      
      if (result.success) {
        toast({ title: "Test Passed", description: scenario.scenario });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Test Failed", 
          description: `${scenario.scenario}: ${result.error || 'Unknown error'}` 
        });
      }
      
      // Switch to results tab
      setActiveTab('results');
      
      // Refresh history
      loadSessionHistory();

    } catch (error: any) {
      console.error("Test execution failed:", error);
      toast({
        variant: "destructive",
        title: "Execution Error",
        description: error.message || 'Unknown error occurred'
      });
    } finally {
      setIsExecuting(false);
      setCurrentExecutingScenario(null);
    }
  };

  const handleExecuteAllScenarios = async () => {
    if (!testCasesOutput || !analysisInput?.applicationUrl || !currentSessionId) {
      toast({
        variant: "destructive",
        title: "Execution Error",
        description: "Missing test cases, application URL, or session data"
      });
      return;
    }

    setIsExecuting(true);
    let successCount = 0;
    let failureCount = 0;

    toast({ 
      title: "Starting All Tests", 
      description: `Executing ${testCasesOutput.testCases.length} test cases...` 
    });

    for (const scenario of testCasesOutput.testCases) {
      setCurrentExecutingScenario(scenario);
      
      try {
        const result = await executePlaywrightTest(scenario, analysisInput.applicationUrl);
        
        const executionResult = {
          ...result,
          executedAt: new Date(),
        };
        
        setExecutionResults(prev => [...prev, executionResult]);
        await updateTestSessionExecution(currentSessionId, executionResult);
        
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        
      } catch (error: any) {
        failureCount++;
        const errorResult = {
          scenario: scenario.scenario,
          success: false,
          logs: [error.message],
          stdout: "",
          stderr: "",
          error: error.message,
          executedAt: new Date(),
        };
        
        setExecutionResults(prev => [...prev, errorResult]);
        await updateTestSessionExecution(currentSessionId, errorResult);
      }
    }

    setCurrentExecutingScenario(null);
    setIsExecuting(false);
    
    toast({
      title: "All Tests Complete",
      description: `${successCount} passed, ${failureCount} failed`
    });
    
    setActiveTab('results');
    loadSessionHistory();
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const session = await getTestSession(sessionId);
      if (!session) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Session not found"
        });
        return;
      }

      // Load session data
      setCurrentSessionId(session.sessionId);
      setAnalysisInput({
        githubRepoUrl: session.githubRepoUrl,
        applicationUrl: session.applicationUrl,
        githubToken: session.githubToken || '',
      });
      setAnalysisResult(session.analysisResult);
      setTestCasesOutput({ testCases: session.testCases });
      setExecutionResults(session.executionResults);
      
      toast({
        title: "Session Loaded",
        description: `Loaded session for ${session.githubRepoUrl}`
      });
      
      setActiveTab('test-cases');
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load session: ${error.message}`
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteTestSession(sessionId);
      toast({
        title: "Session Deleted",
        description: "Test session has been removed"
      });
      loadSessionHistory();
      
      // Clear current session if it was deleted
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setAnalysisInput(null);
        setAnalysisResult(null);
        setTestCasesOutput(null);
        setExecutionResults([]);
        setActiveTab('analyze');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete session: ${error.message}`
      });
    }
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setAnalysisInput(null);
    setAnalysisResult(null);
    setTestCasesOutput(null);
    setExecutionResults([]);
    setActiveTab('analyze');
  };

  // CRUD handlers for test cases (same as before)
  const handleAddScenario = () => {
    setTestCasesOutput(prev => {
      const newScenario: TestCaseType = { 
        scenario: "New Scenario", 
        steps: ["await page.goto('/'); // New step for new scenario"] 
      };
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

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Playwright Genius</h1>
        <Button onClick={handleNewSession} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="test-cases" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Test Cases
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-6">
          <UrlInputForm onSubmit={handleAnalyze} isLoading={isAnalyzing} />
          
          {analysisResult && (
            <AnalysisResults results={analysisResult} debugInfo={analysisDebugInfo} />
          )}
        </TabsContent>

        <TabsContent value="test-cases" className="space-y-6">
          {testCasesOutput ? (
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
              isExecutingAll={isExecuting}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Test Cases Available</CardTitle>
                <CardDescription>
                  Please run an analysis first to generate test cases.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setActiveTab('analyze')}>
                  Go to Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {executionResults.length > 0 ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Execution Summary</CardTitle>
                  <CardDescription>
                    Results from test executions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {executionResults.filter(r => r.success).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {executionResults.filter(r => !r.success).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {executionResults.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {executionResults.map((result, index) => (
                <TestExecutionDisplay 
                  key={index}
                  report={result}
                  onBackToReview={() => setActiveTab('test-cases')}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Test Results</CardTitle>
                <CardDescription>
                  Execute some test cases to see results here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setActiveTab('test-cases')}>
                  Go to Test Cases
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Session History</CardTitle>
              <CardDescription>
                Previous analysis and test execution sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-8">Loading history...</div>
              ) : sessionHistory.length > 0 ? (
                <div className="space-y-4">
                  {sessionHistory.map((session) => (
                    <Card key={session.sessionId} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold truncate">
                            {session.githubRepoUrl}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {session.applicationUrl}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <Badge variant="outline">
                              {session.totalTestCases} test cases
                            </Badge>
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {session.passedTests} passed
                            </Badge>
                            <Badge variant="outline" className="text-red-600">
                              <XCircle className="h-3 w-3 mr-1" />
                              {session.failedTests} failed
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(session.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadSession(session.sessionId)}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSession(session.sessionId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No test sessions found</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab('analyze')}
                  >
                    Create Your First Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}