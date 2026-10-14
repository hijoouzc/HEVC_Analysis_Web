#include "VisualDumper.h"

#include "TComDataCU.h"
#include "TComPic.h"
#include "TComSlice.h"
#include "TComRom.h"

#include <cstdlib>
#include <cstdio>
#include <string>
#include <sys/stat.h>

namespace
{
Bool readIntegerEnv(const char* name, Int& value)
{
  const char* text = std::getenv(name);
  if (text == NULL || *text == '\0')
  {
    return false;
  }

  char* end = NULL;
  const long parsed = std::strtol(text, &end, 10);
  if (end == text || *end != '\0' || parsed < -1 || parsed > 0x7fffffffL)
  {
    return false;
  }

  value = static_cast<Int>(parsed);
  return true;
}

inline std::string makeBlockKey(Int poc, Int ctuX, Int ctuY, Int cuDepth, Int absZscan, Int puIdx = 0, Int tuDepth = 0)
{
  char buf[64];
  std::snprintf(buf, sizeof(buf), "%04d/%03d_%03d/%d/%04d/%d/%d", poc, ctuX, ctuY, cuDepth, absZscan, puIdx, tuDepth);
  return std::string(buf);
}

template<typename T>
Void writeArray(std::ostream& out, const T* values, Int width, Int height, Int stride)
{
  out << '[';
  Bool first = true;
  if (values != NULL)
  {
    for (Int y = 0; y < height; ++y)
    {
      for (Int x = 0; x < width; ++x)
      {
        if (!first) out << ',';
        out << values[y * stride + x];
        first = false;
      }
    }
  }
  out << ']';
}

Void dumpCUNode(std::ostream& out, TComDataCU* cu, UInt absPartIdx, UInt depth, Bool& first)
{
  const TComSPS& sps = *(cu->getSlice()->getSPS());
  const UInt width = sps.getMaxCUWidth() >> depth;
  const UInt height = sps.getMaxCUHeight() >> depth;
  const UInt x = cu->getCUPelX() + g_auiRasterToPelX[g_auiZscanToRaster[absPartIdx]];
  const UInt y = cu->getCUPelY() + g_auiRasterToPelY[g_auiZscanToRaster[absPartIdx]];

  if (x >= sps.getPicWidthInLumaSamples() || y >= sps.getPicHeightInLumaSamples())
  {
    return;
  }

  const UChar cuDepth = cu->getDepth(absPartIdx);
  const Bool isSplit = (depth < cuDepth) && (depth < sps.getLog2DiffMaxMinCodingBlockSize());
  if (!first) out << ',';
  first = false;

  out << "{\"depth\":" << depth
      << ",\"x\":" << x
      << ",\"y\":" << y
      << ",\"width\":" << width
      << ",\"height\":" << height
      << ",\"split\":" << (isSplit ? "true" : "false");

  if (!isSplit)
  {
    const PredMode mode = cu->getPredictionMode(absPartIdx);
    const char* modeName = mode == MODE_INTRA ? "INTRA" : (mode == MODE_INTER ? "INTER" : "SKIP");
    out << ",\"mode\":\"" << modeName << '\"';
    if (mode == MODE_INTRA)
    {
      out << ",\"intra_dir\":" << static_cast<Int>(cu->getIntraDir(CHANNEL_TYPE_LUMA, absPartIdx));
    }
    out << ",\"qp\":" << static_cast<Int>(cu->getQP(absPartIdx));
    out << ",\"cost\":" << cu->getTotalCost();
  }
  out << '}';

  if (isSplit)
  {
    const UInt quarterParts = (cu->getPic()->getNumPartitionsInCtu() >> (depth << 1)) >> 2;
    for (UInt child = 0; child < 4; ++child)
    {
      dumpCUNode(out, cu, absPartIdx + child * quarterParts, depth + 1, first);
    }
  }
}
}

