/**
 * cuCoordinates.js
 * Centralized, Bit-Exact Coordinate Resolution & Normalization Utility
 * strictly conforming to ITU-T H.265 Section 6.4 & 6.5.
 *
 * Enforces Single Source of Truth (SSOT) across all 5 Guided Journey Steps:
 * - relX, relY: relative offset within CTU (0..64 - size)
 * - absX, absY: absolute pixel offset in picture frame (ctuX * 64 + relX, ctuY * 64 + relY)
 */

/**
 * Safely resolves canonical relative and absolute coordinates for any CU/PU block,
 * whether the input uses relative (0..63) or absolute picture coordinates.
 *
 * @param {object|null} cu - CU or node object with { x, y, abs_x, abs_y, rel_x, rel_y, width, size }
 * @param {number} ctuX - Horizontal CTU index (0..)
 * @param {number} ctuY - Vertical CTU index (0..)
 * @param {number} defaultSize - Fallback block size (default 8)
 * @returns {{ relX: number, relY: number, absX: number, absY: number, ctuOriginX: number, ctuOriginY: number, size: number }}
 */
export function resolveCuCoordinates(cu, ctuX = 0, ctuY = 0, defaultSize = 8) {
  const safeCtuX = Number.isFinite(Number(ctuX)) ? Math.max(0, Number(ctuX)) : 0;
  const safeCtuY = Number.isFinite(Number(ctuY)) ? Math.max(0, Number(ctuY)) : 0;
  const ctuOriginX = safeCtuX * 64;
  const ctuOriginY = safeCtuY * 64;

  const rawSize = cu?.width ?? cu?.size ?? defaultSize ?? 8;
  const size = Math.max(4, Math.min(64, Number.isFinite(Number(rawSize)) ? Number(rawSize) : 8));

  let relX = 0;
  let relY = 0;

  if (cu && typeof cu === 'object') {
    // 1. Resolve relX
    if (typeof cu.rel_x === 'number' && Number.isFinite(cu.rel_x)) {
      relX = cu.rel_x;
    } else if (typeof cu.relX === 'number' && Number.isFinite(cu.relX)) {
      relX = cu.relX;
    } else if (typeof cu.abs_x === 'number' && Number.isFinite(cu.abs_x)) {
      relX = cu.abs_x - ctuOriginX;
    } else if (typeof cu.absX === 'number' && Number.isFinite(cu.absX)) {
      relX = cu.absX - ctuOriginX;
    } else if (typeof cu.x === 'number' && Number.isFinite(cu.x)) {
      if (cu.x >= ctuOriginX && cu.x < ctuOriginX + 64) {
        relX = cu.x - ctuOriginX;
      } else if (cu.x < 64 && cu.x >= 0) {
        relX = cu.x;
      } else {
        relX = ((cu.x % 64) + 64) % 64;
      }
    }

    // 2. Resolve relY
    if (typeof cu.rel_y === 'number' && Number.isFinite(cu.rel_y)) {
      relY = cu.rel_y;
    } else if (typeof cu.relY === 'number' && Number.isFinite(cu.relY)) {
      relY = cu.relY;
    } else if (typeof cu.abs_y === 'number' && Number.isFinite(cu.abs_y)) {
      relY = cu.abs_y - ctuOriginY;
    } else if (typeof cu.absY === 'number' && Number.isFinite(cu.absY)) {
      relY = cu.absY - ctuOriginY;
    } else if (typeof cu.y === 'number' && Number.isFinite(cu.y)) {
      if (cu.y >= ctuOriginY && cu.y < ctuOriginY + 64) {
        relY = cu.y - ctuOriginY;
      } else if (cu.y < 64 && cu.y >= 0) {
        relY = cu.y;
      } else {
        relY = ((cu.y % 64) + 64) % 64;
      }
    }
  }

  // Snap to valid block boundaries within CTU 64x64
  const safeRelX = Math.max(0, Math.min(64 - size, relX));
  const safeRelY = Math.max(0, Math.min(64 - size, relY));
  const absX = ctuOriginX + safeRelX;
  const absY = ctuOriginY + safeRelY;

  return {
    relX: safeRelX,
    relY: safeRelY,
    absX,
    absY,
    ctuOriginX,
    ctuOriginY,
    size,
  };
}

/**
 * Normalizes a CU or partition node into a standardized canonical CU object
 * containing both relative and absolute coordinates.
 *
 * @param {object|null} cu
 * @param {number} ctuX
 * @param {number} ctuY
 * @param {number} defaultSize
 * @returns {object|null}
 */
export function normalizeCuNode(cu, ctuX = 0, ctuY = 0, defaultSize = 8) {
  if (!cu) return null;
  const { relX, relY, absX, absY, size } = resolveCuCoordinates(cu, ctuX, ctuY, defaultSize);

  return {
    ...cu,
    x: relX,
    y: relY,
    rel_x: relX,
    rel_y: relY,
    abs_x: absX,
    abs_y: absY,
    width: size,
    height: size,
    size,
    ctu_x: Number.isFinite(Number(ctuX)) ? Number(ctuX) : 0,
    ctu_y: Number.isFinite(Number(ctuY)) ? Number(ctuY) : 0,
  };
}

/**
 * Checks if a telemetry event's coordinate matches a target CU.
 *
 * @param {object} event - Telemetry event with cu_x/pu_x, cu_y/pu_y
 * @param {object} cu - Target CU
 * @param {number} ctuX
 * @param {number} ctuY
 * @returns {boolean}
 */
export function isTelemetryMatchingCu(event, cu, ctuX = 0, ctuY = 0) {
  if (!event || !cu) return false;
  const { relX, relY, absX, absY } = resolveCuCoordinates(cu, ctuX, ctuY, cu.width || 8);
  const evX = event.cu_x ?? event.pu_x ?? event.tu_x;
  const evY = event.cu_y ?? event.pu_y ?? event.tu_y;
  if (evX === undefined || evY === undefined) return false;

  const matchX = (evX === absX || evX === relX);
  const matchY = (evY === absY || evY === relY);
  return matchX && matchY;
}
