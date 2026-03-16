#include <stdio.h>
#include <string.h>

#include "lcms2.h"
#include "lcms2_internal.h"

typedef struct {
    int count;
    cmsUInt16Number values[32][2];
} Slice16Cargo;

typedef struct {
    int count;
    cmsFloat32Number values[32][2];
} SliceFloatCargo;

static cmsInt32Number slice16_sampler(const cmsUInt16Number In[], cmsUInt16Number Out[], void* Cargo)
{
    Slice16Cargo* cargo = (Slice16Cargo*) Cargo;
    cargo->values[cargo->count][0] = In[0];
    cargo->values[cargo->count][1] = In[1];
    cargo->count += 1;
    (void) Out;
    return 1;
}

static cmsInt32Number sliceFloat_sampler(const cmsFloat32Number In[], cmsFloat32Number Out[], void* Cargo)
{
    SliceFloatCargo* cargo = (SliceFloatCargo*) Cargo;
    cargo->values[cargo->count][0] = In[0];
    cargo->values[cargo->count][1] = In[1];
    cargo->count += 1;
    (void) Out;
    return 1;
}

static cmsInt32Number clut_float_sampler(const cmsFloat32Number In[], cmsFloat32Number Out[], void* Cargo)
{
    (void) In;
    (void) Cargo;
    Out[0] = Out[0] + 0.1f;
    return 1;
}

static cmsInt32Number clut16_inspect_sampler(const cmsUInt16Number In[], cmsUInt16Number Out[], void* Cargo)
{
    cmsUInt16Number* seen = (cmsUInt16Number*) Cargo;
    static int index = 0;
    (void) In;
    seen[index++] = Out[0];
    Out[0] = 12345;
    return 1;
}

static void print_u16_matrix(const Slice16Cargo* cargo)
{
    int i;
    printf("[");
    for (i = 0; i < cargo->count; i++) {
        if (i > 0) printf(",");
        printf("[%u,%u]", cargo->values[i][0], cargo->values[i][1]);
    }
    printf("]");
}

static void print_f32_matrix(const SliceFloatCargo* cargo)
{
    int i;
    printf("[");
    for (i = 0; i < cargo->count; i++) {
        if (i > 0) printf(",");
        printf("[%.9g,%.9g]", cargo->values[i][0], cargo->values[i][1]);
    }
    printf("]");
}

static void print_f32_array(const cmsFloat32Number* values, int count)
{
    int i;
    printf("[");
    for (i = 0; i < count; i++) {
        if (i > 0) printf(",");
        printf("%.9g", values[i]);
    }
    printf("]");
}

static void print_u16_array(const cmsUInt16Number* values, int count)
{
    int i;
    printf("[");
    for (i = 0; i < count; i++) {
        if (i > 0) printf(",");
        printf("%u", values[i]);
    }
    printf("]");
}

int main(void)
{
    cmsUInt32Number points2d[] = { 2, 3 };
    Slice16Cargo slice16 = { 0 };
    SliceFloatCargo sliceFloat = { 0 };

    cmsFloat32Number clutFloatTable[] = { 0.0f, 0.25f, 0.5f, 0.75f };
    cmsUInt16Number clut16Table[] = { 0, 32768, 65535 };
    cmsUInt16Number seenInspect[] = { 0, 0, 0 };

    cmsStage* clutFloat = cmsStageAllocCLutFloatGranular(NULL, (cmsUInt32Number[]){ 2, 2 }, 2, 1, clutFloatTable);
    cmsStage* clut16 = cmsStageAllocCLut16bit(NULL, 3, 1, 1, clut16Table);
    _cmsStageCLutData* clutFloatData;
    _cmsStageCLutData* clut16Data;

    if (clutFloat == NULL || clut16 == NULL) {
        fprintf(stderr, "failed to allocate CLUT stages\n");
        return 1;
    }

    cmsSliceSpace16(2, points2d, slice16_sampler, &slice16);
    cmsSliceSpaceFloat(2, points2d, sliceFloat_sampler, &sliceFloat);

    cmsStageSampleCLutFloat(clutFloat, clut_float_sampler, NULL, 0);
    cmsStageSampleCLut16bit(clut16, clut16_inspect_sampler, seenInspect, SAMPLER_INSPECT);

    clutFloatData = (_cmsStageCLutData*) cmsStageData(clutFloat);
    clut16Data = (_cmsStageCLutData*) cmsStageData(clut16);

    printf("{");
    printf("\"slice16\":");
    print_u16_matrix(&slice16);
    printf(",\"sliceFloat\":");
    print_f32_matrix(&sliceFloat);
    printf(",\"clutFloatWritten\":");
    print_f32_array(clutFloatData->Tab.TFloat, 4);
    printf(",\"clut16Seen\":");
    print_u16_array(seenInspect, 3);
    printf(",\"clut16AfterInspect\":");
    print_u16_array(clut16Data->Tab.T, 3);
    printf("}\n");

    cmsStageFree(clutFloat);
    cmsStageFree(clut16);
    return 0;
}
