/* eslint-disable no-console */
import { Command } from 'commander';
import { runSetupWizard } from '../wizards/setup-wizard.js';

export function runSetupCommand(program) {
  const setupCommand = new Command('setup')
    .description('Interactive setup wizard for first-time users')
    .option('--full', 'Run complete setup (all components)')
    .option('--quick', 'Quick setup (skip optional components)')
    .option('--env <env>', 'Pre-select environment (SIT/UAT)')
    .option('--skip-browser', 'Skip browser installation')
    .option('--skip-db', 'Skip database setup')
    .action(async options => {
      await runSetupWizard(options);
    });

  program.addCommand(setupCommand);
}