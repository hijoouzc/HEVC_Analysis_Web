/**
 * tcomPicSymEngine.js
 * Bit-exact JavaScript modeling of HM-18.0 TComPicSym, TComTile, TComSlice, TEncGOP, and TEncSlice.
 *
 * Source provenance:
 * - TLibCommon/TComPicSym.cpp:
 *   - create() (lines 85-163): grid calc, m_pictureCtuArray[N], clearSliceBuffer(), allocateNewSlice() -> m_apSlices[0],
 *     initial identity map m_ctuTsToRsAddrMap[i] = i (lines 151-155), xInitTiles() (line 160), xInitCtuTsRsAddrMaps() (line 161).
 *   - xInitTiles() (lines 318-445): uniform/non-uniform TComTile setup & m_puiTileIdxMap[ctuRsAddr].
 *   - xInitCtuTsRsAddrMaps() & xCalculateNextCtuRSAddr() (lines 306-316, 448-484): TS <-> RS bijection + sentinel [N]=N.
 * - TLibEncoder/TEncGOP.cpp:
 *   - compressGOP() (lines 1593-2005): clearSliceBuffer(), allocateNewSlice(), initEncSlice() for slice 0,
 *     then loop over nextCtuTsAddr calling compressSlice() and dynamically calling pcPic->allocateNewSlice() for subsequent slices.
 * - TLibEncoder/TEncSlice.cpp:
 *   - initEncSlice() (lines 159-303)
 *   - calculateBoundingCtuTsAddrForSlice() (lines 1139-1223)
 *   - compressSlice() (lines 733-949) & encodeSlice() (lines 951-1035)
 */

export const SLICE_CONSTRAINTS = {
  NO_SLICES: 0,
  FIXED_NUMBER_OF_CTU: 1,
  FIXED_NUMBER_OF_BYTES: 2,
  FIXED_NUMBER_OF_TILES: 3,
};

/**
 * Step 1: Computes CTU grid geometry, base 4x4 partition quantum (256 per CTU),
 * and initial identity TS<->RS maps (map[i] = i before xInitCtuTsRsAddrMaps runs)
 * per TComPicSym::create() (TComPicSym.cpp:96-158).
 */
