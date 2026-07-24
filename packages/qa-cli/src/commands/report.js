/* eslint-disable no-console */
import { Command } from 'commander';
import { generateReport } from '../utils/executor.js';

export function runReportCommand(program) {
  const reportCommand = new Command('report')
    .description('View and manage test reports')
    .argument('[type]', 'Report type: api, web, mobile, or dashboard')
    .argument('[action]', 'Action: view, list, clean, export')
    .action(async (type, action) => {
      if (type && ['api', 'web', 'mobile'].includes(type)) {
        console.log(`Opening ${type.toUpperCase()} report...`);
        const result = await generateReport(type);

        if (!result.success) {
          console.error(`✗ Report generation failed`);
          process.exit(result.code);
        }
      } else if (type === 'dashboard') {
        console.log(`Start dashboard with: npm run reporting:dashboard`);
        console.log(`Or open dashboard URL in browser`);
      } else {
        console.log('Usage: npm run qa:report [api|web|mobile]');
        console.log('Examples:');
        console.log('  npm run qa:report api       # Open API report');
        console.log('  npm run qa:report web       # Open web report');
        console.log('  npm run qa:report mobile    # Open mobile report');
      }
    });

  program.addCommand(reportCommand);
}