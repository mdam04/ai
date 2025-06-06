
'use server';

/**
 * @fileOverview Analyzes a GitHub repository to understand the application's functionality,
 * DOM structure, and then generates Playwright test cases.
 * It uses a GitHub service to fetch relevant file contents.
 *
 * - analyzeGithubRepositoryAndGenerateTests - A function that handles analysis and test generation.
 * - AnalyzeAndGenerateTestsInput - The input type for the function.
 * - AnalyzeAndGenerateTestsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getRelevantRepoContents } from '@/services/github-service';


const RepositoryContextFileSchema = z.object({
  path: z.string(),
  content: z.string().max(20000, "File content is too long for context."),
});

const AnalyzeAndGenerateTestsInputSchema = z.object({
  githubRepoUrl: z.string().describe('The URL of the GitHub repository to analyze.'),
  applicationUrl: z.string().describe('The URL of the live application for test navigation purposes ONLY.'),
  githubToken: z.string().optional().describe('Optional GitHub token for accessing private repositories or higher rate limits.'),
  repositoryContext: z.array(RepositoryContextFileSchema).optional().describe('Context from repository files. This is populated by the flow.'),
});
export type AnalyzeAndGenerateTestsInput = z.infer<typeof AnalyzeAndGenerateTestsInputSchema>;

const AnalyzeAndGenerateTestsOutputSchema = z.object({
  analysisSource: z.string().describe('Indicates the primary source of the analysis (e.g., "GitHub API file content", "No repository data", "AI Model Error").'),
  applicationLogicSummary: z.string().describe('A summary of the application logic. Based on repository content if available, otherwise indicates lack of data.'),
  domStructureSummary: z.string().describe(
    "A summary or inference of the DOM structure. Derived *solely* from frontend code in the repository if available, otherwise indicates lack of data. " +
    "This summary MUST be the basis for chosen selectors in test cases. " +
    "Pay EXTREMELY close attention to the nesting of text within interactive elements (buttons, links, etc.). " +
    "For each interactive element, identify its HTML tag (e.g., `button`, `input`, `a`), its **full, exact direct text content** (if any) and how that text is structured (e.g., direct child of the element vs. nested in other tags like `<span>` within the element). Use EXACT text and casing from the code. Also, identify relevant attributes found directly in the code (e.g., `id`, `class`, `role`, `aria-label`, `aria-labelledby`, `data-testid`, `name`, `value`, `placeholder`, `alt`, `href`, `type`, and other `data-*` or `aria-*` attributes). Note how text is structured (e.g., direct child vs. nested in other tags like `<span>`). Use EXACT text and casing from the code. " +
    "For select/dropdown components (often buttons with `role='combobox'`), identify the trigger element AND how options are structured. This MUST include determining if the trigger has an associated `<label>`, a direct `aria-label`, or if its visible text is nested within a child element (e.g. a `<span>`). List these findings explicitly. Use EXACT text and casing from the code." +
    "If the accessible name appears dynamic (e.g., 'Cart ({{itemCount}})'), note this pattern. " +
    "Explicitly list potential ambiguities if similar names/texts could lead to multiple matches (e.g., a 'Cart' link vs. 'Add to Cart' button), and how your generated selectors will distinguish them. "+
    "If the code context is insufficient to determine the structure or attributes of a specific part of the DOM, you MUST clearly state this limitation in your summary. DO NOT leave it blank, guess, or invent attributes for such parts. This includes not being able to find a unique selector."
  ),
  potentialUserFlows: z.string().describe('A detailed description of key end-to-end user scenarios identified from the application logic and DOM structure. This should outline complete user journeys, including significant variations like successful completion, saving drafts, or handling rejections/approvals, applicable to any relevant application feature. Each distinct scenario and each distinct variation described here is expected to have a corresponding test case generated.'),
  testCases: z.array(
    z.object({
      scenario: z.string().describe('The scenario being tested, reflecting a complete user flow or a specific variation thereof (e.g., "User creates form, submits for approval, and gets it approved", "User searches for product, adds to cart, and completes checkout", "User registers new account and verifies email", "User attempts login with invalid credentials", "User submits form with empty required field and verifies validation message").'),
      steps: z.array(z.string().describe('Array of individual, executable Playwright TypeScript code lines for the test body, covering the entire scenario, including input actions, interactions, and comprehensive assertions for validation and state changes.')),
    })
  ).
  describe('Playwright test cases. Each test case MUST cover a distinct end-to-end user scenario or a significant variation thereof as described in "potentialUserFlows". Each step in `steps` is a line of executable Playwright code. Generated based on repository analysis if available. You MUST generate a unique test case for every distinct scenario and every distinct variation of a "Potential User Flow" you have identified. Do not skip any. Test cases should include steps for filling input fields (especially those identified as required) and also assertions to check for validation messages or expected application behavior, especially after invalid inputs.'),
  debugInfo: z.object({
    filesFetched: z.number().optional(),
    totalContentLength: z.number().optional(),
    repoServiceMessage: z.string().optional(),
  }).optional(),
});
export type AnalyzeAndGenerateTestsOutput = z.infer<typeof AnalyzeAndGenerateTestsOutputSchema>;

export async function analyzeGithubRepositoryAndGenerateTests(
  input: AnalyzeAndGenerateTestsInput
): Promise<AnalyzeAndGenerateTestsOutput> {

  const repoData = await getRelevantRepoContents(input.githubRepoUrl, input.githubToken);

  const flowInputWithContext: AnalyzeAndGenerateTestsInput = {
    ...input,
    repositoryContext: repoData.files.map(f => ({
      path: f.path,
      content: f.content.substring(0, 20000) // Truncate content here before sending to AI
    })),
  };

  let flowOutput = await analyzeAndGenerateFlow(flowInputWithContext);

  const aiModelErrored = flowOutput.analysisSource === "AI Model Error";
  const aiSpecificDebugMessage = aiModelErrored ? flowOutput.debugInfo?.repoServiceMessage : null;

  let finalDebugMessageForToast: string;

  if (repoData.errorMessage) {
    finalDebugMessageForToast = "Failed to fetch repository data. Analysis and test generation will be based on the AI's general knowledge (if possible and configured to do so), not specific code. Details: " + repoData.errorMessage;
    if (aiSpecificDebugMessage) finalDebugMessageForToast += " AI Status: " + aiSpecificDebugMessage;
    else if (!aiModelErrored && (!flowOutput.testCases || flowOutput.testCases.length === 0)) finalDebugMessageForToast += " AI processing attempted but could not generate specific tests due to lack of repository data.";
    else if (!aiModelErrored) finalDebugMessageForToast += " AI processing completed; results may be limited due to lack of repository data.";

  } else if (repoData.fileCount === 0) {
    finalDebugMessageForToast = "No relevant files found in repository. Analysis and test generation will be based on the AI's general knowledge (if possible and configured to do so), not specific code.";
    if (aiSpecificDebugMessage) finalDebugMessageForToast += " AI Status: " + aiSpecificDebugMessage;
    else if (!aiModelErrored && (!flowOutput.testCases || flowOutput.testCases.length === 0)) finalDebugMessageForToast += " AI processing attempted but could not generate specific tests as no relevant files were found.";
    else if (!aiModelErrored) finalDebugMessageForToast += " AI processing completed; results may be limited as no relevant files were found.";
  } else {
    finalDebugMessageForToast = repoData.fileCount + " files processed from repository.";
    if (aiSpecificDebugMessage) {
        finalDebugMessageForToast += " AI Status: " + aiSpecificDebugMessage;
    } else if (!aiModelErrored) {
        finalDebugMessageForToast += " AI processing completed successfully.";
    }
  }

  flowOutput.debugInfo = {
    ...(flowOutput.debugInfo || {}),
    filesFetched: repoData.fileCount,
    totalContentLength: repoData.totalContentLength,
    repoServiceMessage: finalDebugMessageForToast,
  };

  if (aiModelErrored) {
    // analysisSource is already "AI Model Error"
  } else if (repoData.errorMessage) {
     flowOutput.analysisSource = "Error fetching repository: " + repoData.errorMessage + ". Analysis NOT based on specific code.";
  } else if (repoData.fileCount === 0 && !repoData.errorMessage) {
    flowOutput.analysisSource = "No relevant files found in repository. Analysis NOT based on specific code.";
  } else if (!flowOutput.applicationLogicSummary && !flowOutput.domStructureSummary && (!flowOutput.testCases || flowOutput.testCases.length === 0)) {
    flowOutput.analysisSource = "GitHub API file content (" + repoData.fileCount + " files) - AI analysis was inconclusive or incomplete.";
  } else {
    flowOutput.analysisSource = "GitHub API file content (" + repoData.fileCount + " files)";
  }

  return flowOutput;
}


const analyzeAndGeneratePromptText =
"You are an expert QA engineer. Your task is to analyze a web application based on its GitHub repository code (provided as 'repositoryContext') and then generate comprehensive, deep, and end-to-end Playwright test cases that include validation checks, edge cases, and corner cases.\n\n" +
"The application's live URL is '{{{applicationUrl}}}'. This URL is *ONLY* for Playwright navigation commands (e.g., page.goto()) within the generated test steps. DO NOT use this URL to infer application logic or DOM structure. Your entire analysis MUST come from the 'repositoryContext'.\n" +
"GitHub Repository URL (for context): {{{githubRepoUrl}}}\n\n" +
"ABSOLUTE CRITICAL RULE: You CANNOT directly access or inspect the live DOM of '{{{applicationUrl}}}'. Your understanding of the application's UI and DOM structure MUST be derived *solely* from the frontend code (e.g., HTML, JSX, TSX, component files) found within the 'repositoryContext'. DO NOT ASSUME, GUESS, OR INVENT the existence of any DOM elements, attributes (including test-ids or labels), or application abilities not explicitly supported by or very strongly inferable from the provided code. If the code does not show it, you cannot use it.\n\n" +
"{{#if repositoryContext.length}}\n" +
"The following files and their content have been extracted from the repository:\n" +
"{{#each repositoryContext}}\n" +
"File: {{{this.path}}}\n" +
"Content:\n" +
"```\n" +
"{{{this.content}}}\n" +
"```\n" +
"---\n" +
"{{/each}}\n" +
"Base your \"Application Logic Summary\" and your \"DOM Structure Summary\" *entirely* on these provided files.\n" +
"For the \"DOM Structure Summary\":\n" +
"  - Analyze the frontend code (HTML, JSX, TSX, Vue, Angular templates, component files, etc.) in 'repositoryContext'. This is your ONLY source for understanding the DOM. Pay attention to how components render to HTML.\n" +
"  - For each key interactive element (buttons, forms, navigation links, input fields, custom components rendering as interactive elements), you MUST try to identify and list its:\n" +
"    *   HTML tag (e.g., `button`, `input`, `a`, or the root tag of a custom component if discernible).\n" +
"    *   **Full, exact direct text content** (if any) and how it is structured (e.g., direct child vs. nested in other tags like `<span>`). Use EXACT text and casing from the code.\n" +
"    *   Relevant attributes found directly in the code. Prioritize these when deciding on locators later. Consider (but are not limited to) attributes like:\n" +
"        *   Global: `id`, `class`, `title`, `hidden`, `tabindex`, `draggable`, `accesskey`, `contenteditable`, `spellcheck`, `data-*` (especially `data-testid`).\n" +
"        *   Accessibility: `role`, `aria-label`, `aria-labelledby`, `aria-describedby`, and other `aria-*` attributes.\n" +
"        *   Form-specific: `type` (for inputs), `name`, `value`, `placeholder`, `checked`, `disabled`, `readonly`, `required`, `min`, `max`, `step`, `autocomplete`, `autofocus`.\n" +
"        *   Link & Image: `href`, `target`, `rel`, `src`, `alt`, `width`, `height`, `loading`.\n" +
"        *   Button-specific: `type` (e.g., 'submit', 'reset', 'button'), `form`.\n" +
"  - **CRITICAL: For each interactive element (button, link, etc.), you MUST determine its *full, exact accessible name* as derived strictly from the code (e.g., direct text content, `aria-label`, text from child elements contributing to the accessible name, or associated `<label>`). Use the EXACT text and casing as seen in the code.**\n" +
"  - **CRITICAL: Pay EXTREMELY close attention to the nesting of text within interactive elements. If text that seems like a label (e.g., 'Select Department') is inside a `<span>` or `<div>` *within* a `<button>` (as identifiable from the code), you MUST note this structure in your summary and distinguish it from the button's direct accessible name. This is crucial for choosing `getByRole` with `name` vs. `filter({ hasText: ... })` or `getByText(...).locator('ancestor::...')`. Use the EXACT text and casing as seen in the code for such nested text.**\n" +
"  - **For select/dropdown components (often a `<button>` with `role=\"combobox\"` that displays placeholder text like 'Select doctor' or 'Select department', and then reveals `<div role=\"listbox\">` with `<div role=\"option\">` or similar), your DOM Structure Summary (based ONLY on code) MUST detail:** \n" +
"    *   The trigger element: How is it identified in the code (tag, roles, specific attributes, text)?\n" +
"    *   Its labeling: Does it have an associated `<label for=\"trigger_id\">` in the code? Does it have an `aria-label`? Is its visible text (e.g., 'Select department') a direct child or nested in a `<span>` or similar within the trigger button code? Use EXACT text and casing from the code.\n" +
"    *   Options structure: How are options (`<option>`, `<div role=\"option\">`, etc.) defined in the code? How is their text content determined from the code? Use EXACT text and casing for example options.\n" +
"  - **If the accessible name appears dynamic** (e.g., 'Cart ({{itemCount}})') from the code, you MUST note this pattern in your summary.\n" +
"  - **Explicitly list any potential ambiguities if similar names/texts could lead to multiple matches (as inferred from the code), and how your generated selectors will distinguish them. This summary is your *only* source for choosing selectors in the test cases.**\n" +
"  - If the code context is insufficient to determine the structure or attributes of a specific part of the DOM, you MUST clearly state this limitation in your summary. DO NOT leave it blank, guess, or invent attributes for such parts. This includes not being able to find a unique selector. Your generated Playwright steps must reflect this limitation.\n" +
"Your analysisSource (for the AI's output) should be \"GitHub API file content\".\n\n" +
"Based on your analysis of the 'repositoryContext':\n\n" +
"1.  **Application Logic & DOM Structure Summary:**\n" +
"    *   Provide an \"Application Logic Summary\".\n" +
"    *   Provide a \"DOM Structure Summary\" (derived as explained above, strictly from code, with emphasis on exact accessible names, `id` attributes, **full exact text from code used for any visible text references**, nested text structures, and how to target complex components like dropdowns based *only* on what's in the code. Use EXACT text from the code for all names, labels, and visible text.).\n\n" +
"2.  **Identify Key User Goals & End-to-End Scenarios with Variations, Edge Cases, and Corner Cases (for \"Potential User Flows\" output field):**\n" +
"    *   From the application logic and DOM structure (as derived strictly from 'repositoryContext'), identify the primary goals a user can achieve with this application.\n" +
"    *   For each significant user goal, outline a complete End-to-End User Scenario. This scenario represents a sequence of actions a user would take to achieve that goal, including any necessary prerequisite actions (e.g., logging in, navigating to a specific page, adding items to a cart before checkout).\n" +
"    *   **Crucially, for each main End-to-End User Scenario, consider and outline:**\n" +
"        *   **Significant variations or alternative paths.** (e.g., for checkout: using a gift card vs. credit card, if discernible from code; for a form: saving a draft vs. submitting for approval, if discernible from code).\n" +
"        *   **Input validation paths.** (e.g., submitting a form with missing required fields, entering invalid data formats, and verifying error messages - all based on what the code suggests is possible).\n" +
"        *   **Edge Cases and Corner Cases** that are logical extensions or stress tests of the main flow (e.g., attempting an action without necessary permissions if code suggests roles/permissions, testing boundary values for inputs if code indicates validation rules).\n" +
"    *   Describe these identified end-to-end scenarios, variations, edge cases, and corner cases in the \"potentialUserFlows\" output field. Each description here must be a complete user journey, implying all necessary steps from start to finish based on your code analysis.\n\n" +
"**Critical Adherence Reminder for Test Case Generation:** All generated test steps MUST strictly adhere to the 'Playwright Best Practices for Locators' outlined below, which are based *solely* on your 'DOM Structure Summary' (which in turn is based *solely* on the 'repositoryContext'). Test quality, reliability, and accuracy are paramount. If a unique, reliable selector cannot be confidently determined from the code context for an essential interaction (as noted in your 'DOM Structure Summary'), you MUST include a comment in the generated step string indicating this (e.g., \"// CODE ANALYSIS INSUFFICIENT: Cannot determine unique selector for 'Approve' button; step requires manual review/update based on live DOM or more detailed code. Do NOT use an ambiguous selector.\") and AVOID generating a potentially failing or ambiguous step. Do NOT guess. Your generated tests should reflect a deep understanding of Playwright commands and their appropriate application based on the analyzed code.\n\n" +
"3.  **Generate \"Deep\" Playwright Test Cases for ALL Identified Scenarios, Variations, Edge Cases, and Corner Cases (for \"testCases\" output field):**\n" +
"    *   **MANDATORY REQUIREMENT:** The number of objects in your 'testCases' array MUST EXACTLY MATCH the total number of distinct end-to-end scenarios, significant variations, edge cases, and corner cases that you detailed in the 'potentialUserFlows' output. Do not skip any.\n" +
"    *   For EACH distinct path you described in \"potentialUserFlows\", generate a **unique and separate Playwright test case**.\n" +
"    *   The `scenario` field for each test case should clearly name the complete user flow, specific variation, edge case, or corner case being tested (e.g., \"User searches for product, adds to cart, and completes checkout\", \"User attempts login with invalid credentials and verifies error message based on code-inferred validation\", \"User submits form with empty required field for 'Name' (identified as required from code) and verifies validation message (inferred from code)\").\n" +
"    *   The `steps` array for each test case must contain ALL Playwright TypeScript commands necessary to execute that ENTIRE scenario from its logical beginning to its end. This INCLUDES any prerequisite actions that are part of that defined flow (e.g., if a scenario is 'Admin approves pending request', the steps must include logging in as an admin, navigating to the requests page, finding the specific request, and then approving it – all based on functionality inferred from the code).\n\n" +
"{{else}}\n" +
"No specific file content from the repository was provided or could be fetched.\n" +
"Therefore, for your \"Application Logic Summary\", \"DOM Structure Summary\", \"Potential UserFlows\", and \"Test Cases\":\n" +
"- State clearly that a detailed analysis and specific test case generation cannot be performed.\n" +
"- Summaries should be generic. \"Potential UserFlows\" should state no specific flows can be determined.\n" +
"- Test cases should be minimal (e.g., navigation and title check) or state no specific tests can be generated.\n" +
"Your analysisSource should be \"No repository data available for analysis\".\n" +
"{{/if}}\n\n" +
"Instructions for generating test steps within the 'testCases' array:\n" +
"1.  Each string in the 'steps' array must be a single, complete, and valid line of Playwright TypeScript code.\n" +
"2.  These steps will be placed directly inside a Playwright `test(async ({ page }) => { ... })` function body.\n" +
"3.  First step of any test case that interacts with the application MUST be: \"await page.goto('{{{applicationUrl}}}');\" unless the scenario logically starts elsewhere (which is rare for UI tests based on a single app URL).\n" +
"4.  Assume `page` and `expect` are available.\n" +
"5.  Do NOT include `import` statements or `test.describe`/`test` wrappers in the `steps` array.\n" +
"6.  **Playwright Best Practices for Locators (Strictly based on 'repositoryContext' and your 'DOM Structure Summary' which is derived ONLY from the code):**\n" +
"    Your choice of locator MUST be based on the attributes and structure you identified in the 'DOM Structure Summary' from the code. The goal is always to select a UNIQUE element. If your code analysis suggests a chosen locator might match multiple elements, you MUST refine it using the strategies below.\n" +
"    -   **Locator Priority (Strictly Adhere based on your code analysis):**\n" +
"        1.  **Test ID:** IF your 'DOM Structure Summary' (derived from code analysis) identified a `data-testid='your-test-id-from-code'` attribute for the element, you MUST use `page.getByTestId(\\'your-test-id-from-code\\')`.\n" +
"        2.  **ID Attribute:** IF your 'DOM Structure Summary' identified a unique `id='your-unique-id-from-code'` attribute for the element, you MUST use `page.locator(\\'#your-unique-id-from-code\\')`.\n" +
"        3.  **Labels for Form Inputs (including `role=\"combobox\"` dropdown triggers):** For form inputs that your 'DOM Structure Summary' indicates are associated with a `<label>` tag (via `for` attribute or by wrapping), you MUST use `page.getByLabel(\\'Exact, Full Label Text From Code\\')`. Ensure the text is EXACTLY as in the code.\n" +
"        4.  **Role and EXACT Accessible Name:** For elements like buttons, links, inputs, etc.:\n" +
"            *   IF your 'DOM Structure Summary' identified an `aria-label='Accessible Name From Code'` on the element, AND this represents its full accessible name, you MUST use `page.getByRole(\\'relevant-role-from-code\\', { name: \\'Exact, Full Accessible Name From Code\\' })`. The `name` MUST be the **full, exact accessible name** you identified. Ensure the name is EXACTLY as in the code.\n" +
"            *   IF the element's accessible name is derived from its **full, exact direct text content** (and not an `aria-label` or nested complex structure), use `page.getByRole(\\'relevant-role-from-code\\', { name: \\'Exact, Full Direct Text From Code\\' })`. Ensure the name is EXACTLY as in the code.\n" +
"            *   **If the accessible name is dynamic** (e.g., 'Cart (1)', 'Cart (2)'), and this pattern is clear from your code analysis, you MUST use a **regular expression** for the `name` option, e.g., `page.getByRole(\\'button\\', { name: /Cart \\\\(\\\\d+\\\\)/ })`.\n" +
"        5.  **Placeholder Text:** IF your 'DOM Structure Summary' identified a `placeholder='Exact placeholder text from code'` attribute for an input, use `page.getByPlaceholder(\\'Exact, Full placeholder text from code\\')`.\n" +
"        6.  **Alt Text (for images):** IF your 'DOM Structure Summary' identified an `alt='Exact alt text from code'` for an image, use `page.getByAltText(\\'Exact, Full alt text from code\\')`.\n" +
"        7.  **Title Attribute:** IF your 'DOM Structure Summary' identified a `title='Exact title text from code'` for an element, use `page.getByTitle(\\'Exact, Full title text from code\\')`.\n" +
"        8.  **Visible Text (using `getByText` or `filter({ hasText: ... })`, especially for NESTED text, or when direct name/label is insufficient/ambiguous, as determined by your 'DOM Structure Summary' from the code):**\n" +
"            *   If your 'DOM Structure Summary' (based on code) indicates that distinct, **full, exact visible text** is the primary identifier AND it's nested inside an interactive element (e.g., `<button><span>Click Me From Code</span></button>`, or `<button role=\"combobox\"><span>Select Type From Code</span></button>` where 'Select Type From Code' is the visible placeholder text found in the code):\n" +
"                *   **PREFER:** `page.getByRole(\\'relevant-role\\').filter({ hasText: \\'Exact, Full Visible Text From Code\\' })` (e.g., `page.getByRole(\\'button\\').filter({ hasText: \\'Select Department From Code\\' })` or `page.getByRole(\\'combobox\\').filter({ hasText: \\'Select Type From Code\\' })`). This is often the most robust for dropdown triggers where the text is inside (as determined by your code analysis). Ensure the text is EXACTLY as in the code.\n" +
"                *   Alternatively: `page.getByText(\\'Exact, Full Visible Text From Code\\').locator(\\'ancestor::relevant-role[1]\\')` (e.g., `page.getByText(\\'Next From Code\\').locator(\\'ancestor::button[1]\\')`). Ensure text is EXACTLY as in the code.\n" +
"            *   Use `page.getByText(\\'Exact, Full Visible Text From Code\\')` directly primarily for non-interactive text or as a base for further chaining if it ensures specificity based on your code analysis. **It is CRITICAL that you use the FULL text content of the element as identified in the code. Do not use partial text if the full text is available, as this can lead to ambiguity.** Ensure text is EXACTLY as in the code.\n" +
"        9.  **CSS Selectors (as a fallback, if more specific locators above are not applicable or robust based on code analysis):** Use CSS selectors (`page.locator('css=your-selector-from-code')`) sparingly. Prefer them if you can identify a very specific combination of tag, class, or attribute from the code, e.g., `page.locator('button.primary[name=\"submit_form\"]')`. Avoid overly complex or brittle CSS selectors.\n" +
"    -   **ABSOLUTELY CRITICAL:** DO NOT invent or assume DOM elements, selectors, or attributes (like test IDs, labels, or specific role names) that have NO BASIS in the provided code ('repositoryContext'). Your selectors MUST target DOM elements that are explicitly identifiable from the 'repositoryContext' and documented in your 'DOM Structure Summary'. USE THE EXACT, FULL TEXT AND CASING from the code for all names, labels, and visible text in locators.\n" +
"    -   **Handling Ambiguity / Strict Mode Violations (e.g. 'resolved to 2 elements'):** If your code analysis (documented in your 'DOM Structure Summary') suggests a chosen locator (e.g., `page.getByRole('button', { name: 'Submit' })` or `page.getByText('Details')`) might match multiple elements, you MUST refine it to ensure uniqueness. Prioritize these refinement strategies based on your code analysis:\n" +
"        1.  **Scoping within a Unique Parent/Ancestor:** If the target element is within a uniquely identifiable parent (e.g., a specific section, dialog, or list item identified from the code), locate the parent first, then chain the locator for the target element. Example: `await page.locator('#user-profile-section').getByRole('button', { name: 'Edit' }).click();` or `await page.getByRole('dialog', { name: 'Confirm Deletion From Code' }).getByRole('button', { name: 'Delete From Code' }).click();` (Ensure 'Confirm Deletion From Code' and 'Delete From Code' are the exact, full names/text from your code analysis.)\n" +
"        2.  **Filtering with `.filter()`:** Add a filter based on other properties like `hasText` for unique nested text, or `has` for a unique child element, as identifiable from your code analysis. Example: `await page.getByRole('listitem').filter({ hasText: 'Product Alpha From Code' }).getByRole('button', { name: 'Add to Cart From Code' }).click();` or `await page.getByRole('button').filter({ hasText: 'Confirm Purchase From Code' }).click();` (if 'Confirm Purchase From Code' is the exact, full, unique visible text within one of several generic buttons, as per your code analysis).\n" +
"        3.  **Positional Selectors (`.first()`, `.last()`, `.nth()`):** Use these as a *last resort* if code analysis indicates no other way to distinguish elements and there's a logical reason for the position (e.g., \"the first 'View Details' button in a list of products whose exact, full text 'View Details' is identical across multiple items\"). Be cautious, as this can make tests brittle. Example: `await page.getByRole('link', { name: 'Read More From Code' }).first().click();`\n" +
"        **If, after attempting these refinement strategies based on your code analysis, a unique, reliable selector CANNOT be determined, you MUST include a comment in the generated step string indicating this (e.g., `// CODE ANALYSIS INSUFFICIENT: Ambiguous locator for 'Delete' button (full text 'Delete From Code'); step requires manual review/update.`) and AVOID generating a potentially failing or ambiguous step. Do NOT guess.**\n" +
"7.  **Utilize a Broad Range of Playwright Capabilities (based *only* on your 'DOM Structure Summary' derived from code):**\n" +
"    *   **Interaction with Select Dropdowns (e.g., ShadCN style with `role=\"combobox\"` trigger and `role=\"option\"` items, as identified in your code analysis):**\n" +
"        1.  Locate the dropdown trigger (the element that is clicked to open the options). **Strictly follow this priority based on your 'DOM Structure Summary' (which is derived *solely* from analyzing the 'repositoryContext') and EXACT, FULL text from code:**\n" +
"            a.  IF your 'DOM Structure Summary' identified an associated `<label>` element in the code (e.g., `<label for=\"dropdownId\">Exact, Full Label Text From Code</label>`): `await page.getByLabel('Exact, Full Label Text From Code').click();`\n" +
"            b.  ELSE IF your 'DOM Structure Summary' identified that the combobox element itself has a unique, explicit `aria-label` in the code (e.g., `<button role=\"combobox\" aria-label=\"Exact, Full Accessible Name From Code\">...`): `await page.getByRole('combobox', { name: 'Exact, Full Accessible Name From Code' }).click();`\n" +
"            c.  **ELSE IF (MOST COMMON FOR VISIBLE PLACEHOLDERS INSIDE THE COMBOBOX, as identified from your CODE ANALYSIS):** IF your 'DOM Structure Summary' identified **exact, full** visible placeholder text *nested inside* the combobox trigger in the code (e.g., in a `<span>Actual, Full Placeholder Text From Code</span>`): `await page.getByRole('combobox').filter({ hasText: 'Actual, Full Placeholder Text From Code' }).click();` (DO NOT use this nested placeholder text in the `name` option of `getByRole` unless your 'DOM Structure Summary' based on code analysis confirms it's the button's direct, full accessible name).\n" +
"            d.  As a fallback, IF **exact, full** text is unique and clearly identifiable from code AND your 'DOM Structure Summary' indicates it's part of a button that is a combobox trigger: `await page.getByText('Exact, Full Placeholder Text From Code').locator('ancestor::button[role=\"combobox\"][1]').click();`\n" +
"        2.  Locate and click the desired option: `await page.getByRole('option', { name: 'Exact, Full Text of the Option From Code' }).click();` Ensure the option text is EXACTLY as identified from your code analysis.\n" +
"    *   **Varied Actions:** Go beyond basic `click()` and `fill()`. Where your analysis of the code suggests specific types of interactions, employ the corresponding Playwright commands. For example:\n" +
"        - For mouse hover interactions on elements clearly identified in code: `hover()`.\n" +
"        - For double clicks if code suggests this functionality: `dblclick()`.\n" +
"        - For submitting forms or triggering actions via keyboard: `press(\\'Enter\\')` (or other keys like 'Escape', 'Tab' if code indicates specific keyboard handling).\n" +
"        - For selecting options in standard `<select>` elements (NOT combobox pattern, as identified from code): `selectOption()`.\n" +
"        - For checkboxes or radio buttons (identified by role and label/name from code): `check()`/`uncheck()`.\n" +
"        - For file upload inputs (identified from code): `setInputFiles()`.\n" +
"        - If code indicates drag-and-drop functionality: `dragAndDrop()`.\n" +
"        - For explicitly setting focus or blurring elements if test logic (based on code) requires it: `focus()`, `blur()`.\n" +
"        - To ensure an element is visible before interaction if it might be off-screen (and this is inferable from code context): `scrollIntoViewIfNeeded()`.\n" +
"    *   **Comprehensive Assertions:** Implement meaningful and frequent `expect()` assertions to thoroughly validate application state, attributes, and behavior as inferred *strictly from the code*. Use a diverse set of matchers directly relevant to what the code indicates should happen. Examples include: `toBeVisible()`, `toBeHidden()`, `toBeEnabled()`, `toBeDisabled()`, `toBeEditable()`, `toBeFocused()`, `toBeChecked()`, `toContainText()` (for parts of text, useful for dynamic content if pattern is clear from code, but ensure uniqueness), `toHaveText()` (for **exact, full text** or regular expressions if text is precisely determinable from code), `toHaveValue()` (for input fields), `toHaveAttribute()` (for attributes visible in code), `toHaveCSS()` (if styles are critical and inferable from code), `toHaveCount()` (for lists of elements whose count can be determined from code logic), `toHaveURL()`, `toHaveTitle()`. Assert not just presence, but also correct states, values, and visual properties *if these are clearly inferable from the provided code context*.\n" +
"    *   **CRITICAL for Ambiguous Text Assertions (e.g., Toasts like 'Order Placed Successfully!', based on your 'DOM Structure Summary' from code):** When asserting visibility of text that your code analysis suggests might appear in multiple DOM locations (e.g., a visual `<div>` and an ARIA `<span role=\"status\">`):\n" +
"        a.  Your primary goal is to assert visibility on the main **user-facing visual element** as identified from the code.\n" +
"        b.  From your 'DOM Structure Summary', if you can identify a unique parent/container for this visual element from the code (e.g., a `div` with `role=\"alert\"`, `role=\"alertdialog\"`, or a specific class like `toast-container-class-from-code` from component code), **YOU MUST** use it to scope your locator: `expect(page.getByRole('alert').getByText('Exact, Full Toast Message From Code!')).toBeVisible();` OR `expect(page.locator('.toast-container-class-from-code').getByText('Exact, Full Toast Message From Code!')).toBeVisible();`.\n" +
"        c.  If such a unique container isn't clearly identifiable from the code, and you must use `page.getByText('Exact, Full Toast Message From Code!')` directly, and your code analysis anticipates it will match multiple elements, **YOU MUST** use `.first()` (or `.last()` if appropriate for the main visual element based on code structure) to target the most likely user-visible instance: `expect(page.getByText('Exact, Full Toast Message From Code!').first()).toBeVisible();`.\n" +
"        d.  **Under no circumstances should you generate an assertion that is likely to cause a strict mode violation due to ambiguity if that ambiguity can be resolved by more specific targeting based on your code analysis.** If, after all considerations, a unique locator for the assertion target cannot be confidently determined from the code, you MUST include a comment indicating this in the step and consider if the assertion is robust enough or if a different validation strategy is needed.\n" +
"    *   **For Input Validation:** When testing forms (identified from code) with invalid/missing data, always assert that expected validation messages (which should be identifiable from the component's code or error handling logic, using **exact, full text**) appear, and that submission is appropriately blocked or handled as per the inferred application logic.\n" +
"    *   **Handling Complex UI & Events:** If the code suggests features like popups/new tabs, dialogs/alerts (e.g., `window.alert` or custom modal components identified from code), iframes, or complex event sequences (e.g., waiting for a download to start after a click that triggers a file download, if evident in code), generate steps that use appropriate Playwright APIs to handle them (e.g., `page.waitForEvent(\\'popup\\')`, `page.on(\\'dialog\\', ...)`, `frameLocator()`, `page.waitForEvent(\\'download\\')`).\n" +
"8.  **Waiting Strategies:** Primarily rely on Playwright's auto-waiting by interacting with elements (using the precise locators derived from your code analysis) and using web-first assertions (e.g., `expect(locator).toBeVisible()`). Use explicit waits like `page.waitForSelector()`, `page.waitForFunction()`, `page.waitForNavigation()`, or `page.waitForLoadState()` *sparingly* and only when the application's behavior (as inferred *strictly from the code*) *absolutely necessitates it* (e.g., waiting for a specific network response to complete if code shows an API call that isn't tied to a visible UI change that Playwright can auto-wait for, or waiting for a custom event whose handling is visible in the code). When in doubt, prefer a robust assertion with a timeout, like `await expect(page.locator(\\'selectorFromCode\\')).toBeVisible({ timeout: 15000 });` or `await expect(page.locator(\\'selectorFromCode\\')).toContainText(\\'expectedTextAfterLoad\\', { timeout: 15000 });` before interacting with elements whose appearance might be delayed by asynchronous operations not covered by standard auto-waits (as determined by your code analysis). Use reasonable timeouts.\n" +
"9.  Ensure all test cases are self-contained and cover the entirety of the scenario/variation, making them \"deep\" based on your code analysis.\n" +
"10. **Mandatory Field Interaction:** If your code analysis indicates required input fields for a form or action within a \"happy path\" scenario, the test steps for that scenario MUST include filling those required fields with plausible data. For negative test scenarios (e.g., testing missing field validation based on code), intentionally omit or provide invalid data for the relevant fields and assert the outcome (as suggested by code).\n" +
"Ensure all parts of the output are well-structured, conform to the output schema, and that your reasoning for selector choices is implicitly tied to the rules above and your 'DOM Structure Summary' (which is based ONLY on the provided code).";


const prompt = ai.definePrompt({
  name: 'analyzeAndGeneratePrompt',
  input: {schema: AnalyzeAndGenerateTestsInputSchema},
  output: {schema: AnalyzeAndGenerateTestsOutputSchema},
  prompt: analyzeAndGeneratePromptText,
});

const analyzeAndGenerateFlow = ai.defineFlow(
  {
    name: 'analyzeAndGenerateFlow',
    inputSchema: AnalyzeAndGenerateTestsInputSchema,
    outputSchema: AnalyzeAndGenerateTestsOutputSchema,
  },
  async (flowInputWithContext: AnalyzeAndGenerateTestsInput): Promise<AnalyzeAndGenerateTestsOutput> => {
    try {
      const result = await prompt(flowInputWithContext);

      if (!result.output) {
        const errorMessage = "AI model did not return a structured output. The content from the repository might have been too large or complex for the model to process, or there was an issue with the prompt response format.";
        console.error("Prompt execution failed to produce a valid output conforming to the schema.", { input: flowInputWithContext, error: errorMessage });
        return {
          analysisSource: "AI Model Error",
          applicationLogicSummary: "The AI model failed to produce an analysis. Output was not structured as expected.",
          domStructureSummary: "The AI model failed to produce a DOM summary due to an output format error.",
          potentialUserFlows: "No user flows could be generated due to an AI model output format error.",
          testCases: [],
          debugInfo: {
            repoServiceMessage: errorMessage,
          }
        };
      }
      
      if (result.output && (!result.output.debugInfo || !result.output.debugInfo.repoServiceMessage)) {
        result.output.debugInfo = {
          ...(result.output.debugInfo || {}), 
          repoServiceMessage: "AI processing completed." 
        };
      }
      return result.output;
    } catch (error: any) {
      console.error("Error during AI prompt execution in analyzeAndGenerateFlow:", error);
      let errorMessage = "An unexpected error occurred during AI processing.";
      if (error.message) {
          if (error.message.includes('Service Unavailable') || error.message.includes('overloaded')) {
            errorMessage = "The AI model is temporarily overloaded or unavailable. Please try again later.";
          } else if (error.message.includes('Candidate was blocked due to SAFETY')) {
            errorMessage = "The AI model's response was blocked due to safety settings. The content generated may have violated safety policies.";
          } else if (error.message.includes('API key not valid')) {
            errorMessage = "Invalid API key for the AI service. Please check configuration.";
          } else {
            errorMessage = "AI processing error: " + (error.message || "Unknown error");
          }
      }

      return {
        analysisSource: "AI Model Error",
        applicationLogicSummary: "The AI model encountered an error during processing. " + errorMessage,
        domStructureSummary: "The AI model failed to produce a DOM summary due to an internal error.",
        potentialUserFlows: "No user flows could be generated due to an AI model error.",
        testCases: [],
        debugInfo: {
          repoServiceMessage: errorMessage, 
        }
      };
    }
  }
);