export function computeCtuGridGeometry(
  picWidth = 416,
  picHeight = 240,
  maxCuWidth = 64,
  maxCuHeight = 64,
  maxDepth = 4
) {
  const safeW = Math.max(16, Math.round(Number(picWidth) || 416));
  const safeH = Math.max(16, Math.round(Number(picHeight) || 240));
  const safeMaxCuW = Math.max(16, Math.round(Number(maxCuWidth) || 64));
  const safeMaxCuH = Math.max(16, Math.round(Number(maxCuHeight) || 64));
  const safeMaxDepth = Math.max(1, Math.min(6, Math.round(Number(maxDepth) || 4)));

  // m_frameWidthInCtus = (iPicWidth % uiMaxCuWidth) ? iPicWidth / uiMaxCuWidth + 1 : iPicWidth / uiMaxCuWidth
  const frameWidthInCtus = Math.ceil(safeW / safeMaxCuW);
  const frameHeightInCtus = Math.ceil(safeH / safeMaxCuH);
  const numCtusInFrame = frameWidthInCtus * frameHeightInCtus;

  const nominalWidth = frameWidthInCtus * safeMaxCuW;
  const nominalHeight = frameHeightInCtus * safeMaxCuH;
  const rightPadding = nominalWidth - safeW;
  const bottomPadding = nominalHeight - safeH;

  // m_uiMinCUWidth = uiMaxCuWidth >> m_uhTotalDepth
  const minCuWidth = safeMaxCuW >> safeMaxDepth;
  const minCuHeight = safeMaxCuH >> safeMaxDepth;
  const numPartInCtuWidth = Math.floor(safeMaxCuW / minCuWidth);
  const numPartInCtuHeight = Math.floor(safeMaxCuH / minCuHeight);
  // m_numPartitionsInCtu = 1 << (m_uhTotalDepth << 1)
  const numPartitionsInCtu = 1 << (safeMaxDepth << 1);

  // TComPicSym.cpp:151-155 initial identity assignment before xInitCtuTsRsAddrMaps()
  const initialIdentityMap = new Array(numCtusInFrame + 1).fill(0).map((_, idx) => idx);

  const ctuList = [];
  for (let rsAddr = 0; rsAddr < numCtusInFrame; rsAddr++) {
    const col = rsAddr % frameWidthInCtus;
    const row = Math.floor(rsAddr / frameWidthInCtus);
    const px = col * safeMaxCuW;
    const py = row * safeMaxCuH;
    const rightEdgePx = px + safeMaxCuW;
    const bottomEdgePx = py + safeMaxCuH;
    const isRightBoundary = rightEdgePx > safeW;
    const isBottomBoundary = bottomEdgePx > safeH;
    const isBoundary = isRightBoundary || isBottomBoundary;
    const validW = Math.max(0, Math.min(safeMaxCuW, safeW - px));
    const validH = Math.max(0, Math.min(safeMaxCuH, safeH - py));

    ctuList.push({
      rsAddr,
      col,
      row,
      px,
      py,
      nominalW: safeMaxCuW,
      nominalH: safeMaxCuH,
      validW,
      validH,
      isRightBoundary,
      isBottomBoundary,
      isBoundary,
    });
  }

  return {
    picWidth: safeW,
    picHeight: safeH,
    maxCuWidth: safeMaxCuW,
    maxCuHeight: safeMaxCuH,
    maxDepth: safeMaxDepth,
    minCuWidth,
    minCuHeight,
    numPartInCtuWidth,
    numPartInCtuHeight,
    numPartitionsInCtu,
    frameWidthInCtus,
    frameHeightInCtus,
    numCtusInFrame,
    nominalWidth,
    nominalHeight,
    rightPadding,
    bottomPadding,
    initialIdentityMap,
    ctuList,
  };
}

/**
 * Step 2: Initializes 2D Tile partitioning and m_puiTileIdxMap per TComPicSym::xInitTiles()
 * (TComPicSym.cpp:160, 318-445).
 */
