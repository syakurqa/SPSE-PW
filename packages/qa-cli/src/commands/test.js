/* eslint-disable no-console */
import { Command } from 'commander';
import { runWebTests } from '../utils/executor.js';
import { checkConfigFiles } from '../utils/config-manager.js';

export function runTestCommand(program) {
  const testCommand = new Command('test')
    .description('Run SPSE Playwright tests')
    .argument('[type]', 'Only supported value: spse', 'spse')
    .option('--headed', 'Run with visible browser')
    .option('--ui', 'Run in UI mode')
    .option('--env <env>', 'Target environment (SIT/UAT)')
    .option('--tag <tag>', 'Filter by test tags')
    .option('--file <path>', 'Run specific test file')
    .option('--grep <pattern>', 'Filter by test name pattern')
    .option('--workers <n>', 'Number of parallel workers')
    .action(async (type, options) => {
      if (type === 'spse') {
        const testOptions = {
          headed: options.headed,
          ui: options.ui,
          env: options.env || process.env.ENV || 'SIT',
          tag: options.tag,
          file: options.file,
          grep: options.grep,
          workers: options.workers,
        };

        // Verify config files exist
        const configStatus = await checkConfigFiles(testOptions.env);
        if (!configStatus.env) {
          console.error(`\n✗ env.${testOptions.env.toLowerCase()}.json — not found`);
          console.error('  Create it under packages/common-module/config/');
          console.error('  Run: npm run qa:setup\n');
          process.exit(1);
        }

        const result = await runWebTests(testOptions);

        if (!result.success) {
          process.exit(result.code);
        }
      } else {
        console.error('Only SPSE tests are available. Use: npm run qa:test');
        process.exit(1);
      }
    });

  program.addCommand(testCommand);
}
