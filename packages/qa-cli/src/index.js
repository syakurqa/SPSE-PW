#!/usr/bin/env node

import { Command } from 'commander';
import { runSetupCommand } from './commands/setup.js';
import { runTestCommand } from './commands/test.js';
import { runReportCommand } from './commands/report.js';
import { runConfigCommand } from './commands/config.js';
import { runHealthCommand } from './commands/health.js';
import { runCodegenCommand } from './commands/codegen.js';

const program = new Command();

program
  .name('qa-cli')
  .description('Interactive CLI for QA automation testing')
  .version('1.0.0');

// Register commands
runSetupCommand(program);
runTestCommand(program);
runReportCommand(program);
runConfigCommand(program);
runHealthCommand(program);
runCodegenCommand(program);

// Run the SPSE suite by default; no legacy API/mobile menu is exposed.
if (process.argv.length <= 2) {
  program.parse([...process.argv, 'test', 'spse']);
} else {
  program.parse(process.argv);
}