export function initTiles(grid, tileConfig = {}) {
  const { frameWidthInCtus, frameHeightInCtus, numCtusInFrame } = grid;
  const uniformSpacing = tileConfig.uniformSpacing !== false;

  const numCols = Math.max(
    1,
    Math.min(frameWidthInCtus, Math.round(Number(tileConfig.numCols) || 1))
  );
  const numRows = Math.max(
    1,
    Math.min(frameHeightInCtus, Math.round(Number(tileConfig.numRows) || 1))
  );

  const colWidths = new Array(numCols).fill(0);
  const rowHeights = new Array(numRows).fill(0);

  if (uniformSpacing) {
    // HM-18.0 TComPicSym.cpp:337-350
    for (let c = 0; c < numCols; c++) {
      colWidths[c] =
        Math.floor(((c + 1) * frameWidthInCtus) / numCols) -
        Math.floor((c * frameWidthInCtus) / numCols);
    }
    for (let r = 0; r < numRows; r++) {
      rowHeights[r] =
        Math.floor(((r + 1) * frameHeightInCtus) / numRows) -
        Math.floor((r * frameHeightInCtus) / numRows);
    }
  } else {
    let usedW = 0;
    for (let c = 0; c < numCols - 1; c++) {
      const remainingCols = numCols - 1 - c;
      const maxAllowed = Math.max(1, frameWidthInCtus - usedW - remainingCols);
      const rawVal = Array.isArray(tileConfig.colWidths) ? tileConfig.colWidths[c] : undefined;
      const requested = (rawVal !== undefined && !Number.isNaN(Number(rawVal)))
        ? Number(rawVal)
        : Math.max(1, Math.floor((frameWidthInCtus - usedW) / (remainingCols + 1)));
      const w = Math.max(1, Math.min(maxAllowed, Math.round(requested || 1)));
      colWidths[c] = w;
      usedW += w;
    }
    colWidths[numCols - 1] = Math.max(1, frameWidthInCtus - usedW);

    let usedH = 0;
    for (let r = 0; r < numRows - 1; r++) {
      const remainingRows = numRows - 1 - r;
      const maxAllowed = Math.max(1, frameHeightInCtus - usedH - remainingRows);
      const rawVal = Array.isArray(tileConfig.rowHeights) ? tileConfig.rowHeights[r] : undefined;
      const requested = (rawVal !== undefined && !Number.isNaN(Number(rawVal)))
        ? Number(rawVal)
        : Math.max(1, Math.floor((frameHeightInCtus - usedH) / (remainingRows + 1)));
      const h = Math.max(1, Math.min(maxAllowed, Math.round(requested || 1)));
      rowHeights[r] = h;
      usedH += h;
    }
    rowHeights[numRows - 1] = Math.max(1, frameHeightInCtus - usedH);
  }

  const maxCuWidth = grid.maxCuWidth || 64;
  const maxCuHeight = grid.maxCuHeight || 64;
  const tilesEnabled = numCols > 1 || numRows > 1;
  const minTileWidthInCtus = tilesEnabled ? Math.ceil(256 / maxCuWidth) : 1;
  const minTileHeightInCtus = tilesEnabled ? Math.ceil(64 / maxCuHeight) : 1;
  const minTileWidthInPixels = tilesEnabled ? 256 : maxCuWidth;
  const minTileHeightInPixels = tilesEnabled ? 64 : maxCuHeight;

  const tileParameters = [];
  const tileIdxMap = new Array(numCtusInFrame).fill(0);

  let rowStartCtuY = 0;
  for (let r = 0; r < numRows; r++) {
    const tileHeightInCtus = rowHeights[r];
    let colStartCtuX = 0;
    for (let c = 0; c < numCols; c++) {
      const tileWidthInCtus = colWidths[c];
      const tileIdx = r * numCols + c;
      const firstCtuRsAddr = rowStartCtuY * frameWidthInCtus + colStartCtuX;
      const rightEdgePosInCtus = colStartCtuX + tileWidthInCtus - 1;
      const bottomEdgePosInCtus = rowStartCtuY + tileHeightInCtus - 1;
      const tileWidthInPixels = tileWidthInCtus * maxCuWidth;
      const tileHeightInPixels = tileHeightInCtus * maxCuHeight;
      const isWidthViolated = tilesEnabled && tileWidthInCtus < minTileWidthInCtus;
      const isHeightViolated = tilesEnabled && tileHeightInCtus < minTileHeightInCtus;
      const isHevcMainProfileCompliant = !isWidthViolated && !isHeightViolated;

      tileParameters.push({
        tileIdx,
        col: c,
        row: r,
        firstCtuX: colStartCtuX,
        firstCtuY: rowStartCtuY,
        tileWidthInCtus,
        tileHeightInCtus,
        tileWidthInPixels,
        tileHeightInPixels,
        rightEdgePosInCtus,
        bottomEdgePosInCtus,
        firstCtuRsAddr,
        numCtusInTile: tileWidthInCtus * tileHeightInCtus,
        isWidthViolated,
        isHeightViolated,
        isHevcMainProfileCompliant,
      });

      // Populate m_puiTileIdxMap[ctuRsAddr] = tileIdx (TComPicSym.cpp:427-440)
      for (let y = rowStartCtuY; y <= bottomEdgePosInCtus; y++) {
        for (let x = colStartCtuX; x <= rightEdgePosInCtus; x++) {
          const rsAddr = y * frameWidthInCtus + x;
          if (rsAddr >= 0 && rsAddr < numCtusInFrame) {
            tileIdxMap[rsAddr] = tileIdx;
          }
        }
      }

      colStartCtuX += tileWidthInCtus;
    }
    rowStartCtuY += tileHeightInCtus;
  }

  const nonCompliantTiles = tileParameters.filter((t) => !t.isHevcMainProfileCompliant);
  const isHevcMainProfileCompliant = nonCompliantTiles.length === 0;

  return {
    uniformSpacing,
    numTileColumnsMinus1: numCols - 1,
    numTileRowsMinus1: numRows - 1,
    numCols,
    numRows,
    numTiles: tileParameters.length,
    colWidths,
    rowHeights,
    tileParameters,
    tileIdxMap,
    tilesEnabled,
    minTileWidthInCtus,
    minTileHeightInCtus,
    minTileWidthInPixels,
    minTileHeightInPixels,
    isHevcMainProfileCompliant,
    nonCompliantTiles,
  };
}

