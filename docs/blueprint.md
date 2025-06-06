# **App Name**: Playwright Genius

## Core Features:

- URL Input: Accepts a GitHub repository URL and application URL as input.
- Repository Analysis: Analyzes the GitHub repository using the GitHub API to understand application logic and DOM structure using Genkit and Gemini. Basically need to analyze with the mindset of an tester/ QA who tests an application.
- Test Case Generation: Generates Playwright test cases and test steps using AI based on extracted DOM elements(strictly should not assume DOM on it's own), application logic, and user flows. This will generate test scripts from scratch. A tool to help make complex decisions about which pieces of information to include in the output.
- Test Case Review: Presents generated test steps to the user in a clear dropdown format for review. for the selected scenario the test cases should be displayed down.
- Live Test Execution: Executes Playwright tests on the live application URL, providing real-time visualization of test execution. "MOST IMPORTANT"
- DOM Selector Highlighting: Highlights DOM selectors during test execution for easy identification and debugging.
- Test Report Generation: Generates a detailed HTML report including test script, DOM selectors, confidence scores, and screenshots done during playwright execution.

## Style Guidelines:

- Primary color: A calm blue (#64B5F6) to inspire confidence and reliability.
- Background color: Light gray (#F0F2F5), providing a neutral backdrop for code and reports.
- Accent color: A Light blue (##D2E3FC) to highlight key actions and feedback elements.
- Body font: 'Inter' (sans-serif) for a clean, modern, and readable interface.
- Code Font: 'Source Code Pro' for displaying code snippets, DOM Selectors and test results
- Clean, structured layout with clear visual hierarchy to facilitate ease of use.
- Subtle animations and transitions to provide feedback and enhance user experience without distraction.