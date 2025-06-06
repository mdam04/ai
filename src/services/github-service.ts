
'use server';
/**
 * @fileOverview Service for interacting with the GitHub API.
 *
 * - getRelevantRepoContents - Fetches relevant file contents from a GitHub repository.
 */

import { z } from 'zod';

const GITHUB_API_BASE_URL = 'https://api.github.com';

const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
});
export type RepoFile = z.infer<typeof FileSchema>;

export interface RelevantRepoContents {
  files: RepoFile[];
  fileCount: number;
  totalContentLength: number;
  errorMessage?: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'github.com') {
      return null;
    }
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return { owner: pathParts[0], repo: pathParts[1].replace('.git', '') };
    }
    return null;
  } catch (error) {
    console.error('Invalid GitHub URL:', error);
    return null;
  }
}

async function fetchFromGitHub(apiUrl: string, token?: string): Promise<any> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(
        `GitHub API request failed: ${response.status} ${errorData.message || response.statusText} for URL ${apiUrl}`
      );
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Error fetching from GitHub API (${apiUrl}):`, error.message);
    throw error; // Re-throw to be caught by the caller
  }
}

const RELEVANT_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.md'];
const RELEVANT_DIRECTORIES = ['src/', 'app/', 'pages/', 'components/', 'server/', 'lib/', 'utils/', 'routes/'];
const MAX_FILES_TO_FETCH = 50; // Limit the number of files to avoid hitting API limits or oversized context
const MAX_FILE_SIZE_KB = 100; // Limit the size of individual files

export async function getRelevantRepoContents(
  repoUrl: string,
  githubToken?: string
): Promise<RelevantRepoContents> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { files: [], fileCount: 0, totalContentLength: 0, errorMessage: 'Invalid GitHub repository URL.' };
  }
  const { owner, repo } = parsed;
  const token = githubToken || process.env.GITHUB_TOKEN;

  let files: RepoFile[] = [];
  let totalContentLength = 0;

  try {
    // Get default branch
    const repoData = await fetchFromGitHub(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`, token);
    const defaultBranch = repoData.default_branch;

    // Get tree for the default branch
    const treeData = await fetchFromGitHub(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      token
    );

    if (!treeData.tree || !Array.isArray(treeData.tree)) {
        return { files: [], fileCount: 0, totalContentLength: 0, errorMessage: 'Could not fetch repository file tree.' };
    }

    const relevantFilePaths = treeData.tree
      .filter((item: any) => {
        return item.type === 'blob' &&
        (RELEVANT_EXTENSIONS.some(ext => item.path.endsWith(ext)) ||
         RELEVANT_DIRECTORIES.some(dir => item.path.startsWith(dir))) &&
         !item.path.includes('node_modules') &&
         !item.path.includes('.next/') &&
         !item.path.includes('dist/') &&
         !item.path.includes('build/') &&
         (!item.size || item.size <= MAX_FILE_SIZE_KB * 1024) // Check size if available
      })
      .map((item: any) => item.path)
      .slice(0, MAX_FILES_TO_FETCH); // Limit number of files

    for (const filePath of relevantFilePaths) {
      try {
        const fileData = await fetchFromGitHub(
          `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${filePath}?ref=${defaultBranch}`,
          token
        );

        if (fileData.content && fileData.encoding === 'base64') {
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          if (content.length <= MAX_FILE_SIZE_KB * 1024) { // Double check content length
            files.push({ path: filePath, content });
            totalContentLength += content.length;
          } else {
             console.warn(`Skipping file ${filePath} due to excessive size after decoding.`);
          }
        }
      } catch (fileError: any) {
        console.warn(`Could not fetch content for file ${filePath}: ${fileError.message}`);
        // Continue to next file
      }
    }
    
    if (files.length === 0 && relevantFilePaths.length > 0) {
        return { files: [], fileCount: 0, totalContentLength: 0, errorMessage: `No relevant files could be fetched or decoded from the repository. Inspected ${relevantFilePaths.length} potential paths.` };
    }


    return { files, fileCount: files.length, totalContentLength };

  } catch (error: any) {
    console.error('Error fetching repository contents:', error);
    return { files: [], fileCount: 0, totalContentLength: 0, errorMessage: `Failed to retrieve repository contents: ${error.message}` };
  }
}