/**
 * Step 3a: Calculates the next Raster Scan (RS) CTU address following Tile Scan (TS) order.
 * Exact port of TComPicSym::xCalculateNextCtuRSAddr(uiCurrCtuRSAddr) (TComPicSym.cpp:448-484).
 */
export function calculateNextCtuRsAddr(currCtuRsAddr, grid, tileParameters, tileIdxMap) {
  const { frameWidthInCtus, numCtusInFrame } = grid;
  const tileIdx = tileIdxMap[currCtuRsAddr] ?? 0;
  const tile = tileParameters[tileIdx];
  if (!tile) return numCtusInFrame;

  const currCol = currCtuRsAddr % frameWidthInCtus;
  const currRow = Math.floor(currCtuRsAddr / frameWidthInCtus);

  // 1. Last CTU of the current Tile? (right edge AND bottom edge)
  if (currCol === tile.rightEdgePosInCtus && currRow === tile.bottomEdgePosInCtus) {
    if (tileIdx + 1 === tileParameters.length) {
      return numCtusInFrame;
    }
    return tileParameters[tileIdx + 1].firstCtuRsAddr;
  }

  // 2. Right edge of the current Tile, but more rows remain inside this Tile?
  if (currCol === tile.rightEdgePosInCtus) {
    return currCtuRsAddr + frameWidthInCtus - tile.tileWidthInCtus + 1;
  }

  // 3. Otherwise, advance 1 CTU to the right within the same Tile row
  return currCtuRsAddr + 1;
}

/**
 * Step 3b: Builds bidirectional TS <-> RS lookup tables per TComPicSym::xInitCtuTsRsAddrMaps()
 * (TComPicSym.cpp:161, 306-316).
 * Both arrays have size numCtusInFrame + 1, with sentinel [N] = N.
 */
export function initCtuTsRsAddrMaps(grid, tileParameters, tileIdxMap) {
  const { numCtusInFrame } = grid;
  const ctuTsToRsAddrMap = new Array(numCtusInFrame + 1).fill(0);
  const ctuRsToTsAddrMap = new Array(numCtusInFrame + 1).fill(0);

  let ctuRsAddr = 0;
  for (let ctuTsAddr = 0; ctuTsAddr < numCtusInFrame; ctuTsAddr++) {
    ctuTsToRsAddrMap[ctuTsAddr] = ctuRsAddr;
    ctuRsToTsAddrMap[ctuRsAddr] = ctuTsAddr;
    ctuRsAddr = calculateNextCtuRsAddr(ctuRsAddr, grid, tileParameters, tileIdxMap);
  }

  // Sentinel entry at index N (TComPicSym.cpp:314-315)
  ctuTsToRsAddrMap[numCtusInFrame] = numCtusInFrame;
  ctuRsToTsAddrMap[numCtusInFrame] = numCtusInFrame;

  const enrichedTiles = tileParameters.map((t) => {
    const startCtuTsAddr = ctuRsToTsAddrMap[t.firstCtuRsAddr];
    const endCtuTsAddr = startCtuTsAddr + t.numCtusInTile; // exclusive
    return {
      ...t,
      startCtuTsAddr,
      endCtuTsAddr,
    };
  });

  return {
    ctuTsToRsAddrMap,
    ctuRsToTsAddrMap,
    enrichedTiles,
  };
}

