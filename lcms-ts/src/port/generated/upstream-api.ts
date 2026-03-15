export interface UpstreamApiEntry {
  readonly name: string;
  readonly signature: string;
}

export const UPSTREAM_PUBLIC_API: readonly UpstreamApiEntry[] = [
  {
    "name": "cmsGetEncodedCMMversion",
    "signature": "CMSAPI int               CMSEXPORT cmsGetEncodedCMMversion(void);"
  },
  {
    "name": "cmsstrcasecmp",
    "signature": "CMSAPI int               CMSEXPORT cmsstrcasecmp(const char* s1, const char* s2);"
  },
  {
    "name": "cmsfilelength",
    "signature": "CMSAPI long int          CMSEXPORT cmsfilelength(FILE* f);"
  },
  {
    "name": "cmsCreateContext",
    "signature": "CMSAPI cmsContext       CMSEXPORT cmsCreateContext(void* Plugin, void* UserData);"
  },
  {
    "name": "cmsDeleteContext",
    "signature": "CMSAPI void             CMSEXPORT cmsDeleteContext(cmsContext ContextID);"
  },
  {
    "name": "cmsDupContext",
    "signature": "CMSAPI cmsContext       CMSEXPORT cmsDupContext(cmsContext ContextID, void* NewUserData);"
  },
  {
    "name": "cmsGetContextUserData",
    "signature": "CMSAPI void*            CMSEXPORT cmsGetContextUserData(cmsContext ContextID);"
  },
  {
    "name": "cmsPlugin",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPlugin(void* Plugin);"
  },
  {
    "name": "cmsPluginTHR",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPluginTHR(cmsContext ContextID, void* Plugin);"
  },
  {
    "name": "cmsUnregisterPlugins",
    "signature": "CMSAPI void              CMSEXPORT cmsUnregisterPlugins(void);"
  },
  {
    "name": "cmsUnregisterPluginsTHR",
    "signature": "CMSAPI void              CMSEXPORT cmsUnregisterPluginsTHR(cmsContext ContextID);"
  },
  {
    "name": "cmsSetLogErrorHandler",
    "signature": "CMSAPI void              CMSEXPORT cmsSetLogErrorHandler(cmsLogErrorHandlerFunction Fn);"
  },
  {
    "name": "cmsSetLogErrorHandlerTHR",
    "signature": "CMSAPI void              CMSEXPORT cmsSetLogErrorHandlerTHR(cmsContext ContextID, cmsLogErrorHandlerFunction Fn);"
  },
  {
    "name": "cmsD50_XYZ",
    "signature": "CMSAPI const cmsCIEXYZ*  CMSEXPORT cmsD50_XYZ(void);"
  },
  {
    "name": "cmsD50_xyY",
    "signature": "CMSAPI const cmsCIExyY*  CMSEXPORT cmsD50_xyY(void);"
  },
  {
    "name": "cmsXYZ2xyY",
    "signature": "CMSAPI void              CMSEXPORT cmsXYZ2xyY(cmsCIExyY* Dest, const cmsCIEXYZ* Source);"
  },
  {
    "name": "cmsxyY2XYZ",
    "signature": "CMSAPI void              CMSEXPORT cmsxyY2XYZ(cmsCIEXYZ* Dest, const cmsCIExyY* Source);"
  },
  {
    "name": "cmsXYZ2Lab",
    "signature": "CMSAPI void              CMSEXPORT cmsXYZ2Lab(const cmsCIEXYZ* WhitePoint, cmsCIELab* Lab, const cmsCIEXYZ* xyz);"
  },
  {
    "name": "cmsLab2XYZ",
    "signature": "CMSAPI void              CMSEXPORT cmsLab2XYZ(const cmsCIEXYZ* WhitePoint, cmsCIEXYZ* xyz, const cmsCIELab* Lab);"
  },
  {
    "name": "cmsLab2LCh",
    "signature": "CMSAPI void              CMSEXPORT cmsLab2LCh(cmsCIELCh*LCh, const cmsCIELab* Lab);"
  },
  {
    "name": "cmsLCh2Lab",
    "signature": "CMSAPI void              CMSEXPORT cmsLCh2Lab(cmsCIELab* Lab, const cmsCIELCh* LCh);"
  },
  {
    "name": "cmsLabEncoded2Float",
    "signature": "CMSAPI void              CMSEXPORT cmsLabEncoded2Float(cmsCIELab* Lab, const cmsUInt16Number wLab[3]);"
  },
  {
    "name": "cmsLabEncoded2FloatV2",
    "signature": "CMSAPI void              CMSEXPORT cmsLabEncoded2FloatV2(cmsCIELab* Lab, const cmsUInt16Number wLab[3]);"
  },
  {
    "name": "cmsFloat2LabEncoded",
    "signature": "CMSAPI void              CMSEXPORT cmsFloat2LabEncoded(cmsUInt16Number wLab[3], const cmsCIELab* Lab);"
  },
  {
    "name": "cmsFloat2LabEncodedV2",
    "signature": "CMSAPI void              CMSEXPORT cmsFloat2LabEncodedV2(cmsUInt16Number wLab[3], const cmsCIELab* Lab);"
  },
  {
    "name": "cmsXYZEncoded2Float",
    "signature": "CMSAPI void              CMSEXPORT cmsXYZEncoded2Float(cmsCIEXYZ* fxyz, const cmsUInt16Number XYZ[3]);"
  },
  {
    "name": "cmsFloat2XYZEncoded",
    "signature": "CMSAPI void              CMSEXPORT cmsFloat2XYZEncoded(cmsUInt16Number XYZ[3], const cmsCIEXYZ* fXYZ);"
  },
  {
    "name": "cmsDeltaE",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsDeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);"
  },
  {
    "name": "cmsCIE94DeltaE",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsCIE94DeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);"
  },
  {
    "name": "cmsBFDdeltaE",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsBFDdeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);"
  },
  {
    "name": "cmsCMCdeltaE",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsCMCdeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2, cmsFloat64Number l, cmsFloat64Number c);"
  },
  {
    "name": "cmsCIE2000DeltaE",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsCIE2000DeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2, cmsFloat64Number Kl, cmsFloat64Number Kc, cmsFloat64Number Kh);"
  },
  {
    "name": "cmsWhitePointFromTemp",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsWhitePointFromTemp(cmsCIExyY* WhitePoint, cmsFloat64Number  TempK);"
  },
  {
    "name": "cmsTempFromWhitePoint",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsTempFromWhitePoint(cmsFloat64Number* TempK, const cmsCIExyY* WhitePoint);"
  },
  {
    "name": "cmsAdaptToIlluminant",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsAdaptToIlluminant(cmsCIEXYZ* Result, const cmsCIEXYZ* SourceWhitePt,"
  },
  {
    "name": "cmsCIECAM02Init",
    "signature": "CMSAPI cmsHANDLE         CMSEXPORT cmsCIECAM02Init(cmsContext ContextID, const cmsViewingConditions* pVC);"
  },
  {
    "name": "cmsCIECAM02Done",
    "signature": "CMSAPI void              CMSEXPORT cmsCIECAM02Done(cmsHANDLE hModel);"
  },
  {
    "name": "cmsCIECAM02Forward",
    "signature": "CMSAPI void              CMSEXPORT cmsCIECAM02Forward(cmsHANDLE hModel, const cmsCIEXYZ* pIn, cmsJCh* pOut);"
  },
  {
    "name": "cmsCIECAM02Reverse",
    "signature": "CMSAPI void              CMSEXPORT cmsCIECAM02Reverse(cmsHANDLE hModel, const cmsJCh* pIn,    cmsCIEXYZ* pOut);"
  },
  {
    "name": "cmsBuildSegmentedToneCurve",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildSegmentedToneCurve(cmsContext ContextID, cmsUInt32Number nSegments, const cmsCurveSegment Segments[]);"
  },
  {
    "name": "cmsBuildParametricToneCurve",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildParametricToneCurve(cmsContext ContextID, cmsInt32Number Type, const cmsFloat64Number Params[]);"
  },
  {
    "name": "cmsBuildGamma",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildGamma(cmsContext ContextID, cmsFloat64Number Gamma);"
  },
  {
    "name": "cmsBuildTabulatedToneCurve16",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildTabulatedToneCurve16(cmsContext ContextID, cmsUInt32Number nEntries, const cmsUInt16Number values[]);"
  },
  {
    "name": "cmsBuildTabulatedToneCurveFloat",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildTabulatedToneCurveFloat(cmsContext ContextID, cmsUInt32Number nEntries, const cmsFloat32Number values[]);"
  },
  {
    "name": "cmsFreeToneCurve",
    "signature": "CMSAPI void              CMSEXPORT cmsFreeToneCurve(cmsToneCurve* Curve);"
  },
  {
    "name": "cmsFreeToneCurveTriple",
    "signature": "CMSAPI void              CMSEXPORT cmsFreeToneCurveTriple(cmsToneCurve* Curve[3]);"
  },
  {
    "name": "cmsDupToneCurve",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsDupToneCurve(const cmsToneCurve* Src);"
  },
  {
    "name": "cmsReverseToneCurve",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsReverseToneCurve(const cmsToneCurve* InGamma);"
  },
  {
    "name": "cmsReverseToneCurveEx",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsReverseToneCurveEx(cmsUInt32Number nResultSamples, const cmsToneCurve* InGamma);"
  },
  {
    "name": "cmsJoinToneCurve",
    "signature": "CMSAPI cmsToneCurve*     CMSEXPORT cmsJoinToneCurve(cmsContext ContextID, const cmsToneCurve* X,  const cmsToneCurve* Y, cmsUInt32Number nPoints);"
  },
  {
    "name": "cmsSmoothToneCurve",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsSmoothToneCurve(cmsToneCurve* Tab, cmsFloat64Number lambda);"
  },
  {
    "name": "cmsEvalToneCurveFloat",
    "signature": "CMSAPI cmsFloat32Number  CMSEXPORT cmsEvalToneCurveFloat(const cmsToneCurve* Curve, cmsFloat32Number v);"
  },
  {
    "name": "cmsEvalToneCurve16",
    "signature": "CMSAPI cmsUInt16Number   CMSEXPORT cmsEvalToneCurve16(const cmsToneCurve* Curve, cmsUInt16Number v);"
  },
  {
    "name": "cmsIsToneCurveMultisegment",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveMultisegment(const cmsToneCurve* InGamma);"
  },
  {
    "name": "cmsIsToneCurveLinear",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveLinear(const cmsToneCurve* Curve);"
  },
  {
    "name": "cmsIsToneCurveMonotonic",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveMonotonic(const cmsToneCurve* t);"
  },
  {
    "name": "cmsIsToneCurveDescending",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveDescending(const cmsToneCurve* t);"
  },
  {
    "name": "cmsGetToneCurveParametricType",
    "signature": "CMSAPI cmsInt32Number    CMSEXPORT cmsGetToneCurveParametricType(const cmsToneCurve* t);"
  },
  {
    "name": "cmsEstimateGamma",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsEstimateGamma(const cmsToneCurve* t, cmsFloat64Number Precision);"
  },
  {
    "name": "cmsGetToneCurveSegment",
    "signature": "CMSAPI const cmsCurveSegment* CMSEXPORT cmsGetToneCurveSegment(cmsInt32Number n, const cmsToneCurve* t);"
  },
  {
    "name": "cmsGetToneCurveEstimatedTableEntries",
    "signature": "CMSAPI cmsUInt32Number         CMSEXPORT cmsGetToneCurveEstimatedTableEntries(const cmsToneCurve* t);"
  },
  {
    "name": "cmsGetToneCurveEstimatedTable",
    "signature": "CMSAPI const cmsUInt16Number*  CMSEXPORT cmsGetToneCurveEstimatedTable(const cmsToneCurve* t);"
  },
  {
    "name": "cmsPipelineAlloc",
    "signature": "CMSAPI cmsPipeline*      CMSEXPORT cmsPipelineAlloc(cmsContext ContextID, cmsUInt32Number InputChannels, cmsUInt32Number OutputChannels);"
  },
  {
    "name": "cmsPipelineFree",
    "signature": "CMSAPI void              CMSEXPORT cmsPipelineFree(cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineDup",
    "signature": "CMSAPI cmsPipeline*      CMSEXPORT cmsPipelineDup(const cmsPipeline* Orig);"
  },
  {
    "name": "cmsGetPipelineContextID",
    "signature": "CMSAPI cmsContext        CMSEXPORT cmsGetPipelineContextID(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineInputChannels",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineInputChannels(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineOutputChannels",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineOutputChannels(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineStageCount",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineStageCount(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineGetPtrToFirstStage",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsPipelineGetPtrToFirstStage(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineGetPtrToLastStage",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsPipelineGetPtrToLastStage(const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineEval16",
    "signature": "CMSAPI void              CMSEXPORT cmsPipelineEval16(const cmsUInt16Number In[], cmsUInt16Number Out[], const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineEvalFloat",
    "signature": "CMSAPI void              CMSEXPORT cmsPipelineEvalFloat(const cmsFloat32Number In[], cmsFloat32Number Out[], const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineEvalReverseFloat",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPipelineEvalReverseFloat(cmsFloat32Number Target[], cmsFloat32Number Result[], cmsFloat32Number Hint[], const cmsPipeline* lut);"
  },
  {
    "name": "cmsPipelineCat",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPipelineCat(cmsPipeline* l1, const cmsPipeline* l2);"
  },
  {
    "name": "cmsPipelineSetSaveAs8bitsFlag",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPipelineSetSaveAs8bitsFlag(cmsPipeline* lut, cmsBool On);"
  },
  {
    "name": "cmsPipelineInsertStage",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPipelineInsertStage(cmsPipeline* lut, cmsStageLoc loc, cmsStage* mpe);"
  },
  {
    "name": "cmsPipelineUnlinkStage",
    "signature": "CMSAPI void              CMSEXPORT cmsPipelineUnlinkStage(cmsPipeline* lut, cmsStageLoc loc, cmsStage** mpe);"
  },
  {
    "name": "cmsPipelineCheckAndRetreiveStages",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsPipelineCheckAndRetreiveStages(const cmsPipeline* Lut, cmsUInt32Number n, ...);"
  },
  {
    "name": "cmsStageAllocIdentity",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocIdentity(cmsContext ContextID, cmsUInt32Number nChannels);"
  },
  {
    "name": "cmsStageAllocToneCurves",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocToneCurves(cmsContext ContextID, cmsUInt32Number nChannels, cmsToneCurve* const Curves[]);"
  },
  {
    "name": "cmsStageAllocMatrix",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocMatrix(cmsContext ContextID, cmsUInt32Number Rows, cmsUInt32Number Cols, const cmsFloat64Number* Matrix, const cmsFloat64Number* Offset);"
  },
  {
    "name": "cmsStageAllocCLut16bit",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLut16bit(cmsContext ContextID, cmsUInt32Number nGridPoints, cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsUInt16Number* Table);"
  },
  {
    "name": "cmsStageAllocCLutFloat",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLutFloat(cmsContext ContextID, cmsUInt32Number nGridPoints, cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsFloat32Number* Table);"
  },
  {
    "name": "cmsStageAllocCLut16bitGranular",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLut16bitGranular(cmsContext ContextID, const cmsUInt32Number clutPoints[], cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsUInt16Number* Table);"
  },
  {
    "name": "cmsStageAllocCLutFloatGranular",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLutFloatGranular(cmsContext ContextID, const cmsUInt32Number clutPoints[], cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsFloat32Number* Table);"
  },
  {
    "name": "cmsStageDup",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageDup(cmsStage* mpe);"
  },
  {
    "name": "cmsStageFree",
    "signature": "CMSAPI void              CMSEXPORT cmsStageFree(cmsStage* mpe);"
  },
  {
    "name": "cmsStageNext",
    "signature": "CMSAPI cmsStage*         CMSEXPORT cmsStageNext(const cmsStage* mpe);"
  },
  {
    "name": "cmsStageInputChannels",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsStageInputChannels(const cmsStage* mpe);"
  },
  {
    "name": "cmsStageOutputChannels",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsStageOutputChannels(const cmsStage* mpe);"
  },
  {
    "name": "cmsStageType",
    "signature": "CMSAPI cmsStageSignature CMSEXPORT cmsStageType(const cmsStage* mpe);"
  },
  {
    "name": "cmsStageData",
    "signature": "CMSAPI void*             CMSEXPORT cmsStageData(const cmsStage* mpe);"
  },
  {
    "name": "cmsGetStageContextID",
    "signature": "CMSAPI cmsContext        CMSEXPORT cmsGetStageContextID(const cmsStage* mpe);"
  },
  {
    "name": "cmsStageSampleCLut16bit",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsStageSampleCLut16bit(cmsStage* mpe, cmsSAMPLER16 Sampler, void* Cargo, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsStageSampleCLutFloat",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsStageSampleCLutFloat(cmsStage* mpe, cmsSAMPLERFLOAT Sampler, void* Cargo, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsSliceSpace16",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsSliceSpace16(cmsUInt32Number nInputs, const cmsUInt32Number clutPoints[],"
  },
  {
    "name": "cmsSliceSpaceFloat",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsSliceSpaceFloat(cmsUInt32Number nInputs, const cmsUInt32Number clutPoints[],"
  },
  {
    "name": "cmsMLUalloc",
    "signature": "CMSAPI cmsMLU*           CMSEXPORT cmsMLUalloc(cmsContext ContextID, cmsUInt32Number nItems);"
  },
  {
    "name": "cmsMLUfree",
    "signature": "CMSAPI void              CMSEXPORT cmsMLUfree(cmsMLU* mlu);"
  },
  {
    "name": "cmsMLUdup",
    "signature": "CMSAPI cmsMLU*           CMSEXPORT cmsMLUdup(const cmsMLU* mlu);"
  },
  {
    "name": "cmsMLUsetASCII",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMLUsetASCII(cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUsetWide",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMLUsetWide(cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUsetUTF8",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMLUsetUTF8(cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUgetASCII",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetASCII(const cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUgetWide",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetWide(const cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUgetUTF8",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetUTF8(const cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUgetTranslation",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMLUgetTranslation(const cmsMLU* mlu,"
  },
  {
    "name": "cmsMLUtranslationsCount",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUtranslationsCount(const cmsMLU* mlu);"
  },
  {
    "name": "cmsMLUtranslationsCodes",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMLUtranslationsCodes(const cmsMLU* mlu,"
  },
  {
    "name": "cmsAllocNamedColorList",
    "signature": "CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsAllocNamedColorList(cmsContext ContextID,"
  },
  {
    "name": "cmsFreeNamedColorList",
    "signature": "CMSAPI void               CMSEXPORT cmsFreeNamedColorList(cmsNAMEDCOLORLIST* v);"
  },
  {
    "name": "cmsDupNamedColorList",
    "signature": "CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsDupNamedColorList(const cmsNAMEDCOLORLIST* v);"
  },
  {
    "name": "cmsAppendNamedColor",
    "signature": "CMSAPI cmsBool            CMSEXPORT cmsAppendNamedColor(cmsNAMEDCOLORLIST* v, const char* Name,"
  },
  {
    "name": "cmsNamedColorCount",
    "signature": "CMSAPI cmsUInt32Number    CMSEXPORT cmsNamedColorCount(const cmsNAMEDCOLORLIST* v);"
  },
  {
    "name": "cmsNamedColorIndex",
    "signature": "CMSAPI cmsInt32Number     CMSEXPORT cmsNamedColorIndex(const cmsNAMEDCOLORLIST* v, const char* Name);"
  },
  {
    "name": "cmsNamedColorInfo",
    "signature": "CMSAPI cmsBool            CMSEXPORT cmsNamedColorInfo(const cmsNAMEDCOLORLIST* NamedColorList, cmsUInt32Number nColor,"
  },
  {
    "name": "cmsGetNamedColorList",
    "signature": "CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsGetNamedColorList(cmsHTRANSFORM xform);"
  },
  {
    "name": "cmsAllocProfileSequenceDescription",
    "signature": "CMSAPI cmsSEQ*           CMSEXPORT cmsAllocProfileSequenceDescription(cmsContext ContextID, cmsUInt32Number n);"
  },
  {
    "name": "cmsDupProfileSequenceDescription",
    "signature": "CMSAPI cmsSEQ*           CMSEXPORT cmsDupProfileSequenceDescription(const cmsSEQ* pseq);"
  },
  {
    "name": "cmsFreeProfileSequenceDescription",
    "signature": "CMSAPI void              CMSEXPORT cmsFreeProfileSequenceDescription(cmsSEQ* pseq);"
  },
  {
    "name": "cmsDictAlloc",
    "signature": "CMSAPI cmsHANDLE           CMSEXPORT cmsDictAlloc(cmsContext ContextID);"
  },
  {
    "name": "cmsDictFree",
    "signature": "CMSAPI void                CMSEXPORT cmsDictFree(cmsHANDLE hDict);"
  },
  {
    "name": "cmsDictDup",
    "signature": "CMSAPI cmsHANDLE           CMSEXPORT cmsDictDup(cmsHANDLE hDict);"
  },
  {
    "name": "cmsDictAddEntry",
    "signature": "CMSAPI cmsBool             CMSEXPORT cmsDictAddEntry(cmsHANDLE hDict, const wchar_t* Name, const wchar_t* Value, const cmsMLU *DisplayName, const cmsMLU *DisplayValue);"
  },
  {
    "name": "cmsDictGetEntryList",
    "signature": "CMSAPI const cmsDICTentry* CMSEXPORT cmsDictGetEntryList(cmsHANDLE hDict);"
  },
  {
    "name": "cmsDictNextEntry",
    "signature": "CMSAPI const cmsDICTentry* CMSEXPORT cmsDictNextEntry(const cmsDICTentry* e);"
  },
  {
    "name": "cmsCreateProfilePlaceholder",
    "signature": "CMSAPI cmsHPROFILE       CMSEXPORT cmsCreateProfilePlaceholder(cmsContext ContextID);"
  },
  {
    "name": "cmsGetProfileContextID",
    "signature": "CMSAPI cmsContext        CMSEXPORT cmsGetProfileContextID(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsGetTagCount",
    "signature": "CMSAPI cmsInt32Number    CMSEXPORT cmsGetTagCount(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsGetTagSignature",
    "signature": "CMSAPI cmsTagSignature   CMSEXPORT cmsGetTagSignature(cmsHPROFILE hProfile, cmsUInt32Number n);"
  },
  {
    "name": "cmsGetTagOffsetAndSize",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsGetTagOffsetAndSize(cmsHPROFILE hProfile, cmsUInt32Number n, cmsUInt32Number* offset, cmsUInt32Number* size);"
  },
  {
    "name": "cmsIsTag",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsTag(cmsHPROFILE hProfile, cmsTagSignature sig);"
  },
  {
    "name": "cmsReadTag",
    "signature": "CMSAPI void*             CMSEXPORT cmsReadTag(cmsHPROFILE hProfile, cmsTagSignature sig);"
  },
  {
    "name": "cmsWriteTag",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsWriteTag(cmsHPROFILE hProfile, cmsTagSignature sig, const void* data);"
  },
  {
    "name": "cmsLinkTag",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsLinkTag(cmsHPROFILE hProfile, cmsTagSignature sig, cmsTagSignature dest);"
  },
  {
    "name": "cmsTagLinkedTo",
    "signature": "CMSAPI cmsTagSignature   CMSEXPORT cmsTagLinkedTo(cmsHPROFILE hProfile, cmsTagSignature sig);"
  },
  {
    "name": "cmsReadRawTag",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsReadRawTag(cmsHPROFILE hProfile, cmsTagSignature sig, void* Buffer, cmsUInt32Number BufferSize);"
  },
  {
    "name": "cmsWriteRawTag",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsWriteRawTag(cmsHPROFILE hProfile, cmsTagSignature sig, const void* data, cmsUInt32Number Size);"
  },
  {
    "name": "cmsGetHeaderFlags",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderFlags(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsGetHeaderAttributes",
    "signature": "CMSAPI void              CMSEXPORT cmsGetHeaderAttributes(cmsHPROFILE hProfile, cmsUInt64Number* Flags);"
  },
  {
    "name": "cmsGetHeaderProfileID",
    "signature": "CMSAPI void              CMSEXPORT cmsGetHeaderProfileID(cmsHPROFILE hProfile, cmsUInt8Number* ProfileID);"
  },
  {
    "name": "cmsGetHeaderCreationDateTime",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsGetHeaderCreationDateTime(cmsHPROFILE hProfile, struct tm *Dest);"
  },
  {
    "name": "cmsGetHeaderRenderingIntent",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderRenderingIntent(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsSetHeaderFlags",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderFlags(cmsHPROFILE hProfile, cmsUInt32Number Flags);"
  },
  {
    "name": "cmsGetHeaderManufacturer",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderManufacturer(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsSetHeaderManufacturer",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderManufacturer(cmsHPROFILE hProfile, cmsUInt32Number manufacturer);"
  },
  {
    "name": "cmsGetHeaderCreator",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderCreator(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsGetHeaderModel",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderModel(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsSetHeaderModel",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderModel(cmsHPROFILE hProfile, cmsUInt32Number model);"
  },
  {
    "name": "cmsSetHeaderAttributes",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderAttributes(cmsHPROFILE hProfile, cmsUInt64Number Flags);"
  },
  {
    "name": "cmsSetHeaderProfileID",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderProfileID(cmsHPROFILE hProfile, cmsUInt8Number* ProfileID);"
  },
  {
    "name": "cmsSetHeaderRenderingIntent",
    "signature": "CMSAPI void              CMSEXPORT cmsSetHeaderRenderingIntent(cmsHPROFILE hProfile, cmsUInt32Number RenderingIntent);"
  },
  {
    "name": "cmsSetPCS",
    "signature": "CMSAPI void              CMSEXPORT cmsSetPCS(cmsHPROFILE hProfile, cmsColorSpaceSignature pcs);"
  },
  {
    "name": "cmsSetColorSpace",
    "signature": "CMSAPI void              CMSEXPORT cmsSetColorSpace(cmsHPROFILE hProfile, cmsColorSpaceSignature sig);"
  },
  {
    "name": "cmsSetDeviceClass",
    "signature": "CMSAPI void              CMSEXPORT cmsSetDeviceClass(cmsHPROFILE hProfile, cmsProfileClassSignature sig);"
  },
  {
    "name": "cmsSetProfileVersion",
    "signature": "CMSAPI void              CMSEXPORT cmsSetProfileVersion(cmsHPROFILE hProfile, cmsFloat64Number Version);"
  },
  {
    "name": "cmsGetProfileVersion",
    "signature": "CMSAPI cmsFloat64Number  CMSEXPORT cmsGetProfileVersion(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsGetEncodedICCversion",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetEncodedICCversion(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsSetEncodedICCversion",
    "signature": "CMSAPI void              CMSEXPORT cmsSetEncodedICCversion(cmsHPROFILE hProfile, cmsUInt32Number Version);"
  },
  {
    "name": "cmsIsIntentSupported",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsIntentSupported(cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number UsedDirection);"
  },
  {
    "name": "cmsIsMatrixShaper",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsMatrixShaper(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsIsCLUT",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsIsCLUT(cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number UsedDirection);"
  },
  {
    "name": "cmsChannelsOf",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsChannelsOf(cmsColorSpaceSignature ColorSpace);"
  },
  {
    "name": "cmsChannelsOfColorSpace",
    "signature": "CMSAPI cmsInt32Number CMSEXPORT cmsChannelsOfColorSpace(cmsColorSpaceSignature ColorSpace);"
  },
  {
    "name": "cmsFormatterForColorspaceOfProfile",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsFormatterForColorspaceOfProfile(cmsHPROFILE hProfile, cmsUInt32Number nBytes, cmsBool lIsFloat);"
  },
  {
    "name": "cmsFormatterForPCSOfProfile",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsFormatterForPCSOfProfile(cmsHPROFILE hProfile, cmsUInt32Number nBytes, cmsBool lIsFloat);"
  },
  {
    "name": "cmsGetProfileInfo",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetProfileInfo(cmsHPROFILE hProfile, cmsInfoType Info,"
  },
  {
    "name": "cmsGetProfileInfoASCII",
    "signature": "CMSAPI cmsUInt32Number   CMSEXPORT cmsGetProfileInfoASCII(cmsHPROFILE hProfile, cmsInfoType Info,"
  },
  {
    "name": "cmsGetProfileInfoUTF8",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetProfileInfoUTF8(cmsHPROFILE hProfile, cmsInfoType Info,"
  },
  {
    "name": "cmsOpenIOhandlerFromFile",
    "signature": "CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromFile(cmsContext ContextID, const char* FileName, const char* AccessMode);"
  },
  {
    "name": "cmsOpenIOhandlerFromStream",
    "signature": "CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromStream(cmsContext ContextID, FILE* Stream);"
  },
  {
    "name": "cmsOpenIOhandlerFromMem",
    "signature": "CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromMem(cmsContext ContextID, void *Buffer, cmsUInt32Number size, const char* AccessMode);"
  },
  {
    "name": "cmsOpenIOhandlerFromNULL",
    "signature": "CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromNULL(cmsContext ContextID);"
  },
  {
    "name": "cmsGetProfileIOhandler",
    "signature": "CMSAPI cmsIOHANDLER*     CMSEXPORT cmsGetProfileIOhandler(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsCloseIOhandler",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsCloseIOhandler(cmsIOHANDLER* io);"
  },
  {
    "name": "cmsMD5computeID",
    "signature": "CMSAPI cmsBool           CMSEXPORT cmsMD5computeID(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsOpenProfileFromFile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromFile(const char *ICCProfile, const char *sAccess);"
  },
  {
    "name": "cmsOpenProfileFromFileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromFileTHR(cmsContext ContextID, const char *ICCProfile, const char *sAccess);"
  },
  {
    "name": "cmsOpenProfileFromStream",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromStream(FILE* ICCProfile, const char* sAccess);"
  },
  {
    "name": "cmsOpenProfileFromStreamTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromStreamTHR(cmsContext ContextID, FILE* ICCProfile, const char* sAccess);"
  },
  {
    "name": "cmsOpenProfileFromMem",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromMem(const void * MemPtr, cmsUInt32Number dwSize);"
  },
  {
    "name": "cmsOpenProfileFromMemTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromMemTHR(cmsContext ContextID, const void * MemPtr, cmsUInt32Number dwSize);"
  },
  {
    "name": "cmsOpenProfileFromIOhandlerTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromIOhandlerTHR(cmsContext ContextID, cmsIOHANDLER* io);"
  },
  {
    "name": "cmsOpenProfileFromIOhandler2THR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromIOhandler2THR(cmsContext ContextID, cmsIOHANDLER* io, cmsBool write);"
  },
  {
    "name": "cmsCloseProfile",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsCloseProfile(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsSaveProfileToFile",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToFile(cmsHPROFILE hProfile, const char* FileName);"
  },
  {
    "name": "cmsSaveProfileToStream",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToStream(cmsHPROFILE hProfile, FILE* Stream);"
  },
  {
    "name": "cmsSaveProfileToMem",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToMem(cmsHPROFILE hProfile, void *MemPtr, cmsUInt32Number* BytesNeeded);"
  },
  {
    "name": "cmsSaveProfileToIOhandler",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsSaveProfileToIOhandler(cmsHPROFILE hProfile, cmsIOHANDLER* io);"
  },
  {
    "name": "cmsCreateRGBProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateRGBProfileTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateRGBProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateRGBProfile(const cmsCIExyY* WhitePoint,"
  },
  {
    "name": "cmsCreateGrayProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateGrayProfileTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateGrayProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateGrayProfile(const cmsCIExyY* WhitePoint,"
  },
  {
    "name": "cmsCreateLinearizationDeviceLinkTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLinearizationDeviceLinkTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateLinearizationDeviceLink",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLinearizationDeviceLink(cmsColorSpaceSignature ColorSpace,"
  },
  {
    "name": "cmsCreateInkLimitingDeviceLinkTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateInkLimitingDeviceLinkTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateInkLimitingDeviceLink",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateInkLimitingDeviceLink(cmsColorSpaceSignature ColorSpace, cmsFloat64Number Limit);"
  },
  {
    "name": "cmsCreateDeviceLinkFromCubeFile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateDeviceLinkFromCubeFile(const char* cFileName);"
  },
  {
    "name": "cmsCreateDeviceLinkFromCubeFileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateDeviceLinkFromCubeFileTHR(cmsContext ContextID, const char* cFileName);"
  },
  {
    "name": "cmsCreateLab2ProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab2ProfileTHR(cmsContext ContextID, const cmsCIExyY* WhitePoint);"
  },
  {
    "name": "cmsCreateLab2Profile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab2Profile(const cmsCIExyY* WhitePoint);"
  },
  {
    "name": "cmsCreateLab4ProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab4ProfileTHR(cmsContext ContextID, const cmsCIExyY* WhitePoint);"
  },
  {
    "name": "cmsCreateLab4Profile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab4Profile(const cmsCIExyY* WhitePoint);"
  },
  {
    "name": "cmsCreateXYZProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateXYZProfileTHR(cmsContext ContextID);"
  },
  {
    "name": "cmsCreateXYZProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateXYZProfile(void);"
  },
  {
    "name": "cmsCreate_sRGBProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_sRGBProfileTHR(cmsContext ContextID);"
  },
  {
    "name": "cmsCreate_sRGBProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_sRGBProfile(void);"
  },
  {
    "name": "cmsCreate_OkLabProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_OkLabProfile(cmsContext ctx);"
  },
  {
    "name": "cmsCreateBCHSWabstractProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateBCHSWabstractProfileTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateBCHSWabstractProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateBCHSWabstractProfile(cmsUInt32Number nLUTPoints,"
  },
  {
    "name": "cmsCreateNULLProfileTHR",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateNULLProfileTHR(cmsContext ContextID);"
  },
  {
    "name": "cmsCreateNULLProfile",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateNULLProfile(void);"
  },
  {
    "name": "cmsTransform2DeviceLink",
    "signature": "CMSAPI cmsHPROFILE      CMSEXPORT cmsTransform2DeviceLink(cmsHTRANSFORM hTransform, cmsFloat64Number Version, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsGetSupportedIntents",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetSupportedIntents(cmsUInt32Number nMax, cmsUInt32Number* Codes, char** Descriptions);"
  },
  {
    "name": "cmsGetSupportedIntentsTHR",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetSupportedIntentsTHR(cmsContext ContextID, cmsUInt32Number nMax, cmsUInt32Number* Codes, char** Descriptions);"
  },
  {
    "name": "cmsCreateTransformTHR",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateTransformTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateTransform",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateTransform(cmsHPROFILE Input,"
  },
  {
    "name": "cmsCreateProofingTransformTHR",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateProofingTransformTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateProofingTransform",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateProofingTransform(cmsHPROFILE Input,"
  },
  {
    "name": "cmsCreateMultiprofileTransformTHR",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateMultiprofileTransformTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsCreateMultiprofileTransform",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateMultiprofileTransform(cmsHPROFILE hProfiles[],"
  },
  {
    "name": "cmsCreateExtendedTransform",
    "signature": "CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateExtendedTransform(cmsContext ContextID,"
  },
  {
    "name": "cmsDeleteTransform",
    "signature": "CMSAPI void             CMSEXPORT cmsDeleteTransform(cmsHTRANSFORM hTransform);"
  },
  {
    "name": "cmsDoTransform",
    "signature": "CMSAPI void             CMSEXPORT cmsDoTransform(cmsHTRANSFORM Transform,"
  },
  {
    "name": "cmsDoTransformStride",
    "signature": "CMSAPI void             CMSEXPORT cmsDoTransformStride(cmsHTRANSFORM Transform,   // Deprecated"
  },
  {
    "name": "cmsDoTransformLineStride",
    "signature": "CMSAPI void             CMSEXPORT cmsDoTransformLineStride(cmsHTRANSFORM  Transform,"
  },
  {
    "name": "cmsSetAlarmCodes",
    "signature": "CMSAPI void             CMSEXPORT cmsSetAlarmCodes(const cmsUInt16Number NewAlarm[cmsMAXCHANNELS]);"
  },
  {
    "name": "cmsGetAlarmCodes",
    "signature": "CMSAPI void             CMSEXPORT cmsGetAlarmCodes(cmsUInt16Number NewAlarm[cmsMAXCHANNELS]);"
  },
  {
    "name": "cmsSetAlarmCodesTHR",
    "signature": "CMSAPI void             CMSEXPORT cmsSetAlarmCodesTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsGetAlarmCodesTHR",
    "signature": "CMSAPI void             CMSEXPORT cmsGetAlarmCodesTHR(cmsContext ContextID,"
  },
  {
    "name": "cmsSetAdaptationState",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsSetAdaptationState(cmsFloat64Number d);"
  },
  {
    "name": "cmsSetAdaptationStateTHR",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsSetAdaptationStateTHR(cmsContext ContextID, cmsFloat64Number d);"
  },
  {
    "name": "cmsGetTransformContextID",
    "signature": "CMSAPI cmsContext       CMSEXPORT cmsGetTransformContextID(cmsHTRANSFORM hTransform);"
  },
  {
    "name": "cmsGetTransformInputFormat",
    "signature": "CMSAPI cmsUInt32Number CMSEXPORT cmsGetTransformInputFormat(cmsHTRANSFORM hTransform);"
  },
  {
    "name": "cmsGetTransformOutputFormat",
    "signature": "CMSAPI cmsUInt32Number CMSEXPORT cmsGetTransformOutputFormat(cmsHTRANSFORM hTransform);"
  },
  {
    "name": "cmsChangeBuffersFormat",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsChangeBuffersFormat(cmsHTRANSFORM hTransform,"
  },
  {
    "name": "cmsGetPostScriptColorResource",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptColorResource(cmsContext ContextID,"
  },
  {
    "name": "cmsGetPostScriptCSA",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptCSA(cmsContext ContextID, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags, void* Buffer, cmsUInt32Number dwBufferLen);"
  },
  {
    "name": "cmsGetPostScriptCRD",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptCRD(cmsContext ContextID, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags, void* Buffer, cmsUInt32Number dwBufferLen);"
  },
  {
    "name": "cmsIT8Alloc",
    "signature": "CMSAPI cmsHANDLE        CMSEXPORT cmsIT8Alloc(cmsContext ContextID);"
  },
  {
    "name": "cmsIT8Free",
    "signature": "CMSAPI void             CMSEXPORT cmsIT8Free(cmsHANDLE hIT8);"
  },
  {
    "name": "cmsIT8TableCount",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8TableCount(cmsHANDLE hIT8);"
  },
  {
    "name": "cmsIT8SetTable",
    "signature": "CMSAPI cmsInt32Number   CMSEXPORT cmsIT8SetTable(cmsHANDLE hIT8, cmsUInt32Number nTable);"
  },
  {
    "name": "cmsIT8LoadFromFile",
    "signature": "CMSAPI cmsHANDLE        CMSEXPORT cmsIT8LoadFromFile(cmsContext ContextID, const char* cFileName);"
  },
  {
    "name": "cmsIT8LoadFromMem",
    "signature": "CMSAPI cmsHANDLE        CMSEXPORT cmsIT8LoadFromMem(cmsContext ContextID, const void *Ptr, cmsUInt32Number len);"
  },
  {
    "name": "cmsIT8SaveToFile",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SaveToFile(cmsHANDLE hIT8, const char* cFileName);"
  },
  {
    "name": "cmsIT8SaveToMem",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SaveToMem(cmsHANDLE hIT8, void *MemPtr, cmsUInt32Number* BytesNeeded);"
  },
  {
    "name": "cmsIT8GetSheetType",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetSheetType(cmsHANDLE hIT8);"
  },
  {
    "name": "cmsIT8SetSheetType",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetSheetType(cmsHANDLE hIT8, const char* Type);"
  },
  {
    "name": "cmsIT8SetComment",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetComment(cmsHANDLE hIT8, const char* cComment);"
  },
  {
    "name": "cmsIT8SetPropertyStr",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyStr(cmsHANDLE hIT8, const char* cProp, const char *Str);"
  },
  {
    "name": "cmsIT8SetPropertyDbl",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyDbl(cmsHANDLE hIT8, const char* cProp, cmsFloat64Number Val);"
  },
  {
    "name": "cmsIT8SetPropertyHex",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyHex(cmsHANDLE hIT8, const char* cProp, cmsUInt32Number Val);"
  },
  {
    "name": "cmsIT8SetPropertyMulti",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyMulti(cmsHANDLE hIT8, const char* Key, const char* SubKey, const char *Buffer);"
  },
  {
    "name": "cmsIT8SetPropertyUncooked",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyUncooked(cmsHANDLE hIT8, const char* Key, const char* Buffer);"
  },
  {
    "name": "cmsIT8GetProperty",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetProperty(cmsHANDLE hIT8, const char* cProp);"
  },
  {
    "name": "cmsIT8GetPropertyDbl",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetPropertyDbl(cmsHANDLE hIT8, const char* cProp);"
  },
  {
    "name": "cmsIT8GetPropertyMulti",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetPropertyMulti(cmsHANDLE hIT8, const char* Key, const char *SubKey);"
  },
  {
    "name": "cmsIT8EnumProperties",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8EnumProperties(cmsHANDLE hIT8, char ***PropertyNames);"
  },
  {
    "name": "cmsIT8EnumPropertyMulti",
    "signature": "CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8EnumPropertyMulti(cmsHANDLE hIT8, const char* cProp, const char ***SubpropertyNames);"
  },
  {
    "name": "cmsIT8GetDataRowCol",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetDataRowCol(cmsHANDLE hIT8, int row, int col);"
  },
  {
    "name": "cmsIT8GetDataRowColDbl",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetDataRowColDbl(cmsHANDLE hIT8, int row, int col);"
  },
  {
    "name": "cmsIT8SetDataRowCol",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataRowCol(cmsHANDLE hIT8, int row, int col,"
  },
  {
    "name": "cmsIT8SetDataRowColDbl",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataRowColDbl(cmsHANDLE hIT8, int row, int col,"
  },
  {
    "name": "cmsIT8GetData",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetData(cmsHANDLE hIT8, const char* cPatch, const char* cSample);"
  },
  {
    "name": "cmsIT8GetDataDbl",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetDataDbl(cmsHANDLE hIT8, const char* cPatch, const char* cSample);"
  },
  {
    "name": "cmsIT8SetData",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetData(cmsHANDLE hIT8, const char* cPatch,"
  },
  {
    "name": "cmsIT8SetDataDbl",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataDbl(cmsHANDLE hIT8, const char* cPatch,"
  },
  {
    "name": "cmsIT8FindDataFormat",
    "signature": "CMSAPI int              CMSEXPORT cmsIT8FindDataFormat(cmsHANDLE hIT8, const char* cSample);"
  },
  {
    "name": "cmsIT8SetDataFormat",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataFormat(cmsHANDLE hIT8, int n, const char *Sample);"
  },
  {
    "name": "cmsIT8EnumDataFormat",
    "signature": "CMSAPI int              CMSEXPORT cmsIT8EnumDataFormat(cmsHANDLE hIT8, char ***SampleNames);"
  },
  {
    "name": "cmsIT8GetPatchName",
    "signature": "CMSAPI const char*      CMSEXPORT cmsIT8GetPatchName(cmsHANDLE hIT8, int nPatch, char* buffer);"
  },
  {
    "name": "cmsIT8GetPatchByName",
    "signature": "CMSAPI int              CMSEXPORT cmsIT8GetPatchByName(cmsHANDLE hIT8, const char *cPatch);"
  },
  {
    "name": "cmsIT8SetTableByLabel",
    "signature": "CMSAPI int              CMSEXPORT cmsIT8SetTableByLabel(cmsHANDLE hIT8, const char* cSet, const char* cField, const char* ExpectedType);"
  },
  {
    "name": "cmsIT8SetIndexColumn",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsIT8SetIndexColumn(cmsHANDLE hIT8, const char* cSample);"
  },
  {
    "name": "cmsIT8DefineDblFormat",
    "signature": "CMSAPI void             CMSEXPORT cmsIT8DefineDblFormat(cmsHANDLE hIT8, const char* Formatter);"
  },
  {
    "name": "cmsGBDAlloc",
    "signature": "CMSAPI cmsHANDLE        CMSEXPORT cmsGBDAlloc(cmsContext ContextID);"
  },
  {
    "name": "cmsGBDFree",
    "signature": "CMSAPI void             CMSEXPORT cmsGBDFree(cmsHANDLE hGBD);"
  },
  {
    "name": "cmsGDBAddPoint",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsGDBAddPoint(cmsHANDLE hGBD, const cmsCIELab* Lab);"
  },
  {
    "name": "cmsGDBCompute",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsGDBCompute(cmsHANDLE  hGDB, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsGDBCheckPoint",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsGDBCheckPoint(cmsHANDLE hGBD, const cmsCIELab* Lab);"
  },
  {
    "name": "cmsDetectBlackPoint",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsDetectBlackPoint(cmsCIEXYZ* BlackPoint, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsDetectDestinationBlackPoint",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsDetectDestinationBlackPoint(cmsCIEXYZ* BlackPoint, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags);"
  },
  {
    "name": "cmsDetectTAC",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsDetectTAC(cmsHPROFILE hProfile);"
  },
  {
    "name": "cmsDetectRGBProfileGamma",
    "signature": "CMSAPI cmsFloat64Number CMSEXPORT cmsDetectRGBProfileGamma(cmsHPROFILE hProfile, cmsFloat64Number threshold);"
  },
  {
    "name": "cmsDesaturateLab",
    "signature": "CMSAPI cmsBool          CMSEXPORT cmsDesaturateLab(cmsCIELab* Lab,"
  }
] as const;
