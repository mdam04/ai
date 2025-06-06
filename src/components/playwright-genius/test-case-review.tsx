
"use client";

import React, { useState } from 'react';
import type { AnalyzeAndGenerateTestsOutput } from "@/ai/flows/analyze-github-repo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, Play, AlertTriangle, Loader2, Edit3, Trash2, PlusCircle, Save, XCircle } from "lucide-react";

type TestCaseType = AnalyzeAndGenerateTestsOutput['testCases'][0];
type TestCasesOutputType = { testCases: AnalyzeAndGenerateTestsOutput['testCases'] };

interface EditingTarget {
  type: 'scenario' | 'step';
  scenarioIndex: number;
  stepIndex?: number;
  currentValue: string;
}

interface TestCaseReviewProps {
  testCasesOutput: TestCasesOutputType;
  onExecuteTests: (scenario: TestCaseType | null) => void;
  isExecuting: boolean;
  onAddScenario: () => void;
  onEditScenarioName: (scenarioIndex: number, newName: string) => void;
  onDeleteScenario: (scenarioIndex: number) => void;
  onAddStep: (scenarioIndex: number) => void;
  onEditStep: (scenarioIndex: number, stepIndex: number, newStepText: string) => void;
  onDeleteStep: (scenarioIndex: number, stepIndex: number) => void;
  onExecuteAllTests: () => void;
  isExecutingAll: boolean;
}