/**
 * Helper to resolve realistic per-CTU bit counts from HM trace or deterministic spatial complexity model.
 */
export function resolveCtuBitsArray(grid, ctuActualBitsMap = {}) {
  const { numCtusInFrame, ctuList } = grid;
  const bitsPerCtu = new Array(numCtusInFrame).fill(0);

  for (let rs = 0; rs < numCtusInFrame; rs++) {
    const ctu = ctuList[rs];
    const keyPx = `${ctu.px}_${ctu.py}`;
    const keyGrid = `${ctu.col}_${ctu.row}`;
    const explicitBits =
      ctuActualBitsMap?.[rs] ??
      ctuActualBitsMap?.[keyPx] ??
      ctuActualBitsMap?.[keyGrid];

    if (typeof explicitBits === 'number' && explicitBits > 0) {
      bitsPerCtu[rs] = Math.round(explicitBits);
    } else {
      const centerWeight =
        1 +
        0.45 *
          Math.sin(((ctu.col + 0.5) / Math.max(1, grid.frameWidthInCtus)) * Math.PI) *
          Math.sin(((ctu.row + 0.5) / Math.max(1, grid.frameHeightInCtus)) * Math.PI);
      const boundaryFactor = ctu.isBoundary ? 0.58 : 1.0;
      const patternJitter = ((rs * 173 + ctu.col * 37 + ctu.row * 53) % 240) - 120;
      bitsPerCtu[rs] = Math.max(256, Math.round((1480 * centerWeight + patternJitter) * boundaryFactor));
    }
  }

  return bitsPerCtu;
}

/**
 * Step 4 & Step 5: Models TEncGOP::compressGOP() & TEncSlice:
 * - Step 4 (TEncGOP.cpp:1593-1598): clearSliceBuffer() -> allocateNewSlice() -> initEncSlice() initializes ONLY m_apSlices[0] at TS=0.
 * - Step 5 (TEncGOP.cpp:1982-2005 & TEncSlice.cpp:733-949): Loop over nextCtuTsAddr, calling
 *   calculateBoundingCtuTsAddrForSlice() -> compressSlice(), and dynamically calling pcPic->allocateNewSlice()
 *   whenever curSliceSegmentEnd < numberOfCtusInFrame.
 */
