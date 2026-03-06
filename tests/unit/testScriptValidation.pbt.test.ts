/**
 * Property-Based Tests for Test Script Validation
 * **Validates: Requirements 2.3**
 * 
 * These tests verify that the test script validation logic correctly:
 * - Accepts all valid test scripts with proper structure
 * - Rejects all invalid test scripts with appropriate error messages
 * - Validates required fields for each action type
 */

import * as fc from 'fast-check';
import { validateTestScript } from '../../src/shared/utils/promptBuilder';
import { TestScript, TestStep } from '../../src/shared/types';

describe('Property-Based Tests: Test Script Validation', () => {
  describe('Property 1: Valid test scripts never throw errors', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any valid test script with proper structure and required fields,
     * the validation function should not throw an error.
     */
    it('should accept all valid test scripts', () => {
      fc.assert(
        fc.property(
          fc.array(validTestStepArbitrary(), { minLength: 1, maxLength: 20 }),
          (steps) => {
            const testScript: TestScript = { steps };
            
            // Should not throw
            expect(() => validateTestScript(testScript)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Invalid structures always throw errors', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any test script that is not an object or lacks a steps array,
     * the validation function should throw an error.
     */
    it('should reject non-object inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything())
          ),
          (invalidInput) => {
            expect(() => validateTestScript(invalidInput)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject objects without steps array', () => {
      fc.assert(
        fc.property(
          fc.record({
            notSteps: fc.anything(),
          }),
          (invalidObj) => {
            expect(() => validateTestScript(invalidObj)).toThrow('steps');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject objects with non-array steps', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.object(),
            fc.constant(null)
          ),
          (invalidSteps) => {
            const invalidScript = { steps: invalidSteps };
            expect(() => validateTestScript(invalidScript)).toThrow('steps');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject empty steps array', () => {
      const emptyScript = { steps: [] };
      expect(() => validateTestScript(emptyScript)).toThrow('at least one step');
    });
  });

  describe('Property 3: Steps with invalid actions always throw errors', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any step with an action that is not in the valid set
     * (navigate, fill, click, assert, waitForNavigation), validation should fail.
     */
    it('should reject steps with invalid action types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => !['navigate', 'fill', 'click', 'assert', 'waitForNavigation'].includes(s)),
          (invalidAction) => {
            const invalidScript = {
              steps: [{ action: invalidAction }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject steps without action field', () => {
      fc.assert(
        fc.property(
          fc.record({
            selector: fc.string(),
            value: fc.string(),
          }),
          (stepWithoutAction) => {
            const invalidScript = { steps: [stepWithoutAction] };
            expect(() => validateTestScript(invalidScript)).toThrow('action');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 4: Navigate actions require valid URL field', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any navigate action, the step must have a url field
     * that is a non-empty string.
     */
    it('should reject navigate steps without url', () => {
      const invalidScript = {
        steps: [{ action: 'navigate' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('url');
    });

    it('should reject navigate steps with non-string url', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object()
          ),
          (invalidUrl) => {
            const invalidScript = {
              steps: [{ action: 'navigate', url: invalidUrl }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('url');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept navigate steps with valid url', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const validScript = {
              steps: [{ action: 'navigate', url }],
            };
            expect(() => validateTestScript(validScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Fill actions require selector and value fields', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any fill action, the step must have both selector and value
     * fields that are non-empty strings.
     */
    it('should reject fill steps without selector', () => {
      const invalidScript = {
        steps: [{ action: 'fill', value: 'test' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('selector');
    });

    it('should reject fill steps without value', () => {
      const invalidScript = {
        steps: [{ action: 'fill', selector: '#input' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('value');
    });

    it('should reject fill steps with non-string selector', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
          (invalidSelector) => {
            const invalidScript = {
              steps: [{ action: 'fill', selector: invalidSelector, value: 'test' }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('selector');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject fill steps with non-string value', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
          (invalidValue) => {
            const invalidScript = {
              steps: [{ action: 'fill', selector: '#input', value: invalidValue }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('value');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept fill steps with valid selector and value', () => {
      fc.assert(
        fc.property(
          cssSelector(),
          fc.string({ minLength: 1 }), // Ensure non-empty value
          (selector, value) => {
            const validScript = {
              steps: [{ action: 'fill', selector, value }],
            };
            expect(() => validateTestScript(validScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Click actions require selector field', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any click action, the step must have a selector field
     * that is a non-empty string.
     */
    it('should reject click steps without selector', () => {
      const invalidScript = {
        steps: [{ action: 'click' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('selector');
    });

    it('should reject click steps with non-string selector', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
          (invalidSelector) => {
            const invalidScript = {
              steps: [{ action: 'click', selector: invalidSelector }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('selector');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept click steps with valid selector', () => {
      fc.assert(
        fc.property(
          cssSelector(),
          (selector) => {
            const validScript = {
              steps: [{ action: 'click', selector }],
            };
            expect(() => validateTestScript(validScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 7: Assert actions require selector and condition fields', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any assert action, the step must have both selector and condition
     * fields that are non-empty strings.
     */
    it('should reject assert steps without selector', () => {
      const invalidScript = {
        steps: [{ action: 'assert', condition: 'visible' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('selector');
    });

    it('should reject assert steps without condition', () => {
      const invalidScript = {
        steps: [{ action: 'assert', selector: '.element' }],
      };
      expect(() => validateTestScript(invalidScript)).toThrow('condition');
    });

    it('should reject assert steps with non-string selector', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
          (invalidSelector) => {
            const invalidScript = {
              steps: [{ action: 'assert', selector: invalidSelector, condition: 'visible' }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('selector');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject assert steps with non-string condition', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.object()),
          (invalidCondition) => {
            const invalidScript = {
              steps: [{ action: 'assert', selector: '.element', condition: invalidCondition }],
            };
            expect(() => validateTestScript(invalidScript)).toThrow('condition');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept assert steps with valid selector and condition', () => {
      fc.assert(
        fc.property(
          cssSelector(),
          fc.constantFrom('visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked', 'text'),
          (selector, condition) => {
            const validScript = {
              steps: [{ action: 'assert', selector, condition }],
            };
            expect(() => validateTestScript(validScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 8: WaitForNavigation actions require no additional fields', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any waitForNavigation action, the step only needs the action field.
     * Additional fields are allowed but not required.
     */
    it('should accept waitForNavigation steps without additional fields', () => {
      const validScript = {
        steps: [{ action: 'waitForNavigation' }],
      };
      expect(() => validateTestScript(validScript)).not.toThrow();
    });

    it('should accept waitForNavigation steps with extra fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constant('waitForNavigation'),
            timeout: fc.integer({ min: 0, max: 60000 }),
            extraField: fc.string(),
          }),
          (step) => {
            const validScript = { steps: [step] };
            expect(() => validateTestScript(validScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9: Multi-step scripts validate all steps', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any test script with multiple steps, validation should check
     * all steps and report the correct step number in error messages.
     */
    it('should validate all steps in sequence', () => {
      fc.assert(
        fc.property(
          fc.array(validTestStepArbitrary(), { minLength: 2, maxLength: 10 }),
          (steps) => {
            const testScript = { steps };
            expect(() => validateTestScript(testScript)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report correct step number for invalid steps', () => {
      fc.assert(
        fc.property(
          fc.array(validTestStepArbitrary(), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 0, max: 4 }),
          (validSteps, invalidIndex) => {
            if (invalidIndex >= validSteps.length) return;
            
            const steps = [...validSteps];
            // Use 'any' to bypass TypeScript checking for intentionally invalid data
            steps[invalidIndex] = { action: 'invalid_action' } as any;
            
            const invalidScript = { steps };
            
            try {
              validateTestScript(invalidScript);
              throw new Error('Should have thrown validation error');
            } catch (error) {
              const err = error as Error;
              expect(err.message).toContain(`Step ${invalidIndex + 1}`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 10: Validation is deterministic', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Property: For any test script, validation should always produce the same result
     * when called multiple times with the same input.
     */
    it('should produce consistent results for the same input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.array(validTestStepArbitrary(), { minLength: 1, maxLength: 5 }).map(steps => ({ steps })),
            fc.constant({ steps: [{ action: 'invalid' }] })
          ),
          (testScript) => {
            let firstResult: { success: boolean; error?: string } = { success: true };
            
            try {
              validateTestScript(testScript);
            } catch (error) {
              firstResult = { success: false, error: (error as Error).message };
            }
            
            // Run validation again
            let secondResult: { success: boolean; error?: string } = { success: true };
            
            try {
              validateTestScript(testScript);
            } catch (error) {
              secondResult = { success: false, error: (error as Error).message };
            }
            
            // Results should be identical
            expect(firstResult.success).toBe(secondResult.success);
            if (!firstResult.success) {
              expect(firstResult.error).toBe(secondResult.error);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Arbitraries (Generators) for Property-Based Testing
// ============================================================================

/**
 * Generate a valid CSS selector
 */
function cssSelector(): fc.Arbitrary<string> {
  return fc.oneof(
    // ID selectors
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `#${s.replace(/[^a-zA-Z0-9-_]/g, 'a')}`),
    // Class selectors
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `.${s.replace(/[^a-zA-Z0-9-_]/g, 'a')}`),
    // Attribute selectors
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `[data-testid="${s}"]`),
    // Element selectors
    fc.constantFrom('button', 'input', 'div', 'span', 'a', 'form'),
    // Combined selectors
    fc.tuple(
      fc.constantFrom('button', 'input', 'div', 'a'),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'a'))
    ).map(([elem, cls]) => `${elem}.${cls}`)
  );
}

/**
 * Generate a valid test step with proper structure
 */
function validTestStepArbitrary(): fc.Arbitrary<TestStep> {
  return fc.oneof(
    // Navigate step
    fc.record({
      action: fc.constant('navigate' as const),
      url: fc.webUrl(),
    }),
    // Fill step - value must be non-empty string
    fc.record({
      action: fc.constant('fill' as const),
      selector: cssSelector(),
      value: fc.string({ minLength: 1 }),
    }),
    // Click step
    fc.record({
      action: fc.constant('click' as const),
      selector: cssSelector(),
    }),
    // Assert step
    fc.record({
      action: fc.constant('assert' as const),
      selector: cssSelector(),
      condition: fc.constantFrom('visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked', 'text'),
    }),
    // WaitForNavigation step
    fc.record({
      action: fc.constant('waitForNavigation' as const),
    })
  );
}
