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
  if (!first)
  {
    out << ',';
  }
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
    const Bool isSkip = cu->isSkipped(absPartIdx);
    const TChar* modeName = (mode == MODE_INTRA ? "INTRA" : (isSkip ? "SKIP" : "INTER"));
    const PartSize partSize = cu->getPartitionSize(absPartIdx);
    const Bool cuTransquantBypass = cu->getCUTransquantBypass(absPartIdx);
    out << ",\"mode\":\"" << modeName << '\"'
        << ",\"part_size\":" << static_cast<Int>(partSize)
        << ",\"cu_transquant_bypass_flag\":" << (cuTransquantBypass ? "true" : "false");
    if (mode == MODE_INTRA)
    {
      out << ",\"intra_dir\":" << static_cast<Int>(cu->getIntraDir(CHANNEL_TYPE_LUMA, absPartIdx));
    }
    out << ",\"qp\":" << static_cast<Int>(cu->getQP(absPartIdx));

    Double leafCost = cu->getTotalCost();
    VisualDumper* pDumper = VisualDumper::getInstance();
    if (pDumper != NULL)
    {
      const Int ctuX = cu->getCUPelX() / sps.getMaxCUWidth();
      const Int ctuY = cu->getCUPelY() / sps.getMaxCUHeight();
      leafCost = pDumper->getCuWinnerCost(cu->getSlice()->getPOC(), ctuX, ctuY, x, y, width, depth, leafCost);
    }
    out << ",\"cost\":" << leafCost;
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

Bool VisualDumper::xReadIntegerEnv(const TChar* pName, Int& riValue)
{
  const TChar* text = std::getenv(pName);
  if (text == NULL || *text == '\0')
  {
    return false;
  }

  TChar* end = NULL;
  const long parsed = std::strtol(text, &end, 10);
  if (end == text || *end != '\0' || parsed < -1 || parsed > 0x7fffffffL)
  {
    return false;
  }

  riValue = static_cast<Int>(parsed);
  return true;
}

std::string VisualDumper::xMakeCuKey(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth)
{
  TChar buf[64];
  std::snprintf(buf, sizeof(buf), "%d_%d_%d_%d_%d_%d_%d", poc, ctuX, ctuY, cuX, cuY, cuSize, depth);
  return std::string(buf);
}

template<typename T>
Void VisualDumper::xWriteArray(std::ostream& out, const T* values, Int width, Int height, Int stride)
{
  out << '[';
  Bool first = true;
  if (values != NULL)
  {
    for (Int y = 0; y < height; ++y)
    {
      for (Int x = 0; x < width; ++x)
      {
        if (!first)
        {
          out << ',';
        }
        out << values[y * stride + x];
        first = false;
      }
    }
  }
  out << ']';
}

VisualDumper::VisualDumper()
  : m_bEnabled(false),
    m_iTargetPOC(-1),
    m_iTargetCtuX(0),
    m_iTargetCtuY(0),
    m_iTargetCuSize(0),
    m_bFilterPuPosition(false),
    m_iTargetPuX(0),
    m_iTargetPuY(0),
    m_uiPrevCabacBits(0)
{
  m_activeTrial.active = false;
  m_activeTrial.trialId = 0;
  init();
}

VisualDumper::~VisualDumper()
{
  destroy();
}

Void VisualDumper::init()
{
  xReadIntegerEnv("VISUAL_POC", m_iTargetPOC);
  const Bool hasX = xReadIntegerEnv("VISUAL_CTU_X", m_iTargetCtuX);
  const Bool hasY = xReadIntegerEnv("VISUAL_CTU_Y", m_iTargetCtuY);
  Int requestedCuSize = m_iTargetCuSize;
  const TChar* cuSizeText = std::getenv("VISUAL_CU_SIZE");
  const Bool validCuSize = (cuSizeText == NULL)
                        || (xReadIntegerEnv("VISUAL_CU_SIZE", requestedCuSize) && requestedCuSize >= 0);
  const TChar* puXText = std::getenv("VISUAL_PU_X");
  const TChar* puYText = std::getenv("VISUAL_PU_Y");
  const Bool hasPuX = xReadIntegerEnv("VISUAL_PU_X", m_iTargetPuX);
  const Bool hasPuY = xReadIntegerEnv("VISUAL_PU_Y", m_iTargetPuY);
  const Bool validPuX = (puXText == NULL) || hasPuX;
  const Bool validPuY = (puYText == NULL) || hasPuY;

  m_bEnabled = hasX && hasY && validCuSize && validPuX && validPuY && (hasPuX == hasPuY);
  if (!m_bEnabled)
  {
    return;
  }
  m_bFilterPuPosition = hasPuX && hasPuY;
  m_iTargetCuSize = requestedCuSize;

  const TChar* configuredOutputDir = std::getenv("VISUAL_OUTPUT_DIR");
  std::string outputDir = (configuredOutputDir != NULL && *configuredOutputDir != '\0')
                        ? configuredOutputDir : "dump_data";
  if (outputDir[outputDir.length() - 1] != '/')
  {
    outputDir += '/';
  }

  mkdir(outputDir.c_str(), 0777);
  m_cOutFile.open((outputDir + "trace.jsonl").c_str(), std::ios::out | std::ios::trunc);
  m_bEnabled = m_cOutFile.is_open();
}