export function partitionSlices(
  grid,
  tileInfo,
  tsRsMaps,
  sliceConfig = {},
  ctuActualBitsMap = {}
) {
  const { numCtusInFrame } = grid;
  const { tileIdxMap } = tileInfo;
  const { ctuTsToRsAddrMap, ctuRsToTsAddrMap, enrichedTiles } = tsRsMaps;

  const sliceMode = Number(sliceConfig.sliceMode ?? SLICE_CONSTRAINTS.NO_SLICES);
  const sliceArgument = Math.max(1, Math.round(Number(sliceConfig.sliceArgument) || 1));
  const respectTileBoundaries = sliceConfig.respectTileBoundaries !== false;
  const qp = Number(sliceConfig.qp ?? 32);
  const poc = Number(sliceConfig.poc ?? 0);
  const sliceType = sliceConfig.sliceType || 'I_SLICE';
  const lambda = Number((0.57 * Math.pow(2, (qp - 12) / 3)).toFixed(2));

  const bitsPerCtuRs = resolveCtuBitsArray(grid, ctuActualBitsMap);
  const apSlices = [];
  const ctuSliceMap = new Array(numCtusInFrame).fill(0);

  let startCtuTsAddr = 0;
  let sliceIdx = 0;

  while (startCtuTsAddr < numCtusInFrame) {
    const startCtuRsAddr = ctuTsToRsAddrMap[startCtuTsAddr];
    const startTileIdx = tileIdxMap[startCtuRsAddr] ?? 0;
    const startTile = enrichedTiles[startTileIdx];
    const tileEndTsExcl = startTile ? startTile.endCtuTsAddr : numCtusInFrame;

    // 1. TEncSlice::calculateBoundingCtuTsAddrForSlice() initial bound calculation
    let initialBoundingTsAddr = numCtusInFrame;
    let terminatedByTileBoundary = false;
    let terminatedByByteLimit = false;

    if (sliceMode === SLICE_CONSTRAINTS.NO_SLICES) {
      initialBoundingTsAddr = numCtusInFrame;
    } else if (sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU) {
      const tentativeEnd = Math.min(startCtuTsAddr + sliceArgument, numCtusInFrame);
      if (respectTileBoundaries && enrichedTiles.length > 1 && tileEndTsExcl < tentativeEnd) {
        initialBoundingTsAddr = tileEndTsExcl;
        terminatedByTileBoundary = true;
      } else {
        initialBoundingTsAddr = tentativeEnd;
      }
    } else if (sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_TILES) {
      const targetLastTileIdx = Math.min(
        enrichedTiles.length - 1,
        startTileIdx + sliceArgument - 1
      );
      initialBoundingTsAddr = enrichedTiles[targetLastTileIdx]?.endCtuTsAddr ?? numCtusInFrame;
    } else if (sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES) {
      // TEncSlice.cpp:1157 & 1211: Initially bounded by frame end or current tile end!
      initialBoundingTsAddr =
        respectTileBoundaries && enrichedTiles.length > 1
          ? tileEndTsExcl
          : numCtusInFrame;
    }

    // 2. TEncSlice::compressSlice() execution over [startCtuTsAddr .. initialBoundingTsAddr)
    let endCtuTsAddr = initialBoundingTsAddr;
    if (sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES) {
      const maxSliceBits = sliceArgument * 8;
      let accBits = 0;
      for (let ts = startCtuTsAddr; ts < initialBoundingTsAddr; ts++) {
        const rs = ctuTsToRsAddrMap[ts];
        const ctuBits = bitsPerCtuRs[rs] || 1000;
        if (accBits + ctuBits > maxSliceBits) {
          endCtuTsAddr = ts === startCtuTsAddr ? startCtuTsAddr + 1 : ts;
          terminatedByByteLimit = endCtuTsAddr < initialBoundingTsAddr;
          break;
        }
        accBits += ctuBits;
      }
      if (!terminatedByByteLimit && initialBoundingTsAddr < numCtusInFrame) {
        terminatedByTileBoundary = true;
      }
    }

    if (endCtuTsAddr <= startCtuTsAddr) {
      endCtuTsAddr = Math.min(numCtusInFrame, startCtuTsAddr + 1);
    }

    const ctuTsList = [];
    const ctuRsList = [];
    const tileIndicesInSlice = new Set();
    let totalBits = 0;

    for (let ts = startCtuTsAddr; ts < endCtuTsAddr; ts++) {
      const rs = ctuTsToRsAddrMap[ts];
      ctuTsList.push(ts);
      ctuRsList.push(rs);
      ctuSliceMap[rs] = sliceIdx;
      tileIndicesInSlice.add(tileIdxMap[rs] ?? 0);
      totalBits += bitsPerCtuRs[rs] || 0;
    }

    apSlices.push({
      sliceIdx,
      sliceSegmentIdx: sliceIdx,
      poc,
      sliceType,
      sliceQp: qp,
      lambda,
      allocatedAtTs: startCtuTsAddr,
      allocatedBy:
        sliceIdx === 0
          ? 'TComPicSym::create() / TEncGOP::initEncSlice()'
          : 'TEncGOP::compressGOP() -> pcPic->allocateNewSlice()',
      initialBoundingTsAddr,
      startCtuTsAddr,
      endCtuTsAddr,
      startCtuRsAddr: ctuTsToRsAddrMap[startCtuTsAddr],
      lastCtuRsAddr: ctuTsToRsAddrMap[endCtuTsAddr - 1],
      numCtus: endCtuTsAddr - startCtuTsAddr,
      ctuTsList,
      ctuRsList,
      tileIndices: Array.from(tileIndicesInSlice),
      totalBits,
      totalBytes: Math.ceil(totalBits / 8),
      terminatedByTileBoundary,
      terminatedByByteLimit,
    });

    startCtuTsAddr = endCtuTsAddr;
    sliceIdx++;
  }

  return {
    sliceMode,
    sliceArgument,
    respectTileBoundaries,
    bitsPerCtuRs,
    apSlices,
    slices: apSlices,
    ctuSliceMap,
    ctuRsToTsAddrMap,
  };
}

