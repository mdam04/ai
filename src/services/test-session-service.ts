'use server';

import { getDatabase } from '@/lib/mongodb';
import { TestSession, TestSessionSummary } from '@/models/TestSession';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = 'test-sessions';

export async function createTestSession(data: {
  githubRepoUrl: string;
  applicationUrl: string;
  githubToken?: string;
  analysisResult: TestSession['analysisResult'];
  testCases: TestSession['testCases'];
}): Promise<string> {
  const db = await getDatabase();
  const collection = db.collection<TestSession>(COLLECTION_NAME);
  
  const sessionId = uuidv4();
  const now = new Date();
  
  const session: TestSession = {
    sessionId,
    githubRepoUrl: data.githubRepoUrl,
    applicationUrl: data.applicationUrl,
    githubToken: data.githubToken,
    analysisResult: data.analysisResult,
    testCases: data.testCases,
    executionResults: [],
    createdAt: now,
    updatedAt: now,
  };
  
  await collection.insertOne(session);
  return sessionId;
}

export async function getTestSession(sessionId: string): Promise<TestSession | null> {
  const db = await getDatabase();
  const collection = db.collection<TestSession>(COLLECTION_NAME);
  
  return await collection.findOne({ sessionId });
}

export async function updateTestSessionExecution(
  sessionId: string,
  executionResult: TestSession['executionResults'][0]
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<TestSession>(COLLECTION_NAME);
  
  await collection.updateOne(
    { sessionId },
    {
      $push: { executionResults: executionResult },
      $set: { updatedAt: new Date() }
    }
  );
}

export async function getTestSessionSummaries(): Promise<TestSessionSummary[]> {
  const db = await getDatabase();
  const collection = db.collection<TestSession>(COLLECTION_NAME);
  
  const sessions = await collection
    .find({}, { 
      projection: { 
        sessionId: 1, 
        githubRepoUrl: 1, 
        applicationUrl: 1, 
        testCases: 1, 
        executionResults: 1, 
        createdAt: 1, 
        updatedAt: 1 
      } 
    })
    .sort({ createdAt: -1 })
    .toArray();
  
  return sessions.map(session => ({
    _id: session._id!,
    sessionId: session.sessionId,
    githubRepoUrl: session.githubRepoUrl,
    applicationUrl: session.applicationUrl,
    totalTestCases: session.testCases.length,
    passedTests: session.executionResults.filter(r => r.success).length,
    failedTests: session.executionResults.filter(r => !r.success).length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
}

export async function deleteTestSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<TestSession>(COLLECTION_NAME);
  
  await collection.deleteOne({ sessionId });
}