Void VisualDumper::destroy()
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  if (m_cOutFile.is_open())
  {
    m_cOutFile.flush();
    m_cOutFile.close();
  }
  m_bEnabled = false;
  m_mapCuWinnerCost.clear();
}

Void VisualDumper::setActiveTrial(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                  Int candRank, Int candMode, Int qp, UInt trialId)
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_activeTrial.poc = poc;
  m_activeTrial.ctuX = ctuX;
  m_activeTrial.ctuY = ctuY;
  m_activeTrial.puX = puX;
  m_activeTrial.puY = puY;
  m_activeTrial.puSize = puSize;
  m_activeTrial.candRank = candRank;
  m_activeTrial.candMode = candMode;
  m_activeTrial.qp = qp;
  m_activeTrial.trialId = trialId;
  m_activeTrial.active = true;
}

Void VisualDumper::clearActiveTrial()
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_activeTrial.active = false;
}

Bool VisualDumper::getActiveTrial(ActiveTrialInfo& rInfo)
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  rInfo = m_activeTrial;
  return m_activeTrial.active;
}

Void VisualDumper::recordCuWinnerCost(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth, Double winnerCost)
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_mapCuWinnerCost[xMakeCuKey(poc, ctuX, ctuY, cuX, cuY, cuSize, depth)] = winnerCost;
}

Double VisualDumper::getCuWinnerCost(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth, Double defaultCost) const
{
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  std::map<std::string, Double>::const_iterator it = m_mapCuWinnerCost.find(xMakeCuKey(poc, ctuX, ctuY, cuX, cuY, cuSize, depth));
  if (it != m_mapCuWinnerCost.end())
  {
    return it->second;
  }
  return defaultCost;
}

Void VisualDumper::dumpSequenceParams(const TComSPS* pcSPS, const TComPPS* pcPPS)
{
  if (!m_bEnabled || !m_cOutFile.is_open() || pcSPS == NULL || pcPPS == NULL)
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"SEQUENCE_METADATA\",\"stage\":\"CP_00_FRAME_GOP\""
             << ",\"sps\":{"
             << "\"sps_id\":" << pcSPS->getSPSId()
             << ",\"pic_width_in_luma_samples\":" << pcSPS->getPicWidthInLumaSamples()
             << ",\"pic_height_in_luma_samples\":" << pcSPS->getPicHeightInLumaSamples()
             << ",\"max_cu_width\":" << pcSPS->getMaxCUWidth()
             << ",\"max_cu_height\":" << pcSPS->getMaxCUHeight()
             << ",\"max_total_cu_depth\":" << pcSPS->getMaxTotalCUDepth()
             << ",\"log2_min_coding_block_size\":" << pcSPS->getLog2MinCodingBlockSize()
             << ",\"log2_diff_max_min_coding_block_size\":" << pcSPS->getLog2DiffMaxMinCodingBlockSize()
             << ",\"quadtree_tu_log2_min_size\":" << pcSPS->getQuadtreeTULog2MinSize()
             << ",\"quadtree_tu_log2_max_size\":" << pcSPS->getQuadtreeTULog2MaxSize()
             << ",\"quadtree_tu_max_depth_intra\":" << pcSPS->getQuadtreeTUMaxDepthIntra()
             << ",\"quadtree_tu_max_depth_inter\":" << pcSPS->getQuadtreeTUMaxDepthInter()
             << ",\"chroma_format_idc\":" << static_cast<Int>(pcSPS->getChromaFormatIdc())
             << ",\"bit_depth_luma\":" << pcSPS->getBitDepth(CHANNEL_TYPE_LUMA)
             << ",\"bit_depth_chroma\":" << pcSPS->getBitDepth(CHANNEL_TYPE_CHROMA)
             << ",\"use_sao\":" << (pcSPS->getUseSAO() ? "true" : "false")
             << ",\"use_strong_intra_smoothing\":" << (pcSPS->getUseStrongIntraSmoothing() ? "true" : "false")
             << ",\"use_amp\":" << (pcSPS->getUseAMP() ? "true" : "false")
             << "},\"pps\":{"
             << "\"pps_id\":" << pcPPS->getPPSId()
             << ",\"sps_id\":" << pcPPS->getSPSId()
             << ",\"pic_init_qp_minus26\":" << pcPPS->getPicInitQPMinus26()
             << ",\"constrained_intra_pred_flag\":" << (pcPPS->getConstrainedIntraPred() ? "true" : "false")
             << ",\"transquant_bypass_enabled_flag\":" << (pcPPS->getTransquantBypassEnabledFlag() ? "true" : "false")
             << ",\"use_transform_skip\":" << (pcPPS->getUseTransformSkip() ? "true" : "false")
             << ",\"use_dqp\":" << (pcPPS->getUseDQP() ? "true" : "false")
             << ",\"max_cu_dqp_depth\":" << pcPPS->getMaxCuDQPDepth()
             << ",\"loop_filter_across_slices_enabled_flag\":" << (pcPPS->getLoopFilterAcrossSlicesEnabledFlag() ? "true" : "false")
             << ",\"deblocking_filter_control_present_flag\":" << (pcPPS->getDeblockingFilterControlPresentFlag() ? "true" : "false")
             << "}}\n";
}

