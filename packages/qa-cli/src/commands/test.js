/* eslint-disable no-console */
import { Command } from 'commander';
import { runTestWizard } from '../wizards/test-wizard.js';
import { runApiTests, runWebTests, runMobileTests } from '../utils/executor.js';
import { checkConfigFiles } from '../utils/config-manager.js';

export function runTestCommand(program) {
  const testCommand = new Command('test')
    .description('Run tests interactively or via commands')
    .argument('[type]', 'Test type: api, web, mobile, or all')
    .option('--headed', 'Run with visible browser')
    .option('--ui', 'Run in UI mode')
    .option('--env <env>', 'Target environment (SIT/UAT)')
    .option('--tag <tag>', 'Filter by test tags')
    .option('--file <path>', 'Run specific test file')
    .option('--grep <pattern>', 'Filter by test name pattern')
    .option('--workers <n>', 'Number of parallel workers')
    .option('--preset <name>', 'Use predefined test preset')
    .option('--run-type <type>', 'Mobile: LOCAL, LAMBDA, or DEVICE-FARM')
    .option('--device-type <type>', 'Mobile: android or ios')
    .option('--app <path>', 'Mobile: path to .apk/.ipa')
    .option('--squad <name>', 'Mobile: squad name')
    .option('--spec-pattern <pattern>', 'Mobile: test spec glob pattern')
    .action(async (type, options) => {
      if (type && ['api', 'web', 'mobile'].includes(type)) {
        // Direct command execution
        const testOptions = {
          headed: options.headed,
          ui: options.ui,
          env: options.env || process.env.ENV || 'SIT',
          tag: options.tag,
          file: options.file,
          grep: options.grep,
          workers: options.workers,
          preset: options.preset,
          runType: options.runType,
          deviceType: options.deviceType,
          appPath: options.app,
          squad: options.squad,
          specPattern: options.specPattern
        };

        // Verify config files exist
        const configStatus = await checkConfigFiles(testOptions.env);
        if (!configStatus.env) {
          console.error(`\n✗ env.${testOptions.env.toLowerCase()}.json — not found`);
          console.error('  Create it under packages/common-module/config/');
          console.error('  Run: npm run qa:setup\n');
          process.exit(1);
        }

        let result;
        if (type === 'api') {
          result = await runApiTests(testOptions);
        } else if (type === 'web') {
          result = await runWebTests(testOptions);
        } else if (type === 'mobile') {
          result = await runMobileTests(testOptions);
        }

        if (!result.success) {
          process.exit(result.code);
        }
      } else {
        // Interactive wizard
        await runTestWizard(options);
      }
    });

  program.addCommand(testCommand);
}