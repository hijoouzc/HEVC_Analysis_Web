import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Computes dynamic frame and CTU geometry conforming strictly to
 * ITU-T H.265 Section 6.5.3 (zero hardcoding).
 *
 * @param {number} width Frame width in luma samples
 * @param {number} height Frame height in luma samples
 * @param {number} ctuSize Max CU / CTU size (typically 64, 32, or 16)
 * @returns {{ width: number, height: number, ctuSize: number, numCtuX: number, numCtuY: number, totalCtus: number }}
 */
export function computeFrameCtuGeometry(width = 640, height = 360, ctuSize = 64) {
  const safeW = Math.max(1, Number(width) || 640);
  const safeH = Math.max(1, Number(height) || 360);
  const safeSize = Math.max(8, Number(ctuSize) || 64);
  const numCtuX = Math.ceil(safeW / safeSize);
  const numCtuY = Math.ceil(safeH / safeSize);
  const totalCtus = numCtuX * numCtuY;
  return { width: safeW, height: safeH, ctuSize: safeSize, numCtuX, numCtuY, totalCtus };
}

/**
 * Extracts the true CTU processing order directly from the trace event sequence
 * or falls back to the configured tile/raster scan order.
 *
 * @param {number} numCtuX
 * @param {number} numCtuY
 * @param {Record<string, any>} [ctuPartitionsMap]
 * @returns {Array<{ seqIdx: number, ctuX: number, ctuY: number, key: string }>}
 */
export function deriveCtuProcessingSequence(numCtuX, numCtuY, ctuPartitionsMap = null) {
  if (ctuPartitionsMap && typeof ctuPartitionsMap === 'object') {
    const keys = Object.keys(ctuPartitionsMap);
    if (keys.length > 0) {
      return keys.map((key, idx) => {
        const parts = key.split('_').map(Number);
        const ctuX = Number.isFinite(parts[0]) ? parts[0] : 0;
        const ctuY = Number.isFinite(parts[1]) ? parts[1] : 0;
        return {
          seqIdx: idx,
          ctuX,
          ctuY,
          key,
        };
      });
    }
  }

  const seq = [];
  let idx = 0;
  for (let cy = 0; cy < numCtuY; cy++) {
    for (let cx = 0; cx < numCtuX; cx++) {
      seq.push({
        seqIdx: idx++,
        ctuX: cx,
        ctuY: cy,
        key: `${cx}_${cy}`,
      });
    }
  }
  return seq;
}

/**
 * Extracts leaf CU nodes from a CTU partition snapshot in Z-scan order.
 */
export function extractCtuLeafNodes(partitionData) {
  if (!partitionData || !Array.isArray(partitionData.nodes)) return [];
  return partitionData.nodes.filter((n) => !n.split);
}

/**
 * Extracts all CU nodes (both parent and leaf) from a CTU partition snapshot.
 */
export function extractAllCtuNodes(partitionData) {
  if (!partitionData || !Array.isArray(partitionData.nodes)) return [];
  return partitionData.nodes;
}

/**
 * useHmTracePlayback
 * Core React state machine managing HM Trace Playback across the frame:
 * - Macro Stepping: advances CTU-by-CTU according to actual trace sequence
 * - Micro Stepping: advances CU-by-CU through leaf nodes of the active CTU
 * - State Separation: playhead position vs user inspection cursor
 */
