require('dotenv').config();

module.exports = {
  default: {
    require: [
      'utils/world.ts',
      'hooks/hooks.ts',
      // include all step files so editors and runners pick up shared/generic steps
      'steps/**/*.steps.ts',
      'steps/**/*.ts'
    ],
    requireModule: ['ts-node/register'],
    format: [
      'progress-bar',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json'
    ],
    paths: ['features/**/*.feature'],
    parallel: 2,
    strict: false
  }
};