Void VisualDumper::dumpFrameGOP(Int poc, Int sliceType, Int qp, Int temporalId,
                                Int numRefL0, const Int* pRefL0,
                                Int numRefL1, const Int* pRefL1)
{
  if (!m_bEnabled || !m_cOutFile.is_open())
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  const TChar* sliceTypeName = (sliceType == B_SLICE ? "B" : (sliceType == P_SLICE ? "P" : "I"));
  m_cOutFile << "{\"event\":\"FRAME_GOP\",\"stage\":\"CP_00_FRAME_GOP\""
             << ",\"poc\":" << poc
             << ",\"slice_type\":\"" << sliceTypeName << '\"'
             << ",\"qp\":" << qp
             << ",\"temporal_id\":" << temporalId
             << ",\"ref_l0\":";
  xWriteArray(m_cOutFile, pRefL0, numRefL0, 1, numRefL0);
  m_cOutFile << ",\"ref_l1\":";
  xWriteArray(m_cOutFile, pRefL1, numRefL1, 1, numRefL1);
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpCuRdoDecision(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                     Double costNoSplit, Double costSplit, Bool splitDecision,
                                     Int bestMode)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"CU_RDO_DECISION\",\"stage\":\"CP_01_CU_QUADTREE_RDO\""
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

Void VisualDumper::dumpCuRdoDecisionVerified(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                             Bool splitEvaluated,
                                             Double costNoSplit, Distortion distNoSplit, UInt bitsNoSplit, Int qpNoSplit, Int modeNoSplit,
                                             Double costSplit, Distortion distSplit, UInt bitsSplit, Int qpSplit,
                                             Bool splitDecision, Double winnerCost)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }

  recordCuWinnerCost(poc, ctuX, ctuY, cuX, cuY, cuSize, depth, winnerCost);

  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"CU_RDO_DECISION\",\"stage\":\"CP_01_CU_QUADTREE_RDO\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
             << ",\"cu_size\":" << cuSize << ",\"depth\":" << depth
             << ",\"split_evaluated\":" << (splitEvaluated ? "true" : "false")
             << ",\"cost_nosplit\":" << costNoSplit
             << ",\"cost_split\":" << costSplit
             << ",\"nosplit\":{\"cost\":" << costNoSplit << ",\"dist\":" << distNoSplit << ",\"bits\":" << bitsNoSplit << ",\"qp\":" << qpNoSplit << ",\"mode\":" << modeNoSplit << '}'
             << ",\"split\":{\"cost\":" << costSplit << ",\"dist\":" << distSplit << ",\"bits\":" << bitsSplit << ",\"qp\":" << qpSplit << '}'
             << ",\"split_decision\":" << (splitDecision ? "true" : "false")
             << ",\"best_mode\":" << modeNoSplit
             << ",\"winner_cost\":" << winnerCost
             << "}\n";
}

