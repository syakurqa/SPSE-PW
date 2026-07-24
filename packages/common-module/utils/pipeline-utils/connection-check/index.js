/* eslint-disable no-console */
import { checkAllHealth } from './connection-check.js';

async function displayResults(title, results, icon = '🔍') {
  console.log(`\n${icon} ${title}:\n`);

  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'healthy') {
      console.log(`✅ ${name}: ${result.message}`);
    } else if (result.status === 'unhealthy') {
      console.log(`❌ ${name}: ${result.message}`);
    } else {
      console.log(`🚨 ${name}: ${result.message}`);
    }
  }

  // Count total for each status
  const statusCounts = Object.values(results).reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  return {
    total: Object.keys(results).length,
    healthy: statusCounts.healthy || 0,
    unhealthy: statusCounts.unhealthy || 0,
    error: statusCounts.error || 0
  };
}

async function displaySummary(dbStats, httpStats, envLabel) {
  console.log('\n📋 Summary:');

  console.log(`\n🗄️  Databases [${envLabel}]:`);
  console.log(`📊 Total databases checked: ${dbStats.total}`);
  console.log(`✅ Healthy: ${dbStats.healthy}`);
  console.log(`❌ Unhealthy: ${dbStats.unhealthy}`);
  console.log(`🚨 Error: ${dbStats.error}`);

  console.log('\n🌐 HTTP Connections:');
  console.log(`📊 Total URLs checked: ${httpStats.total}`);
  console.log(`✅ Healthy: ${httpStats.healthy}`);
  console.log(`❌ Unhealthy: ${httpStats.unhealthy}`);
  console.log(`🚨 Error: ${httpStats.error}`);

  console.log('\n🎯 Overall:');
  const totalHealthy = dbStats.healthy + httpStats.healthy;
  const totalChecks = dbStats.total + httpStats.total;
  const healthPercentage = totalChecks > 0 ? Math.round((totalHealthy / totalChecks) * 100) : 0;
  console.log(`📊 Total services checked: ${totalChecks}`);
  console.log(`✅ Overall healthy: ${totalHealthy}/${totalChecks} (${healthPercentage}%)`);

  const totalIssues = dbStats.unhealthy + dbStats.error + httpStats.unhealthy + httpStats.error;
  console.log(`❌ Total issues: ${totalIssues}`);

  return totalIssues === 0;
}

const envLabel = process.env.ENV || 'SIT';

(async function () {
  console.log(`🚀 Starting comprehensive health check [${envLabel}]...`);

  try {
    // Test all health checks (databases + HTTP)
    const allResults = await checkAllHealth();
    console.log(`Found ${allResults.httpUrlCount} HTTP/HTTPS URLs to check from ${envLabel} config...`);

    // Display database results
    const dbStats = await displayResults(`Database Health Checks [${envLabel}]`, allResults.databases, '🗄️');

    // Display HTTP results
    const httpStats = await displayResults(`HTTP Connection Health Checks [${envLabel}]`, allResults.httpConnections, '🌐');

    // Display summary
    const allHealthy = await displaySummary(dbStats, httpStats, envLabel);

    process.exit(allHealthy ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    process.exit(1);
  }
})();