export default function TestCaseReview({
  testCasesOutput,
  onExecuteTests,
  isExecuting,
  onAddScenario,
  onEditScenarioName,
  onDeleteScenario,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onExecuteAllTests,
  isExecutingAll
}: TestCaseReviewProps) {
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>("");

  const handleStartEdit = (type: 'scenario' | 'step', scenarioIndex: number, stepIndex?: number, initialValue?: string) => {
    // Ensure testCasesOutput and the specific testCase/step exist before trying to access them
    let currentValue = initialValue;
    if (currentValue === undefined) {
        if (type === 'scenario' && testCasesOutput?.testCases?.[scenarioIndex]) {
            currentValue = testCasesOutput.testCases[scenarioIndex].scenario;
        } else if (type === 'step' && stepIndex !== undefined && testCasesOutput?.testCases?.[scenarioIndex]?.steps?.[stepIndex] !== undefined) {
            currentValue = testCasesOutput.testCases[scenarioIndex].steps[stepIndex];
        } else {
            currentValue = ''; // Default to empty string if somehow undefined
        }
    }
    setEditingTarget({ type, scenarioIndex, stepIndex, currentValue });
    setTempEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingTarget(null);
    setTempEditValue("");
  };

  const handleSaveEdit = () => {
    if (!editingTarget) {
        // This case should ideally not happen if buttons are correctly disabled,
        // but as a safeguard:
        setEditingTarget(null);
        setTempEditValue("");
        return;
    }

    const { type, scenarioIndex, stepIndex } = editingTarget;

    if (type === 'scenario') {
      onEditScenarioName(scenarioIndex, tempEditValue);
    } else if (type === 'step' && stepIndex !== undefined) {
      onEditStep(scenarioIndex, stepIndex, tempEditValue);
    }

    // Always reset editing state after attempting to save
    setEditingTarget(null);
    setTempEditValue("");
  };


  if (!testCasesOutput || !testCasesOutput.testCases || testCasesOutput.testCases.length === 0) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <p className="flex items-center text-muted-foreground">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
              No test cases generated yet, or an error occurred.
            </p>
            <Button onClick={onAddScenario} variant="outline" disabled={editingTarget !== null}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Scenario Manually
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { testCases } = testCasesOutput;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Review Test Cases</CardTitle>
        <CardDescription>
          Inspect, edit, add, or delete generated Playwright test scenarios and their steps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full space-y-2">
          {testCases.map((testCase, scenarioIndex) => (
            <AccordionItem value={`item-${scenarioIndex}`} key={`scenario-${scenarioIndex}`} className="border bg-card rounded-md shadow-sm">
              <AccordionTrigger className="px-4 py-3 hover:bg-accent/50 rounded-t-md w-full">
                <div className="flex items-center justify-between w-full space-x-3">
                  <div className="flex items-center space-x-3 flex-grow min-w-0">
                    <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                    {editingTarget?.type === 'scenario' && editingTarget.scenarioIndex === scenarioIndex ? (
                      <Input
                        value={tempEditValue}
                        onChange={(e) => setTempEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSaveEdit();} if (e.key === 'Escape') {e.stopPropagation(); handleCancelEdit();}}}
                        className="h-8 text-base flex-grow"
                        autoFocus
                      />
                    ) : (
                      <span className="font-headline text-base truncate">{testCase.scenario}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    {editingTarget?.type === 'scenario' && editingTarget.scenarioIndex === scenarioIndex ? (
                      <>
                        <Button asChild variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} title="Save Scenario Name">
                          <span><Save className="h-4 w-4 text-green-600" /></span>
                        </Button>
                        <Button asChild variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }} title="Cancel Edit">
                          <span><XCircle className="h-4 w-4 text-muted-foreground" /></span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button asChild variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartEdit('scenario', scenarioIndex, undefined, testCase.scenario); }} title="Edit Scenario Name" disabled={editingTarget !== null}>
                          <span><Edit3 className="h-4 w-4" /></span>
                        </Button>
                        <Button asChild variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteScenario(scenarioIndex); }} title="Delete Scenario" disabled={editingTarget !== null}>
                          <span><Trash2 className="h-4 w-4 text-destructive" /></span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-0 pb-3">
                <ScrollArea className="h-48 mt-2 rounded-md border p-3 bg-secondary/30">
                  <ol className="space-y-2">
                    {testCase.steps.map((step, stepIndex) => (
                      <li key={`scenario-${scenarioIndex}-step-${stepIndex}`} className="text-sm font-code py-1 flex justify-between items-center group">
                        {editingTarget?.type === 'step' && editingTarget.scenarioIndex === scenarioIndex && editingTarget.stepIndex === stepIndex ? (
                          <Input
                            value={tempEditValue}
                            onChange={(e) => setTempEditValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSaveEdit();} if (e.key === 'Escape') {e.stopPropagation(); handleCancelEdit();}}}
                            className="h-8 text-sm font-code flex-grow mr-2"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate flex-grow mr-2">{stepIndex + 1}. {step}</span>
                        )}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                          {editingTarget?.type === 'step' && editingTarget.scenarioIndex === scenarioIndex && editingTarget.stepIndex === stepIndex ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} title="Save Step">
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }} title="Cancel Edit">
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartEdit('step', scenarioIndex, stepIndex, step);}} title="Edit Step" disabled={editingTarget !== null}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteStep(scenarioIndex, stepIndex); }} title="Delete Step" disabled={editingTarget !== null}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
                <div className="mt-3 space-x-2 flex justify-between">
                    <Button
                        onClick={() => onAddStep(scenarioIndex)}
                        variant="outline"
                        size="sm"
                        disabled={editingTarget !== null}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Step
                    </Button>
                    <Button
                        onClick={() => onExecuteTests(testCase)}
                        disabled={isExecuting || isExecutingAll || (editingTarget !== null) }
                        variant="outline"
                        size="sm"
                    >
                        {isExecuting && editingTarget?.scenarioIndex === scenarioIndex ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        {isExecuting && editingTarget?.scenarioIndex === scenarioIndex ? "Executing..." : "Execute This Scenario"}
                    </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Button
            onClick={onAddScenario}
            variant="outline"
            className="w-full mt-6"
            size="lg"
            disabled={editingTarget !== null}
        >
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Scenario
        </Button>

        {testCases.length > 0 && (
           <Button
            onClick={onExecuteAllTests}
            disabled={isExecuting || isExecutingAll || (editingTarget !== null)}
            className="w-full mt-2"
            size="lg"
            variant="secondary"
          >
            {isExecutingAll ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            {isExecutingAll ? "Executing All..." : "Execute All Test Cases"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

