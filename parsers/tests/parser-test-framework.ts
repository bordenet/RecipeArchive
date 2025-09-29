/**
 * Parser Test Framework
 *
 * Provides utilities for testing recipe parsers against known good URLs
 * and HTML fixtures.
 */

import { Recipe } from '../types';

export interface ParserTestCase {
  name: string;
  url: string;
  htmlFixture?: string;
  expectedRecipe: Partial<Recipe>;
  skipFields?: string[];
}

export interface ParserTestResult {
  testCase: ParserTestCase;
  passed: boolean;
  errors: string[];
  actualRecipe?: Recipe;
  executionTime: number;
}

export class ParserTestRunner {
  private parser: any;

  constructor(parser: any) {
    this.parser = parser;
  }

  async runTest(testCase: ParserTestCase): Promise<ParserTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let actualRecipe: Recipe | undefined;

    try {
      // Use HTML fixture if provided, otherwise this would need to fetch the URL
      if (!testCase.htmlFixture) {
        errors.push(
          'No HTML fixture provided - cannot test without HTML content'
        );
        return {
          testCase,
          passed: false,
          errors,
          executionTime: Date.now() - startTime,
        };
      }

      // Check if parser can handle this URL
      if (!this.parser.canParse(testCase.url)) {
        errors.push(`Parser cannot handle URL: ${testCase.url}`);
        return {
          testCase,
          passed: false,
          errors,
          executionTime: Date.now() - startTime,
        };
      }

      // Parse the HTML
      actualRecipe = await this.parser.parse(
        testCase.htmlFixture,
        testCase.url
      );

      // Validate required fields are present
      if (!actualRecipe?.title || actualRecipe.title.trim() === '') {
        errors.push('Missing or empty title');
      }

      if (!actualRecipe?.ingredients || actualRecipe.ingredients.length === 0) {
        errors.push('Missing or empty ingredients');
      }

      if (
        !actualRecipe?.instructions ||
        actualRecipe.instructions.length === 0
      ) {
        errors.push('Missing or empty instructions');
      }

      // Check expected values
      for (const [key, expectedValue] of Object.entries(
        testCase.expectedRecipe
      )) {
        if (testCase.skipFields?.includes(key)) {
          continue;
        }

        const actualValue = (actualRecipe as any)[key];

        if (key === 'ingredients' || key === 'instructions') {
          // For arrays, check minimum expected count
          if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
            if (actualValue.length < expectedValue.length) {
              errors.push(
                `${key}: expected at least ${expectedValue.length} items, got ${actualValue.length}`
              );
            }
          }
        } else if (key === 'title') {
          // For title, check if it contains expected keywords
          if (
            typeof expectedValue === 'string' &&
            typeof actualValue === 'string'
          ) {
            const expectedWords = expectedValue.toLowerCase().split(/\s+/);
            const actualTitle = actualValue.toLowerCase();
            const missingWords = expectedWords.filter(
              (word) => !actualTitle.includes(word)
            );
            if (missingWords.length > 0) {
              errors.push(
                `Title missing expected words: ${missingWords.join(', ')}`
              );
            }
          }
        } else {
          // For other fields, check exact match or presence
          if (expectedValue !== undefined && actualValue === undefined) {
            errors.push(`Missing expected field: ${key}`);
          }
        }
      }
    } catch (error) {
      errors.push(
        `Parser threw exception: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      testCase,
      passed: errors.length === 0,
      errors,
      actualRecipe,
      executionTime: Date.now() - startTime,
    };
  }

  async runTestSuite(testCases: ParserTestCase[]): Promise<ParserTestResult[]> {
    const results: ParserTestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push(result);
    }

    return results;
  }

  static generateReport(results: ParserTestResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    let report = `Parser Test Results\n`;
    report += `==================\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    if (failedTests > 0) {
      report += `Failed Tests:\n`;
      report += `=============\n`;

      results
        .filter((r) => !r.passed)
        .forEach((result) => {
          report += `\n❌ ${result.testCase.name}\n`;
          report += `   URL: ${result.testCase.url}\n`;
          report += `   Errors:\n`;
          result.errors.forEach((error) => {
            report += `   - ${error}\n`;
          });
        });
    }

    return report;
  }
}
