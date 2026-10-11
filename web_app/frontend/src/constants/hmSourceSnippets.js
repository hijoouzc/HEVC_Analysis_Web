/**
 * hmSourceSnippets.js
 * Centralized C++ source snippets from ITU-T H.265 / HEVC HM-16.0 Reference Software.
 * Serves as documentation and code modal inspector references.
 */

export const HM_CTU_BOUNDARY_SNIPPET = {
  title: 'TEncCu::compressCtu & Boundary Check',
  sourceFile: 'source/Lib/TLibEncoder/TEncCu.cpp (Lines 238-248, 666-670)',
  functionName: 'xCompressCU',
  standardRef: 'ITU-T H.265 Section 6.4.1 / HEVC Book Chapter 3',
  description: 'HM reference software starts recursive quadtree compression at Depth 0 for each CTU. If the block extends beyond the frame dimensions (uiRPelX ≥ PicWidth or uiBPelY ≥ PicHeight), bBoundary is flagged TRUE. The non-split test is completely bypassed, forcing immediate sub-branch division into 32×32 CUs.',
  codeSnippet: `// source/Lib/TLibEncoder/TEncCu.cpp

Void TEncCu::compressCtu( TComDataCU* pCtu )
{
  // 1. Initialize CU data structures for CTU at raster scan address
  m_ppcBestCU[0]->initCtu( pCtu->getPic(), pCtu->getCtuRsAddr() );
  m_ppcTempCU[0]->initCtu( pCtu->getPic(), pCtu->getCtuRsAddr() );
  m_bEncodeDQP = false;

  // 2. Start recursive QuadTree search at Depth 0 (64x64 block)
  xCompressCU( m_ppcBestCU[0], m_ppcTempCU[0], 0 );
}

// Inside TEncCu::xCompressCU (lines 666-675):
UInt uiLPelX = pcCU->getCUPelX();
UInt uiRPelX = uiLPelX + (g_uiMaxCUWidth>>uiDepth)  - 1;
UInt uiTPelY = pcCU->getCUPelY();
UInt uiBPelY = uiTPelY + (g_uiMaxCUHeight>>uiDepth) - 1;

// HEVC Boundary Condition Check:
const Bool bBoundary = !( uiRPelX < sps.getPicWidthInLumaSamples() && 
                          uiBPelY < sps.getPicHeightInLumaSamples() );

if ( !bBoundary )
{
  // 64x64 block is fully inside the picture frame:
  // Perform RDO evaluation for 64x64 non-split mode:
  // J_nosplit = Distortion + lambda * Rate
  for (Int iQP=iMinQP; iQP<=iMaxQP; iQP++)
  {
    xCheckRDO( rpcBestCU, rpcTempCU, ... );
  }
}
else
{
  // Block crosses frame boundary:
  // Non-split evaluation is BYPASSED.
  // Forced split: Sub-branch must split down into 4 sub-CUs (32x32).
  // In the bitstream, split_flag=1 is inferred by the decoder.
}`
};

export const HM_QUADTREE_RDO_SNIPPET = {
  title: 'TEncCu::xCompressCU — Recursive QuadTree & RDO',
  sourceFile: 'source/Lib/TLibEncoder/TEncCu.cpp (Lines 660-840)',
  functionName: 'xCompressCU',
  standardRef: 'ITU-T H.265 Section 6.4.1 / 7.3.8 / HEVC Book Chapter 3',
  description: 'HM-16.0 evaluates CU partitioning recursively in Z-scan order (k=0: Top-Left, k=1: Top-Right, k=2: Bottom-Left, k=3: Bottom-Right). At each quadtree depth, the encoder tests non-split modes (Intra/Inter) computing J_nosplit = D + λ·R. It then recursively tests 4 sub-CUs to compute J_split = Σ J_sub + λ·R_split_flag. Finally, xCheckBestMode decides whether to split or keep the current block.',
  codeSnippet: `// source/Lib/TLibEncoder/TEncCu.cpp

Void TEncCu::xCompressCU( TComDataCU*& rpcBestCU, TComDataCU*& rpcTempCU, const UInt uiDepth DEBUG_STRING_FN_DECLARE(sDebug_), UInt uiSplitFlag )
{
  TComPic* pcPic = rpcBestCU->getPic();
  DEBUG_STRING_NEW(sNextDebug)

  UInt uiLPelX = rpcBestCU->getCUPelX();
  UInt uiRPelX = uiLPelX + (g_uiMaxCUWidth>>uiDepth)  - 1;
  UInt uiTPelY = rpcBestCU->getCUPelY();
  UInt uiBPelY = uiTPelY + (g_uiMaxCUHeight>>uiDepth) - 1;
  const Bool bBoundary = !( uiRPelX < sps.getPicWidthInLumaSamples() && uiBPelY < sps.getPicHeightInLumaSamples() );

  if ( !bBoundary )
  {
    // 1. Evaluate 2Nx2N Non-Split Modes (Intra, Inter 2Nx2N, Merge/Skip)
    xCheckRDO( rpcBestCU, rpcTempCU, ... );
    // rpcBestCU now holds J_nosplit = Distortion_best + lambda * Rate_best
  }

  // 2. Recursive Subdivision: 4 Quadrants in Z-Scan Order (k = 0, 1, 2, 3)
  if ( uiDepth < sps.getLog2DiffMaxMinCodingBlockSize() )
  {
    for ( UInt uiPartUnitIdx = 0; uiPartUnitIdx < 4; uiPartUnitIdx++ )
    {
      pcSubBestPartCU->initSubCU( rpcTempCU, uiPartUnitIdx, uiDepth );
      pcSubTempPartCU->initSubCU( rpcTempCU, uiPartUnitIdx, uiDepth );

      // Recursive call down to Depth + 1:
      xCompressCU( pcSubBestPartCU, pcSubTempPartCU, uiDepth + 1 );

      // Accumulate child cost into temporary parent CU:
      rpcTempCU->copyPartFrom( pcSubBestPartCU, uiPartUnitIdx, uiDepth );
      // J_split += J_best(child_k)
    }

    // 3. RDO Split Decision:
    // Compare accumulated J_split against best non-split J_nosplit
    xCheckBestMode( rpcBestCU, rpcTempCU, uiDepth );
  }
}`
};

