#!/usr/bin/env node
/**
 * run_all.mjs
 * Unified, high-performance Test Runner for HM-Debugger Frontend Test Suites.
 * Features:
 *  - Automatic suite auto-discovery under tests/suites/*.mjs
 *  - Isolated process execution to ensure pure sandbox & no memory/state leaks
 *  - High-precision execution benchmarking (ms per suite)
 *  - Live output streaming or clean summary mode
 *  - Filter support (e.g. `node tests/run_all.mjs cabac` or `npm test -- --filter=quadtree`)
 *  - Formatted terminal report card with exit code propagation
 */

import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const suitesDir = resolve(__dirname, 'suites');

// Parse CLI args for filters
const args = process.argv.slice(2);
let filter = '';
for (const arg of args) {
  if (arg.startsWith('--filter=')) {
    filter = arg.slice(9).toLowerCase();
  } else if (!arg.startsWith('-')) {
    filter = arg.toLowerCase();
  }
}

// Auto-discover test suites
const allFiles = readdirSync(suitesDir)
  .filter(f => f.startsWith('test_') && f.endsWith('.mjs'))
  .sort();

const targetSuites = filter
  ? allFiles.filter(f => f.toLowerCase().includes(filter))
  : allFiles;

if (targetSuites.length === 0) {
  console.log(`\n❌ No test suites matched filter: "${filter}"`);
  console.log(`Available suites (${allFiles.length}):\n${allFiles.map(f => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}

console.log(`\n================================================================================`);
console.log(`🚀 HM-DEBUGGER FRONTEND TEST HARNESS: RUNNING ${targetSuites.length} TEST SUITE(S)`);
if (filter) console.log(`   (Filter active: "${filter}")`);
console.log(`================================================================================\n`);

async function runSuite(suiteFileName) {
  const suitePath = resolve(suitesDir, suiteFileName);
  const startTime = performance.now();

  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [suitePath], {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk;
      process.stdout.write(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on('close', code => {
      const durationMs = Math.round(performance.now() - startTime);
      resolveResult({
        name: suiteFileName,
        code,
        durationMs,
        stdout,
        stderr,
        success: code === 0,
      });
    });
  });
}

async function runAll() {
  const results = [];
  const overallStart = performance.now();

  for (const suite of targetSuites) {
    const res = await runSuite(suite);
    results.push(res);
  }

  const overallDuration = ((performance.now() - overallStart) / 1000).toFixed(2);
  const passedCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`\n================================================================================`);
  console.log(`📊 TEST SUITES SUMMARY REPORT`);
  console.log(`================================================================================`);
  console.log(`┌─────┬──────────────────────────────────────────────────────┬─────────┬──────────┐`);
  console.log(`│ #   │ Test Suite File                                      │ Status  │ Duration │`);
  console.log(`├─────┼──────────────────────────────────────────────────────┼─────────┼──────────┤`);

  results.forEach((r, idx) => {
    const num = String(idx + 1).padStart(3, ' ');
    const name = r.name.padEnd(52, ' ');
    const status = r.success ? '  PASS ' : '  FAIL ';
    const duration = `${r.durationMs}ms`.padStart(8, ' ');
    console.log(`│ ${num} │ ${name} │ ${status} │ ${duration} │`);
  });

  console.log(`└─────┴──────────────────────────────────────────────────────┴─────────┴──────────┘`);
  console.log(`Total Suites:   ${results.length}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log(`Total Time:     ${overallDuration}s`);
  console.log(`================================================================================\n`);

  if (failedCount > 0) {
    console.error(`💥 TEST SUITE RUN FAILED: ${failedCount} suite(s) failed.`);
    process.exit(1);
  } else {
    console.log(`✨ ALL TEST SUITES PASSED CLEANLY (100% SUCCESS)!`);
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
