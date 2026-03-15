# Upstream API Surface

Source: `tmp/Little-CMS/include/lcms2.h`

Extracted entries: 287

| API | Signature |
| --- | --- |
| `cmsGetEncodedCMMversion` | `CMSAPI int               CMSEXPORT cmsGetEncodedCMMversion(void);` |
| `cmsstrcasecmp` | `CMSAPI int               CMSEXPORT cmsstrcasecmp(const char* s1, const char* s2);` |
| `cmsfilelength` | `CMSAPI long int          CMSEXPORT cmsfilelength(FILE* f);` |
| `cmsCreateContext` | `CMSAPI cmsContext       CMSEXPORT cmsCreateContext(void* Plugin, void* UserData);` |
| `cmsDeleteContext` | `CMSAPI void             CMSEXPORT cmsDeleteContext(cmsContext ContextID);` |
| `cmsDupContext` | `CMSAPI cmsContext       CMSEXPORT cmsDupContext(cmsContext ContextID, void* NewUserData);` |
| `cmsGetContextUserData` | `CMSAPI void*            CMSEXPORT cmsGetContextUserData(cmsContext ContextID);` |
| `cmsPlugin` | `CMSAPI cmsBool           CMSEXPORT cmsPlugin(void* Plugin);` |
| `cmsPluginTHR` | `CMSAPI cmsBool           CMSEXPORT cmsPluginTHR(cmsContext ContextID, void* Plugin);` |
| `cmsUnregisterPlugins` | `CMSAPI void              CMSEXPORT cmsUnregisterPlugins(void);` |
| `cmsUnregisterPluginsTHR` | `CMSAPI void              CMSEXPORT cmsUnregisterPluginsTHR(cmsContext ContextID);` |
| `cmsSetLogErrorHandler` | `CMSAPI void              CMSEXPORT cmsSetLogErrorHandler(cmsLogErrorHandlerFunction Fn);` |
| `cmsSetLogErrorHandlerTHR` | `CMSAPI void              CMSEXPORT cmsSetLogErrorHandlerTHR(cmsContext ContextID, cmsLogErrorHandlerFunction Fn);` |
| `cmsD50_XYZ` | `CMSAPI const cmsCIEXYZ*  CMSEXPORT cmsD50_XYZ(void);` |
| `cmsD50_xyY` | `CMSAPI const cmsCIExyY*  CMSEXPORT cmsD50_xyY(void);` |
| `cmsXYZ2xyY` | `CMSAPI void              CMSEXPORT cmsXYZ2xyY(cmsCIExyY* Dest, const cmsCIEXYZ* Source);` |
| `cmsxyY2XYZ` | `CMSAPI void              CMSEXPORT cmsxyY2XYZ(cmsCIEXYZ* Dest, const cmsCIExyY* Source);` |
| `cmsXYZ2Lab` | `CMSAPI void              CMSEXPORT cmsXYZ2Lab(const cmsCIEXYZ* WhitePoint, cmsCIELab* Lab, const cmsCIEXYZ* xyz);` |
| `cmsLab2XYZ` | `CMSAPI void              CMSEXPORT cmsLab2XYZ(const cmsCIEXYZ* WhitePoint, cmsCIEXYZ* xyz, const cmsCIELab* Lab);` |
| `cmsLab2LCh` | `CMSAPI void              CMSEXPORT cmsLab2LCh(cmsCIELCh*LCh, const cmsCIELab* Lab);` |
| `cmsLCh2Lab` | `CMSAPI void              CMSEXPORT cmsLCh2Lab(cmsCIELab* Lab, const cmsCIELCh* LCh);` |
| `cmsLabEncoded2Float` | `CMSAPI void              CMSEXPORT cmsLabEncoded2Float(cmsCIELab* Lab, const cmsUInt16Number wLab[3]);` |
| `cmsLabEncoded2FloatV2` | `CMSAPI void              CMSEXPORT cmsLabEncoded2FloatV2(cmsCIELab* Lab, const cmsUInt16Number wLab[3]);` |
| `cmsFloat2LabEncoded` | `CMSAPI void              CMSEXPORT cmsFloat2LabEncoded(cmsUInt16Number wLab[3], const cmsCIELab* Lab);` |
| `cmsFloat2LabEncodedV2` | `CMSAPI void              CMSEXPORT cmsFloat2LabEncodedV2(cmsUInt16Number wLab[3], const cmsCIELab* Lab);` |
| `cmsXYZEncoded2Float` | `CMSAPI void              CMSEXPORT cmsXYZEncoded2Float(cmsCIEXYZ* fxyz, const cmsUInt16Number XYZ[3]);` |
| `cmsFloat2XYZEncoded` | `CMSAPI void              CMSEXPORT cmsFloat2XYZEncoded(cmsUInt16Number XYZ[3], const cmsCIEXYZ* fXYZ);` |
| `cmsDeltaE` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsDeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);` |
| `cmsCIE94DeltaE` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsCIE94DeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);` |
| `cmsBFDdeltaE` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsBFDdeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2);` |
| `cmsCMCdeltaE` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsCMCdeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2, cmsFloat64Number l, cmsFloat64Number c);` |
| `cmsCIE2000DeltaE` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsCIE2000DeltaE(const cmsCIELab* Lab1, const cmsCIELab* Lab2, cmsFloat64Number Kl, cmsFloat64Number Kc, cmsFloat64Number Kh);` |
| `cmsWhitePointFromTemp` | `CMSAPI cmsBool           CMSEXPORT cmsWhitePointFromTemp(cmsCIExyY* WhitePoint, cmsFloat64Number  TempK);` |
| `cmsTempFromWhitePoint` | `CMSAPI cmsBool           CMSEXPORT cmsTempFromWhitePoint(cmsFloat64Number* TempK, const cmsCIExyY* WhitePoint);` |
| `cmsAdaptToIlluminant` | `CMSAPI cmsBool           CMSEXPORT cmsAdaptToIlluminant(cmsCIEXYZ* Result, const cmsCIEXYZ* SourceWhitePt,` |
| `cmsCIECAM02Init` | `CMSAPI cmsHANDLE         CMSEXPORT cmsCIECAM02Init(cmsContext ContextID, const cmsViewingConditions* pVC);` |
| `cmsCIECAM02Done` | `CMSAPI void              CMSEXPORT cmsCIECAM02Done(cmsHANDLE hModel);` |
| `cmsCIECAM02Forward` | `CMSAPI void              CMSEXPORT cmsCIECAM02Forward(cmsHANDLE hModel, const cmsCIEXYZ* pIn, cmsJCh* pOut);` |
| `cmsCIECAM02Reverse` | `CMSAPI void              CMSEXPORT cmsCIECAM02Reverse(cmsHANDLE hModel, const cmsJCh* pIn,    cmsCIEXYZ* pOut);` |
| `cmsBuildSegmentedToneCurve` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildSegmentedToneCurve(cmsContext ContextID, cmsUInt32Number nSegments, const cmsCurveSegment Segments[]);` |
| `cmsBuildParametricToneCurve` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildParametricToneCurve(cmsContext ContextID, cmsInt32Number Type, const cmsFloat64Number Params[]);` |
| `cmsBuildGamma` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildGamma(cmsContext ContextID, cmsFloat64Number Gamma);` |
| `cmsBuildTabulatedToneCurve16` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildTabulatedToneCurve16(cmsContext ContextID, cmsUInt32Number nEntries, const cmsUInt16Number values[]);` |
| `cmsBuildTabulatedToneCurveFloat` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsBuildTabulatedToneCurveFloat(cmsContext ContextID, cmsUInt32Number nEntries, const cmsFloat32Number values[]);` |
| `cmsFreeToneCurve` | `CMSAPI void              CMSEXPORT cmsFreeToneCurve(cmsToneCurve* Curve);` |
| `cmsFreeToneCurveTriple` | `CMSAPI void              CMSEXPORT cmsFreeToneCurveTriple(cmsToneCurve* Curve[3]);` |
| `cmsDupToneCurve` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsDupToneCurve(const cmsToneCurve* Src);` |
| `cmsReverseToneCurve` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsReverseToneCurve(const cmsToneCurve* InGamma);` |
| `cmsReverseToneCurveEx` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsReverseToneCurveEx(cmsUInt32Number nResultSamples, const cmsToneCurve* InGamma);` |
| `cmsJoinToneCurve` | `CMSAPI cmsToneCurve*     CMSEXPORT cmsJoinToneCurve(cmsContext ContextID, const cmsToneCurve* X,  const cmsToneCurve* Y, cmsUInt32Number nPoints);` |
| `cmsSmoothToneCurve` | `CMSAPI cmsBool           CMSEXPORT cmsSmoothToneCurve(cmsToneCurve* Tab, cmsFloat64Number lambda);` |
| `cmsEvalToneCurveFloat` | `CMSAPI cmsFloat32Number  CMSEXPORT cmsEvalToneCurveFloat(const cmsToneCurve* Curve, cmsFloat32Number v);` |
| `cmsEvalToneCurve16` | `CMSAPI cmsUInt16Number   CMSEXPORT cmsEvalToneCurve16(const cmsToneCurve* Curve, cmsUInt16Number v);` |
| `cmsIsToneCurveMultisegment` | `CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveMultisegment(const cmsToneCurve* InGamma);` |
| `cmsIsToneCurveLinear` | `CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveLinear(const cmsToneCurve* Curve);` |
| `cmsIsToneCurveMonotonic` | `CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveMonotonic(const cmsToneCurve* t);` |
| `cmsIsToneCurveDescending` | `CMSAPI cmsBool           CMSEXPORT cmsIsToneCurveDescending(const cmsToneCurve* t);` |
| `cmsGetToneCurveParametricType` | `CMSAPI cmsInt32Number    CMSEXPORT cmsGetToneCurveParametricType(const cmsToneCurve* t);` |
| `cmsEstimateGamma` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsEstimateGamma(const cmsToneCurve* t, cmsFloat64Number Precision);` |
| `cmsGetToneCurveSegment` | `CMSAPI const cmsCurveSegment* CMSEXPORT cmsGetToneCurveSegment(cmsInt32Number n, const cmsToneCurve* t);` |
| `cmsGetToneCurveEstimatedTableEntries` | `CMSAPI cmsUInt32Number         CMSEXPORT cmsGetToneCurveEstimatedTableEntries(const cmsToneCurve* t);` |
| `cmsGetToneCurveEstimatedTable` | `CMSAPI const cmsUInt16Number*  CMSEXPORT cmsGetToneCurveEstimatedTable(const cmsToneCurve* t);` |
| `cmsPipelineAlloc` | `CMSAPI cmsPipeline*      CMSEXPORT cmsPipelineAlloc(cmsContext ContextID, cmsUInt32Number InputChannels, cmsUInt32Number OutputChannels);` |
| `cmsPipelineFree` | `CMSAPI void              CMSEXPORT cmsPipelineFree(cmsPipeline* lut);` |
| `cmsPipelineDup` | `CMSAPI cmsPipeline*      CMSEXPORT cmsPipelineDup(const cmsPipeline* Orig);` |
| `cmsGetPipelineContextID` | `CMSAPI cmsContext        CMSEXPORT cmsGetPipelineContextID(const cmsPipeline* lut);` |
| `cmsPipelineInputChannels` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineInputChannels(const cmsPipeline* lut);` |
| `cmsPipelineOutputChannels` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineOutputChannels(const cmsPipeline* lut);` |
| `cmsPipelineStageCount` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsPipelineStageCount(const cmsPipeline* lut);` |
| `cmsPipelineGetPtrToFirstStage` | `CMSAPI cmsStage*         CMSEXPORT cmsPipelineGetPtrToFirstStage(const cmsPipeline* lut);` |
| `cmsPipelineGetPtrToLastStage` | `CMSAPI cmsStage*         CMSEXPORT cmsPipelineGetPtrToLastStage(const cmsPipeline* lut);` |
| `cmsPipelineEval16` | `CMSAPI void              CMSEXPORT cmsPipelineEval16(const cmsUInt16Number In[], cmsUInt16Number Out[], const cmsPipeline* lut);` |
| `cmsPipelineEvalFloat` | `CMSAPI void              CMSEXPORT cmsPipelineEvalFloat(const cmsFloat32Number In[], cmsFloat32Number Out[], const cmsPipeline* lut);` |
| `cmsPipelineEvalReverseFloat` | `CMSAPI cmsBool           CMSEXPORT cmsPipelineEvalReverseFloat(cmsFloat32Number Target[], cmsFloat32Number Result[], cmsFloat32Number Hint[], const cmsPipeline* lut);` |
| `cmsPipelineCat` | `CMSAPI cmsBool           CMSEXPORT cmsPipelineCat(cmsPipeline* l1, const cmsPipeline* l2);` |
| `cmsPipelineSetSaveAs8bitsFlag` | `CMSAPI cmsBool           CMSEXPORT cmsPipelineSetSaveAs8bitsFlag(cmsPipeline* lut, cmsBool On);` |
| `cmsPipelineInsertStage` | `CMSAPI cmsBool           CMSEXPORT cmsPipelineInsertStage(cmsPipeline* lut, cmsStageLoc loc, cmsStage* mpe);` |
| `cmsPipelineUnlinkStage` | `CMSAPI void              CMSEXPORT cmsPipelineUnlinkStage(cmsPipeline* lut, cmsStageLoc loc, cmsStage** mpe);` |
| `cmsPipelineCheckAndRetreiveStages` | `CMSAPI cmsBool           CMSEXPORT cmsPipelineCheckAndRetreiveStages(const cmsPipeline* Lut, cmsUInt32Number n, ...);` |
| `cmsStageAllocIdentity` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocIdentity(cmsContext ContextID, cmsUInt32Number nChannels);` |
| `cmsStageAllocToneCurves` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocToneCurves(cmsContext ContextID, cmsUInt32Number nChannels, cmsToneCurve* const Curves[]);` |
| `cmsStageAllocMatrix` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocMatrix(cmsContext ContextID, cmsUInt32Number Rows, cmsUInt32Number Cols, const cmsFloat64Number* Matrix, const cmsFloat64Number* Offset);` |
| `cmsStageAllocCLut16bit` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLut16bit(cmsContext ContextID, cmsUInt32Number nGridPoints, cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsUInt16Number* Table);` |
| `cmsStageAllocCLutFloat` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLutFloat(cmsContext ContextID, cmsUInt32Number nGridPoints, cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsFloat32Number* Table);` |
| `cmsStageAllocCLut16bitGranular` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLut16bitGranular(cmsContext ContextID, const cmsUInt32Number clutPoints[], cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsUInt16Number* Table);` |
| `cmsStageAllocCLutFloatGranular` | `CMSAPI cmsStage*         CMSEXPORT cmsStageAllocCLutFloatGranular(cmsContext ContextID, const cmsUInt32Number clutPoints[], cmsUInt32Number inputChan, cmsUInt32Number outputChan, const cmsFloat32Number* Table);` |
| `cmsStageDup` | `CMSAPI cmsStage*         CMSEXPORT cmsStageDup(cmsStage* mpe);` |
| `cmsStageFree` | `CMSAPI void              CMSEXPORT cmsStageFree(cmsStage* mpe);` |
| `cmsStageNext` | `CMSAPI cmsStage*         CMSEXPORT cmsStageNext(const cmsStage* mpe);` |
| `cmsStageInputChannels` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsStageInputChannels(const cmsStage* mpe);` |
| `cmsStageOutputChannels` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsStageOutputChannels(const cmsStage* mpe);` |
| `cmsStageType` | `CMSAPI cmsStageSignature CMSEXPORT cmsStageType(const cmsStage* mpe);` |
| `cmsStageData` | `CMSAPI void*             CMSEXPORT cmsStageData(const cmsStage* mpe);` |
| `cmsGetStageContextID` | `CMSAPI cmsContext        CMSEXPORT cmsGetStageContextID(const cmsStage* mpe);` |
| `cmsStageSampleCLut16bit` | `CMSAPI cmsBool           CMSEXPORT cmsStageSampleCLut16bit(cmsStage* mpe, cmsSAMPLER16 Sampler, void* Cargo, cmsUInt32Number dwFlags);` |
| `cmsStageSampleCLutFloat` | `CMSAPI cmsBool           CMSEXPORT cmsStageSampleCLutFloat(cmsStage* mpe, cmsSAMPLERFLOAT Sampler, void* Cargo, cmsUInt32Number dwFlags);` |
| `cmsSliceSpace16` | `CMSAPI cmsBool           CMSEXPORT cmsSliceSpace16(cmsUInt32Number nInputs, const cmsUInt32Number clutPoints[],` |
| `cmsSliceSpaceFloat` | `CMSAPI cmsBool           CMSEXPORT cmsSliceSpaceFloat(cmsUInt32Number nInputs, const cmsUInt32Number clutPoints[],` |
| `cmsMLUalloc` | `CMSAPI cmsMLU*           CMSEXPORT cmsMLUalloc(cmsContext ContextID, cmsUInt32Number nItems);` |
| `cmsMLUfree` | `CMSAPI void              CMSEXPORT cmsMLUfree(cmsMLU* mlu);` |
| `cmsMLUdup` | `CMSAPI cmsMLU*           CMSEXPORT cmsMLUdup(const cmsMLU* mlu);` |
| `cmsMLUsetASCII` | `CMSAPI cmsBool           CMSEXPORT cmsMLUsetASCII(cmsMLU* mlu,` |
| `cmsMLUsetWide` | `CMSAPI cmsBool           CMSEXPORT cmsMLUsetWide(cmsMLU* mlu,` |
| `cmsMLUsetUTF8` | `CMSAPI cmsBool           CMSEXPORT cmsMLUsetUTF8(cmsMLU* mlu,` |
| `cmsMLUgetASCII` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetASCII(const cmsMLU* mlu,` |
| `cmsMLUgetWide` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetWide(const cmsMLU* mlu,` |
| `cmsMLUgetUTF8` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUgetUTF8(const cmsMLU* mlu,` |
| `cmsMLUgetTranslation` | `CMSAPI cmsBool           CMSEXPORT cmsMLUgetTranslation(const cmsMLU* mlu,` |
| `cmsMLUtranslationsCount` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsMLUtranslationsCount(const cmsMLU* mlu);` |
| `cmsMLUtranslationsCodes` | `CMSAPI cmsBool           CMSEXPORT cmsMLUtranslationsCodes(const cmsMLU* mlu,` |
| `cmsAllocNamedColorList` | `CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsAllocNamedColorList(cmsContext ContextID,` |
| `cmsFreeNamedColorList` | `CMSAPI void               CMSEXPORT cmsFreeNamedColorList(cmsNAMEDCOLORLIST* v);` |
| `cmsDupNamedColorList` | `CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsDupNamedColorList(const cmsNAMEDCOLORLIST* v);` |
| `cmsAppendNamedColor` | `CMSAPI cmsBool            CMSEXPORT cmsAppendNamedColor(cmsNAMEDCOLORLIST* v, const char* Name,` |
| `cmsNamedColorCount` | `CMSAPI cmsUInt32Number    CMSEXPORT cmsNamedColorCount(const cmsNAMEDCOLORLIST* v);` |
| `cmsNamedColorIndex` | `CMSAPI cmsInt32Number     CMSEXPORT cmsNamedColorIndex(const cmsNAMEDCOLORLIST* v, const char* Name);` |
| `cmsNamedColorInfo` | `CMSAPI cmsBool            CMSEXPORT cmsNamedColorInfo(const cmsNAMEDCOLORLIST* NamedColorList, cmsUInt32Number nColor,` |
| `cmsGetNamedColorList` | `CMSAPI cmsNAMEDCOLORLIST* CMSEXPORT cmsGetNamedColorList(cmsHTRANSFORM xform);` |
| `cmsAllocProfileSequenceDescription` | `CMSAPI cmsSEQ*           CMSEXPORT cmsAllocProfileSequenceDescription(cmsContext ContextID, cmsUInt32Number n);` |
| `cmsDupProfileSequenceDescription` | `CMSAPI cmsSEQ*           CMSEXPORT cmsDupProfileSequenceDescription(const cmsSEQ* pseq);` |
| `cmsFreeProfileSequenceDescription` | `CMSAPI void              CMSEXPORT cmsFreeProfileSequenceDescription(cmsSEQ* pseq);` |
| `cmsDictAlloc` | `CMSAPI cmsHANDLE           CMSEXPORT cmsDictAlloc(cmsContext ContextID);` |
| `cmsDictFree` | `CMSAPI void                CMSEXPORT cmsDictFree(cmsHANDLE hDict);` |
| `cmsDictDup` | `CMSAPI cmsHANDLE           CMSEXPORT cmsDictDup(cmsHANDLE hDict);` |
| `cmsDictAddEntry` | `CMSAPI cmsBool             CMSEXPORT cmsDictAddEntry(cmsHANDLE hDict, const wchar_t* Name, const wchar_t* Value, const cmsMLU *DisplayName, const cmsMLU *DisplayValue);` |
| `cmsDictGetEntryList` | `CMSAPI const cmsDICTentry* CMSEXPORT cmsDictGetEntryList(cmsHANDLE hDict);` |
| `cmsDictNextEntry` | `CMSAPI const cmsDICTentry* CMSEXPORT cmsDictNextEntry(const cmsDICTentry* e);` |
| `cmsCreateProfilePlaceholder` | `CMSAPI cmsHPROFILE       CMSEXPORT cmsCreateProfilePlaceholder(cmsContext ContextID);` |
| `cmsGetProfileContextID` | `CMSAPI cmsContext        CMSEXPORT cmsGetProfileContextID(cmsHPROFILE hProfile);` |
| `cmsGetTagCount` | `CMSAPI cmsInt32Number    CMSEXPORT cmsGetTagCount(cmsHPROFILE hProfile);` |
| `cmsGetTagSignature` | `CMSAPI cmsTagSignature   CMSEXPORT cmsGetTagSignature(cmsHPROFILE hProfile, cmsUInt32Number n);` |
| `cmsGetTagOffsetAndSize` | `CMSAPI cmsBool           CMSEXPORT cmsGetTagOffsetAndSize(cmsHPROFILE hProfile, cmsUInt32Number n, cmsUInt32Number* offset, cmsUInt32Number* size);` |
| `cmsIsTag` | `CMSAPI cmsBool           CMSEXPORT cmsIsTag(cmsHPROFILE hProfile, cmsTagSignature sig);` |
| `cmsReadTag` | `CMSAPI void*             CMSEXPORT cmsReadTag(cmsHPROFILE hProfile, cmsTagSignature sig);` |
| `cmsWriteTag` | `CMSAPI cmsBool           CMSEXPORT cmsWriteTag(cmsHPROFILE hProfile, cmsTagSignature sig, const void* data);` |
| `cmsLinkTag` | `CMSAPI cmsBool           CMSEXPORT cmsLinkTag(cmsHPROFILE hProfile, cmsTagSignature sig, cmsTagSignature dest);` |
| `cmsTagLinkedTo` | `CMSAPI cmsTagSignature   CMSEXPORT cmsTagLinkedTo(cmsHPROFILE hProfile, cmsTagSignature sig);` |
| `cmsReadRawTag` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsReadRawTag(cmsHPROFILE hProfile, cmsTagSignature sig, void* Buffer, cmsUInt32Number BufferSize);` |
| `cmsWriteRawTag` | `CMSAPI cmsBool           CMSEXPORT cmsWriteRawTag(cmsHPROFILE hProfile, cmsTagSignature sig, const void* data, cmsUInt32Number Size);` |
| `cmsGetHeaderFlags` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderFlags(cmsHPROFILE hProfile);` |
| `cmsGetHeaderAttributes` | `CMSAPI void              CMSEXPORT cmsGetHeaderAttributes(cmsHPROFILE hProfile, cmsUInt64Number* Flags);` |
| `cmsGetHeaderProfileID` | `CMSAPI void              CMSEXPORT cmsGetHeaderProfileID(cmsHPROFILE hProfile, cmsUInt8Number* ProfileID);` |
| `cmsGetHeaderCreationDateTime` | `CMSAPI cmsBool           CMSEXPORT cmsGetHeaderCreationDateTime(cmsHPROFILE hProfile, struct tm *Dest);` |
| `cmsGetHeaderRenderingIntent` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderRenderingIntent(cmsHPROFILE hProfile);` |
| `cmsSetHeaderFlags` | `CMSAPI void              CMSEXPORT cmsSetHeaderFlags(cmsHPROFILE hProfile, cmsUInt32Number Flags);` |
| `cmsGetHeaderManufacturer` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderManufacturer(cmsHPROFILE hProfile);` |
| `cmsSetHeaderManufacturer` | `CMSAPI void              CMSEXPORT cmsSetHeaderManufacturer(cmsHPROFILE hProfile, cmsUInt32Number manufacturer);` |
| `cmsGetHeaderCreator` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderCreator(cmsHPROFILE hProfile);` |
| `cmsGetHeaderModel` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetHeaderModel(cmsHPROFILE hProfile);` |
| `cmsSetHeaderModel` | `CMSAPI void              CMSEXPORT cmsSetHeaderModel(cmsHPROFILE hProfile, cmsUInt32Number model);` |
| `cmsSetHeaderAttributes` | `CMSAPI void              CMSEXPORT cmsSetHeaderAttributes(cmsHPROFILE hProfile, cmsUInt64Number Flags);` |
| `cmsSetHeaderProfileID` | `CMSAPI void              CMSEXPORT cmsSetHeaderProfileID(cmsHPROFILE hProfile, cmsUInt8Number* ProfileID);` |
| `cmsSetHeaderRenderingIntent` | `CMSAPI void              CMSEXPORT cmsSetHeaderRenderingIntent(cmsHPROFILE hProfile, cmsUInt32Number RenderingIntent);` |
| `cmsSetPCS` | `CMSAPI void              CMSEXPORT cmsSetPCS(cmsHPROFILE hProfile, cmsColorSpaceSignature pcs);` |
| `cmsSetColorSpace` | `CMSAPI void              CMSEXPORT cmsSetColorSpace(cmsHPROFILE hProfile, cmsColorSpaceSignature sig);` |
| `cmsSetDeviceClass` | `CMSAPI void              CMSEXPORT cmsSetDeviceClass(cmsHPROFILE hProfile, cmsProfileClassSignature sig);` |
| `cmsSetProfileVersion` | `CMSAPI void              CMSEXPORT cmsSetProfileVersion(cmsHPROFILE hProfile, cmsFloat64Number Version);` |
| `cmsGetProfileVersion` | `CMSAPI cmsFloat64Number  CMSEXPORT cmsGetProfileVersion(cmsHPROFILE hProfile);` |
| `cmsGetEncodedICCversion` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetEncodedICCversion(cmsHPROFILE hProfile);` |
| `cmsSetEncodedICCversion` | `CMSAPI void              CMSEXPORT cmsSetEncodedICCversion(cmsHPROFILE hProfile, cmsUInt32Number Version);` |
| `cmsIsIntentSupported` | `CMSAPI cmsBool           CMSEXPORT cmsIsIntentSupported(cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number UsedDirection);` |
| `cmsIsMatrixShaper` | `CMSAPI cmsBool           CMSEXPORT cmsIsMatrixShaper(cmsHPROFILE hProfile);` |
| `cmsIsCLUT` | `CMSAPI cmsBool           CMSEXPORT cmsIsCLUT(cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number UsedDirection);` |
| `cmsChannelsOf` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsChannelsOf(cmsColorSpaceSignature ColorSpace);` |
| `cmsChannelsOfColorSpace` | `CMSAPI cmsInt32Number CMSEXPORT cmsChannelsOfColorSpace(cmsColorSpaceSignature ColorSpace);` |
| `cmsFormatterForColorspaceOfProfile` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsFormatterForColorspaceOfProfile(cmsHPROFILE hProfile, cmsUInt32Number nBytes, cmsBool lIsFloat);` |
| `cmsFormatterForPCSOfProfile` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsFormatterForPCSOfProfile(cmsHPROFILE hProfile, cmsUInt32Number nBytes, cmsBool lIsFloat);` |
| `cmsGetProfileInfo` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetProfileInfo(cmsHPROFILE hProfile, cmsInfoType Info,` |
| `cmsGetProfileInfoASCII` | `CMSAPI cmsUInt32Number   CMSEXPORT cmsGetProfileInfoASCII(cmsHPROFILE hProfile, cmsInfoType Info,` |
| `cmsGetProfileInfoUTF8` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetProfileInfoUTF8(cmsHPROFILE hProfile, cmsInfoType Info,` |
| `cmsOpenIOhandlerFromFile` | `CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromFile(cmsContext ContextID, const char* FileName, const char* AccessMode);` |
| `cmsOpenIOhandlerFromStream` | `CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromStream(cmsContext ContextID, FILE* Stream);` |
| `cmsOpenIOhandlerFromMem` | `CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromMem(cmsContext ContextID, void *Buffer, cmsUInt32Number size, const char* AccessMode);` |
| `cmsOpenIOhandlerFromNULL` | `CMSAPI cmsIOHANDLER*     CMSEXPORT cmsOpenIOhandlerFromNULL(cmsContext ContextID);` |
| `cmsGetProfileIOhandler` | `CMSAPI cmsIOHANDLER*     CMSEXPORT cmsGetProfileIOhandler(cmsHPROFILE hProfile);` |
| `cmsCloseIOhandler` | `CMSAPI cmsBool           CMSEXPORT cmsCloseIOhandler(cmsIOHANDLER* io);` |
| `cmsMD5computeID` | `CMSAPI cmsBool           CMSEXPORT cmsMD5computeID(cmsHPROFILE hProfile);` |
| `cmsOpenProfileFromFile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromFile(const char *ICCProfile, const char *sAccess);` |
| `cmsOpenProfileFromFileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromFileTHR(cmsContext ContextID, const char *ICCProfile, const char *sAccess);` |
| `cmsOpenProfileFromStream` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromStream(FILE* ICCProfile, const char* sAccess);` |
| `cmsOpenProfileFromStreamTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromStreamTHR(cmsContext ContextID, FILE* ICCProfile, const char* sAccess);` |
| `cmsOpenProfileFromMem` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromMem(const void * MemPtr, cmsUInt32Number dwSize);` |
| `cmsOpenProfileFromMemTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromMemTHR(cmsContext ContextID, const void * MemPtr, cmsUInt32Number dwSize);` |
| `cmsOpenProfileFromIOhandlerTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromIOhandlerTHR(cmsContext ContextID, cmsIOHANDLER* io);` |
| `cmsOpenProfileFromIOhandler2THR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsOpenProfileFromIOhandler2THR(cmsContext ContextID, cmsIOHANDLER* io, cmsBool write);` |
| `cmsCloseProfile` | `CMSAPI cmsBool          CMSEXPORT cmsCloseProfile(cmsHPROFILE hProfile);` |
| `cmsSaveProfileToFile` | `CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToFile(cmsHPROFILE hProfile, const char* FileName);` |
| `cmsSaveProfileToStream` | `CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToStream(cmsHPROFILE hProfile, FILE* Stream);` |
| `cmsSaveProfileToMem` | `CMSAPI cmsBool          CMSEXPORT cmsSaveProfileToMem(cmsHPROFILE hProfile, void *MemPtr, cmsUInt32Number* BytesNeeded);` |
| `cmsSaveProfileToIOhandler` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsSaveProfileToIOhandler(cmsHPROFILE hProfile, cmsIOHANDLER* io);` |
| `cmsCreateRGBProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateRGBProfileTHR(cmsContext ContextID,` |
| `cmsCreateRGBProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateRGBProfile(const cmsCIExyY* WhitePoint,` |
| `cmsCreateGrayProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateGrayProfileTHR(cmsContext ContextID,` |
| `cmsCreateGrayProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateGrayProfile(const cmsCIExyY* WhitePoint,` |
| `cmsCreateLinearizationDeviceLinkTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLinearizationDeviceLinkTHR(cmsContext ContextID,` |
| `cmsCreateLinearizationDeviceLink` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLinearizationDeviceLink(cmsColorSpaceSignature ColorSpace,` |
| `cmsCreateInkLimitingDeviceLinkTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateInkLimitingDeviceLinkTHR(cmsContext ContextID,` |
| `cmsCreateInkLimitingDeviceLink` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateInkLimitingDeviceLink(cmsColorSpaceSignature ColorSpace, cmsFloat64Number Limit);` |
| `cmsCreateDeviceLinkFromCubeFile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateDeviceLinkFromCubeFile(const char* cFileName);` |
| `cmsCreateDeviceLinkFromCubeFileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateDeviceLinkFromCubeFileTHR(cmsContext ContextID, const char* cFileName);` |
| `cmsCreateLab2ProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab2ProfileTHR(cmsContext ContextID, const cmsCIExyY* WhitePoint);` |
| `cmsCreateLab2Profile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab2Profile(const cmsCIExyY* WhitePoint);` |
| `cmsCreateLab4ProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab4ProfileTHR(cmsContext ContextID, const cmsCIExyY* WhitePoint);` |
| `cmsCreateLab4Profile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateLab4Profile(const cmsCIExyY* WhitePoint);` |
| `cmsCreateXYZProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateXYZProfileTHR(cmsContext ContextID);` |
| `cmsCreateXYZProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateXYZProfile(void);` |
| `cmsCreate_sRGBProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_sRGBProfileTHR(cmsContext ContextID);` |
| `cmsCreate_sRGBProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_sRGBProfile(void);` |
| `cmsCreate_OkLabProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreate_OkLabProfile(cmsContext ctx);` |
| `cmsCreateBCHSWabstractProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateBCHSWabstractProfileTHR(cmsContext ContextID,` |
| `cmsCreateBCHSWabstractProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateBCHSWabstractProfile(cmsUInt32Number nLUTPoints,` |
| `cmsCreateNULLProfileTHR` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateNULLProfileTHR(cmsContext ContextID);` |
| `cmsCreateNULLProfile` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsCreateNULLProfile(void);` |
| `cmsTransform2DeviceLink` | `CMSAPI cmsHPROFILE      CMSEXPORT cmsTransform2DeviceLink(cmsHTRANSFORM hTransform, cmsFloat64Number Version, cmsUInt32Number dwFlags);` |
| `cmsGetSupportedIntents` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetSupportedIntents(cmsUInt32Number nMax, cmsUInt32Number* Codes, char** Descriptions);` |
| `cmsGetSupportedIntentsTHR` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetSupportedIntentsTHR(cmsContext ContextID, cmsUInt32Number nMax, cmsUInt32Number* Codes, char** Descriptions);` |
| `cmsCreateTransformTHR` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateTransformTHR(cmsContext ContextID,` |
| `cmsCreateTransform` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateTransform(cmsHPROFILE Input,` |
| `cmsCreateProofingTransformTHR` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateProofingTransformTHR(cmsContext ContextID,` |
| `cmsCreateProofingTransform` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateProofingTransform(cmsHPROFILE Input,` |
| `cmsCreateMultiprofileTransformTHR` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateMultiprofileTransformTHR(cmsContext ContextID,` |
| `cmsCreateMultiprofileTransform` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateMultiprofileTransform(cmsHPROFILE hProfiles[],` |
| `cmsCreateExtendedTransform` | `CMSAPI cmsHTRANSFORM    CMSEXPORT cmsCreateExtendedTransform(cmsContext ContextID,` |
| `cmsDeleteTransform` | `CMSAPI void             CMSEXPORT cmsDeleteTransform(cmsHTRANSFORM hTransform);` |
| `cmsDoTransform` | `CMSAPI void             CMSEXPORT cmsDoTransform(cmsHTRANSFORM Transform,` |
| `cmsDoTransformStride` | `CMSAPI void             CMSEXPORT cmsDoTransformStride(cmsHTRANSFORM Transform,   // Deprecated` |
| `cmsDoTransformLineStride` | `CMSAPI void             CMSEXPORT cmsDoTransformLineStride(cmsHTRANSFORM  Transform,` |
| `cmsSetAlarmCodes` | `CMSAPI void             CMSEXPORT cmsSetAlarmCodes(const cmsUInt16Number NewAlarm[cmsMAXCHANNELS]);` |
| `cmsGetAlarmCodes` | `CMSAPI void             CMSEXPORT cmsGetAlarmCodes(cmsUInt16Number NewAlarm[cmsMAXCHANNELS]);` |
| `cmsSetAlarmCodesTHR` | `CMSAPI void             CMSEXPORT cmsSetAlarmCodesTHR(cmsContext ContextID,` |
| `cmsGetAlarmCodesTHR` | `CMSAPI void             CMSEXPORT cmsGetAlarmCodesTHR(cmsContext ContextID,` |
| `cmsSetAdaptationState` | `CMSAPI cmsFloat64Number CMSEXPORT cmsSetAdaptationState(cmsFloat64Number d);` |
| `cmsSetAdaptationStateTHR` | `CMSAPI cmsFloat64Number CMSEXPORT cmsSetAdaptationStateTHR(cmsContext ContextID, cmsFloat64Number d);` |
| `cmsGetTransformContextID` | `CMSAPI cmsContext       CMSEXPORT cmsGetTransformContextID(cmsHTRANSFORM hTransform);` |
| `cmsGetTransformInputFormat` | `CMSAPI cmsUInt32Number CMSEXPORT cmsGetTransformInputFormat(cmsHTRANSFORM hTransform);` |
| `cmsGetTransformOutputFormat` | `CMSAPI cmsUInt32Number CMSEXPORT cmsGetTransformOutputFormat(cmsHTRANSFORM hTransform);` |
| `cmsChangeBuffersFormat` | `CMSAPI cmsBool          CMSEXPORT cmsChangeBuffersFormat(cmsHTRANSFORM hTransform,` |
| `cmsGetPostScriptColorResource` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptColorResource(cmsContext ContextID,` |
| `cmsGetPostScriptCSA` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptCSA(cmsContext ContextID, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags, void* Buffer, cmsUInt32Number dwBufferLen);` |
| `cmsGetPostScriptCRD` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsGetPostScriptCRD(cmsContext ContextID, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags, void* Buffer, cmsUInt32Number dwBufferLen);` |
| `cmsIT8Alloc` | `CMSAPI cmsHANDLE        CMSEXPORT cmsIT8Alloc(cmsContext ContextID);` |
| `cmsIT8Free` | `CMSAPI void             CMSEXPORT cmsIT8Free(cmsHANDLE hIT8);` |
| `cmsIT8TableCount` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8TableCount(cmsHANDLE hIT8);` |
| `cmsIT8SetTable` | `CMSAPI cmsInt32Number   CMSEXPORT cmsIT8SetTable(cmsHANDLE hIT8, cmsUInt32Number nTable);` |
| `cmsIT8LoadFromFile` | `CMSAPI cmsHANDLE        CMSEXPORT cmsIT8LoadFromFile(cmsContext ContextID, const char* cFileName);` |
| `cmsIT8LoadFromMem` | `CMSAPI cmsHANDLE        CMSEXPORT cmsIT8LoadFromMem(cmsContext ContextID, const void *Ptr, cmsUInt32Number len);` |
| `cmsIT8SaveToFile` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SaveToFile(cmsHANDLE hIT8, const char* cFileName);` |
| `cmsIT8SaveToMem` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SaveToMem(cmsHANDLE hIT8, void *MemPtr, cmsUInt32Number* BytesNeeded);` |
| `cmsIT8GetSheetType` | `CMSAPI const char*      CMSEXPORT cmsIT8GetSheetType(cmsHANDLE hIT8);` |
| `cmsIT8SetSheetType` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetSheetType(cmsHANDLE hIT8, const char* Type);` |
| `cmsIT8SetComment` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetComment(cmsHANDLE hIT8, const char* cComment);` |
| `cmsIT8SetPropertyStr` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyStr(cmsHANDLE hIT8, const char* cProp, const char *Str);` |
| `cmsIT8SetPropertyDbl` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyDbl(cmsHANDLE hIT8, const char* cProp, cmsFloat64Number Val);` |
| `cmsIT8SetPropertyHex` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyHex(cmsHANDLE hIT8, const char* cProp, cmsUInt32Number Val);` |
| `cmsIT8SetPropertyMulti` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyMulti(cmsHANDLE hIT8, const char* Key, const char* SubKey, const char *Buffer);` |
| `cmsIT8SetPropertyUncooked` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetPropertyUncooked(cmsHANDLE hIT8, const char* Key, const char* Buffer);` |
| `cmsIT8GetProperty` | `CMSAPI const char*      CMSEXPORT cmsIT8GetProperty(cmsHANDLE hIT8, const char* cProp);` |
| `cmsIT8GetPropertyDbl` | `CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetPropertyDbl(cmsHANDLE hIT8, const char* cProp);` |
| `cmsIT8GetPropertyMulti` | `CMSAPI const char*      CMSEXPORT cmsIT8GetPropertyMulti(cmsHANDLE hIT8, const char* Key, const char *SubKey);` |
| `cmsIT8EnumProperties` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8EnumProperties(cmsHANDLE hIT8, char ***PropertyNames);` |
| `cmsIT8EnumPropertyMulti` | `CMSAPI cmsUInt32Number  CMSEXPORT cmsIT8EnumPropertyMulti(cmsHANDLE hIT8, const char* cProp, const char ***SubpropertyNames);` |
| `cmsIT8GetDataRowCol` | `CMSAPI const char*      CMSEXPORT cmsIT8GetDataRowCol(cmsHANDLE hIT8, int row, int col);` |
| `cmsIT8GetDataRowColDbl` | `CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetDataRowColDbl(cmsHANDLE hIT8, int row, int col);` |
| `cmsIT8SetDataRowCol` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataRowCol(cmsHANDLE hIT8, int row, int col,` |
| `cmsIT8SetDataRowColDbl` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataRowColDbl(cmsHANDLE hIT8, int row, int col,` |
| `cmsIT8GetData` | `CMSAPI const char*      CMSEXPORT cmsIT8GetData(cmsHANDLE hIT8, const char* cPatch, const char* cSample);` |
| `cmsIT8GetDataDbl` | `CMSAPI cmsFloat64Number CMSEXPORT cmsIT8GetDataDbl(cmsHANDLE hIT8, const char* cPatch, const char* cSample);` |
| `cmsIT8SetData` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetData(cmsHANDLE hIT8, const char* cPatch,` |
| `cmsIT8SetDataDbl` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataDbl(cmsHANDLE hIT8, const char* cPatch,` |
| `cmsIT8FindDataFormat` | `CMSAPI int              CMSEXPORT cmsIT8FindDataFormat(cmsHANDLE hIT8, const char* cSample);` |
| `cmsIT8SetDataFormat` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetDataFormat(cmsHANDLE hIT8, int n, const char *Sample);` |
| `cmsIT8EnumDataFormat` | `CMSAPI int              CMSEXPORT cmsIT8EnumDataFormat(cmsHANDLE hIT8, char ***SampleNames);` |
| `cmsIT8GetPatchName` | `CMSAPI const char*      CMSEXPORT cmsIT8GetPatchName(cmsHANDLE hIT8, int nPatch, char* buffer);` |
| `cmsIT8GetPatchByName` | `CMSAPI int              CMSEXPORT cmsIT8GetPatchByName(cmsHANDLE hIT8, const char *cPatch);` |
| `cmsIT8SetTableByLabel` | `CMSAPI int              CMSEXPORT cmsIT8SetTableByLabel(cmsHANDLE hIT8, const char* cSet, const char* cField, const char* ExpectedType);` |
| `cmsIT8SetIndexColumn` | `CMSAPI cmsBool          CMSEXPORT cmsIT8SetIndexColumn(cmsHANDLE hIT8, const char* cSample);` |
| `cmsIT8DefineDblFormat` | `CMSAPI void             CMSEXPORT cmsIT8DefineDblFormat(cmsHANDLE hIT8, const char* Formatter);` |
| `cmsGBDAlloc` | `CMSAPI cmsHANDLE        CMSEXPORT cmsGBDAlloc(cmsContext ContextID);` |
| `cmsGBDFree` | `CMSAPI void             CMSEXPORT cmsGBDFree(cmsHANDLE hGBD);` |
| `cmsGDBAddPoint` | `CMSAPI cmsBool          CMSEXPORT cmsGDBAddPoint(cmsHANDLE hGBD, const cmsCIELab* Lab);` |
| `cmsGDBCompute` | `CMSAPI cmsBool          CMSEXPORT cmsGDBCompute(cmsHANDLE  hGDB, cmsUInt32Number dwFlags);` |
| `cmsGDBCheckPoint` | `CMSAPI cmsBool          CMSEXPORT cmsGDBCheckPoint(cmsHANDLE hGBD, const cmsCIELab* Lab);` |
| `cmsDetectBlackPoint` | `CMSAPI cmsBool          CMSEXPORT cmsDetectBlackPoint(cmsCIEXYZ* BlackPoint, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags);` |
| `cmsDetectDestinationBlackPoint` | `CMSAPI cmsBool          CMSEXPORT cmsDetectDestinationBlackPoint(cmsCIEXYZ* BlackPoint, cmsHPROFILE hProfile, cmsUInt32Number Intent, cmsUInt32Number dwFlags);` |
| `cmsDetectTAC` | `CMSAPI cmsFloat64Number CMSEXPORT cmsDetectTAC(cmsHPROFILE hProfile);` |
| `cmsDetectRGBProfileGamma` | `CMSAPI cmsFloat64Number CMSEXPORT cmsDetectRGBProfileGamma(cmsHPROFILE hProfile, cmsFloat64Number threshold);` |
| `cmsDesaturateLab` | `CMSAPI cmsBool          CMSEXPORT cmsDesaturateLab(cmsCIELab* Lab,` |