VisualDumper::VisualDumper()
  : m_enabled(false),
    m_targetPOC(-1),
    m_targetCtuX(0),
    m_targetCtuY(0),
    m_targetCuSize(8),
    m_filterPuPosition(false),
    m_targetPuX(0),
    m_targetPuY(0)
{
  readIntegerEnv("VISUAL_POC", m_targetPOC);
  const Bool hasX = readIntegerEnv("VISUAL_CTU_X", m_targetCtuX);
  const Bool hasY = readIntegerEnv("VISUAL_CTU_Y", m_targetCtuY);
  Int requestedCuSize = m_targetCuSize;
  const char* cuSizeText = std::getenv("VISUAL_CU_SIZE");
  const Bool validCuSize = cuSizeText == NULL
                        || (readIntegerEnv("VISUAL_CU_SIZE", requestedCuSize) && requestedCuSize >= 0);
  const char* puXText = std::getenv("VISUAL_PU_X");
  const char* puYText = std::getenv("VISUAL_PU_Y");
  const Bool hasPuX = readIntegerEnv("VISUAL_PU_X", m_targetPuX);
  const Bool hasPuY = readIntegerEnv("VISUAL_PU_Y", m_targetPuY);
  const Bool validPuX = puXText == NULL || hasPuX;
  const Bool validPuY = puYText == NULL || hasPuY;
  m_enabled = hasX && hasY && validCuSize && validPuX && validPuY && (hasPuX == hasPuY);
  if (!m_enabled)
  {
    return;
  }
  m_filterPuPosition = hasPuX && hasPuY;
  m_targetCuSize = requestedCuSize;

  const char* configuredOutputDir = std::getenv("VISUAL_OUTPUT_DIR");
  std::string outputDir = (configuredOutputDir != NULL && *configuredOutputDir != '\0')
                        ? configuredOutputDir : "dump_data";
  if (outputDir[outputDir.length() - 1] != '/')
  {
    outputDir += '/';
  }
  mkdir(outputDir.c_str(), 0777);
  m_outFile.open((outputDir + "trace.jsonl").c_str(), std::ios::out | std::ios::trunc);
  m_enabled = m_outFile.is_open();
}

VisualDumper::~VisualDumper()
{
  if (m_outFile.is_open())
  {
    m_outFile.flush();
    m_outFile.close();
  }
}

Void VisualDumper::dumpFrameGOP(Int poc, Int sliceType, Int qp, Int temporalId,
                                Int numRefL0, const Int* pRefL0,
                                Int numRefL1, const Int* pRefL1)
{
  if (!m_enabled || !m_outFile.is_open())
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  const char* sliceTypeName = (sliceType == B_SLICE ? "B" : (sliceType == P_SLICE ? "P" : "I"));
  m_outFile << "{\"event\":\"FRAME_GOP\",\"stage\":\"CP_00_FRAME_GOP\""
            << ",\"poc\":" << poc
            << ",\"slice_type\":\"" << sliceTypeName << '\"'
            << ",\"qp\":" << qp
            << ",\"temporal_id\":" << temporalId
            << ",\"ref_l0\":";
  writeArray(m_outFile, pRefL0, numRefL0, 1, numRefL0);
  m_outFile << ",\"ref_l1\":";
  writeArray(m_outFile, pRefL1, numRefL1, 1, numRefL1);
  m_outFile << "}\n";
}

Void VisualDumper::dumpCuRdoDecision(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                     Double costNoSplit, Double costSplit, Bool splitDecision,
                                     Int bestMode)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"CU_RDO_DECISION\",\"stage\":\"CP_01_CU_QUADTREE_RDO\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
            << ",\"cu_size\":" << cuSize << ",\"depth\":" << depth
            << ",\"cost_nosplit\":" << costNoSplit
            << ",\"cost_split\":" << costSplit
            << ",\"split_decision\":" << (splitDecision ? "true" : "false")
            << ",\"best_mode\":" << bestMode
            << "}\n";
}

