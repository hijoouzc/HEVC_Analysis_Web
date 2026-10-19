import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_CTU_CACHE = 16;

/**
 * LRU Cache update helper: maintains recency order and keeps size <= maxCapacity.
 */
function updateLruCache(prevCache, key, value, maxCapacity = MAX_CTU_CACHE) {
  const newCache = { ...prevCache };
  if (key in newCache) {
    delete newCache[key];
  } else {
    const keys = Object.keys(newCache);
    if (keys.length >= maxCapacity) {
      delete newCache[keys[0]];
    }
  }
  newCache[key] = value;
  return newCache;
}

/**
 * Builds a query string safely from an object of parameters.
 */
function buildQuery(paramsObj) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v !== null && v !== undefined) {
      q.set(k, String(v));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

/**
 * Custom Hook: useAnalysisSession
 * Encapsulates session state, async job polling, client-side caching,
 * keyboard navigation, and checkpoint synchronization.
 */
export function useAnalysisSession() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [rawImageDims, setRawImageDims] = useState({ width: 0, height: 0 });
  const [imageDims, setImageDims] = useState({ width: 640, height: 360 });
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [data, setData] = useState(null);
  const [refSamples, setRefSamples] = useState(null);
  const [currentModeIdx, setCurrentModeIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ctuX, setCtuX] = useState(0);
  const [ctuY, setCtuY] = useState(0);
  const [analyzedCtu, setAnalyzedCtu] = useState({ x: 0, y: 0 });
  const [cuSize, setCuSize] = useState(8);
  const [analyzedCuSize, setAnalyzedCuSize] = useState(8);

  const [activeStageTab, setActiveStageTab] = useState('CP_00');
  const [jobId, setJobId] = useState(null);
  const [partitionData, setPartitionData] = useState(null);
  const [transformData, setTransformData] = useState([]);
  const [quantData, setQuantData] = useState([]);
  const [frameGopData, setFrameGopData] = useState([]);
  const [interSearchData, setInterSearchData] = useState([]);
  const [reconPictureData, setReconPictureData] = useState([]);
  const [inloopFilterData, setInloopFilterData] = useState(null);
  const [cabacEntropyData, setCabacEntropyData] = useState(null);
  const [selectedCu, setSelectedCu] = useState(null);
  const [rdoDecisions, setRdoDecisions] = useState([]);
  const [ctuPartitionsMap, setCtuPartitionsMap] = useState({});
  const [ctuAnalysisCache, setCtuAnalysisCache] = useState({});
  const [allCtus, setAllCtus] = useState(false);
  const [profile, setProfile] = useState('all_intra');
  const [frames, setFrames] = useState(1);

  const checkpointAbortRef = useRef(null);
  const selectBlockAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      if (checkpointAbortRef.current) checkpointAbortRef.current.abort();
      if (selectBlockAbortRef.current) selectBlockAbortRef.current.abort();
    };
  }, []);

  // Auto-play mode loop
  useEffect(() => {
    let interval;
    if (isPlaying && data && data.length > 0) {
      interval = setInterval(() => {
        setCurrentModeIdx(prev => {
          if (prev >= data.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 750);
    }
    return () => clearInterval(interval);
  }, [isPlaying, data]);

  // Keyboard navigation shortcuts (ArrowLeft, ArrowRight, Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!data || data.length === 0) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentModeIdx(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentModeIdx(prev => Math.min(data.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data]);

  const computeDims = useCallback((origW, origH) => {
    if (!origW || !origH) return { width: 640, height: 360 };
    return {
      width: Math.max(64, Math.round(origW / 8) * 8),
      height: Math.max(64, Math.round(origH / 8) * 8)
    };
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;
          setRawImageDims({ width: origW, height: origH });
          const dims = computeDims(origW, origH);
          setImageDims(dims);
          setImagePreview(event.target.result);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(selectedFile);
      setData(null);
      setPartitionData(null);
      setSelectedCu(null);
      setRefSamples(null);
      setTransformData([]);
      setQuantData([]);
      setJobId(null);
      setCtuPartitionsMap({});
      setCtuAnalysisCache({});
    }
  }, [computeDims]);

  // Helper to fetch checkpoints for a completed job with AbortController
  const fetchCheckpoints = useCallback(async (currentJobId, targetX, targetY, targetCuSize, targetCuX = null, targetCuY = null) => {
    if (checkpointAbortRef.current) {
      checkpointAbortRef.current.abort();
    }
    const controller = new AbortController();
    checkpointAbortRef.current = controller;
    const signal = controller.signal;

    const ctuQuery = buildQuery({ ctu_x: targetX, ctu_y: targetY });
    const cuQuery = buildQuery({ ctu_x: targetX, ctu_y: targetY, cu_x: targetCuX, cu_y: targetCuY });
    const refQuery = buildQuery({ cu_size: targetCuSize, ctu_x: targetX, ctu_y: targetY, cu_x: targetCuX, cu_y: targetCuY });

    try {
      const [p, allParts, ref, transform, quant, gop, inter, recon, inloop, cabac, rdoDecs] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_01_PARTITION${ctuQuery}`, { signal }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/partitions`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_02_INTRA_REF${refQuery}`, { signal }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_04_TRANSFORM_RQT${cuQuery}`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_07_QUANT${cuQuery}`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_00_FRAME_GOP`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_03_INTER_SEARCH${ctuQuery}`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_05_RECON_PICTURE${ctuQuery}`, { signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_06_INLOOP_FILTER${ctuQuery}`, { signal }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_07_CABAC_ENTROPY?limit=300`, { signal }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/rdo-decisions${cuQuery}`, { signal }).then(r => r.ok ? r.json() : []),
      ]);

      if (signal.aborted) return {};

      if (p) {
        const keyX = p.ctu_x !== undefined ? p.ctu_x : targetX;
        const keyY = p.ctu_y !== undefined ? p.ctu_y : targetY;
        const normalized = { ...p, ctu_x: keyX, ctu_y: keyY };
        setPartitionData(normalized);
        setCtuPartitionsMap(prev => ({
          ...prev,
          [`${keyX}_${keyY}`]: normalized
        }));
      }
      if (Array.isArray(allParts) && allParts.length > 0) {
        setCtuPartitionsMap(prev => {
          const updated = { ...prev };
          allParts.forEach(part => {
            const kX = part.ctu_x !== undefined ? part.ctu_x : targetX;
            const kY = part.ctu_y !== undefined ? part.ctu_y : targetY;
            updated[`${kX}_${kY}`] = { ...part, ctu_x: kX, ctu_y: kY };
          });
          return updated;
        });
      }
      if (ref) setRefSamples(ref);
      if (Array.isArray(transform) && transform.length > 0) setTransformData(transform);
      if (Array.isArray(quant) && quant.length > 0) setQuantData(quant);
      if (Array.isArray(gop)) setFrameGopData(gop);
      if (Array.isArray(inter)) setInterSearchData(inter);
      if (Array.isArray(recon)) setReconPictureData(recon);
      if (inloop) setInloopFilterData(inloop);
      if (cabac) setCabacEntropyData(cabac);
      if (Array.isArray(rdoDecs)) setRdoDecisions(rdoDecs);
      return { p, allParts, ref, transform, quant, gop, inter, recon, inloop, cabac, rdoDecs };
    } catch (err) {
      if (err.name === 'AbortError') return {};
      throw err;
    }
  }, []);

  // Poll job status until COMPLETED or FAILED
  const pollJobCompletion = useCallback(async (currentJobId, maxAttempts = 150) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${currentJobId}`);
      if (!res.ok) {
        throw new Error(`Failed to check job status (${res.status})`);
      }
      const jobInfo = await res.json();
      if (jobInfo.status === 'COMPLETED') {
        return jobInfo;
      }
      if (jobInfo.status === 'FAILED') {
        throw new Error(jobInfo.error_message || 'Encoder execution failed');
      }
      // Wait 400ms before next poll
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw new Error('Analysis timed out after 60 seconds.');
  }, []);

  const handleUpload = useCallback(async (
    e,
    customX = null,
    customY = null,
    customCuSize = null,
    targetMode = null,
    options = {}
  ) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!file) return;

    const targetX = customX !== null ? customX : (ctuX !== null ? ctuX : 0);
    const targetY = customY !== null ? customY : (ctuY !== null ? ctuY : 0);
    const targetCuSize = customCuSize !== null ? customCuSize : (cuSize !== null ? cuSize : 8);
    const targetAllCtus = options.allCtus !== undefined ? options.allCtus : allCtus;
    const targetProfile = options.profile || profile;
    const targetFrames = options.frames || frames;

    setCtuX(targetX);
    setCtuY(targetY);
    setCuSize(targetCuSize);

    setLoading(true);
    setLoadingStatus('Submitting analysis job...');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('ctu_x', targetAllCtus ? -1 : targetX);
    formData.append('ctu_y', targetAllCtus ? -1 : targetY);
    formData.append('cu_size', targetCuSize);
    formData.append('scale_mode', 'native');
    formData.append('all_ctus', targetAllCtus ? 'true' : 'false');
    formData.append('profile', targetProfile);
    formData.append('frames', targetFrames);

    try {
      // 1. Attempt Modern Asynchronous Job Workflow (HTTP 202 + Polling)
      let currentJobId = null;
      let jobInfo = null;

      try {
        const submitRes = await fetch(`${API_BASE_URL}/api/v1/jobs/submit`, {
          method: 'POST',
          body: formData,
        });

        if (submitRes.status === 202) {
          const initJob = await submitRes.json();
          currentJobId = initJob.job_id;
          setJobId(currentJobId);
          setLoadingStatus('Running HM-18.0 Encoder & Tracing Checkpoints...');
          jobInfo = await pollJobCompletion(currentJobId);
        }
      } catch (asyncErr) {
        console.warn('Async job submission failed, falling back to synchronous /upload:', asyncErr);
      }

      // If async job succeeded:
      if (jobInfo && currentJobId) {
        setLoadingStatus('Parsing Checkpoints...');
        const modesQuery = buildQuery({ cu_size: targetCuSize, ctu_x: targetX, ctu_y: targetY });
        const modesRes = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_03_INTRA_SEARCH${modesQuery}`);
        const modesData = modesRes.ok ? await modesRes.json() : [];

        if (modesData.length > 0) {
          setData(modesData);
          if (jobInfo.frame?.width && jobInfo.frame?.height) {
            setImageDims({ width: jobInfo.frame.width, height: jobInfo.frame.height });
          }
          setAnalyzedCtu({ x: targetX, y: targetY });
          setAnalyzedCuSize(targetCuSize);

          const { ref } = await fetchCheckpoints(currentJobId, targetX, targetY, targetCuSize);

          // Update client cache for 0ms instant reload with bounded LRU
          setCtuAnalysisCache(prev => updateLruCache(prev, `${targetX}_${targetY}_${targetCuSize}`, {
            data: modesData,
            refSamples: ref || null,
            bestMode: jobInfo.best_mode,
            bestCost: jobInfo.best_cost,
            jobId: currentJobId
          }));

          // Intelligently select active mode
          if (targetMode !== null && targetMode !== undefined) {
            const idx = modesData.findIndex(d => d.mode === targetMode);
            setCurrentModeIdx(idx !== -1 ? idx : 0);
          } else {
            const prevMode = (data && data[currentModeIdx]) ? data[currentModeIdx].mode : 0;
            const idx = modesData.findIndex(d => d.mode === prevMode);
            setCurrentModeIdx(idx !== -1 ? idx : 0);
          }
          setLoading(false);
          setLoadingStatus('');
          return;
        }
      }

      // 2. Fallback to Synchronous /upload endpoint if async flow did not return data
      setLoadingStatus('Executing encoder (Synchronous fallback)...');
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      let result;
      try {
        result = await res.json();
      } catch {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Invalid response'}`);
      }

      if (res.ok && result.status === 'success' && result.data && result.data.length > 0) {
        setData(result.data);
        if (result.ref_samples) setRefSamples(result.ref_samples);
        if (result.width && result.height) setImageDims({ width: result.width, height: result.height });
        setAnalyzedCtu({ x: targetX, y: targetY });
        setAnalyzedCuSize(targetCuSize);

        setCtuAnalysisCache(prev => ({
          ...prev,
          [`${targetX}_${targetY}_${targetCuSize}`]: {
            data: result.data,
            refSamples: result.ref_samples || null,
            bestMode: result.best_mode,
            bestCost: result.best_cost,
            jobId: result.job_id
          }
        }));

        if (targetMode !== null && targetMode !== undefined) {
          const idx = result.data.findIndex(d => d.mode === targetMode);
          setCurrentModeIdx(idx !== -1 ? idx : 0);
        } else {
          const prevMode = (data && data[currentModeIdx]) ? data[currentModeIdx].mode : 0;
          const idx = result.data.findIndex(d => d.mode === prevMode);
          setCurrentModeIdx(idx !== -1 ? idx : 0);
        }

        const legacyJobId = result.job_id;
        if (legacyJobId) {
          setJobId(legacyJobId);
          fetchCheckpoints(legacyJobId, targetX, targetY, targetCuSize).catch(err => console.warn(err));
        }
      } else {
        const errorDetail = result?.detail || result?.message || 'Failed to extract Intra Search data from HM encoder.';
        setErrorMsg(errorDetail);
      }
    } catch (err) {
      console.error('Upload failed', err);
      setErrorMsg(err.message?.includes('Server returned') ? err.message : `Cannot connect to backend server (${API_BASE_URL || 'localhost:8000'}).`);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }, [file, ctuX, ctuY, cuSize, data, currentModeIdx, pollJobCompletion, fetchCheckpoints, allCtus, profile, frames]);

  const safeModeIdx = (data && data.length > 0) ? Math.min(Math.max(0, currentModeIdx), data.length - 1) : 0;
  const currentMode = (data && data.length > 0) ? data[safeModeIdx] : null;
  const currentModeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const handleResetImage = useCallback(() => {
    setData(null);
    setIsPlaying(false);
    setPartitionData(null);
    setSelectedCu(null);
    setRefSamples(null);
    setTransformData([]);
    setQuantData([]);
    setFrameGopData([]);
    setInterSearchData([]);
    setReconPictureData([]);
    setInloopFilterData(null);
    setCabacEntropyData(null);
    setRdoDecisions([]);
    setJobId(null);
    setErrorMsg(null);
    setCtuPartitionsMap({});
    setCtuAnalysisCache({});
  }, []);

  const handleSelectCU = useCallback((cu) => {
    setSelectedCu(prev => {
      if (!cu) return null;
      if (prev && prev.x === cu.x && prev.y === cu.y && prev.width === cu.width) {
        return null;
      }
      return cu;
    });
    if (cu && jobId) {
      const cuPosX = cu.abs_x ?? cu.x;
      const cuPosY = cu.abs_y ?? cu.y;
      fetchCheckpoints(jobId, ctuX, ctuY, cu.width || cuSize, cuPosX, cuPosY).catch(() => {});
    }
  }, [jobId, ctuX, ctuY, cuSize, fetchCheckpoints]);

  const handleSelectCTU = useCallback((x, y) => {
    setCtuX(x);
    setCtuY(y);
    if (x === null || y === null) {
      return;
    }

    // Guard against desynchronized selectedCu belonging to a different CTU
    setSelectedCu(prev => {
      if (!prev) return null;
      const ctuOriginX = x * 64;
      const ctuOriginY = y * 64;
      const px = prev.abs_x ?? prev.x;
      const py = prev.abs_y ?? prev.y;
      if (typeof px === 'number' && typeof py === 'number') {
        if (px < ctuOriginX || px >= ctuOriginX + 64 || py < ctuOriginY || py >= ctuOriginY + 64) {
          return null;
        }
      }
      return prev;
    });

    const cachedPart = ctuPartitionsMap[`${x}_${y}`];
    if (cachedPart) {
      setPartitionData(cachedPart);
    }

    if (jobId) {
      fetchCheckpoints(jobId, x, y, cuSize).catch(() => {});
    }

    // Instant restoration from analysis cache if this CTU was previously analyzed
    const cachedAnalysis = ctuAnalysisCache[`${x}_${y}_${cuSize}`];
    if (cachedAnalysis) {
      setData(cachedAnalysis.data);
      if (cachedAnalysis.refSamples) setRefSamples(cachedAnalysis.refSamples);
      if (cachedAnalysis.jobId) setJobId(cachedAnalysis.jobId);
      setAnalyzedCtu({ x, y });
    }
  }, [ctuPartitionsMap, ctuAnalysisCache, cuSize, jobId, fetchCheckpoints]);

  const handleSelectBlock = useCallback(async ({ size, relX = 0, relY = 0, absX = null, absY = null, cu = null }) => {
    const targetSize = size || cu?.width || cuSize || 8;
    const resolvedRelX = (typeof relX === 'number') ? relX : (cu?.x ?? 0);
    const resolvedRelY = (typeof relY === 'number') ? relY : (cu?.y ?? 0);
    const resolvedAbsX = (absX !== null && absX !== undefined)
      ? absX
      : (typeof cu?.abs_x === 'number' ? cu.abs_x : (ctuX ?? 0) * 64 + resolvedRelX);
    const resolvedAbsY = (absY !== null && absY !== undefined)
      ? absY
      : (typeof cu?.abs_y === 'number' ? cu.abs_y : (ctuY ?? 0) * 64 + resolvedRelY);

    const normalizedCu = {
      ...(cu || {}),
      x: resolvedRelX,
      y: resolvedRelY,
      abs_x: resolvedAbsX,
      abs_y: resolvedAbsY,
      width: targetSize,
      height: targetSize,
      size: targetSize,
      ctu_x: ctuX,
      ctu_y: ctuY
    };

    setSelectedCu(normalizedCu);
    setCuSize(targetSize);
    setAnalyzedCuSize(targetSize);

    const cacheKey = `${ctuX}_${ctuY}_${targetSize}_${resolvedAbsX}_${resolvedAbsY}`;
    const cachedAnalysis = ctuAnalysisCache[cacheKey] || ctuAnalysisCache[`${ctuX}_${ctuY}_${targetSize}`];
    if (cachedAnalysis) {
      setData(cachedAnalysis.data);
      if (cachedAnalysis.refSamples) setRefSamples(cachedAnalysis.refSamples);
      return;
    }

    if (jobId) {
      if (selectBlockAbortRef.current) {
        selectBlockAbortRef.current.abort();
      }
      const controller = new AbortController();
      selectBlockAbortRef.current = controller;
      const signal = controller.signal;

      try {
        // Queries backend with specific cu_x=${resolvedAbsX} and cu_y=${resolvedAbsY} coordinates
        const queryWithCu = buildQuery({ cu_size: targetSize, ctu_x: ctuX, ctu_y: ctuY, cu_x: resolvedAbsX, cu_y: resolvedAbsY });
        const queryCtuOnly = buildQuery({ cu_size: targetSize, ctu_x: ctuX, ctu_y: ctuY });
        const [modesRes, refRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_03_INTRA_SEARCH${queryWithCu}`, { signal }),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_02_INTRA_REF${queryWithCu}`, { signal })
        ]);
        let modesData = modesRes.ok ? await modesRes.json() : [];
        let refData = refRes.ok ? await refRes.json() : null;

        if (!modesData || modesData.length === 0) {
          const fallbackRes = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_03_INTRA_SEARCH${queryCtuOnly}`, { signal });
          if (fallbackRes.ok) modesData = await fallbackRes.json();
        }
        if (!refData) {
          const fallbackRef = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_02_INTRA_REF${queryCtuOnly}`, { signal });
          if (fallbackRef.ok) refData = await fallbackRef.json();
        }

        if (signal.aborted) return;

        if (modesData && modesData.length > 0) {
          setData(modesData);
          if (refData) setRefSamples(refData);
          setCtuAnalysisCache(prev => updateLruCache(prev, cacheKey, {
            data: modesData,
            refSamples: refData,
            jobId
          }));
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Failed to switch block position checkpoints:', err);
      }
    }
  }, [ctuX, ctuY, cuSize, ctuAnalysisCache, jobId]);

  const handleSelectSize = useCallback(async (newSize) => {
    if (!newSize || newSize <= 0) return;
    const currentRelX = selectedCu ? (selectedCu.abs_x !== undefined ? selectedCu.abs_x % 64 : (selectedCu.x ?? 0)) : 0;
    const currentRelY = selectedCu ? (selectedCu.abs_y !== undefined ? selectedCu.abs_y % 64 : (selectedCu.y ?? 0)) : 0;
    const snappedRelX = Math.min(64 - newSize, Math.floor(currentRelX / newSize) * newSize);
    const snappedRelY = Math.min(64 - newSize, Math.floor(currentRelY / newSize) * newSize);

    return handleSelectBlock({
      size: newSize,
      relX: snappedRelX,
      relY: snappedRelY
    });
  }, [selectedCu, handleSelectBlock]);

  const hasDesync = Boolean(data && ctuX !== null && ctuY !== null && (ctuX !== analyzedCtu.x || ctuY !== analyzedCtu.y));

  return {
    file,
    imagePreview,
    rawImageDims,
    imageDims,
    loading,
    loadingStatus,
    errorMsg,
    setErrorMsg,
    data,
    refSamples,
    currentModeIdx,
    setCurrentModeIdx,
    currentMode,
    currentModeInfo,
    isPlaying,
    setIsPlaying,
    ctuX,
    ctuY,
    analyzedCtu,
    cuSize,
    setCuSize,
    analyzedCuSize,
    activeStageTab,
    setActiveStageTab,
    jobId,
    partitionData,
    setPartitionData,
    transformData,
    quantData,
    frameGopData,
    interSearchData,
    reconPictureData,
    inloopFilterData,
    cabacEntropyData,
    rdoDecisions,
    setRdoDecisions,
    selectedCu,
    setSelectedCu,
    ctuPartitionsMap,
    hasDesync,
    allCtus,
    setAllCtus,
    profile,
    setProfile,
    frames,
    setFrames,
    API_BASE_URL,
    handleFileChange,
    handleUpload,
    handleResetImage,
    handleSelectCU,
    handleSelectCTU,
    handleSelectSize,
    handleSelectBlock,
  };
}
