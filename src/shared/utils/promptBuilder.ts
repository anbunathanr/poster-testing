/**
 * Prompt builder utility for AI-powered test generation
 * Constructs structured prompts for Claude 3.5 Sonnet via Amazon Bedrock
 */

import { Environment, TestScript } from '../types';

/**
 * Input parameters for building a test generation prompt
 */
export interface PromptBuilderInput {
  testPrompt: string;
  environment: Environment;
  baseUrl?: string;
  additionalContext?: string;
}

/**
 * Template for test generation prompts
 */
const TEST_GENERATION_TEMPLATE = `You are a QA automation expert specializing in Playwright test generation. Your task is to generate structured test scripts from natural language descriptions.

**Test Scenario:**
{testPrompt}

**Target Environment:** {environment}
{baseUrlSection}
{additionalContextSection}

**Instructions:**
1. Generate a complete Playwright test script as a JSON object
2. Break down the test scenario into clear, sequential steps
3. Use specific, reliable selectors (prefer data-testid, id, or unique CSS selectors)
4. Include appropriate assertions to verify expected behavior
5. Add navigation waits where needed to ensure page loads complete
6. Return ONLY valid JSON - no markdown, no explanations, no additional text

**Supported Actions:**
- navigate: Navigate to a URL
- fill: Fill an input field with a value
- click: Click on an element
- assert: Verify an element's state or content
- waitForNavigation: Wait for page navigation to complete

**Expected JSON Format:**
{
  "steps": [
    {
      "action": "navigate",
      "url": "https://example.com/page"
    },
    {
      "action": "fill",
      "selector": "#email",
      "value": "user@example.com"
    },
    {
      "action": "click",
      "selector": "button[type='submit']"
    },
    {
      "action": "waitForNavigation"
    },
    {
      "action": "assert",
      "selector": ".dashboard",
      "condition": "visible"
    }
  ]
}

**Selector Guidelines:**
- Prefer data-testid attributes: [data-testid="login-button"]
- Use IDs when available: #submit-button
- Use specific CSS selectors: button.primary[type="submit"]
- Avoid generic selectors like: div, span, button (without qualifiers)
- For text-based selection: text=Login or "Login" (exact match)

**Assertion Conditions:**
- visible: Element is visible on the page
- hidden: Element is not visible
- enabled: Element is enabled (not disabled)
- disabled: Element is disabled
- checked: Checkbox/radio is checked
- unchecked: Checkbox/radio is not checked
- text: Element contains specific text (use with value field)

**Important:**
- Return ONLY the JSON object
- Do not include markdown code blocks
- Do not include explanations before or after the JSON
- Ensure all JSON is properly formatted and valid
- Each step must have a valid action type
- Include all required fields for each action type`;

/**
 * Build a prompt for test generation
 * @param input - Prompt builder input parameters
 * @returns Formatted prompt string for Bedrock
 */
export function buildTestGenerationPrompt(input: PromptBuilderInput): string {
  const { testPrompt, environment, baseUrl, additionalContext } = input;

  // Build optional sections
  const baseUrlSection = baseUrl ? `**Base URL:** ${baseUrl}` : '';

  const additionalContextSection = additionalContext
    ? `\n**Additional Context:**\n${additionalContext}`
    : '';

  // Replace template placeholders
  let prompt = TEST_GENERATION_TEMPLATE.replace('{testPrompt}', testPrompt)
    .replace('{environment}', environment)
    .replace('{baseUrlSection}', baseUrlSection)
    .replace('{additionalContextSection}', additionalContextSection);

  // Clean up extra newlines
  prompt = prompt.replace(/\n{3,}/g, '\n\n');

  return prompt;
}

/**
 * Parse the JSON response from Bedrock into a TestScript
 * @param response - Raw response string from Bedrock
 * @returns Parsed TestScript object
 * @throws Error if parsing fails or validation fails
 */
export function parseTestScriptResponse(response: string): TestScript {
  // Remove markdown code blocks if present
  let cleanedResponse = response.trim();

  // Remove ```json and ``` markers
  cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
  cleanedResponse = cleanedResponse.replace(/^```\s*/, '');
  cleanedResponse = cleanedResponse.replace(/\s*```$/, '');

  // Trim again after removing markers
  cleanedResponse = cleanedResponse.trim();

  try {
    const parsed = JSON.parse(cleanedResponse);

    // Validate the structure
    validateTestScript(parsed);

    return parsed as TestScript;
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to parse test script response: ${err.message}`);
  }
}

/**
 * Validate that a parsed object conforms to TestScript structure
 * @param obj - Object to validate
 * @throws Error if validation fails
 */
export function validateTestScript(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Test script must be an object');
  }

  if (!Array.isArray(obj.steps)) {
    throw new Error('Test script must have a "steps" array');
  }

  if (obj.steps.length === 0) {
    throw new Error('Test script must have at least one step');
  }

  const validActions = ['navigate', 'fill', 'click', 'assert', 'waitForNavigation'];

  obj.steps.forEach((step: any, index: number) => {
    if (!step || typeof step !== 'object') {
      throw new Error(`Step ${index + 1} must be an object`);
    }

    if (!step.action || typeof step.action !== 'string') {
      throw new Error(`Step ${index + 1} must have an "action" field`);
    }

    if (!validActions.includes(step.action)) {
      throw new Error(
        `Step ${index + 1} has invalid action "${step.action}". Valid actions: ${validActions.join(', ')}`
      );
    }

    // Validate required fields for each action type
    switch (step.action) {
      case 'navigate':
        if (!step.url || typeof step.url !== 'string') {
          throw new Error(`Step ${index + 1} (navigate) must have a "url" field`);
        }
        break;

      case 'fill':
        if (!step.selector || typeof step.selector !== 'string') {
          throw new Error(`Step ${index + 1} (fill) must have a "selector" field`);
        }
        if (!step.value || typeof step.value !== 'string') {
          throw new Error(`Step ${index + 1} (fill) must have a "value" field`);
        }
        break;

      case 'click':
        if (!step.selector || typeof step.selector !== 'string') {
          throw new Error(`Step ${index + 1} (click) must have a "selector" field`);
        }
        break;

      case 'assert':
        if (!step.selector || typeof step.selector !== 'string') {
          throw new Error(`Step ${index + 1} (assert) must have a "selector" field`);
        }
        if (!step.condition || typeof step.condition !== 'string') {
          throw new Error(`Step ${index + 1} (assert) must have a "condition" field`);
        }
        break;

      case 'waitForNavigation':
        // No required fields for waitForNavigation
        break;
    }
  });
}

/**
 * Build a simple prompt for quick test generation (minimal template)
 * @param testPrompt - Natural language test description
 * @returns Formatted prompt string
 */
export function buildSimplePrompt(testPrompt: string): string {
  return buildTestGenerationPrompt({
    testPrompt,
    environment: 'DEV',
  });
}
