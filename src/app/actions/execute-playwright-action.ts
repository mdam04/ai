'use server';

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AnalyzeAndGenerateTestsOutput } from '@/ai/flows/analyze-github-repo';

const execFileAsync = promisify(execFile);

export interface PlaywrightExecutionResult {
  scenario: string;
  success: boolean;
  logs: string[];
  stdout: string;
  stderr: string;
  error?: string;
  screenshotDataUri?: string;
  videoPath?: string;
  duration?: number;
  attachments?: Array<{ name: string; contentType: string; path?: string; body?: string }>;
}

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch (e) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

function escapePathForJSStringLiteral(filePath: string): string {
  return filePath.replace(/\\/g, '\\\\');
}

// Helper function to recursively find a spec by its title
function findSpecRecursive(suites: any[], targetTitle: string): any | undefined {
  for (const suite of suites) {
    if (suite.specs) {
      const foundSpec = suite.specs.find((spec: any) => spec.title === targetTitle);
      if (foundSpec) return foundSpec;
    }
    if (suite.suites) {
      const foundInNested = findSpecRecursive(suite.suites, targetTitle);
      if (foundInNested) return foundInNested;
    }
  }
  return undefined;
}

export async function executePlaywrightTest(
  testCase: AnalyzeAndGenerateTestsOutput['testCases'][0],
  appUrl: string
): Promise<PlaywrightExecutionResult> {
  const projectRoot = process.cwd();
  const tempBaseDirWithinProject = path.join(projectRoot, 'playwright-genius-runs');

  const sanitizedScenarioName = testCase.scenario.replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueRunId = `${sanitizedScenarioName}-${Date.now()}`;

  const runContextDir = path.join(tempBaseDirWithinProject, uniqueRunId);
  const outputArtifactsDirInContext = 'playwright-output';
  const absoluteOutputArtifactsDir = path.join(runContextDir, outputArtifactsDirInContext);

  const reportJsonFileRelativePath = path.join(outputArtifactsDirInContext, 'report.json');

  const testFileName = `test.spec.ts`;
  const playwrightConfigName = `playwright.config.ts`;
  const playwrightConfigPathInContext = path.join(runContextDir, playwrightConfigName); 

  await ensureDir(runContextDir);
  await ensureDir(absoluteOutputArtifactsDir);

  const testContent = `
import { test, expect } from '@playwright/test';

test.describe('${testCase.scenario.replace(/'/g, "\\'")}', () => {
  test('should successfully complete: ${testCase.scenario.replace(/'/g, "\\'")}', async ({ page }) => {
    ${testCase.steps.join('\n    ')}
  });
});
  `;
  await fs.writeFile(path.join(runContextDir, testFileName), testContent);

  const finalPlaywrightConfigContent = `
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  reporter: [['json', { outputFile: '${escapePathForJSStringLiteral(reportJsonFileRelativePath)}' }]],
  use: {
    headless: true, // Set to true for server execution
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    baseURL: '${appUrl}',
  },
  projects: [ 
    { 
      name: 'chromium', 
      use: { 
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 }
      } 
    } 
  ],
  outputDir: '${escapePathForJSStringLiteral(outputArtifactsDirInContext)}',
  testDir: '.',
  webServer: {
    command: 'echo "Using external server"',
    url: '${appUrl}',
    reuseExistingServer: true,
    timeout: 5000,
  },
};

export default config;
`;
  await fs.writeFile(playwrightConfigPathInContext, finalPlaywrightConfigContent);

  let executionResult: Partial<PlaywrightExecutionResult> = {
    scenario: testCase.scenario,
    success: false,
    logs: [],
  };

  try {
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    const playwrightBinPath = path.join(nodeModulesPath, '.bin', 'playwright');
    
    // Check if playwright binary exists
    let playwrightCommand = playwrightBinPath;
    try {
      await fs.access(playwrightBinPath);
    } catch {
      // Fallback to npx if binary doesn't exist
      playwrightCommand = 'npx';
    }

    const executionEnv = {
      ...process.env,
      NODE_PATH: `${process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : ''}${nodeModulesPath}`,
      PLAYWRIGHT_BROWSERS_PATH: path.join(nodeModulesPath, '@playwright', 'test'),
    };

    const args = playwrightCommand === 'npx' 
      ? ['playwright', 'test', '--config', playwrightConfigName, '--reporter=json']
      : ['test', '--config', playwrightConfigName, '--reporter=json'];
    
    executionResult.logs?.push(`Executing: ${playwrightCommand} ${args.join(' ')} (CWD: ${runContextDir})`);
    executionResult.logs?.push(`Project root for Node modules: ${projectRoot}`);
    executionResult.logs?.push(`Setting NODE_PATH to: ${executionEnv.NODE_PATH}`);

    const { stdout, stderr } = await execFileAsync(playwrightCommand, args, {
      cwd: runContextDir,
      env: executionEnv,
      timeout: 120000, // 2 minutes timeout
    });

    executionResult.stdout = stdout;
    executionResult.stderr = stderr;
    executionResult.logs?.push(`Playwright stdout: ${stdout}`);
    if (stderr) executionResult.logs?.push(`Playwright stderr: ${stderr}`);

    const absoluteReportJsonPath = path.join(absoluteOutputArtifactsDir, 'report.json');
    try {
      const reportContent = await fs.readFile(absoluteReportJsonPath, 'utf-8');
      const report = JSON.parse(reportContent);

      const targetSpecTitle = `should successfully complete: ${testCase.scenario}`;
      executionResult.logs?.push(`Searching for spec title in JSON report: "${targetSpecTitle}"`);

      const allSpecTitlesInReport: string[] = [];
      function getAllSpecTitles(suites: any[]) {
        for (const suite of suites) {
          if (suite.specs) {
            suite.specs.forEach((spec: any) => spec.title && allSpecTitlesInReport.push(spec.title));
          }
          if (suite.suites) {
            getAllSpecTitles(suite.suites);
          }
        }
      }
      if (report.suites) {
        getAllSpecTitles(report.suites);
        executionResult.logs?.push(`Available spec titles in report: ${JSON.stringify(allSpecTitlesInReport)}`);
      }
      
      const specResult = findSpecRecursive(report.suites || [], targetSpecTitle);
      
      const testRun = specResult?.tests[0]?.results[0];

      if (testRun) {
        executionResult.success = testRun.status === 'passed';
        executionResult.duration = testRun.duration;
        executionResult.attachments = testRun.attachments?.map((att: any) => ({
          ...att,
          path: att.path ? path.resolve(absoluteOutputArtifactsDir, att.path) : undefined
        }));

        const screenshotAttachment = executionResult.attachments?.find((att: any) => 
          att.name === 'screenshot' && att.contentType === 'image/png' && att.path
        );
        if (screenshotAttachment?.path) {
          try {
            const screenshotData = await fs.readFile(screenshotAttachment.path);
            executionResult.screenshotDataUri = `data:image/png;base64,${screenshotData.toString('base64')}`;
            executionResult.logs?.push(`Screenshot captured: ${screenshotAttachment.path}`);
          } catch (imgError: any) {
            executionResult.logs?.push(`Failed to read screenshot (${screenshotAttachment.path}): ${imgError.message}`);
          }
        }

        if (testRun.status !== 'passed') {
          executionResult.error = testRun.error?.message || testRun.errors?.map((e:any) => e.message).join('\\n') || `Test ${testRun.status}`;
          const videoAttachment = executionResult.attachments?.find((att: any) => 
            att.name === 'video' && att.contentType === 'video/webm' && att.path
          );
          if (videoAttachment?.path) {
            executionResult.videoPath = videoAttachment.path;
            executionResult.logs?.push(`Video recorded: ${videoAttachment.path}`);
          }
        }
      } else {
        executionResult.error = `Test result for scenario "${testCase.scenario}" not found in JSON report from ${absoluteReportJsonPath}. Check Playwright stdout/stderr. Ensure target title matches a title in 'Available spec titles in report'.`;
        executionResult.logs?.push(executionResult.error);
        if(report.errors && report.errors.length > 0) {
          executionResult.logs?.push(`Global errors in Playwright JSON report: ${JSON.stringify(report.errors)}`);
        }
      }
    } catch (reportError: any) {
      executionResult.error = `Failed to parse Playwright JSON report from ${absoluteReportJsonPath}. Error: ${reportError.message}. Check Playwright stdout/stderr.`;
      executionResult.logs?.push(executionResult.error);
      executionResult.success = false;
    }

  } catch (e: any) {
    executionResult.success = false;
    executionResult.error = e.message || 'Playwright execution failed.';
    if (e.stdout && !executionResult.stdout) executionResult.stdout = e.stdout;
    if (e.stderr && !executionResult.stderr) executionResult.stderr = e.stderr;
    executionResult.logs?.push(`Execution error caught: ${e.message}`);
    if(e.stdout) executionResult.logs?.push(`Error stdout: ${e.stdout}`);
    if(e.stderr) executionResult.logs?.push(`Error stderr: ${e.stderr}`);
  } finally {
    try {
      await fs.rm(runContextDir, { recursive: true, force: true }).catch(err => 
        console.warn(`Non-critical: Failed to delete temp run context dir ${runContextDir}: ${err.message}`)
      );
    } catch (cleanupError: any) {
      console.warn(`Error during cleanup of ${runContextDir}: ${cleanupError.message}`);
      executionResult.logs?.push(`Cleanup error for ${runContextDir}: ${cleanupError.message}`);
    }
  }
  
  return executionResult as PlaywrightExecutionResult;
}