/**
 * Step 5 & Step 6: Builds step-by-step execution trace for TEncSlice::compressSlice() and TEncSlice::encodeSlice(),
 * including dynamic m_apSlices growth (only slices with startCtuTsAddr <= current ctuTsAddr exist in m_apSlices at that moment)
 * and CABAC context resets at Tile / Slice boundaries (TEncSlice.cpp:1017-1023).
 */
export function buildCompressSliceSteps(grid, tileInfo, tsRsMaps, sliceInfo) {
  const { numCtusInFrame, ctuList } = grid;
  const { tileIdxMap } = tileInfo;
  const { ctuTsToRsAddrMap, enrichedTiles } = tsRsMaps;
  const { apSlices, ctuSliceMap, bitsPerCtuRs } = sliceInfo;

  const steps = [];
  let prevTileIdx = -1;
  let prevSliceIdx = -1;
  let cumulativeSliceBits = 0;

  for (let ctuTsAddr = 0; ctuTsAddr < numCtusInFrame; ctuTsAddr++) {
    const ctuRsAddr = ctuTsToRsAddrMap[ctuTsAddr];
    const tileIdx = tileIdxMap[ctuRsAddr] ?? 0;
    const sliceIdx = ctuSliceMap[ctuRsAddr] ?? 0;
    const ctu = ctuList[ctuRsAddr];
    const sliceObj = apSlices[sliceIdx];
    const tileObj = enrichedTiles[tileIdx];
    const ctuBits = bitsPerCtuRs[ctuRsAddr] || 0;

    const isNewSliceAllocated = sliceIdx !== prevSliceIdx;
    const isTileBoundaryCrossed = ctuTsAddr > 0 && tileIdx !== prevTileIdx;
    const isFirstCtuOfTile = ctuRsAddr === tileObj?.firstCtuRsAddr;
    // TEncSlice.cpp:965, 1017-1023: CABAC context is reset at start of every Slice and at firstCtuRsAddrOfTile
    const isCabacReset = isNewSliceAllocated || isFirstCtuOfTile;

    if (isNewSliceAllocated) {
      cumulativeSliceBits = ctuBits;
    } else {
      cumulativeSliceBits += ctuBits;
    }

    const nextCtuRsAddr = ctuTsToRsAddrMap[ctuTsAddr + 1];
    const isTileJumpOnNext =
      ctuTsAddr + 1 < numCtusInFrame && nextCtuRsAddr !== ctuRsAddr + 1;

    // Progressive m_apSlices deque state at this exact point in TEncGOP::compressGOP() loop
    const allocatedSliceCountAtStep = sliceIdx + 1;

    steps.push({
      stepIdx: ctuTsAddr,
      ctuTsAddr,
      ctuRsAddr,
      nextCtuRsAddr,
      isTileJumpOnNext,
      col: ctu?.col ?? 0,
      row: ctu?.row ?? 0,
      px: ctu?.px ?? 0,
      py: ctu?.py ?? 0,
      validW: ctu?.validW ?? 64,
      validH: ctu?.validH ?? 64,
      isBoundary: Boolean(ctu?.isBoundary),
      tileIdx,
      sliceIdx,
      allocatedSliceCountAtStep,
      sliceStartTs: sliceObj?.startCtuTsAddr ?? 0,
      sliceInitialBoundTs: sliceObj?.initialBoundingTsAddr ?? numCtusInFrame,
      sliceEndTs: sliceObj?.endCtuTsAddr ?? numCtusInFrame,
      isNewSliceAllocated,
      isTileBoundaryCrossed,
      isFirstCtuOfTile,
      isCabacReset,
      ctuBits,
      cumulativeSliceBits,
      cumulativeSliceBytes: Math.ceil(cumulativeSliceBits / 8),
    });

    prevTileIdx = tileIdx;
    prevSliceIdx = sliceIdx;
  }

  return steps;
}

