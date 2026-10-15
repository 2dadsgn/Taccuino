process.env.TACCUINO_USE_SEED = 'true';
const { runContractTests } = require('./contract.spec');
const { runUiRenderingTests } = require('./ui_rendering.spec');
const { runIntegrationTests } = require('./integration.spec');

console.log('===============================================================');
console.log('   TACCUINO AUTOMATED QA TEST RUNNER - INTEGRATION & CONTRACTS  ');
console.log('===============================================================\n');

const suites = [
  { name: 'Suite 1: IPC Contract & Schema Conformance', fn: runContractTests },
  { name: 'Suite 2: Angular UI Rendering & Wireframe Layout', fn: runUiRenderingTests },
  { name: 'Suite 3: Electron E2E Integration & Data Flow', fn: runIntegrationTests }
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

const startTime = Date.now();

(async () => {
  for (const suite of suites) {
    console.log(`\n--- Running ${suite.name} ---`);
    try {
      const results = await suite.fn();
      for (const test of results) {
        totalTests++;
        if (test.passed) {
          passedTests++;
          console.log(`  [PASS] ${test.name}`);
        } else {
          failedTests++;
          console.error(`  [FAIL] ${test.name} - ${test.error || 'Assertion failed'}`);
          failures.push({ suite: suite.name, test: test.name, error: test.error });
        }
      }
    } catch (err) {
      failedTests++;
      console.error(`  [ERROR] Suite crashed: ${err.message}`);
      failures.push({ suite: suite.name, test: 'Suite Execution', error: err.message });
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY:`);
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log(`Execution Time:   ${duration}s`);
  console.log('===============================================================');

  if (failedTests > 0) {
    console.error('\nFAILURE DETAILS:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.suite}] ${f.test}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n>>> ALL TEST SUITES PASSED PERFECTLY (100% SUCCESS) <<<\n');
    process.exit(0);
  }
})();