export function useHmTracePlayback({
  imageDims = { width: 640, height: 360 },
  ctuSize = 64,
  ctuPartitionsMap = null,
  partitionData = null,
  targetCtuX = 0,
  targetCtuY = 0,
  initialSelectedCu = null,
  onSelectCTU = null,
  onSelectCU = null,
}) {
  const geometry = useMemo(() => {
    return computeFrameCtuGeometry(imageDims?.width, imageDims?.height, ctuSize);
  }, [imageDims?.width, imageDims?.height, ctuSize]);

  const ctuSequence = useMemo(() => {
    return deriveCtuProcessingSequence(geometry.numCtuX, geometry.numCtuY, ctuPartitionsMap);
  }, [geometry.numCtuX, geometry.numCtuY, ctuPartitionsMap]);

  const totalCtus = ctuSequence.length > 0 ? ctuSequence.length : geometry.totalCtus;

  // Playhead state: 0 = unencoded initial frame; k in 1..totalCtus represents CTU (k-1) committed
  const [playheadCtuIdx, setPlayheadCtuIdx] = useState(0);
  const [isInitial, setIsInitial] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1000);

  // Micro CU index within the active CTU
  const [activeCuIdx, setActiveCuIdx] = useState(0);

  // Inspection target: independent of playhead
  const [inspectedCu, setInspectedCu] = useState(initialSelectedCu);

  const timerRef = useRef(null);

  // Determine currently active CTU based on playhead
  const currentCtu = useMemo(() => {
    if (ctuSequence.length === 0) return null;
    const clampedIdx = Math.max(0, Math.min(ctuSequence.length - 1, playheadCtuIdx > 0 ? playheadCtuIdx - 1 : 0));
    return ctuSequence[clampedIdx] || ctuSequence[0];
  }, [ctuSequence, playheadCtuIdx]);

  // Leaf nodes of currently active CTU
  const activeCtuPartitions = useMemo(() => {
    if (!currentCtu) return partitionData;
    return ctuPartitionsMap?.[currentCtu.key] || partitionData || null;
  }, [currentCtu, ctuPartitionsMap, partitionData]);

  const activeLeafNodes = useMemo(() => {
    return extractCtuLeafNodes(activeCtuPartitions);
  }, [activeCtuPartitions]);

  const allCtuNodes = useMemo(() => {
    return extractAllCtuNodes(activeCtuPartitions);
  }, [activeCtuPartitions]);

  // Set of committed CTU keys (all CTUs strictly prior to or equal to current committed playhead)
  const committedCtuKeys = useMemo(() => {
    if (isInitial || playheadCtuIdx <= 0) return new Set();
    const set = new Set();
    for (let i = 0; i < playheadCtuIdx && i < ctuSequence.length; i++) {
      set.add(ctuSequence[i].key);
    }
    return set;
  }, [isInitial, playheadCtuIdx, ctuSequence]);

  const lastReportedKeyRef = useRef(null);

  // Synchronize onSelectCTU when active CTU changes from playback
  useEffect(() => {
    if (!isInitial && currentCtu) {
      if (lastReportedKeyRef.current !== currentCtu.key) {
        lastReportedKeyRef.current = currentCtu.key;
        if (onSelectCTU) {
          onSelectCTU(currentCtu.ctuX, currentCtu.ctuY);
        }
      }
    } else if (isInitial) {
      lastReportedKeyRef.current = null;
    }
  }, [isInitial, currentCtu, onSelectCTU]);

  // Step Next CTU
  const stepNextCtu = useCallback(() => {
    setIsInitial(false);
    setPlayheadCtuIdx((prev) => {
      const next = prev + 1;
      if (next >= totalCtus) {
        setIsPlaying(false);
        return totalCtus;
      }
      return next;
    });
    setActiveCuIdx(0);
  }, [totalCtus]);

  // Step Prev CTU
  const stepPrevCtu = useCallback(() => {
    setPlayheadCtuIdx((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) {
        setIsInitial(true);
        setIsPlaying(false);
      }
      return next;
    });
    setActiveCuIdx(0);
  }, []);

  // Reset to initial unencoded state
  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    setPlayheadCtuIdx(0);
    setIsInitial(true);
    setActiveCuIdx(0);
  }, []);

  // Jump directly to specific CTU index
  const jumpToCtu = useCallback((seqIdx) => {
    const clamped = Math.max(0, Math.min(totalCtus, seqIdx + 1));
    setIsInitial(false);
    setPlayheadCtuIdx(clamped);
    setActiveCuIdx(0);
  }, [totalCtus]);

  // Play / Pause toggle
  const startPlayback = useCallback(() => {
    if (playheadCtuIdx >= totalCtus) {
      setPlayheadCtuIdx(1);
    } else if (playheadCtuIdx === 0) {
      setPlayheadCtuIdx(1);
    }
    setIsInitial(false);
    setIsPlaying(true);
  }, [playheadCtuIdx, totalCtus]);

  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Autoplay ticker
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setPlayheadCtuIdx((prev) => {
          if (prev >= totalCtus) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalCtus, speedMs]);

  // Micro Stepping (CU-by-CU within active CTU)
  const stepNextCu = useCallback(() => {
    if (activeLeafNodes.length === 0) return;
    setActiveCuIdx((prev) => (prev + 1) % activeLeafNodes.length);
  }, [activeLeafNodes.length]);

  const stepPrevCu = useCallback(() => {
    if (activeLeafNodes.length === 0) return;
    setActiveCuIdx((prev) => (prev <= 0 ? activeLeafNodes.length - 1 : prev - 1));
  }, [activeLeafNodes.length]);

  // Safeguard against out-of-bounds indices when activeLeafNodes shrinks
  const safeCuIdx = Math.min(activeCuIdx, Math.max(0, activeLeafNodes.length - 1));

  // Synchronize inspected node and notify external callback once per discrete committed selection using composite key
  const lastNotifiedKeyRef = useRef(null);
  useEffect(() => {
    if (activeLeafNodes.length === 0) return;
    const targetNode = activeLeafNodes[safeCuIdx];
    if (!targetNode) return;

    const nodeKey = `${currentCtu?.ctuX ?? 0}_${currentCtu?.ctuY ?? 0}_${targetNode.x}_${targetNode.y}_${targetNode.width}x${targetNode.height}`;
    if (nodeKey !== lastNotifiedKeyRef.current) {
      lastNotifiedKeyRef.current = nodeKey;
      setInspectedCu(targetNode);
      if (onSelectCU) onSelectCU(targetNode);
    }
  }, [safeCuIdx, activeLeafNodes, currentCtu, onSelectCU]);

  // Dedicated inspection handler: strictly NEVER alters playhead
  const handleSelectInspectedCu = useCallback((cu) => {
    if (!cu) return;
    const nodeKey = `${currentCtu?.ctuX ?? 0}_${currentCtu?.ctuY ?? 0}_${cu.x}_${cu.y}_${cu.width}x${cu.height}`;
    lastNotifiedKeyRef.current = nodeKey;
    setInspectedCu(cu);
    if (onSelectCU) onSelectCU(cu);
  }, [currentCtu, onSelectCU]);

  const isCompleted = playheadCtuIdx >= totalCtus;
  const isTargetCtuActive = Boolean(
    currentCtu && currentCtu.ctuX === targetCtuX && currentCtu.ctuY === targetCtuY
  );

  return {
    geometry,
    ctuSequence,
    totalCtus,
    playheadCtuIdx,
    currentCtu,
    isInitial,
    isCompleted,
    isPlaying,
    speedMs,
    setSpeedMs,
    committedCtuKeys,
    activeLeafNodes,
    allCtuNodes,
    activeCuIdx,
    inspectedCu,
    isTargetCtuActive,
    startPlayback,
    pausePlayback,
    stepNextCtu,
    stepPrevCtu,
    resetPlayback,
    jumpToCtu,
    stepNextCu,
    stepPrevCu,
    setInspectedCu: handleSelectInspectedCu,
  };
}

export default useHmTracePlayback;
