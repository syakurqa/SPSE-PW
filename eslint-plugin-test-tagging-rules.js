/**
 * Custom ESLint rules for test tag validation
 * Supports both Playwright (test with tag options) and Mocha (it with tags in title)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Helper function to read zephyr config and extract keys
function getZephyrKeys() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = resolve(__dirname, 'packages/common-module/config/zephyr-config.js');

    // Read the config file content
    const configContent = readFileSync(configPath, 'utf8');

    // Extract keys using regex to match both key: 'VALUE' and 'key': 'VALUE' patterns
    const keyPattern = /['"]?key['"]?\s*:\s*['"]([^'"]+)['"]/g;
    const matches = [];
    let match;

    while ((match = keyPattern.exec(configContent)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length > 0) {
      // Remove duplicates and return
      return [...new Set(matches)];
    }

    // Fallback if no matches found
    return ['PBF2', 'BLP', 'CORE', 'PLAT', 'BL', 'DMTM', 'BLCS','QA'];
  } catch (error) {
    // Fallback to hardcoded keys if any error occurs
    return ['PBF2', 'BLP', 'CORE', 'PLAT', 'BL', 'DMTM', 'BLCS','QA'];
  }
}

export default {
  rules: {
    'require-valid-tag': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require test cases to have valid tags based on zephyr config',
        },
        messages: {
          missingTag: 'Test case must have at least one tag',
          missingTestCaseId: 'Test case must have at least one test case ID tag (e.g., @QA-T11). Tags like @smoke, @critical, @feature:<name> are allowed only as additional tags.',
          invalidTag: 'Invalid tag "{{tag}}". Allowed formats: @smoke, @critical, @feature:<name>, or @{{KEY}}-T{{NUMBER}} where KEY is one of: {{validKeys}}',
          invalidTagFormat: 'Tag "{{tag}}" must follow pattern @{{KEY}}-T{{NUMBER}} (e.g., @QA-T11)',
        },
        schema: [],
      },
      create(context) {
        // Get zephyr keys dynamically from config
        const zephyrKeys = getZephyrKeys();
        const intentionTags = ['@smoke', '@critical', '@e2e'];

        function isTestCaseIdTag(tag) {
          // Check if tag matches test case ID pattern (@KEY-TNUMBER)
          const tagPattern = /^@([A-Z0-9]+)-T(\d+)$/;
          const match = tag.match(tagPattern);
          
          if (!match) {
            return false;
          }
          
          const key = match[1];
          return zephyrKeys.includes(key);
        }

        function isValidTag(tag) {
          // Check for intention tags (@smoke, @critical)
          if (intentionTags.includes(tag)) {
            return true;
          }

          // Check for feature tags (@feature:*)
          if (/^@feature:.+$/.test(tag)) {
            return true;
          }

          // Check for test case ID pattern (@KEY-TNUMBER)
          const tagPattern = /^@([A-Z0-9]+)-T(\d+)$/;
          const match = tag.match(tagPattern);

          if (!match) {
            return false;
          }

          const key = match[1];
          return zephyrKeys.includes(key);
        }

        function getTagErrorMessage(tag) {
          // Check intention tags
          if (intentionTags.includes(tag)) {
            return null;
          }

          // Check feature tags
          if (/^@feature:.+$/.test(tag)) {
            return null;
          }

          // Check test case ID pattern
          const tagPattern = /^@([A-Z0-9]+)-T(\d+)$/;
          const match = tag.match(tagPattern);

          if (!match) {
            return {
              messageId: 'invalidTag',
              data: {
                tag,
                validKeys: zephyrKeys.join(', ')
              }
            };
          }

          const key = match[1];
          if (!zephyrKeys.includes(key)) {
            return {
              messageId: 'invalidTag',
              data: {
                tag,
                validKeys: zephyrKeys.join(', ')
              }
            };
          }

          return {
            messageId: 'invalidTagFormat',
            data: { tag }
          };
        }

        return {
          CallExpression(node) {
            // Check if this is a test() or it() call
            const isTest = node.callee.name === 'test';
            const isIt = node.callee.name === 'it';
            
            if (!isTest && !isIt) {
              return;
            }

            // Handle Mocha pattern: it('@TAG description', async () => {})
            if (isIt) {
              if (node.arguments.length === 0) {
                context.report({
                  node: node,
                  messageId: 'missingTag',
                });
                return;
              }

              const titleArg = node.arguments[0];
              if (titleArg.type !== 'Literal' || typeof titleArg.value !== 'string') {
                return;
              }

              const title = titleArg.value;
              
              // Extract all tags from the title (tags start with @)
              const tagPattern = /@[A-Z0-9]+-T\d+|@smoke|@critical|@feature:[^\s]+/g;
              const foundTags = title.match(tagPattern) || [];

              if (foundTags.length === 0) {
                context.report({
                  node: titleArg,
                  messageId: 'missingTag',
                });
                return;
              }

              // Check if at least one tag is a test case ID
              const hasTestCaseId = foundTags.some(tag => isTestCaseIdTag(tag));
              if (!hasTestCaseId) {
                context.report({
                  node: titleArg,
                  messageId: 'missingTestCaseId',
                });
                return;
              }

              // Validate each tag found in the title
              for (const tag of foundTags) {
                if (!isValidTag(tag)) {
                  const errorInfo = getTagErrorMessage(tag);
                  if (errorInfo) {
                    context.report({
                      node: titleArg,
                      ...errorInfo,
                    });
                  }
                }
              }
              return;
            }

            // Handle Playwright pattern: test('name', { tag: '@TAG' }, async () => {})
            if (isTest) {
              let testOptions = null;
              let hasTagOptions = false;

              if (node.arguments.length >= 2) {
                // Check if second argument is an object (potential tag options)
                if (node.arguments[1].type === 'ObjectExpression') {
                  testOptions = node.arguments[1];
                  hasTagOptions = true;
                } else {
                  // Second argument is not an object (likely a function), so no tag provided
                  testOptions = null;
                  hasTagOptions = false;
                }
              } else {
                // test() has only 1 argument (name), so definitely missing tag
                testOptions = null;
                hasTagOptions = false;
              }

              // If testOptions exist, check for tag property
              if (hasTagOptions) {
                const tagProperty = testOptions.properties.find(
                  prop => prop.key && prop.key.name === 'tag'
                );

                if (!tagProperty) {
                  context.report({
                    node: testOptions,
                    messageId: 'missingTag',
                  });
                  return;
                }

                let tags = [];
                if (tagProperty.value.type === 'ArrayExpression') {
                  // Multiple tags: { tag: ['@smoke', '@QA-T12'] }
                  tags = tagProperty.value.elements
                    .filter(el => el && el.type === 'Literal')
                    .map(el => el.value);
                } else if (tagProperty.value.type === 'Literal') {
                  // Single tag: { tag: '@QA-T33' }
                  tags = [tagProperty.value.value];
                }

                // Check if at least one tag is a test case ID
                const hasTestCaseId = tags.some(tag => typeof tag === 'string' && isTestCaseIdTag(tag));
                if (!hasTestCaseId) {
                  context.report({
                    node: tagProperty.value,
                    messageId: 'missingTestCaseId',
                  });
                  return;
                }

                // Validate each tag
                for (const tag of tags) {
                  if (typeof tag === 'string' && !isValidTag(tag)) {
                    const errorInfo = getTagErrorMessage(tag);
                    if (errorInfo) {
                      context.report({
                        node: tagProperty.value,
                        ...errorInfo,
                      });
                    }
                  }
                }
              } else if (node.arguments.length >= 2) {
                // Test has second argument but it's not an object (likely function), so missing tag
                context.report({
                  node: node.arguments[1],
                  messageId: 'missingTag',
                });
              } else {
                // Test has only 1 argument (name), definitely missing tag
                context.report({
                  node: node,
                  messageId: 'missingTag',
                });
              }
            }
          },
        };
      },
    },
  },
};
