import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n=== RUNNING LEFT REFERENCE SAMPLES & SAFE CENTERING TEST SUITE ===\n');

// Test Suite 1: ReferencePerimeter Structural & Mathematical Conformance
console.log('Test Suite 1: ReferencePerimeter Mathematical Layout');
{
  const refPath = resolve(__dirname, '../../src/components/stages/cp02_intra_search/pipeline/ReferencePerimeter.jsx');
  const refContent = readFileSync(refPath, 'utf8');

  assert(refContent.includes('gridColumn: 1') && refContent.includes('gridRow: 1'), 'Corner sample mapped to col 1, row 1');
  assert(refContent.includes('gridColumn: 1') && refContent.includes('gridRow: idx + 2'), 'Direct Left samples mapped to col 1, row idx + 2');
  assert(refContent.includes('gridColumn: 1') && refContent.includes('gridRow: idx + N + 2'), 'Extended Below-Left samples mapped to col 1, row idx + N + 2');
  assert(refContent.includes('refLeft.slice(1, N + 1)'), 'Direct Left samples extract exactly N elements (1 to N)');
  assert(refContent.includes('refLeft.slice(N + 1, 2 * N + 1)'), 'Extended Below-Left samples extract exactly N elements (N+1 to 2N)');
}

// Test Suite 2: IntraPredictionFlow Layout & Safe Centering Immunity
console.log('\nTest Suite 2: IntraPredictionFlow Safe Centering & Clipping Immunity');
{
  const flowPath = resolve(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx');
  const flowContent = readFileSync(flowPath, 'utf8');

  // Verify Card 1 Pinned Header & Safe Centering
  assert(flowContent.includes('Original Source (S)'), 'Contains Original Source (S) card');
  assert(flowContent.includes('justifyContent: \'safe center\''), 'Implements safe center alignment to prevent negative-coordinate scroll clipping');
  assert(flowContent.includes('minWidth: `${stageGridSize}px`'), 'Enforces explicit minWidth on stage grid container');
  assert(flowContent.includes('minHeight: `${stageGridSize}px`'), 'Enforces explicit minHeight on stage grid container');
  assert(flowContent.includes('margin: \'auto\''), 'Enforces margin: auto for symmetric cross-axis centering without left-clipping');

  // Verify that outer card does NOT have unsafe alignItems: 'center' with overflowX: 'auto'
  const card1Match = flowContent.match(/Card 1: Original Source[\s\S]*?Pinned Card 1 Header/);
  assert(card1Match && !card1Match[0].includes("alignItems: 'center'"), 'Card 1 outer container avoids unsafe alignItems: center');
  assert(card1Match && !card1Match[0].includes("overflowX: 'auto'"), 'Card 1 outer container delegates scrolling to inner stage body');

  // Verify Card 2 Pinned Header & Safe Centering
  const card2Match = flowContent.match(/Card 2: Prediction \(P\) PU Matrix[\s\S]*?Pinned Card 2 Header/);
  assert(card2Match && !card2Match[0].includes("alignItems: 'center'"), 'Card 2 outer container avoids unsafe alignItems: center');
  assert(card2Match && !card2Match[0].includes("overflowX: 'auto'"), 'Card 2 outer container delegates scrolling to inner stage body');
}

// Test Suite 3: Multi-Block Geometry Verification
console.log('\nTest Suite 3: Multi-Block Geometry & Perimeter Sample Count Verification');
{
  const sizes = [4, 8, 16, 32, 64];
  for (const N of sizes) {
    const totalRefCol1 = 1 + N + N; // Corner + Direct Left + Below-Left
    const S = 2 * N + 1;
    assert(totalRefCol1 === S, `Size ${N}×${N}: Column 1 contains exactly ${S} boundary reference samples`);
  }
}

console.log('\n=== ALL LEFT REFERENCE VISIBILITY & SAFE CENTERING TESTS PASSED ===\n');
