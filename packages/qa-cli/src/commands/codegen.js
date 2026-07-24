/* eslint-disable no-console */
import { Command } from 'commander';
import { executeNpmScript } from '../utils/executor.js';

export function runCodegenCommand(program) {
  const codegenCommand = new Command('codegen')
    .description('Generate test code with Playwright')
    .option('--url <url>', 'Target URL for code generation')
    .option('--output <path>', 'Output file path')
    .option('--device <type>', 'Device type (desktop/mobile/tablet)')
    .action(async options => {
      console.log('Starting Playwright code generator...\n');

      const args = ['run', 'codegen:web'];

      if (options.url) {
        console.log(`  Target URL: ${options.url}`);
      }

      if (options.output) {
        console.log(`  Output path: ${options.output}`);
      }

      if (options.device) {
        console.log(`  Device type: ${options.device}`);
      }

      console.log('\nLaunching Playwright codegen...\n');

      const result = await executeNpmScript(args.join(' '));

      if (!result.success) {
        process.exit(result.code);
      }
    });

  program.addCommand(codegenCommand);
}