Void VisualDumper::dumpIntraRefSamples(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                       const Pel* refUnfiltered, const Pel* refFiltered,
                                       Int refStride, Bool strongSmoothingEligible,
                                       const Pel* pRefUnfiltU, const Pel* pRefFiltU,
                                       const Pel* pRefUnfiltV, const Pel* pRefFiltV,
                                       Int refStrideC)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize) || refStride <= 0)
  {
    return;
  }

  const Int cSize = (puSize >> 1);
  const Int cStride = (refStrideC > 0 ? refStrideC : (2 * cSize + 1));

  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"INTRA_REF_SAMPLES\",\"stage\":\"CP_02_INTRA_REF\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_size\":" << puSize
            << ",\"cu_size\":" << puSize
            << ",\"strong_smoothing_eligible\":" << (strongSmoothingEligible ? "true" : "false")
            << ",\"ref_unfilt_top\":";
  writeArray(m_outFile, refUnfiltered, 2 * puSize + 1, 1, 2 * puSize + 1);
  m_outFile << ",\"ref_unfilt_left\":";
  writeArray(m_outFile, refUnfiltered, 1, 2 * puSize + 1, refStride);
  m_outFile << ",\"ref_filt_top\":";
  writeArray(m_outFile, refFiltered, 2 * puSize + 1, 1, 2 * puSize + 1);
  m_outFile << ",\"ref_filt_left\":";
  writeArray(m_outFile, refFiltered, 1, 2 * puSize + 1, refStride);

  if (pRefUnfiltU != NULL && pRefFiltU != NULL)
  {
    m_outFile << ",\"ref_unfilt_top_u\":";
    writeArray(m_outFile, pRefUnfiltU, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_outFile << ",\"ref_unfilt_left_u\":";
    writeArray(m_outFile, pRefUnfiltU, 1, 2 * cSize + 1, cStride);
    m_outFile << ",\"ref_filt_top_u\":";
    writeArray(m_outFile, pRefFiltU, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_outFile << ",\"ref_filt_left_u\":";
    writeArray(m_outFile, pRefFiltU, 1, 2 * cSize + 1, cStride);
  }
  if (pRefUnfiltV != NULL && pRefFiltV != NULL)
  {
    m_outFile << ",\"ref_unfilt_top_v\":";
    writeArray(m_outFile, pRefUnfiltV, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_outFile << ",\"ref_unfilt_left_v\":";
    writeArray(m_outFile, pRefUnfiltV, 1, 2 * cSize + 1, cStride);
    m_outFile << ",\"ref_filt_top_v\":";
    writeArray(m_outFile, pRefFiltV, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_outFile << ",\"ref_filt_left_v\":";
    writeArray(m_outFile, pRefFiltV, 1, 2 * cSize + 1, cStride);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpIntraSearchStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                       Int mode, Double fastCost, Bool useFilter,
                                       const Pel* org, const Pel* pred, Int stride,
                                       const Pel* ref, Int refStride,
                                       const Pel* pOrgU, const Pel* pPredU,
                                       const Pel* pOrgV, const Pel* pPredV,
                                       Int strideC)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize) || org == NULL || pred == NULL || stride < puSize)
  {
    return;
  }

  const Int cSize = (puSize >> 1);
  const Int effStrideC = (strideC > 0 ? strideC : cSize);

  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"RDO_INTRA_SEARCH\",\"event_type\":\"INTRA_FAST_MODE\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"RMD\","
            << "\"distortion\":\"Hadamard\",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_size\":" << puSize
            << ",\"cu_size\":" << puSize
            << ",\"mode\":" << mode
            << ",\"cost\":" << fastCost
            << ",\"fast_cost\":" << fastCost
            << ",\"b_use_filter\":" << (useFilter ? "true" : "false")
            << ",\"use_filtered_references\":" << (useFilter ? "true" : "false")
            << ",\"org_data\":";
  writeArray(m_outFile, org, puSize, puSize, stride);
  m_outFile << ",\"pred_data\":";
  writeArray(m_outFile, pred, puSize, puSize, stride);
  m_outFile << ",\"org_y\":";
  writeArray(m_outFile, org, puSize, puSize, stride);
  m_outFile << ",\"pred_y\":";
  writeArray(m_outFile, pred, puSize, puSize, stride);
  m_outFile << ",\"resi_data\":[";
  Bool first = true;
  for (Int y = 0; y < puSize; ++y)
  {
    for (Int x = 0; x < puSize; ++x)
    {
      if (!first) m_outFile << ',';
      m_outFile << (static_cast<Int>(org[y * stride + x]) - static_cast<Int>(pred[y * stride + x]));
      first = false;
    }
  }
  m_outFile << "],\"residual_y\":[";
  first = true;
  for (Int y = 0; y < puSize; ++y)
  {
    for (Int x = 0; x < puSize; ++x)
    {
      if (!first) m_outFile << ',';
      m_outFile << (static_cast<Int>(org[y * stride + x]) - static_cast<Int>(pred[y * stride + x]));
      first = false;
    }
  }
  m_outFile << "],\"ref_top\":";
  writeArray(m_outFile, ref, 2 * puSize + 1, 1, 2 * puSize + 1);
  m_outFile << ",\"ref_left\":";
  writeArray(m_outFile, ref, 1, 2 * puSize + 1, refStride);

  if (pOrgU != NULL && pPredU != NULL && cSize >= 2)
  {
    m_outFile << ",\"org_u\":";
    writeArray(m_outFile, pOrgU, cSize, cSize, effStrideC);
    m_outFile << ",\"pred_u\":";
    writeArray(m_outFile, pPredU, cSize, cSize, effStrideC);
    m_outFile << ",\"resi_u\":[";
    first = true;
    for (Int y = 0; y < cSize; ++y)
    {
      for (Int x = 0; x < cSize; ++x)
      {
        if (!first) m_outFile << ',';
        m_outFile << (static_cast<Int>(pOrgU[y * effStrideC + x]) - static_cast<Int>(pPredU[y * effStrideC + x]));
        first = false;
      }
    }
    m_outFile << ']';
  }
  if (pOrgV != NULL && pPredV != NULL && cSize >= 2)
  {
    m_outFile << ",\"org_v\":";
    writeArray(m_outFile, pOrgV, cSize, cSize, effStrideC);
    m_outFile << ",\"pred_v\":";
    writeArray(m_outFile, pPredV, cSize, cSize, effStrideC);
    m_outFile << ",\"resi_v\":[";
    first = true;
    for (Int y = 0; y < cSize; ++y)
    {
      for (Int x = 0; x < cSize; ++x)
      {
        if (!first) m_outFile << ',';
        m_outFile << (static_cast<Int>(pOrgV[y * effStrideC + x]) - static_cast<Int>(pPredV[y * effStrideC + x]));
        first = false;
      }
    }
    m_outFile << ']';
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpIntraMpm(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                Int mpm0, Int mpm1, Int mpm2, Int leftMode, Int aboveMode,
                                const UInt* pTopKModes, Int numTopK,
                                const UInt* pFullCandModes, Int numFullCand)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"INTRA_MPM_DERIVATION\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"MPM\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_size\":" << puSize
            << ",\"mpm_modes\":[" << mpm0 << ',' << mpm1 << ',' << mpm2 << ']'
            << ",\"left_mode\":" << leftMode
            << ",\"above_mode\":" << aboveMode
            << ",\"top_k_modes\":";
  writeArray(m_outFile, pTopKModes, numTopK, 1, numTopK);
  m_outFile << ",\"candidate_modes\":";
  writeArray(m_outFile, pFullCandModes, numFullCand, 1, numFullCand);
  m_outFile << "}\n";
}

Void VisualDumper::dumpIntraFullRdoStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                        Int candRank, Int mode, Double cost, Distortion dist, Double bits,
                                        Bool isWinner,
                                        const Pel* pReco, const Pel* pResi, const Pel* pOrg, const Pel* pPred,
                                        Int stride)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"INTRA_FULL_RDO\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"FULL_RDO\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_size\":" << puSize
            << ",\"mode\":" << mode
            << ",\"rank_rdo\":" << candRank
            << ",\"cost_rdo\":" << cost
            << ",\"sse\":" << dist
            << ",\"bits\":" << bits
            << ",\"is_winner\":" << (isWinner ? "true" : "false");
  if (pReco != NULL && stride >= puSize)
  {
    m_outFile << ",\"reconstructed_data\":";
    writeArray(m_outFile, pReco, puSize, puSize, stride);
  }
  if (pResi != NULL && stride >= puSize)
  {
    m_outFile << ",\"reconstructed_resi\":";
    writeArray(m_outFile, pResi, puSize, puSize, stride);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpIntraChromaSearch(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                         Int bestLumaMode, Int numModes,
                                         const UInt* pModeList, const Double* pCosts,
                                         const Distortion* pDists, const UInt* pBits,
                                         Int bestChromaMode, Double bestChromaCost, Distortion bestChromaDist,
                                         const Pel* pOrgU, const Pel* pPredU, const Pel* pResiU, const Pel* pRecoU,
                                         const Pel* pOrgV, const Pel* pPredV, const Pel* pResiV, const Pel* pRecoV,
                                         Int strideC, Int cWidth, Int cHeight)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"INTRA_CHROMA_SEARCH\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"CHROMA\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_size\":" << puSize
            << ",\"best_luma_mode\":" << bestLumaMode
            << ",\"best_chroma_mode\":" << bestChromaMode
            << ",\"best_chroma_cost\":" << bestChromaCost
            << ",\"best_chroma_dist\":" << bestChromaDist
            << ",\"candidates\":[";
  for (Int i = 0; i < numModes; ++i)
  {
    if (i > 0) m_outFile << ',';
    m_outFile << "{\"mode\":" << pModeList[i]
              << ",\"cost\":" << pCosts[i]
              << ",\"dist\":" << pDists[i]
              << ",\"bits\":" << pBits[i]
              << ",\"rank\":" << (i + 1)
              << '}';
  }
  m_outFile << ']';

  if (pRecoU != NULL && strideC >= cWidth)
  {
    m_outFile << ",\"reco_u\":";
    writeArray(m_outFile, pRecoU, cWidth, cHeight, strideC);
  }
  if (pRecoV != NULL && strideC >= cWidth)
  {
    m_outFile << ",\"reco_v\":";
    writeArray(m_outFile, pRecoV, cWidth, cHeight, strideC);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpPartitionTree(TComDataCU* cu)
{
  if (!m_enabled || !m_outFile.is_open() || cu == NULL)
  {
    return;
  }

  const TComSPS& sps = *(cu->getSlice()->getSPS());
  const Int ctuX = cu->getCUPelX() / sps.getMaxCUWidth();
  const Int ctuY = cu->getCUPelY() / sps.getMaxCUHeight();
  const Int poc = cu->getSlice()->getPOC();
  if (m_targetPOC >= 0 && poc != m_targetPOC)
  {
    return;
  }

  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"CTU_PARTITION\",\"stage\":\"CP_01_CU_QUADTREE_RDO\",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"ctu_size\":" << sps.getMaxCUWidth() << ",\"nodes\":[";
  Bool first = true;
  dumpCUNode(m_outFile, cu, 0, 0, first);
  m_outFile << "]}\n";
}

Void VisualDumper::dumpTransformQuant(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY,
                                      Int cuWidth, Int cuHeight, Int cuDepth, Int predMode, Int intraMode,
                                      Int tuX, Int tuY, Int tuWidth, Int tuHeight, Int tuDepth, Int compID,
                                      ChromaFormat chromaFormat, Int qp,
                                      const Pel* residual, Int residualStride,
                                      const TCoeff* transformCoeff, const TCoeff* quantCoeff,
                                      const TCoeff* dequantCoeff,
                                      const Pel* invResidual, Int invResidualStride,
                                      Bool isDST, Bool isTransformSkip)
{
  const ComponentID componentId = static_cast<ComponentID>(compID);
  const Int maxTransformWidth = m_targetCuSize >> getComponentScaleX(componentId, chromaFormat);
  const Int maxTransformHeight = m_targetCuSize >> getComponentScaleY(componentId, chromaFormat);
  if (!m_enabled || !m_outFile.is_open()
      || (m_targetPOC >= 0 && poc != m_targetPOC)
      || (m_targetCtuX >= 0 && ctuX != m_targetCtuX)
      || (m_targetCtuY >= 0 && ctuY != m_targetCtuY)
      || cuWidth != m_targetCuSize || cuHeight != m_targetCuSize
      || tuWidth <= 0 || tuHeight <= 0
      || (m_targetCuSize > 0 && (tuWidth > maxTransformWidth || tuHeight > maxTransformHeight)))
  {
    return;
  }
  if (m_filterPuPosition)
  {
    if (cuX != m_targetPuX || cuY != m_targetPuY)
    {
      return;
    }
    const Int puX = m_targetPuX >> getComponentScaleX(componentId, chromaFormat);
    const Int puY = m_targetPuY >> getComponentScaleY(componentId, chromaFormat);
    if (tuX < puX || tuY < puY || tuX + tuWidth > puX + maxTransformWidth
        || tuY + tuHeight > puY + maxTransformHeight)
    {
      return;
    }
  }

  const char* componentName = compID == 0 ? "Y" : (compID == 1 ? "Cb" : "Cr");
  const char* predictionModeName = predMode == MODE_INTRA ? "INTRA"
                                 : (predMode == MODE_INTER ? "INTER" : "OTHER");
  
  // Calculate significant coefficients count and DC energy
  Int sigCount = 0;
  Double totalEnergy = 0.0;
  Double dcEnergy = 0.0;
  if (transformCoeff != NULL)
  {
    dcEnergy = static_cast<Double>(transformCoeff[0]) * static_cast<Double>(transformCoeff[0]);
    for (Int i = 0; i < tuWidth * tuHeight; ++i)
    {
      if (quantCoeff != NULL && quantCoeff[i] != 0)
      {
        sigCount++;
      }
      totalEnergy += static_cast<Double>(transformCoeff[i]) * static_cast<Double>(transformCoeff[i]);
    }
  }

  Double energyCompaction = (totalEnergy > 0.0 ? (dcEnergy / totalEnergy) : 0.0);

  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"TRANSFORM_QUANT\",\"stage\":\"CP_04_TRANSFORM_RQT\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
            << ",\"cu_width\":" << cuWidth << ",\"cu_height\":" << cuHeight
            << ",\"cu_depth\":" << cuDepth
            << ",\"pred_mode\":\"" << predictionModeName << '\"'
            << ",\"intra_mode\":" << intraMode
            << ",\"tu_x\":" << tuX << ",\"tu_y\":" << tuY
            << ",\"width\":" << tuWidth << ",\"height\":" << tuHeight << ",\"tu_depth\":" << tuDepth
            << ",\"cu_size\":" << m_targetCuSize
            << ",\"component\":\"" << componentName << "\",\"qp\":" << qp
            << ",\"is_dst\":" << (isDST ? "true" : "false")
            << ",\"is_transform_skip\":" << (isTransformSkip ? "true" : "false")
            << ",\"sig_coeff_count\":" << sigCount
            << ",\"energy_compaction_ratio\":" << energyCompaction
            << ",\"residual\":";
  writeArray(m_outFile, residual, tuWidth, tuHeight, residualStride);
  m_outFile << ",\"resi_matrix\":";
  writeArray(m_outFile, residual, tuWidth, tuHeight, residualStride);
  m_outFile << ",\"transform_coeff\":";
  writeArray(m_outFile, transformCoeff, tuWidth, tuHeight, tuWidth);
  m_outFile << ",\"dct_coeff\":";
  writeArray(m_outFile, transformCoeff, tuWidth, tuHeight, tuWidth);
  m_outFile << ",\"quant_coeff\":";
  writeArray(m_outFile, quantCoeff, tuWidth, tuHeight, tuWidth);
  if (dequantCoeff != NULL)
  {
    m_outFile << ",\"dequant_coeff\":";
    writeArray(m_outFile, dequantCoeff, tuWidth, tuHeight, tuWidth);
  }
  if (invResidual != NULL && invResidualStride >= tuWidth)
  {
    m_outFile << ",\"inv_residual\":";
    writeArray(m_outFile, invResidual, tuWidth, tuHeight, invResidualStride);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpReconPicture(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize,
                                    const Pel* pRecY, Int strideY,
                                    const Pel* pRecU, const Pel* pRecV, Int strideC)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  const Int cSize = (cuSize >> 1);
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"RECON_PICTURE\",\"stage\":\"CP_05_RECON_PICTURE\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
            << ",\"cu_size\":" << cuSize;
  if (pRecY != NULL && strideY >= cuSize)
  {
    m_outFile << ",\"reco_y\":";
    writeArray(m_outFile, pRecY, cuSize, cuSize, strideY);
  }
  if (pRecU != NULL && strideC >= cSize)
  {
    m_outFile << ",\"reco_u\":";
    writeArray(m_outFile, pRecU, cSize, cSize, strideC);
  }
  if (pRecV != NULL && strideC >= cSize)
  {
    m_outFile << ",\"reco_v\":";
    writeArray(m_outFile, pRecV, cSize, cSize, strideC);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpInterSearch(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                   Int puIdx, Int puX, Int puY, Int puW, Int puH,
                                   Int refPicList, Int refIdx, Int mvpIdx,
                                   Int mvX, Int mvY, Int mvdX, Int mvdY,
                                   Double cost, Distortion dist, UInt bits,
                                   Int numMergeCand, const Int* pMergeCandX, const Int* pMergeCandY,
                                   Int numAmvpCand, const Int* pAmvpCandX, const Int* pAmvpCandY)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"INTER_SEARCH\",\"stage\":\"CP_03_INTER_SEARCH\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
            << ",\"cu_size\":" << cuSize << ",\"depth\":" << depth
            << ",\"pu_idx\":" << puIdx << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
            << ",\"pu_w\":" << puW << ",\"pu_h\":" << puH
            << ",\"ref_list\":" << refPicList << ",\"ref_idx\":" << refIdx << ",\"mvp_idx\":" << mvpIdx
            << ",\"mv_x\":" << mvX << ",\"mv_y\":" << mvY
            << ",\"mvd_x\":" << mvdX << ",\"mvd_y\":" << mvdY
            << ",\"cost\":" << cost << ",\"dist\":" << dist << ",\"bits\":" << bits;

  if (numMergeCand > 0 && pMergeCandX != NULL && pMergeCandY != NULL)
  {
    m_outFile << ",\"merge_candidates\":[";
    for (Int i = 0; i < numMergeCand; ++i)
    {
      m_outFile << (i > 0 ? ",{" : "{") << "\"idx\":" << i << ",\"mv_x\":" << pMergeCandX[i] << ",\"mv_y\":" << pMergeCandY[i] << "}";
    }
    m_outFile << "]";
  }

  if (numAmvpCand > 0 && pAmvpCandX != NULL && pAmvpCandY != NULL)
  {
    m_outFile << ",\"amvp_candidates\":[";
    for (Int i = 0; i < numAmvpCand; ++i)
    {
      m_outFile << (i > 0 ? ",{" : "{") << "\"idx\":" << i << ",\"mv_x\":" << pAmvpCandX[i] << ",\"mv_y\":" << pAmvpCandY[i] << "}";
    }
    m_outFile << "]";
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpDeblockingEdge(Int poc, Int ctuX, Int ctuY, Int edgeX, Int edgeY,
                                      Int edgeType, Int bS, Int beta, Int tc,
                                      const Pel* pSamples, const Pel* qSamples, Int stride)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"DEBLOCKING_EDGE\",\"stage\":\"CP_06_INLOOP_FILTER\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"edge_x\":" << edgeX << ",\"edge_y\":" << edgeY
            << ",\"edge_type\":" << edgeType
            << ",\"bS\":" << bS
            << ",\"beta\":" << beta
            << ",\"tc\":" << tc;
  if (pSamples != NULL && qSamples != NULL && stride > 0)
  {
    m_outFile << ",\"p_samples\":[";
    for (Int i = 0; i < 4; ++i)
    {
      m_outFile << (i > 0 ? "," : "") << pSamples[i * stride];
    }
    m_outFile << "],\"q_samples\":[";
    for (Int i = 0; i < 4; ++i)
    {
      m_outFile << (i > 0 ? "," : "") << qSamples[i * stride];
    }
    m_outFile << "]";
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpSaoDecision(Int poc, Int ctuX, Int ctuY,
                                   Int saoTypeY, const Int* pOffsetsY,
                                   Int saoTypeU, const Int* pOffsetsU,
                                   Int saoTypeV, const Int* pOffsetsV)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"SAO_DECISION\",\"stage\":\"CP_06_INLOOP_FILTER\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"sao_type_y\":" << saoTypeY;
  if (pOffsetsY != NULL)
  {
    m_outFile << ",\"offsets_y\":";
    writeArray(m_outFile, pOffsetsY, 5, 1, 5);
  }
  m_outFile << ",\"sao_type_u\":" << saoTypeU;
  if (pOffsetsU != NULL)
  {
    m_outFile << ",\"offsets_u\":";
    writeArray(m_outFile, pOffsetsU, 5, 1, 5);
  }
  m_outFile << ",\"sao_type_v\":" << saoTypeV;
  if (pOffsetsV != NULL)
  {
    m_outFile << ",\"offsets_v\":";
    writeArray(m_outFile, pOffsetsV, 5, 1, 5);
  }
  m_outFile << "}\n";
}

Void VisualDumper::dumpCabacBin(Int poc, Int ctuX, Int ctuY,
                                const char* syntaxName, UInt binValue,
                                UInt ctxIdx, UInt pStateIdx, UInt valMPS,
                                UInt writtenBits)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::mutex> lock(m_mutex);
  m_outFile << "{\"event\":\"CABAC_BIN\",\"stage\":\"CP_07_CABAC_ENTROPY\""
            << ",\"poc\":" << poc
            << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
            << ",\"syntax_element\":\"" << (syntaxName ? syntaxName : "UNKNOWN") << '\"'
            << ",\"bin\":" << binValue
            << ",\"ctx_idx\":" << ctxIdx
            << ",\"p_state_idx\":" << pStateIdx
            << ",\"val_mps\":" << valMPS
            << ",\"bits\":" << writtenBits
            << "}\n";
}
