import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';
import { resolveCuCoordinates, normalizeCuNode } from '../utils/cuCoordinates.js';

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
  const [cuDetailsCache, setCuDetailsCache] = useState({});
  const [allCtus, setAllCtus] = useState(false);
  const [profile, setProfile] = useState('all_intra');
  const [frames, setFrames] = useState(1);

  const checkpointAbortRef = useRef(null);
  const ctuAbortRef = useRef(null);
  const cuAbortRef = useRef(null);
  const selectBlockAbortRef = useRef(null);
  const pollingAbortRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const jobScopePromiseRef = useRef(null);
  const loadedJobIdRef = useRef(null);

  useEffect(() => {
    return () => {
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      checkpointAbortRef.current?.abort();
      ctuAbortRef.current?.abort();
      cuAbortRef.current?.abort();
      selectBlockAbortRef.current?.abort();
      pollingAbortRef.current?.abort();
      uploadAbortRef.current?.abort();
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
      setCuDetailsCache({});
      loadedJobIdRef.current = null;
      jobScopePromiseRef.current = null;
    }
  }, [computeDims]);

  // 1. Job Scope Checkpoint Fetcher (CP_00_FRAME_GOP, partitions, CP_07_CABAC_ENTROPY)
  const fetchJobCheckpoints = useCallback(async (currentJobId) => {
    if (!currentJobId) return { gop: [], allParts: [], cabac: null };
    if (loadedJobIdRef.current === currentJobId) {
      return { gop: frameGopData, allParts: Object.values(ctuPartitionsMap), cabac: cabacEntropyData };
    }
    if (jobScopePromiseRef.current) {
      return jobScopePromiseRef.current;
    }

    const jobPromise = (async () => {
      try {
        const [gopRes, partsRes, cabacRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_00_FRAME_GOP`),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/partitions`),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_07_CABAC_ENTROPY?limit=300`),
        ]);

        let gop = [];
        if (gopRes.status === 'fulfilled' && gopRes.value.ok) {
          gop = await gopRes.value.json();
          if (Array.isArray(gop)) setFrameGopData(gop);
        }

        let allParts = [];
        if (partsRes.status === 'fulfilled' && partsRes.value.ok) {
          allParts = await partsRes.value.json();
          if (Array.isArray(allParts) && allParts.length > 0) {
            setCtuPartitionsMap(prev => {
              const updated = { ...prev };
              allParts.forEach(part => {
                const kX = part.ctu_x !== undefined ? part.ctu_x : 0;
                const kY = part.ctu_y !== undefined ? part.ctu_y : 0;
                updated[`${kX}_${kY}`] = { ...part, ctu_x: kX, ctu_y: kY };
              });
              return updated;
            });
          }
        }

        let cabac = null;
        if (cabacRes.status === 'fulfilled' && cabacRes.value.ok) {
          cabac = await cabacRes.value.json();
          if (cabac) setCabacEntropyData(cabac);
        }

        loadedJobIdRef.current = currentJobId;
        return { gop, allParts, cabac };
      } finally {
        jobScopePromiseRef.current = null;
      }
    })();

    jobScopePromiseRef.current = jobPromise;
    return jobPromise;
  }, [frameGopData, ctuPartitionsMap, cabacEntropyData]);

  // 2. CTU Scope Checkpoint Fetcher (CP_01_PARTITION, CP_03_INTER_SEARCH, CP_05_RECON_PICTURE, CP_06_INLOOP_FILTER)
  const fetchCtuCheckpoints = useCallback(async (currentJobId, targetX, targetY) => {
    if (!currentJobId || targetX === null || targetY === null) return {};
    if (ctuAbortRef.current) {
      ctuAbortRef.current.abort();
    }
    const controller = new AbortController();
    ctuAbortRef.current = controller;
    const signal = controller.signal;

    const ctuQuery = buildQuery({ ctu_x: targetX, ctu_y: targetY });

    try {
      const [pRes, interRes, reconRes, inloopRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_01_PARTITION${ctuQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_03_INTER_SEARCH${ctuQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_05_RECON_PICTURE${ctuQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_06_INLOOP_FILTER${ctuQuery}`, { signal }),
      ]);

      if (signal.aborted) return {};

      let p = null;
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        p = await pRes.value.json();
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
      }

      let inter = [];
      if (interRes.status === 'fulfilled' && interRes.value.ok) {
        inter = await interRes.value.json();
        if (Array.isArray(inter)) setInterSearchData(inter);
      }

      let recon = [];
      if (reconRes.status === 'fulfilled' && reconRes.value.ok) {
        recon = await reconRes.value.json();
        if (Array.isArray(recon)) setReconPictureData(recon);
      }

      let inloop = null;
      if (inloopRes.status === 'fulfilled' && inloopRes.value.ok) {
        inloop = await inloopRes.value.json();
        if (inloop) setInloopFilterData(inloop);
      }

      return { p, inter, recon, inloop };
    } catch (err) {
      if (err.name === 'AbortError') return {};
      throw err;
    }
  }, []);

  // 3. CU Scope Checkpoint Fetcher (CP_02_INTRA_REF, CP_04_TRANSFORM_RQT, CP_07_QUANT, rdo-decisions)
  const fetchCuCheckpoints = useCallback(async (currentJobId, targetX, targetY, targetCuSize, targetCuX = null, targetCuY = null) => {
    if (!currentJobId) return {};

    const cacheKey = `${currentJobId}_${targetX}_${targetY}_${targetCuSize}_${targetCuX ?? 'none'}_${targetCuY ?? 'none'}`;
    const cachedDetails = cuDetailsCache[cacheKey];
    if (cachedDetails) {
      if (cachedDetails.transform) setTransformData(cachedDetails.transform);
      if (cachedDetails.quant) setQuantData(cachedDetails.quant);
      if (cachedDetails.rdoDecs) setRdoDecisions(cachedDetails.rdoDecs);
      if (cachedDetails.ref) setRefSamples(cachedDetails.ref);
      return cachedDetails;
    }

    if (cuAbortRef.current) {
      cuAbortRef.current.abort();
    }
    const controller = new AbortController();
    cuAbortRef.current = controller;
    const signal = controller.signal;

    const cuQuery = buildQuery({ ctu_x: targetX, ctu_y: targetY, cu_x: targetCuX, cu_y: targetCuY });
    const refQuery = buildQuery({ cu_size: targetCuSize, ctu_x: targetX, ctu_y: targetY, cu_x: targetCuX, cu_y: targetCuY });

    try {
      const [refRes, transformRes, quantRes, rdoRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_02_INTRA_REF${refQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_04_TRANSFORM_RQT${cuQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_07_QUANT${cuQuery}`, { signal }),
        fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/rdo-decisions${cuQuery}`, { signal }),
      ]);

      if (signal.aborted) return {};

      let ref = null;
      if (refRes.status === 'fulfilled' && refRes.value.ok) {
        ref = await refRes.value.json();
        if (ref) setRefSamples(ref);
      }

      let transform = [];
      if (transformRes.status === 'fulfilled' && transformRes.value.ok) {
        transform = await transformRes.value.json();
        if (Array.isArray(transform)) setTransformData(transform);
      }

      let quant = [];
      if (quantRes.status === 'fulfilled' && quantRes.value.ok) {
        quant = await quantRes.value.json();
        if (Array.isArray(quant)) setQuantData(quant);
      }

      let rdoDecs = [];
      if (rdoRes.status === 'fulfilled' && rdoRes.value.ok) {
        rdoDecs = await rdoRes.value.json();
        if (Array.isArray(rdoDecs)) setRdoDecisions(rdoDecs);
      }

      const result = { ref, transform, quant, rdoDecs };
      setCuDetailsCache(prev => updateLruCache(prev, cacheKey, result, 30));
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return {};
      throw err;
    }
  }, [cuDetailsCache]);

  // 4. Combined Tier Coordinator (Backwards Compatible)
  const fetchCheckpoints = useCallback(async (currentJobId, targetX, targetY, targetCuSize, targetCuX = null, targetCuY = null) => {
    const [jobRes, ctuRes, cuRes] = await Promise.all([
      fetchJobCheckpoints(currentJobId),
      fetchCtuCheckpoints(currentJobId, targetX, targetY),
      fetchCuCheckpoints(currentJobId, targetX, targetY, targetCuSize, targetCuX, targetCuY),
    ]);
    return {
      p: ctuRes.p,
      allParts: jobRes.allParts,
      ref: cuRes.ref,
      transform: cuRes.transform,
      quant: cuRes.quant,
      gop: jobRes.gop,
      inter: ctuRes.inter,
      recon: ctuRes.recon,
      inloop: ctuRes.inloop,
      cabac: jobRes.cabac,
      rdoDecs: cuRes.rdoDecs
    };
  }, [fetchJobCheckpoints, fetchCtuCheckpoints, fetchCuCheckpoints]);

  // Poll job status until COMPLETED or FAILED with AbortSignal cancellation support
  const pollJobCompletion = useCallback(async (currentJobId, signal = null, maxAttempts = 150) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) return null;
      const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${currentJobId}`, { signal });
      if (!res.ok) {
        throw new Error(`Failed to check job status (${res.status})`);
      }
      const jobInfo = await res.json();
      if (signal?.aborted) return null;
      if (jobInfo.status === 'COMPLETED') {
        return jobInfo;
      }
      if (jobInfo.status === 'FAILED') {
        throw new Error(jobInfo.error_message || 'Encoder execution failed');
      }
      // Wait 400ms before next poll with abort event handling
      await new Promise(resolve => {
        if (signal?.aborted) return resolve();
        const timeout = setTimeout(resolve, 400);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
      if (signal?.aborted) return null;
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

    // Abort any prior in-flight upload or polling to prevent race conditions
    uploadAbortRef.current?.abort();
    pollingAbortRef.current?.abort();
    const uploadController = new AbortController();
    uploadAbortRef.current = uploadController;
    const pollingController = new AbortController();
    pollingAbortRef.current = pollingController;
    const uploadSignal = uploadController.signal;
    const pollingSignal = pollingController.signal;

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
          signal: uploadSignal,
        });

        if (uploadSignal.aborted) return;

        if (submitRes.status === 202) {
          const initJob = await submitRes.json();
          currentJobId = initJob.job_id;
          setJobId(currentJobId);
          setLoadingStatus('Running HM-18.0 Encoder & Tracing Checkpoints...');
          jobInfo = await pollJobCompletion(currentJobId, pollingSignal);
          if (pollingSignal.aborted || !jobInfo) {
            return;
          }
        }
      } catch (asyncErr) {
        if (asyncErr.name === 'AbortError' || uploadSignal.aborted || pollingSignal.aborted) {
          return;
        }
        console.warn('Async job submission failed, falling back to synchronous /upload:', asyncErr);
      }

      // If async job succeeded:
      if (jobInfo && currentJobId) {
        if (uploadSignal.aborted || pollingSignal.aborted) return;
        setLoadingStatus('Parsing Checkpoints...');
        const modesQuery = buildQuery({ cu_size: targetCuSize, ctu_x: targetX, ctu_y: targetY });
        const modesRes = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_03_INTRA_SEARCH${modesQuery}`, { signal: uploadSignal });
        const modesData = modesRes.ok ? await modesRes.json() : [];

        if (uploadSignal.aborted) return;

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

      if (uploadSignal.aborted) return;

      // 2. Fallback to Synchronous /upload endpoint if async flow did not return data
      setLoadingStatus('Executing encoder (Synchronous fallback)...');
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        signal: uploadSignal,
      });

      if (uploadSignal.aborted) return;

      let result;
      try {
        result = await res.json();
      } catch {
        if (uploadSignal.aborted) return;
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Invalid response'}`);
      }

      if (uploadSignal.aborted) return;

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
      if (err.name === 'AbortError' || uploadSignal.aborted) return;
      console.error('Upload failed', err);
      setErrorMsg(err.message?.includes('Server returned') ? err.message : `Cannot connect to backend server (${API_BASE_URL || 'localhost:8000'}).`);
    } finally {
      if (!uploadSignal.aborted) {
        setLoading(false);
        setLoadingStatus('');
      }
    }
  }, [file, ctuX, ctuY, cuSize, data, currentModeIdx, pollJobCompletion, fetchCheckpoints, allCtus, profile, frames]);

  const safeModeIdx = (data && data.length > 0) ? Math.min(Math.max(0, currentModeIdx), data.length - 1) : 0;
  const currentMode = (data && data.length > 0) ? data[safeModeIdx] : null;
  const currentModeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const handleResetImage = useCallback(() => {
    pollingAbortRef.current?.abort();
    uploadAbortRef.current?.abort();
    checkpointAbortRef.current?.abort();
    ctuAbortRef.current?.abort();
    cuAbortRef.current?.abort();
    selectBlockAbortRef.current?.abort();
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
    setCuDetailsCache({});
    loadedJobIdRef.current = null;
    jobScopePromiseRef.current = null;
  }, []);

  const handleSelectCU = useCallback(async (cu) => {
    if (!cu) {
      setSelectedCu(null);
      return;
    }
    const targetSize = cu.width || cu.size || cuSize || 8;
    const normalizedCu = normalizeCuNode(cu, ctuX, ctuY, targetSize);
    if (!normalizedCu) {
      setSelectedCu(null);
      return;
    }

    setSelectedCu(normalizedCu);
    setCuSize(targetSize);
    setAnalyzedCuSize(targetSize);

    const targetAbsX = normalizedCu.abs_x;
    const targetAbsY = normalizedCu.abs_y;
    const cacheKey = `${ctuX}_${ctuY}_${targetSize}_${targetAbsX}_${targetAbsY}`;
    const cachedAnalysis = ctuAnalysisCache[cacheKey];

    if (cachedAnalysis) {
      if (Array.isArray(cachedAnalysis.data) && cachedAnalysis.data.length > 0) setData(cachedAnalysis.data);
      if (cachedAnalysis.refSamples) setRefSamples(cachedAnalysis.refSamples);
      if (Array.isArray(cachedAnalysis.transform)) setTransformData(cachedAnalysis.transform);
      if (Array.isArray(cachedAnalysis.quant)) setQuantData(cachedAnalysis.quant);
      if (Array.isArray(cachedAnalysis.rdoDecs)) setRdoDecisions(cachedAnalysis.rdoDecs);

      const targetMode = cu.intra_dir;
      if (targetMode !== null && targetMode !== undefined && Array.isArray(cachedAnalysis.data) && cachedAnalysis.data.length > 0) {
        const mIdx = cachedAnalysis.data.findIndex(m => m.mode === targetMode);
        if (mIdx !== -1) setCurrentModeIdx(mIdx);
      }
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
        // Queries backend with specific cu_x=${targetAbsX} and cu_y=${targetAbsY} coordinates
        const cuQuery = buildQuery({ cu_size: targetSize, ctu_x: ctuX, ctu_y: ctuY, cu_x: targetAbsX, cu_y: targetAbsY });
        const ctuOnlyQuery = buildQuery({ cu_size: targetSize, ctu_x: ctuX, ctu_y: ctuY });

        const [modesRes, refRes, transformRes, quantRes, rdoRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_03_INTRA_SEARCH${cuQuery}`, { signal }),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_02_INTRA_REF${cuQuery}`, { signal }),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_04_TRANSFORM_RQT${cuQuery}`, { signal }),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_07_QUANT${cuQuery}`, { signal }),
          fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/rdo-decisions${cuQuery}`, { signal }),
        ]);

        if (signal.aborted) return;

        let modesData = (modesRes.status === 'fulfilled' && modesRes.value.ok) ? await modesRes.value.json() : [];
        let refData = (refRes.status === 'fulfilled' && refRes.value.ok) ? await refRes.value.json() : null;

        // Fallback to CTU-level query if block-specific query returned empty
        if ((!modesData || modesData.length === 0) && !signal.aborted) {
          const fallbackRes = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_03_INTRA_SEARCH${ctuOnlyQuery}`, { signal });
          if (fallbackRes.ok) modesData = await fallbackRes.json();
        }
        if (!refData && !signal.aborted) {
          const fallbackRef = await fetch(`${API_BASE_URL}/api/v1/checkpoints/${jobId}/CP_02_INTRA_REF${ctuOnlyQuery}`, { signal });
          if (fallbackRef.ok) refData = await fallbackRef.json();
        }

        if (signal.aborted) return;

        let transform = [];
        if (transformRes.status === 'fulfilled' && transformRes.value.ok) {
          transform = await transformRes.value.json();
          if (Array.isArray(transform)) setTransformData(transform);
        }

        let quant = [];
        if (quantRes.status === 'fulfilled' && quantRes.value.ok) {
          quant = await quantRes.value.json();
          if (Array.isArray(quant)) setQuantData(quant);
        }

        let rdoDecs = [];
        if (rdoRes.status === 'fulfilled' && rdoRes.value.ok) {
          rdoDecs = await rdoRes.value.json();
          if (Array.isArray(rdoDecs)) setRdoDecisions(rdoDecs);
        }

        if (Array.isArray(modesData) && modesData.length > 0) {
          setData(modesData);
          const targetMode = cu.intra_dir;
          if (targetMode !== null && targetMode !== undefined) {
            const mIdx = modesData.findIndex(m => m.mode === targetMode);
            if (mIdx !== -1) setCurrentModeIdx(mIdx);
          }
        }
        if (refData) setRefSamples(refData);

        const cachePayload = {
          data: (Array.isArray(modesData) && modesData.length > 0) ? modesData : (data || []),
          refSamples: refData,
          transform,
          quant,
          rdoDecs,
          jobId
        };
        setCtuAnalysisCache(prev => updateLruCache(prev, cacheKey, cachePayload));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Failed to switch block position checkpoints:', err);
        }
      }
    }
  }, [ctuX, ctuY, cuSize, ctuAnalysisCache, jobId, data]);

  const handleSelectCTU = useCallback((x, y) => {
    setCtuX(x);
    setCtuY(y);
    if (x === null || y === null) {
      return;
    }

    // Guard against desynchronized selectedCu belonging to a different CTU
    setSelectedCu(prev => {
      if (!prev) return null;
      if (prev.ctu_x !== undefined && prev.ctu_x !== x) return null;
      if (prev.ctu_y !== undefined && prev.ctu_y !== y) return null;
      const ctuOriginX = x * 64;
      const ctuOriginY = y * 64;
      const px = prev.abs_x;
      const py = prev.abs_y;
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
      fetchCtuCheckpoints(jobId, x, y).catch(() => {});
    }

    // Instant restoration from analysis cache if this CTU was previously analyzed
    const cachedAnalysis = ctuAnalysisCache[`${x}_${y}_${cuSize}`];
    if (cachedAnalysis) {
      if (Array.isArray(cachedAnalysis.data) && cachedAnalysis.data.length > 0) {
        setData(cachedAnalysis.data);
      }
      if (cachedAnalysis.refSamples) setRefSamples(cachedAnalysis.refSamples);
      if (cachedAnalysis.jobId) setJobId(cachedAnalysis.jobId);
      setAnalyzedCtu({ x, y });
    }
  }, [ctuPartitionsMap, ctuAnalysisCache, cuSize, jobId, fetchCtuCheckpoints]);

  const handleSelectBlock = useCallback(async ({ size, relX = null, relY = null, absX = null, absY = null, cu = null }) => {
    const targetSize = size || cu?.width || cuSize || 8;
    const baseCu = cu ? { ...cu } : {};
    if (typeof relX === 'number') baseCu.x = relX;
    if (typeof relY === 'number') baseCu.y = relY;
    if (typeof absX === 'number') baseCu.abs_x = absX;
    if (typeof absY === 'number') baseCu.abs_y = absY;
    baseCu.width = targetSize;
    baseCu.height = targetSize;
    baseCu.size = targetSize;

    return handleSelectCU(baseCu);
  }, [cuSize, handleSelectCU]);

  const handleSelectSize = useCallback(async (newSize) => {
    if (!newSize || newSize <= 0) return;
    const { relX, relY } = resolveCuCoordinates(selectedCu, ctuX, ctuY, newSize);
    const snappedRelX = Math.min(64 - newSize, Math.floor(relX / newSize) * newSize);
    const snappedRelY = Math.min(64 - newSize, Math.floor(relY / newSize) * newSize);

    return handleSelectBlock({
      size: newSize,
      relX: snappedRelX,
      relY: snappedRelY,
      cu: selectedCu ? { ...selectedCu, width: newSize, height: newSize } : null
    });
  }, [selectedCu, ctuX, ctuY, handleSelectBlock]);

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
    fetchJobCheckpoints,
    fetchCtuCheckpoints,
    fetchCuCheckpoints,
    fetchCheckpoints,
    handleFileChange,
    handleUpload,
    handleResetImage,
    handleSelectCU,
    handleSelectCTU,
    handleSelectSize,
    handleSelectBlock,
  };
}
