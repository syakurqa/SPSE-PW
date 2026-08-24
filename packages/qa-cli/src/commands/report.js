/* eslint-disable no-console */
import { Command } from 'commander';
import { generateReport } from '../utils/executor.js';

export function runReportCommand(program) {
  const reportCommand = new Command('report')
    .description('View and manage test reports')
    .argument('[type]', 'Only supported value: spse', 'spse')
    .argument('[action]', 'Action: view, list, clean, export')
    .action(async (type, action) => {
      if (type === 'spse') {
        console.log('Opening SPSE report...');
        const result = await generateReport('web');

        if (!result.success) {
          console.error(`✗ Report generation failed`);
          process.exit(result.code);
        }
      } else {
        console.log('Usage: npm run qa:report');
      }
    });

  program.addCommand(reportCommand);
}
