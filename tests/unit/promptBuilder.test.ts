/**
 * Unit tests for prompt builder utility
 */

import {
  buildTestGenerationPrompt,
  buildSimplePrompt,
  parseTestScriptResponse,
  validateTestScript,
  PromptBuilderInput,
} from '../../src/shared/utils/promptBuilder';
import { TestScript } from '../../src/shared/types';

describe('promptBuilder', () => {
  describe('buildTestGenerationPrompt', () => {
    it('should build a basic prompt with required fields', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test login functionality',
        environment: 'DEV',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('Test login functionality');
      expect(prompt).toContain('DEV');
      expect(prompt).toContain('QA automation expert');
      expect(prompt).toContain('Supported Actions');
      expect(prompt).toContain('Expected JSON Format');
    });

    it('should include base URL when provided', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test login functionality',
        environment: 'STAGING',
        baseUrl: 'https://staging.example.com',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('https://staging.example.com');
      expect(prompt).toContain('Base URL');
    });

    it('should include additional context when provided', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test login functionality',
        environment: 'PROD',
        additionalContext: 'Use test user credentials from environment variables',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('Use test user credentials from environment variables');
      expect(prompt).toContain('Additional Context');
    });

    it('should include all optional fields when provided', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test checkout flow',
        environment: 'DEV',
        baseUrl: 'https://dev.example.com',
        additionalContext: 'Test with mock payment gateway',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('Test checkout flow');
      expect(prompt).toContain('DEV');
      expect(prompt).toContain('https://dev.example.com');
      expect(prompt).toContain('Test with mock payment gateway');
    });

    it('should clean up extra newlines', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test login',
        environment: 'DEV',
      };

      const prompt = buildTestGenerationPrompt(input);

      // Should not have more than 2 consecutive newlines
      expect(prompt).not.toMatch(/\n{3,}/);
    });

    it('should include all supported actions in the template', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test',
        environment: 'DEV',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('navigate');
      expect(prompt).toContain('fill');
      expect(prompt).toContain('click');
      expect(prompt).toContain('assert');
      expect(prompt).toContain('waitForNavigation');
    });

    it('should include selector guidelines', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test',
        environment: 'DEV',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('data-testid');
      expect(prompt).toContain('Selector Guidelines');
    });

    it('should include assertion conditions', () => {
      const input: PromptBuilderInput = {
        testPrompt: 'Test',
        environment: 'DEV',
      };

      const prompt = buildTestGenerationPrompt(input);

      expect(prompt).toContain('visible');
      expect(prompt).toContain('hidden');
      expect(prompt).toContain('enabled');
      expect(prompt).toContain('Assertion Conditions');
    });
  });

  describe('buildSimplePrompt', () => {
    it('should build a prompt with default environment', () => {
      const prompt = buildSimplePrompt('Test user registration');

      expect(prompt).toContain('Test user registration');
      expect(prompt).toContain('DEV');
    });

    it('should return a valid prompt string', () => {
      const prompt = buildSimplePrompt('Test');

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('parseTestScriptResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: '#button' },
        ],
      });

      const result = parseTestScriptResponse(response);

      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].action).toBe('navigate');
      expect(result.steps[1].action).toBe('click');
    });

    it('should parse JSON with markdown code blocks', () => {
      const response = '```json\n{"steps":[{"action":"navigate","url":"https://example.com"}]}\n```';

      const result = parseTestScriptResponse(response);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action).toBe('navigate');
    });

    it('should parse JSON with ```json marker', () => {
      const response = '```json\n{"steps":[{"action":"click","selector":"#btn"}]}\n```';

      const result = parseTestScriptResponse(response);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action).toBe('click');
    });

    it('should parse JSON with ``` marker only', () => {
      const response = '```\n{"steps":[{"action":"waitForNavigation"}]}\n```';

      const result = parseTestScriptResponse(response);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action).toBe('waitForNavigation');
    });

    it('should handle whitespace around JSON', () => {
      const response = '  \n  {"steps":[{"action":"navigate","url":"https://test.com"}]}  \n  ';

      const result = parseTestScriptResponse(response);

      expect(result.steps).toHaveLength(1);
    });

    it('should throw error for invalid JSON', () => {
      const response = 'not valid json';

      expect(() => parseTestScriptResponse(response)).toThrow('Failed to parse test script response');
    });

    it('should throw error for JSON without steps array', () => {
      const response = '{"invalid": "structure"}';

      expect(() => parseTestScriptResponse(response)).toThrow('steps');
    });

    it('should throw error for empty steps array', () => {
      const response = '{"steps": []}';

      expect(() => parseTestScriptResponse(response)).toThrow('at least one step');
    });
  });

  describe('validateTestScript', () => {
    it('should validate a correct test script', () => {
      const testScript: TestScript = {
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'fill', selector: '#email', value: 'test@example.com' },
          { action: 'click', selector: '#submit' },
          { action: 'waitForNavigation' },
          { action: 'assert', selector: '.dashboard', condition: 'visible' },
        ],
      };

      expect(() => validateTestScript(testScript)).not.toThrow();
    });

    it('should throw error if input is not an object', () => {
      expect(() => validateTestScript(null)).toThrow('must be an object');
      expect(() => validateTestScript('string')).toThrow('must be an object');
      expect(() => validateTestScript(123)).toThrow('must be an object');
    });

    it('should throw error if steps is not an array', () => {
      const invalid = { steps: 'not an array' };

      expect(() => validateTestScript(invalid)).toThrow('steps');
    });

    it('should throw error if steps array is empty', () => {
      const invalid = { steps: [] };

      expect(() => validateTestScript(invalid)).toThrow('at least one step');
    });

    it('should throw error if step is not an object', () => {
      const invalid = { steps: ['not an object'] };

      expect(() => validateTestScript(invalid)).toThrow('Step 1 must be an object');
    });

    it('should throw error if step has no action field', () => {
      const invalid = { steps: [{ selector: '#test' }] };

      expect(() => validateTestScript(invalid)).toThrow('must have an "action" field');
    });

    it('should throw error for invalid action type', () => {
      const invalid = { steps: [{ action: 'invalid_action' }] };

      expect(() => validateTestScript(invalid)).toThrow('invalid action');
    });

    describe('navigate action validation', () => {
      it('should require url field', () => {
        const invalid = { steps: [{ action: 'navigate' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "url" field');
      });

      it('should validate url is a string', () => {
        const invalid = { steps: [{ action: 'navigate', url: 123 }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "url" field');
      });

      it('should accept valid navigate step', () => {
        const valid = { steps: [{ action: 'navigate', url: 'https://example.com' }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });
    });

    describe('fill action validation', () => {
      it('should require selector field', () => {
        const invalid = { steps: [{ action: 'fill', value: 'test' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should require value field', () => {
        const invalid = { steps: [{ action: 'fill', selector: '#input' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "value" field');
      });

      it('should validate selector is a string', () => {
        const invalid = { steps: [{ action: 'fill', selector: 123, value: 'test' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should validate value is a string', () => {
        const invalid = { steps: [{ action: 'fill', selector: '#input', value: 123 }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "value" field');
      });

      it('should accept valid fill step', () => {
        const valid = { steps: [{ action: 'fill', selector: '#email', value: 'test@example.com' }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });
    });

    describe('click action validation', () => {
      it('should require selector field', () => {
        const invalid = { steps: [{ action: 'click' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should validate selector is a string', () => {
        const invalid = { steps: [{ action: 'click', selector: 123 }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should accept valid click step', () => {
        const valid = { steps: [{ action: 'click', selector: '#button' }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });
    });

    describe('assert action validation', () => {
      it('should require selector field', () => {
        const invalid = { steps: [{ action: 'assert', condition: 'visible' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should require condition field', () => {
        const invalid = { steps: [{ action: 'assert', selector: '.element' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "condition" field');
      });

      it('should validate selector is a string', () => {
        const invalid = { steps: [{ action: 'assert', selector: 123, condition: 'visible' }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "selector" field');
      });

      it('should validate condition is a string', () => {
        const invalid = { steps: [{ action: 'assert', selector: '.element', condition: 123 }] };

        expect(() => validateTestScript(invalid)).toThrow('must have a "condition" field');
      });

      it('should accept valid assert step', () => {
        const valid = { steps: [{ action: 'assert', selector: '.dashboard', condition: 'visible' }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });
    });

    describe('waitForNavigation action validation', () => {
      it('should accept waitForNavigation without additional fields', () => {
        const valid = { steps: [{ action: 'waitForNavigation' }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });

      it('should accept waitForNavigation with extra fields', () => {
        const valid = { steps: [{ action: 'waitForNavigation', timeout: 5000 }] };

        expect(() => validateTestScript(valid)).not.toThrow();
      });
    });

    it('should validate multiple steps correctly', () => {
      const testScript: TestScript = {
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'fill', selector: '#username', value: 'testuser' },
          { action: 'fill', selector: '#password', value: 'password123' },
          { action: 'click', selector: '#login-btn' },
          { action: 'waitForNavigation' },
          { action: 'assert', selector: '.welcome-message', condition: 'visible' },
        ],
      };

      expect(() => validateTestScript(testScript)).not.toThrow();
    });

    it('should report correct step number in error messages', () => {
      const invalid = {
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: '#btn' },
          { action: 'invalid_action' }, // Step 3
        ],
      };

      expect(() => validateTestScript(invalid)).toThrow('Step 3');
    });
  });
});
