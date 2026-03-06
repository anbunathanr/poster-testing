// Input validation utilities
import { TestScript, Environment } from '../types';

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidEnvironment = (env: string): env is Environment => {
  return ['DEV', 'STAGING', 'PROD'].includes(env);
};

export const isValidTestScript = (script: any): script is TestScript => {
  if (!script || !Array.isArray(script.steps)) {
    return false;
  }

  const validActions = ['navigate', 'fill', 'click', 'assert', 'waitForNavigation'];

  return script.steps.every((step: any) => {
    if (!step.action || !validActions.includes(step.action)) {
      return false;
    }

    // Validate required fields based on action type
    switch (step.action) {
      case 'navigate':
        return typeof step.url === 'string';
      case 'fill':
        return typeof step.selector === 'string' && typeof step.value === 'string';
      case 'click':
        return typeof step.selector === 'string';
      case 'assert':
        return typeof step.selector === 'string' && typeof step.condition === 'string';
      case 'waitForNavigation':
        return true;
      default:
        return false;
    }
  });
};