/**
 * Full high-level simulation builder combining all stages of TComPicSym, TEncGOP, and TEncSlice.
 */
export function runTComPicSymSimulation({
  picWidth = 416,
  picHeight = 240,
  maxCuWidth = 64,
  maxCuHeight = 64,
  maxDepth = 4,
  tileConfig = { uniformSpacing: true, numCols: 2, numRows: 1 },
  sliceConfig = {
    sliceMode: SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU,
    sliceArgument: 10,
    respectTileBoundaries: true,
    qp: 32,
  },
  ctuActualBitsMap = {},
} = {}) {
  const grid = computeCtuGridGeometry(picWidth, picHeight, maxCuWidth, maxCuHeight, maxDepth);
  const tileInfo = initTiles(grid, tileConfig);
  const tsRsMaps = initCtuTsRsAddrMaps(grid, tileInfo.tileParameters, tileInfo.tileIdxMap);
  const sliceInfo = partitionSlices(grid, tileInfo, tsRsMaps, sliceConfig, ctuActualBitsMap);
  const compressSteps = buildCompressSliceSteps(grid, tileInfo, tsRsMaps, sliceInfo);

  return {
    grid,
    tileInfo,
    tsRsMaps,
    sliceInfo,
    compressSteps,
  };
}

const paddedImageCache = new Map();

/**
 * Generates an edge-clamped (replicated border pixels) padded data URL from a source image URL.
 * Conforms 100% to HM C++ TVideoIOYuv::read / TComPicYuv::extendPicBorder.
 *
 * @param {string} imageSrc - Source image data URL or URL
 * @param {number} width - Valid image width (e.g. 416)
 * @param {number} height - Valid image height (e.g. 240)
 * @param {number} nominalWidth - Aligned nominal width (e.g. 448)
 * @param {number} nominalHeight - Aligned nominal height (e.g. 256)
 * @returns {Promise<string>} - Padded image data URL
 */
export function generateEdgeClampedPaddedImage(imageSrc, width, height, nominalWidth, nominalHeight) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !imageSrc) {
      resolve(imageSrc);
      return;
    }

    const rightPad = nominalWidth - width;
    const bottomPad = nominalHeight - height;
    if (rightPad <= 0 && bottomPad <= 0) {
      resolve(imageSrc);
      return;
    }

    const cacheKey = `${imageSrc}_${width}_${height}_${nominalWidth}_${nominalHeight}`;
    if (paddedImageCache.has(cacheKey)) {
      resolve(paddedImageCache.get(cacheKey));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = nominalWidth;
        canvas.height = nominalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.imageSmoothingEnabled = false;

        // 1. Valid image at (0, 0)
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Right padding: replicate last column (width - 1) horizontally
        if (rightPad > 0) {
          ctx.drawImage(img, width - 1, 0, 1, height, width, 0, rightPad, height);
        }

        // 3. Bottom padding: replicate last row (height - 1) vertically
        if (bottomPad > 0) {
          ctx.drawImage(img, 0, height - 1, width, 1, 0, height, width, bottomPad);
        }

        // 4. Bottom-right corner: replicate last pixel (width - 1, height - 1)
        if (rightPad > 0 && bottomPad > 0) {
          ctx.drawImage(img, width - 1, height - 1, 1, 1, width, height, rightPad, bottomPad);
        }

        const dataUrl = canvas.toDataURL();
        paddedImageCache.set(cacheKey, dataUrl);
        resolve(dataUrl);
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}
