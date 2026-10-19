#ifndef VISUAL_DUMPER_H
#define VISUAL_DUMPER_H

#include "CommonDef.h"
#include <fstream>
#include <mutex>
#include <string>
#include <map>

class TComDataCU;
class TComSPS;
class TComPPS;

#ifndef ENABLE_VISUAL_DUMP
#define ENABLE_VISUAL_DUMP 0
#endif

class VisualDumper {
public:
  struct ActiveTrialInfo {
    Int   poc;
    Int   ctuX;
    Int   ctuY;
    Int   puX;
    Int   puY;
    Int   puSize;
    Int   candRank;
    Int   candMode;
    Int   qp;
    UInt  trialId;
    Bool  active;
  };

private:
  std::ofstream       m_cOutFile;
  Bool                m_bEnabled;
  Int                 m_iTargetPOC;
  Int                 m_iTargetCtuX;
  Int                 m_iTargetCtuY;
  Int                 m_iTargetCuSize;
  Bool                m_bFilterPuPosition;
  Int                 m_iTargetPuX;
  Int                 m_iTargetPuY;
  mutable std::recursive_mutex m_cMutex;

  ActiveTrialInfo     m_activeTrial;
  std::map<std::string, Double> m_mapCuWinnerCost;
  UInt                m_uiPrevCabacBits;

  VisualDumper();
  ~VisualDumper();

  // Internal helper methods following HM naming convention (x...)
  static Bool xReadIntegerEnv(const TChar* pName, Int& riValue);
  static std::string xMakeCuKey(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth);
  template<typename T>
  Void xWriteArray(std::ostream& out, const T* values, Int width, Int height, Int stride);

public:
  static VisualDumper* getInstance() {
    static VisualDumper instance;
    return &instance;
  }

  Void init();
  Void destroy();

  Bool isEnabled() const { return m_bEnabled; }

  Void setActiveTrial(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                      Int candRank, Int candMode, Int qp, UInt trialId);
  Void clearActiveTrial();
  Bool getActiveTrial(ActiveTrialInfo& rInfo);

  Void recordCuWinnerCost(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth, Double winnerCost);
  Double getCuWinnerCost(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth, Double defaultCost) const;

  Bool isCtuActive(Int poc, Int ctuX, Int ctuY) const {
    return m_bEnabled &&
           (m_iTargetPOC < 0 || poc == m_iTargetPOC) &&
           (m_iTargetCtuX < 0 || ctuX == m_iTargetCtuX) &&
           (m_iTargetCtuY < 0 || ctuY == m_iTargetCtuY);
  }

  Bool isActive(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize) const {
    return m_bEnabled &&
           (m_iTargetPOC < 0 || poc == m_iTargetPOC) &&
           (m_iTargetCtuX < 0 || ctuX == m_iTargetCtuX) &&
           (m_iTargetCtuY < 0 || ctuY == m_iTargetCtuY) &&
           (!m_bFilterPuPosition || (puX == m_iTargetPuX && puY == m_iTargetPuY)) &&
           (m_iTargetCuSize <= 0 || puSize == m_iTargetCuSize);
  }

  Bool isCuActive(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuWidth, Int cuHeight) const {
    if (!isCtuActive(poc, ctuX, ctuY))
    {
      return false;
    }
    if (m_iTargetCuSize > 0 && (cuWidth != m_iTargetCuSize || cuHeight != m_iTargetCuSize))
    {
      return false;
    }
    if (m_bFilterPuPosition && (cuX != m_iTargetPuX || cuY != m_iTargetPuY))
    {
      return false;
    }
    return true;
  }

  // CP_00: Frame & GOP Control
  Void dumpSequenceParams(const TComSPS* pcSPS, const TComPPS* pcPPS);
  Void dumpFrameGOP(Int poc, Int sliceType, Int qp, Int temporalId,
                    Int numRefL0, const Int* pRefL0,
                    Int numRefL1, const Int* pRefL1);

  // CP_01: CU Quadtree RDO Call Stack & Partition
  Void dumpCuRdoDecision(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                         Double costNoSplit, Double costSplit, Bool splitDecision,
                         Int bestMode);
  Void dumpCuRdoDecisionVerified(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                                 Bool splitEvaluated,
                                 Double costNoSplit, Distortion distNoSplit, UInt bitsNoSplit, Int qpNoSplit, Int modeNoSplit,
                                 Double costSplit, Distortion distSplit, UInt bitsSplit, Int qpSplit,
                                 Bool splitDecision, Double winnerCost);
  Void dumpCtuActualBits(Int poc, Int ctuX, Int ctuY, UInt ctuRsAddr, Int actualBitsCtu);
  Void dumpPartitionTree(TComDataCU* pcCU);

  // CP_02: Intra Prediction Pipeline
  Void dumpIntraRefSamples(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                           const Pel* pRefUnfilt, const Pel* pRefFilt, Int refStride,
                           Bool strongSmoothingEligible,
                           const Pel* pRefUnfiltU = NULL, const Pel* pRefFiltU = NULL,
                           const Pel* pRefUnfiltV = NULL, const Pel* pRefFiltV = NULL,
                           Int refStrideC = 0);