export const HM_RDO_COST_SIMULATION_SNIPPET = {
  title: 'TEncCu::xCompressCU & RDO Cost Evaluation',
  sourceFile: 'source/Lib/TLibEncoder/TEncCu.cpp (Lines 720-835)',
  functionName: 'xCompressCU / xCheckRDO',
  standardRef: 'ITU-T H.265 Section 6.4.1 / HEVC Book Chapter 3 (RDO Framework)',
  description: 'The Rate-Distortion Optimization (RDO) engine in HM compares the Lagrangian RD cost J = Distortion + λ · Rate for every candidate intra mode and quadtree split configuration. Sub-CUs are evaluated recursively in Z-scan order (k=0: Top-Left, k=1: Top-Right, k=2: Bottom-Left, k=3: Bottom-Right). If the accumulated sum of sub-CU costs (J_split) is lower than the parent block cost (J_nosplit), the CU is subdivided.',
  codeSnippet: `// source/Lib/TLibEncoder/TEncCu.cpp

// 1. Calculate Lagrangian Rate-Distortion Cost for Candidate Mode:
//    Distortion D = Sum of Squared Errors (SSE) between Original & Reconstructed pixels
//    Rate R       = CABAC entropy bit count for header, mode index & quantized transform coefficients
//    Cost J       = D + m_pcRdCost->getLambda() * R;

Double dCost = m_pcRdCost->calcRdCost( uiBits, uiDistortion );

// 2. Recursive Child Evaluation in Z-Scan Order (k = 0, 1, 2, 3):
for ( UInt uiPartUnitIdx = 0; uiPartUnitIdx < 4; uiPartUnitIdx++ )
{
  pcSubBestPartCU->initSubCU( rpcTempCU, uiPartUnitIdx, uhDepth );
  pcSubTempPartCU->initSubCU( rpcTempCU, uiPartUnitIdx, uhDepth );

  // Recurse into child quadtree depth
  xCompressCU( pcSubBestPartCU, pcSubTempPartCU, uhDepth + 1 );

  // Accumulate sub-CU cost into split cost:
  // J_split += pcSubBestPartCU->getTotalCost();
  rpcTempCU->copyPartFrom( pcSubBestPartCU, uiPartUnitIdx, uhDepth );
}

// 3. Mode Decision: Compare Split Cost vs Non-Split Cost:
//    if ( rpcTempCU->getTotalCost() < rpcBestCU->getTotalCost() )
//    {
//      // SPLIT yields lower RD-cost -> accept quadtree subdivision
//      rpcBestCU->copyPartFrom( rpcTempCU, ... );
//    }
//    else
//    {
//      // PRUNE quadtree -> preserve current CU block size
//    }
xCheckBestMode( rpcBestCU, rpcTempCU, uhDepth );`
};

