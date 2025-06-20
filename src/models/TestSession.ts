import { ObjectId } from 'mongodb';

export interface TestSession {
  _id?: ObjectId;
  sessionId: string;
  githubRepoUrl: string;
  applicationUrl: string;
  githubToken?: string;
  analysisResult: {
    analysisSource: string;
    applicationLogicSummary: string;
    domStructureSummary: string;
    potentialUserFlows: string;
  };
  testCases: Array<{
    scenario: string;
    steps: string[];
  }>;
  executionResults: Array<{
    scenario: string;
    success: boolean;
    logs: string[];
    stdout: string;
    stderr: string;
    error?: string;
    screenshotDataUri?: string;
    videoPath?: string;
    duration?: number;
    executedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSessionSummary {
  _id: ObjectId;
  sessionId: string;
  githubRepoUrl: string;
  applicationUrl: string;
  totalTestCases: number;
  passedTests: number;
  failedTests: number;
  createdAt: Date;
  updatedAt: Date;
}