  Void dumpIntraSearchStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                           Int mode, Double fastCost, Bool bUseFilter,
                           const Pel* pOrg, const Pel* pPred, Int stride,
                           const Pel* pRef, Int refStride,
                           const Pel* pOrgU = NULL, const Pel* pPredU = NULL,
                           const Pel* pOrgV = NULL, const Pel* pPredV = NULL,
                           Int strideC = 0);

  Void dumpIntraMpm(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                    Int mpm0, Int mpm1, Int mpm2, Int leftMode, Int aboveMode,
                    const UInt* pTopKModes, Int numTopK,
                    const UInt* pFullCandModes, Int numFullCand);

  Void dumpIntraTuPred(Int poc, Int ctuX, Int ctuY,
                       Int puX, Int puY, Int puSize,
                       Int tuX, Int tuY, Int tuWidth, Int tuHeight, Int tuDepth,
                       Int candRank, Int candMode, Int qp, UInt trialId,
                       const Pel* pPred, Int stride);

  Void dumpIntraFullRdoStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                            Int candRank, Int mode, Int qp, UInt trialId,
                            Double cost, Distortion dist, Double bits,
                            Bool isWinner,
                            const Pel* pReco, const Pel* pResi, const Pel* pOrg,
                            Int stride);

  Void dumpIntraFullRdoStep(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                            Int candRank, Int mode, Double cost, Distortion dist, Double bits,
                            Bool isWinner,
                            const Pel* pReco, const Pel* pResi, const Pel* pOrg, const Pel* pPred,
                            Int stride);

  Void dumpIntraChromaSearch(Int poc, Int ctuX, Int ctuY, Int puX, Int puY, Int puSize,
                             Int bestLumaMode, Int numModes,
                             const UInt* pModeList, const Double* pCosts,
                             const Distortion* pDists, const UInt* pBits,
                             Int bestChromaMode, Double bestChromaCost, Distortion bestChromaDist,
                             const Pel* pOrgU, const Pel* pPredU, const Pel* pResiU, const Pel* pRecoU,
                             const Pel* pOrgV, const Pel* pPredV, const Pel* pResiV, const Pel* pRecoV,
                             Int strideC, Int cWidth, Int cHeight);

  // CP_04: Transform, Quantization & RQT
  Void dumpTransformQuant(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY,
                          Int cuWidth, Int cuHeight, Int cuDepth, Int predMode, Int intraMode,
                          Int tuX, Int tuY, Int tuWidth, Int tuHeight, Int tuDepth,
                          Int compID, ChromaFormat chromaFormat, Int qp,
                          const Pel* pResi, Int resiStride,
                          const TCoeff* pDctCoeff, const TCoeff* pQCoeff,
                          const TCoeff* pDequantCoeff = NULL,
                          const Pel* pInvResi = NULL, Int invResiStride = 0,
                          Bool isDST = false, Bool isTransformSkip = false);

  // CP_03: Inter Prediction & Motion Search (Supports both Uni- and Bi-prediction)
  Void dumpInterSearch(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize, Int depth,
                       Int puIdx, Int puX, Int puY, Int puW, Int puH,
                       Int refPicList, Int refIdx, Int mvpIdx,
                       Int mvX, Int mvY, Int mvdX, Int mvdY,
                       Double cost, Distortion dist, UInt bits,
                       Int refIdxL1 = -1, Int mvpIdxL1 = -1,
                       Int mvL1X = 0, Int mvL1Y = 0, Int mvdL1X = 0, Int mvdL1Y = 0,
                       Int numMergeCand = 0, const Int* pMergeCandX = NULL, const Int* pMergeCandY = NULL,
                       Int numAmvpCand = 0, const Int* pAmvpCandX = NULL, const Int* pAmvpCandY = NULL);

  // CP_05: Reconstruction Picture Buffer
  Void dumpReconPicture(Int poc, Int ctuX, Int ctuY, Int cuX, Int cuY, Int cuSize,
                        const Pel* pRecY, Int strideY,
                        const Pel* pRecU, const Pel* pRecV, Int strideC);

  // CP_06: In-Loop Filtering (DBF & SAO)
  Void dumpDeblockingEdge(Int poc, Int ctuX, Int ctuY, Int edgeX, Int edgeY,
                          Int edgeType, Int bS, Int beta, Int tc,
                          const Pel* pSamples, const Pel* qSamples, Int stride);
  Void dumpSaoDecision(Int poc, Int ctuX, Int ctuY,
                       Int saoTypeY, const Int* pOffsetsY,
                       Int saoTypeU, const Int* pOffsetsU,
                       Int saoTypeV, const Int* pOffsetsV);

  // CP_07: CABAC Entropy Coding
  Void dumpCabacBin(Int poc, Int ctuX, Int ctuY,
                    const TChar* syntaxName, UInt binValue,
                    UInt ctxIdx, UInt pStateIdx, UInt valMPS,
                    UInt writtenBits);
};

#endif // VISUAL_DUMPER_H