export const HM_INTRA_PREDICTION_SNIPPET = {
  title: 'TComPrediction::predIntraLumaAng — 35 Intra Prediction Modes',
  sourceFile: 'source/Lib/TLibCommon/TComPrediction.cpp (Lines 370-580)',
  functionName: 'predIntraLumaAng / xPredIntraAng',
  standardRef: 'ITU-T H.265 Section 8.4.4.2.6 (Intra Sample Prediction) / HEVC Book Chapter 4',
  description: 'HEVC generates predicted sample blocks from reconstructed spatial boundary samples (2N+1 samples on Top and Left). Mode 0 (Planar) performs 2D bilinear interpolation from 4 corners. Mode 1 (DC) computes the mean average. Modes 2-34 (Angular) project directional rays with 1/32 fractional sample precision. Mode-Dependent Intra Smoothing (MDIS) applies a 3-tap lowpass filter [1, 2, 1]/4 when directional edges require sample smoothing.',
  codeSnippet: `// source/Lib/TLibCommon/TComPrediction.cpp

Void TComPrediction::xPredIntraAng( Int bitDepth, const Pel* pSrc, Int srcStride, Pel* pDst, Int dstStride, 
                                    UInt width, UInt height, UInt dirMode, Bool blkAboveAvailable, Bool blkLeftAvailable, Bool bFilter )
{
  Int deltaInt, deltaFract;
  Int refIdx;

  if ( dirMode == PLANAR_IDX ) // Mode 0: Planar 2D Bilinear Interpolation
  {
    xPredIntraPlanar( pSrc, srcStride, pDst, dstStride, width, height );
    return;
  }
  if ( dirMode == DC_IDX )     // Mode 1: DC Mean Average
  {
    xPredIntraDC( pSrc, srcStride, pDst, dstStride, width, height, blkAboveAvailable, blkLeftAvailable );
    return;
  }

  // Modes 2-34: Angular Directional Prediction with 1/32 Pel Precision
  Int intraPredAngle = s_intraModeNumFast[dirMode]; // Table lookup: -32 to +32
  Int absAng         = abs(intraPredAngle);

  for (Int y = 0; y < height; y++)
  {
    // Compute projected offset with 1/32 Pel accuracy:
    deltaInt   = ( (y + 1) * intraPredAngle ) >> 5;
    deltaFract = ( (y + 1) * intraPredAngle ) & 31;

    for (Int x = 0; x < width; x++)
    {
      refIdx = x + deltaInt + 1;
      if (deltaFract != 0)
      {
        // 2-tap linear interpolation between adjacent integer boundary samples:
        pDst[y * dstStride + x] = ( (32 - deltaFract) * pSrc[refIdx] + deltaFract * pSrc[refIdx + 1] + 16 ) >> 5;
      }
      else
      {
        pDst[y * dstStride + x] = pSrc[refIdx];
      }
    }
  }
}`
};

export const HM_TRANSFORM_QUANT_SNIPPET = {
  title: 'TComTrQuant::transformNxN & xQuant — Core Transform & Quantization',
  sourceFile: 'source/Lib/TLibCommon/TComTrQuant.cpp (Lines 210-380, 500-640)',
  functionName: 'transformNxN / xQuant',
  standardRef: 'ITU-T H.265 Section 8.7.2 (Transform) / 8.7.3 (Quantization) / HEVC Book Chapter 5',
  description: 'HEVC applies integer matrix transforms to spatial residuals. 4×4 Luma intra blocks utilize DST-VII to compact directional boundary energy; 8×8, 16×16, and 32×32 blocks employ DCT-II. Scaled coefficients are quantized based on QP (QP/6 period scaling and QP%6 step offset), followed by Rate-Distortion Optimized Quantization (RDOQ) in the encoder.',
  codeSnippet: `// source/Lib/TLibCommon/TComTrQuant.cpp

Void TComTrQuant::transformNxN( TComDataCU* pcCU, Pel* pcResidual, UInt uiStride, TCoeff* rpcCoeff, 
                                UInt uiWidth, UInt uiHeight, UInt uiMode, ComponentID compID, const Bool useDST )
{
  // 1. Transform Kernel Selection:
  //    4x4 Intra Luma utilizes DST-VII for optimal energy compaction at block boundaries:
  if ( useDST && uiWidth == 4 && uiHeight == 4 && compID == COMPONENT_Y )
  {
    fastForwardDST_VII_4x4( pcResidual, rpcCoeff, uiStride );
  }
  else
  {
    // All other block sizes (8x8, 16x16, 32x32) utilize DCT-II:
    fastForwardDCT_II( pcResidual, rpcCoeff, uiWidth, uiHeight, uiStride );
  }
}

Void TComTrQuant::xQuant( TComDataCU* pcCU, TCoeff* pSrc, TCoeff* pDes, 
                          Int iWidth, Int iHeight, UInt& uiAcSum, ComponentID compID, const QpParam& cQPParam )
{
  // 2. Integer Forward Quantization:
  //    cQPParam.per() = QP / 6, cQPParam.rem() = QP % 6
  const Int qStep = g_quantScales[cQPParam.rem()] << cQPParam.per();
  const Int qAdd  = (pcCU->getSlice()->getSliceType() == I_SLICE) ? 171 : 85;

  for ( Int n = 0; n < iWidth * iHeight; n++ )
  {
    Int level = pSrc[n];
    Int sign  = (level < 0 ? -1 : 1);
    level     = abs(level);

    // Quantize with rounding offset and bit shift:
    level = ( (level * g_quantScales[cQPParam.rem()]) + qAdd ) >> (cQPParam.per() + 9);
    pDes[n] = sign * level;
  }
}`
};
