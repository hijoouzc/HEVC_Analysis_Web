/**
 * zScanUtils.js
 * Mathematical Morton Z-Scan Order & Spatial Coordinate Utilities for HEVC CTU / CU QuadTree.
 * Adheres strictly to ITU-T H.265 Section 6.4.1 (Morton scan / Z-scan) & HM-18.0 TEncCu::xCompressCU.
 */

/**
 * Computes 2D Morton Z-scan index from unit grid coordinates (ux, uy).
 * Bit interleaves bits of ux and uy: Z = sum(x_i * 2^(2i) + y_i * 2^(2i+1))
 */
export function morton2D(ux, uy) {
  let z = 0;
  for (let i = 0; i < 6; i++) {
    z |= ((ux >> i) & 1) << (2 * i);
    z |= ((uy >> i) & 1) << (2 * i + 1);
  }
  return z;
}

/**
 * Computes unit grid coordinates (ux, uy) from 2D Morton Z-scan index.
 */
export function inverseMorton2D(z) {
  let ux = 0;
  let uy = 0;
  for (let i = 0; i < 6; i++) {
    ux |= ((z >> (2 * i)) & 1) << i;
    uy |= ((z >> (2 * i + 1)) & 1) << i;
  }
  return { ux, uy };
}

/**
 * Returns total number of possible sub-blocks for a given CU block size inside a 64x64 CTU.
 */
export function getTotalBlocksForSize(blockSize) {
  const size = Math.max(4, Math.min(64, blockSize || 8));
  const countPerSide = Math.floor(64 / size);
  return countPerSide * countPerSide;
}

/**
 * Converts relative CTU coordinates (relX, relY in [0, 63]) to Morton Z-scan index.
 */
export function getZIndexForBlock(relX, relY, blockSize) {
  const size = Math.max(4, Math.min(64, blockSize || 8));
  const maxCoord = 64 - size;
  const clampedX = Math.max(0, Math.min(maxCoord, relX || 0));
  const clampedY = Math.max(0, Math.min(maxCoord, relY || 0));
  const ux = Math.floor(clampedX / size);
  const uy = Math.floor(clampedY / size);
  return morton2D(ux, uy);
}

/**
 * Converts Morton Z-scan index back to relative CTU coordinates (relX, relY in [0, 63]).
 */
export function getBlockCoordsForZIndex(zIndex, blockSize) {
  const size = Math.max(4, Math.min(64, blockSize || 8));
  const total = getTotalBlocksForSize(size);
  const clampedZ = Math.max(0, Math.min(total - 1, zIndex || 0));
  const { ux, uy } = inverseMorton2D(clampedZ);
  return {
    relX: ux * size,
    relY: uy * size,
    ux,
    uy,
  };
}

/**
 * Safely resolves relative CTU coordinates (0..63) and absolute picture coordinates.
 */
export function getRelativeCuCoords(cu, ctuX = 0, ctuY = 0) {
  const ctuOriginX = (ctuX ?? 0) * 64;
  const ctuOriginY = (ctuY ?? 0) * 64;

  if (!cu) {
    return {
      relX: 0,
      relY: 0,
      absX: ctuOriginX,
      absY: ctuOriginY,
    };
  }

  const px = typeof cu.abs_x === 'number' ? cu.abs_x : (typeof cu.x === 'number' ? cu.x : 0);
  const py = typeof cu.abs_y === 'number' ? cu.abs_y : (typeof cu.y === 'number' ? cu.y : 0);

  let relX = 0;
  if (px >= ctuOriginX && px < ctuOriginX + 64) {
    relX = px - ctuOriginX;
  } else if (px < 64) {
    relX = px;
  } else {
    relX = px % 64;
  }

  let relY = 0;
  if (py >= ctuOriginY && py < ctuOriginY + 64) {
    relY = py - ctuOriginY;
  } else if (py < 64) {
    relY = py;
  } else {
    relY = py % 64;
  }

  return {
    relX,
    relY,
    absX: ctuOriginX + relX,
    absY: ctuOriginY + relY,
  };
}

/**
 * Returns human-readable descriptive quadrant name for spatial identification.
 */
export function getQuadrantLabel(relX, relY, blockSize) {
  const size = Math.max(4, Math.min(64, blockSize || 8));

  if (size === 64) {
    return 'Full CTU (64×64)';
  }

  if (size === 32) {
    const isRight = relX >= 32;
    const isBottom = relY >= 32;
    if (!isRight && !isBottom) return 'Quad 0: Top-Left (TL)';
    if (isRight && !isBottom) return 'Quad 1: Top-Right (TR)';
    if (!isRight && isBottom) return 'Quad 2: Bottom-Left (BL)';
    return 'Quad 3: Bottom-Right (BR)';
  }

  if (size === 16) {
    const parentQuadX = Math.floor(relX / 32);
    const parentQuadY = Math.floor(relY / 32);
    const parentQuad = (parentQuadX === 0 && parentQuadY === 0) ? 'TL'
      : (parentQuadX === 1 && parentQuadY === 0) ? 'TR'
      : (parentQuadX === 0 && parentQuadY === 1) ? 'BL'
      : 'BR';
    const subX = Math.floor((relX % 32) / 16);
    const subY = Math.floor((relY % 32) / 16);
    const subIdx = morton2D(subX, subY);
    return `32×32 [${parentQuad}] › Sub #${subIdx}`;
  }

  const zIdx = getZIndexForBlock(relX, relY, size);
  return `Block #${zIdx} (${relX}, ${relY})`;
}