Void VisualDumper::dumpCtuActualBits(Int poc, Int ctuX, Int ctuY, UInt ctuRsAddr, Int actualBitsCtu)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"CTU_ACTUAL_BITS\",\"stage\":\"CP_01_CU_QUADTREE_RDO\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"ctu_rs_addr\":" << ctuRsAddr
             << ",\"actual_bits_ctu\":" << actualBitsCtu
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

  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTRA_REF_SAMPLES\",\"stage\":\"CP_02_INTRA_REF\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_size\":" << puSize
             << ",\"cu_size\":" << puSize
             << ",\"strong_smoothing\":" << (strongSmoothingEligible ? "true" : "false")
             << ",\"strong_smoothing_eligible\":" << (strongSmoothingEligible ? "true" : "false")
             << ",\"ref_unfilt_top\":";
  xWriteArray(m_cOutFile, refUnfiltered, 2 * puSize + 1, 1, 2 * puSize + 1);
  m_cOutFile << ",\"ref_unfilt_left\":";
  xWriteArray(m_cOutFile, refUnfiltered, 1, 2 * puSize + 1, refStride);
  m_cOutFile << ",\"ref_filt_top\":";
  xWriteArray(m_cOutFile, refFiltered, 2 * puSize + 1, 1, 2 * puSize + 1);
  m_cOutFile << ",\"ref_filt_left\":";
  xWriteArray(m_cOutFile, refFiltered, 1, 2 * puSize + 1, refStride);

  if (pRefUnfiltU != NULL && pRefFiltU != NULL)
  {
    m_cOutFile << ",\"ref_unfilt_top_u\":";
    xWriteArray(m_cOutFile, pRefUnfiltU, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_cOutFile << ",\"ref_unfilt_left_u\":";
    xWriteArray(m_cOutFile, pRefUnfiltU, 1, 2 * cSize + 1, cStride);
    m_cOutFile << ",\"ref_filt_top_u\":";
    xWriteArray(m_cOutFile, pRefFiltU, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_cOutFile << ",\"ref_filt_left_u\":";
    xWriteArray(m_cOutFile, pRefFiltU, 1, 2 * cSize + 1, cStride);
  }
  if (pRefUnfiltV != NULL && pRefFiltV != NULL)
  {
    m_cOutFile << ",\"ref_unfilt_top_v\":";
    xWriteArray(m_cOutFile, pRefUnfiltV, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_cOutFile << ",\"ref_unfilt_left_v\":";
    xWriteArray(m_cOutFile, pRefUnfiltV, 1, 2 * cSize + 1, cStride);
    m_cOutFile << ",\"ref_filt_top_v\":";
    xWriteArray(m_cOutFile, pRefFiltV, 2 * cSize + 1, 1, 2 * cSize + 1);
    m_cOutFile << ",\"ref_filt_left_v\":";
    xWriteArray(m_cOutFile, pRefFiltV, 1, 2 * cSize + 1, cStride);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpIntraSearchStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                       Int mode, Double fastCost, Bool bUseFilter,
                                       const Pel* pOrg, const Pel* pPred, Int stride,
                                       const Pel* pRef, Int refStride,
                                       const Pel* pOrgU, const Pel* pPredU,
                                       const Pel* pOrgV, const Pel* pPredV,
                                       Int strideC)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize) || stride <= 0)
  {
    return;
  }

  const Int cSize = (puSize >> 1);
  const Int cStride = (strideC > 0 ? strideC : cSize);

  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"RDO_INTRA_SEARCH\",\"stage\":\"CP_02_INTRA_SEARCH\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_size\":" << puSize
             << ",\"cu_size\":" << puSize
             << ",\"mode\":" << mode
             << ",\"cost\":" << fastCost
             << ",\"b_use_filter\":" << (bUseFilter ? "true" : "false");

  if (pOrg != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"org_data\":";
    xWriteArray(m_cOutFile, pOrg, puSize, puSize, stride);
  }
  if (pPred != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"pred_data\":";
    xWriteArray(m_cOutFile, pPred, puSize, puSize, stride);
  }
  if (pOrg != NULL && pPred != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"resi_data\":[";
    Bool first = true;
    for (Int y = 0; y < puSize; ++y)
    {
      for (Int x = 0; x < puSize; ++x)
      {
        if (!first) m_cOutFile << ',';
        m_cOutFile << (pOrg[y * stride + x] - pPred[y * stride + x]);
        first = false;
      }
    }
    m_cOutFile << ']';
  }

  if (pRef != NULL && refStride > 0)
  {
    m_cOutFile << ",\"ref_top\":";
    xWriteArray(m_cOutFile, pRef, 2 * puSize + 1, 1, 2 * puSize + 1);
    m_cOutFile << ",\"ref_left\":";
    xWriteArray(m_cOutFile, pRef, 1, 2 * puSize + 1, refStride);
  }

  if (pOrgU != NULL && pPredU != NULL && cStride >= cSize)
  {
    m_cOutFile << ",\"org_u\":";
    xWriteArray(m_cOutFile, pOrgU, cSize, cSize, cStride);
    m_cOutFile << ",\"pred_u\":";
    xWriteArray(m_cOutFile, pPredU, cSize, cSize, cStride);
  }
  if (pOrgV != NULL && pPredV != NULL && cStride >= cSize)
  {
    m_cOutFile << ",\"org_v\":";
    xWriteArray(m_cOutFile, pOrgV, cSize, cSize, cStride);
    m_cOutFile << ",\"pred_v\":";
    xWriteArray(m_cOutFile, pPredV, cSize, cSize, cStride);
  }
  m_cOutFile << "}\n";
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
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTRA_MPM_DERIVATION\",\"stage\":\"CP_02_INTRA_SEARCH\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_size\":" << puSize
             << ",\"mpm0\":" << mpm0 << ",\"mpm1\":" << mpm1 << ",\"mpm2\":" << mpm2
             << ",\"left_mode\":" << leftMode << ",\"above_mode\":" << aboveMode
             << ",\"top_k\":";
  xWriteArray(m_cOutFile, pTopKModes, numTopK, 1, numTopK);
  m_cOutFile << ",\"candidates\":";
  xWriteArray(m_cOutFile, pFullCandModes, numFullCand, 1, numFullCand);
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpIntraTuPred(Int poc, Int ctuX, Int ctuY,
                                   Int puX, Int puY, Int puSize,
                                   Int tuX, Int tuY, Int tuWidth, Int tuHeight, Int tuDepth,
                                   Int candRank, Int candMode, Int qp, UInt trialId,
                                   const Pel* pPred, Int stride)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize) || stride <= 0)
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTRA_TU_PRED\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"TU_PRED\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_size\":" << puSize
             << ",\"tu_x\":" << tuX << ",\"tu_y\":" << tuY
             << ",\"tu_width\":" << tuWidth << ",\"tu_height\":" << tuHeight << ",\"tu_depth\":" << tuDepth
             << ",\"cand_rank\":" << candRank
             << ",\"mode\":" << candMode
             << ",\"qp\":" << qp
             << ",\"trial_id\":" << trialId;
  if (pPred != NULL && stride >= tuWidth)
  {
    m_cOutFile << ",\"pred_data\":";
    xWriteArray(m_cOutFile, pPred, tuWidth, tuHeight, stride);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpIntraFullRdoStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                        Int candRank, Int mode, Int qp, UInt trialId,
                                        Double cost, Distortion dist, Double bits,
                                        Bool isWinner,
                                        const Pel* pReco, const Pel* pResi, const Pel* pOrg,
                                        Int stride)
{
  if (!isActive(poc, ctuX, ctuY, puX, puY, puSize) || stride <= 0)
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTRA_FULL_RDO\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"FULL_RDO\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_size\":" << puSize
             << ",\"cu_size\":" << puSize
             << ",\"cand_rank\":" << candRank
             << ",\"mode\":" << mode
             << ",\"qp\":" << qp
             << ",\"trial_id\":" << trialId
             << ",\"cost\":" << cost
             << ",\"cost_rdo\":" << cost
             << ",\"dist\":" << dist
             << ",\"sse\":" << dist
             << ",\"bits\":" << bits
             << ",\"rdo_rate_est\":" << bits
             << ",\"is_winner\":" << (isWinner ? "true" : "false");

  if (pReco != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"reco_data\":";
    xWriteArray(m_cOutFile, pReco, puSize, puSize, stride);
    m_cOutFile << ",\"reconstructed_data\":";
    xWriteArray(m_cOutFile, pReco, puSize, puSize, stride);
  }
  if (pResi != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"resi_data\":";
    xWriteArray(m_cOutFile, pResi, puSize, puSize, stride);
    m_cOutFile << ",\"reconstructed_resi\":";
    xWriteArray(m_cOutFile, pResi, puSize, puSize, stride);
  }
  if (pOrg != NULL && stride >= puSize)
  {
    m_cOutFile << ",\"org_data\":";
    xWriteArray(m_cOutFile, pOrg, puSize, puSize, stride);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpIntraFullRdoStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                                        Int candRank, Int mode, Double cost, Distortion dist, Double bits,
                                        Bool isWinner,
                                        const Pel* pReco, const Pel* pResi, const Pel* pOrg, const Pel* pPred,
                                        Int stride)
{
  dumpIntraFullRdoStep(poc, ctuX, ctuY, puX, puY, puSize, candRank, mode, 0, 0, cost, dist, bits, isWinner, pReco, pResi, pOrg, stride);
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
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTRA_CHROMA_SEARCH\",\"stage\":\"CP_02_INTRA_SEARCH\",\"sub_stage\":\"CHROMA\""
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
    if (i > 0) m_cOutFile << ',';
    m_cOutFile << "{\"mode\":" << pModeList[i]
               << ",\"cost\":" << pCosts[i]
               << ",\"dist\":" << pDists[i]
               << ",\"bits\":" << pBits[i]
               << ",\"rank\":" << (i + 1)
               << '}';
  }
  m_cOutFile << ']';

  if (pRecoU != NULL && strideC >= cWidth)
  {
    m_cOutFile << ",\"reco_u\":";
    xWriteArray(m_cOutFile, pRecoU, cWidth, cHeight, strideC);
  }
  if (pRecoV != NULL && strideC >= cWidth)
  {
    m_cOutFile << ",\"reco_v\":";
    xWriteArray(m_cOutFile, pRecoV, cWidth, cHeight, strideC);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpPartitionTree(TComDataCU* cu)
{
  if (!m_bEnabled || !m_cOutFile.is_open() || cu == NULL)
  {
    return;
  }

  const TComSPS& sps = *(cu->getSlice()->getSPS());
  const Int ctuX = cu->getCUPelX() / sps.getMaxCUWidth();
  const Int ctuY = cu->getCUPelY() / sps.getMaxCUHeight();
  const Int poc = cu->getSlice()->getPOC();
  if (m_iTargetPOC >= 0 && poc != m_iTargetPOC)
  {
    return;
  }

  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"CTU_PARTITION\",\"stage\":\"CP_01_CU_QUADTREE_RDO\",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"ctu_size\":" << sps.getMaxCUWidth() << ",\"nodes\":[";
  Bool first = true;
  dumpCUNode(m_cOutFile, cu, 0, 0, first);
  m_cOutFile << "]}\n";
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
  if (!m_bEnabled || !m_cOutFile.is_open())
  {
    return;
  }
  if (!isCuActive(poc, ctuX, ctuY, cuX, cuY, cuWidth, cuHeight))
  {
    return;
  }
  if (tuWidth <= 0 || tuHeight <= 0)
  {
    return;
  }

  const ComponentID componentId = static_cast<ComponentID>(compID);
  if (m_bFilterPuPosition)
  {
    const Int maxTransformWidth = (m_iTargetCuSize > 0 ? m_iTargetCuSize : cuWidth) >> getComponentScaleX(componentId, chromaFormat);
    const Int maxTransformHeight = (m_iTargetCuSize > 0 ? m_iTargetCuSize : cuHeight) >> getComponentScaleY(componentId, chromaFormat);
    const Int puX = m_iTargetPuX >> getComponentScaleX(componentId, chromaFormat);
    const Int puY = m_iTargetPuY >> getComponentScaleY(componentId, chromaFormat);
    if (tuX < puX || tuY < puY || tuX + tuWidth > puX + maxTransformWidth
        || tuY + tuHeight > puY + maxTransformHeight)
    {
      return;
    }
  }

  const TChar* componentName = compID == 0 ? "Y" : (compID == 1 ? "Cb" : "Cr");
  const TChar* predictionModeName = predMode == MODE_INTRA ? "INTRA"
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

  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"TRANSFORM_QUANT\",\"stage\":\"CP_04_TRANSFORM_RQT\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
             << ",\"cu_width\":" << cuWidth << ",\"cu_height\":" << cuHeight
             << ",\"cu_depth\":" << cuDepth
             << ",\"pred_mode\":\"" << predictionModeName << '\"'
             << ",\"intra_mode\":" << intraMode
             << ",\"tu_x\":" << tuX << ",\"tu_y\":" << tuY
             << ",\"width\":" << tuWidth << ",\"height\":" << tuHeight << ",\"tu_depth\":" << tuDepth
             << ",\"cu_size\":" << (m_iTargetCuSize > 0 ? m_iTargetCuSize : cuWidth)
             << ",\"component\":\"" << componentName << "\",\"qp\":" << qp
             << ",\"is_dst\":" << (isDST ? "true" : "false")
             << ",\"is_transform_skip\":" << (isTransformSkip ? "true" : "false")
             << ",\"cbf\":" << (sigCount > 0 ? "true" : "false")
             << ",\"sig_coeff_count\":" << sigCount
             << ",\"energy_compaction_ratio\":" << energyCompaction
             << ",\"residual\":";
  xWriteArray(m_cOutFile, residual, tuWidth, tuHeight, residualStride);
  m_cOutFile << ",\"resi_matrix\":";
  xWriteArray(m_cOutFile, residual, tuWidth, tuHeight, residualStride);
  m_cOutFile << ",\"transform_coeff\":";
  xWriteArray(m_cOutFile, transformCoeff, tuWidth, tuHeight, tuWidth);
  m_cOutFile << ",\"dct_coeff\":";
  xWriteArray(m_cOutFile, transformCoeff, tuWidth, tuHeight, tuWidth);
  m_cOutFile << ",\"quant_coeff\":";
  xWriteArray(m_cOutFile, quantCoeff, tuWidth, tuHeight, tuWidth);
  if (dequantCoeff != NULL)
  {
    m_cOutFile << ",\"dequant_coeff\":";
    xWriteArray(m_cOutFile, dequantCoeff, tuWidth, tuHeight, tuWidth);
  }
  if (invResidual != NULL && invResidualStride >= tuWidth)
  {
    m_cOutFile << ",\"inv_residual\":";
    xWriteArray(m_cOutFile, invResidual, tuWidth, tuHeight, invResidualStride);
  }
  m_cOutFile << "}\n";
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
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"RECON_PICTURE\",\"stage\":\"CP_05_RECON_PICTURE\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
             << ",\"cu_size\":" << cuSize;
  if (pRecY != NULL && strideY >= cuSize)
  {
    m_cOutFile << ",\"reco_y\":";
    xWriteArray(m_cOutFile, pRecY, cuSize, cuSize, strideY);
  }
  if (pRecU != NULL && strideC >= cSize)
  {
    m_cOutFile << ",\"reco_u\":";
    xWriteArray(m_cOutFile, pRecU, cSize, cSize, strideC);
  }
  if (pRecV != NULL && strideC >= cSize)
  {
    m_cOutFile << ",\"reco_v\":";
    xWriteArray(m_cOutFile, pRecV, cSize, cSize, strideC);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpInterSearch(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                   Int puIdx, Int puX, Int puY, Int puW, Int puH,
                                   Int refPicList, Int refIdx, Int mvpIdx,
                                   Int mvX, Int mvY, Int mvdX, Int mvdY,
                                   Double cost, Distortion dist, UInt bits,
                                   Int refIdxL1, Int mvpIdxL1,
                                   Int mvL1X, Int mvL1Y, Int mvdL1X, Int mvdL1Y,
                                   Int numMergeCand, const Int* pMergeCandX, const Int* pMergeCandY,
                                   Int numAmvpCand, const Int* pAmvpCandX, const Int* pAmvpCandY)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"INTER_SEARCH\",\"stage\":\"CP_03_INTER_SEARCH\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"cu_x\":" << cuX << ",\"cu_y\":" << cuY
             << ",\"cu_size\":" << cuSize << ",\"depth\":" << depth
             << ",\"pu_idx\":" << puIdx << ",\"pu_x\":" << puX << ",\"pu_y\":" << puY
             << ",\"pu_w\":" << puW << ",\"pu_h\":" << puH
             << ",\"ref_list\":" << refPicList << ",\"ref_idx\":" << refIdx << ",\"mvp_idx\":" << mvpIdx
             << ",\"mv_x\":" << mvX << ",\"mv_y\":" << mvY
             << ",\"mvd_x\":" << mvdX << ",\"mvd_y\":" << mvdY;

  if (refPicList == 2) // Bi-prediction
  {
    m_cOutFile << ",\"ref_idx_l1\":" << refIdxL1 << ",\"mvp_idx_l1\":" << mvpIdxL1
               << ",\"mv_x_l1\":" << mvL1X << ",\"mv_y_l1\":" << mvL1Y
               << ",\"mvd_x_l1\":" << mvdL1X << ",\"mvd_y_l1\":" << mvdL1Y;
  }

  m_cOutFile << ",\"cost\":" << cost << ",\"dist\":" << dist << ",\"bits\":" << bits;

  if (numMergeCand > 0 && pMergeCandX != NULL && pMergeCandY != NULL)
  {
    m_cOutFile << ",\"merge_candidates\":[";
    for (Int i = 0; i < numMergeCand; ++i)
    {
      m_cOutFile << (i > 0 ? ",{" : "{") << "\"idx\":" << i << ",\"mv_x\":" << pMergeCandX[i] << ",\"mv_y\":" << pMergeCandY[i] << "}";
    }
    m_cOutFile << "]";
  }

  if (numAmvpCand > 0 && pAmvpCandX != NULL && pAmvpCandY != NULL)
  {
    m_cOutFile << ",\"amvp_candidates\":[";
    for (Int i = 0; i < numAmvpCand; ++i)
    {
      m_cOutFile << (i > 0 ? ",{" : "{") << "\"idx\":" << i << ",\"mv_x\":" << pAmvpCandX[i] << ",\"mv_y\":" << pAmvpCandY[i] << "}";
    }
    m_cOutFile << "]";
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpDeblockingEdge(Int poc, Int ctuX, Int ctuY, Int edgeX, Int edgeY,
                                      Int edgeType, Int bS, Int beta, Int tc,
                                      const Pel* pSamples, const Pel* qSamples, Int stride)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"DEBLOCKING_EDGE\",\"stage\":\"CP_06_INLOOP_FILTER\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"edge_x\":" << edgeX << ",\"edge_y\":" << edgeY
             << ",\"edge_type\":" << edgeType
             << ",\"bS\":" << bS
             << ",\"beta\":" << beta
             << ",\"tc\":" << tc;
  if (pSamples != NULL && qSamples != NULL && stride > 0)
  {
    m_cOutFile << ",\"p_samples\":[";
    for (Int i = 0; i < 4; ++i)
    {
      m_cOutFile << (i > 0 ? "," : "") << pSamples[i * stride];
    }
    m_cOutFile << "],\"q_samples\":[";
    for (Int i = 0; i < 4; ++i)
    {
      m_cOutFile << (i > 0 ? "," : "") << qSamples[i * stride];
    }
    m_cOutFile << "]";
  }
  m_cOutFile << "}\n";
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
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);
  m_cOutFile << "{\"event\":\"SAO_DECISION\",\"stage\":\"CP_06_INLOOP_FILTER\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"sao_type_y\":" << saoTypeY;
  if (pOffsetsY != NULL)
  {
    m_cOutFile << ",\"offsets_y\":";
    xWriteArray(m_cOutFile, pOffsetsY, 5, 1, 5);
  }
  m_cOutFile << ",\"sao_type_u\":" << saoTypeU;
  if (pOffsetsU != NULL)
  {
    m_cOutFile << ",\"offsets_u\":";
    xWriteArray(m_cOutFile, pOffsetsU, 5, 1, 5);
  }
  m_cOutFile << ",\"sao_type_v\":" << saoTypeV;
  if (pOffsetsV != NULL)
  {
    m_cOutFile << ",\"offsets_v\":";
    xWriteArray(m_cOutFile, pOffsetsV, 5, 1, 5);
  }
  m_cOutFile << "}\n";
}

Void VisualDumper::dumpCabacBin(Int poc, Int ctuX, Int ctuY,
                                const TChar* syntaxName, UInt binValue,
                                UInt ctxIdx, UInt pStateIdx, UInt valMPS,
                                UInt writtenBits)
{
  if (!isCtuActive(poc, ctuX, ctuY))
  {
    return;
  }
  std::lock_guard<std::recursive_mutex> lock(m_cMutex);

  UInt deltaBits = 1;
  if (writtenBits >= m_uiPrevCabacBits && m_uiPrevCabacBits > 0)
  {
    deltaBits = writtenBits - m_uiPrevCabacBits;
  }
  m_uiPrevCabacBits = writtenBits;

  m_cOutFile << "{\"event\":\"CABAC_BIN\",\"stage\":\"CP_07_CABAC_ENTROPY\""
             << ",\"poc\":" << poc
             << ",\"ctu_x\":" << ctuX << ",\"ctu_y\":" << ctuY
             << ",\"syntax_element\":\"" << (syntaxName ? syntaxName : "UNKNOWN") << '\"'
             << ",\"bin\":" << binValue
             << ",\"ctx_idx\":" << ctxIdx
             << ",\"p_state_idx\":" << pStateIdx
             << ",\"val_mps\":" << valMPS
             << ",\"bits\":" << deltaBits
             << ",\"cumulative_bits\":" << writtenBits
             << "}\n";
}
