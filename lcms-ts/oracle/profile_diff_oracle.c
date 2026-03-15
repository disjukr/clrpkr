#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "lcms2.h"
#include "lcms2_plugin.h"
#include "lcms2_internal.h"

static void sig_to_text(cmsUInt32Number sig, char out[5])
{
    out[0] = (char) ((sig >> 24) & 0xff);
    out[1] = (char) ((sig >> 16) & 0xff);
    out[2] = (char) ((sig >> 8) & 0xff);
    out[3] = (char) (sig & 0xff);
    out[4] = '\0';
}

static void print_json_string(const char* text)
{
    const unsigned char* p = (const unsigned char*) text;
    putchar('"');
    while (*p != 0) {
        if (*p == '\\' || *p == '"') {
            putchar('\\');
            putchar(*p);
        }
        else if (*p < 0x20) {
            printf("\\u%04x", (unsigned int) *p);
        }
        else {
            putchar(*p);
        }
        p++;
    }
    putchar('"');
}

static void dump_stage_summary(const cmsStage* stage)
{
    char kind[5];
    sig_to_text(cmsStageType(stage), kind);
    printf("{\"kind\":");
    print_json_string(kind);
    printf(",\"inputChannels\":%u,\"outputChannels\":%u",
           (unsigned int) cmsStageInputChannels(stage),
           (unsigned int) cmsStageOutputChannels(stage));

    if (cmsStageType(stage) == cmsSigCLutElemType) {
        const _cmsStageCLutData* clut = (const _cmsStageCLutData*) cmsStageData(stage);
        cmsUInt32Number i;
        printf(",\"gridPoints\":[");
        for (i = 0; i < clut->Params->nInputs; i++) {
            if (i > 0) printf(",");
            printf("%u", (unsigned int) clut->Params->nSamples[i]);
        }
        printf("]");
    }

    printf("}");
}

static void dump_pipeline_summary(cmsPipeline* pipeline)
{
    cmsStage* stage;
    cmsUInt32Number index = 0;
    if (pipeline == NULL) {
        printf("null");
        return;
    }

    printf("{\"inputChannels\":%u,\"outputChannels\":%u,\"stages\":[",
           (unsigned int) cmsPipelineInputChannels(pipeline),
           (unsigned int) cmsPipelineOutputChannels(pipeline));

    for (stage = cmsPipelineGetPtrToFirstStage(pipeline);
         stage != NULL;
         stage = cmsStageNext(stage)) {
        if (index > 0) printf(",");
        dump_stage_summary(stage);
        index++;
    }

    printf("]}");
}

static void dump_parse_summary(cmsHPROFILE profile)
{
    cmsUInt32Number i;
    cmsUInt32Number count = (cmsUInt32Number) cmsGetTagCount(profile);
    char device_class[5];
    char color_space[5];
    char pcs[5];

    sig_to_text((cmsUInt32Number) cmsGetDeviceClass(profile), device_class);
    sig_to_text((cmsUInt32Number) cmsGetColorSpace(profile), color_space);
    sig_to_text((cmsUInt32Number) cmsGetPCS(profile), pcs);

    printf("{\"deviceClass\":");
    print_json_string(device_class);
    printf(",\"colorSpace\":");
    print_json_string(color_space);
    printf(",\"pcs\":");
    print_json_string(pcs);
    printf(",\"renderingIntent\":%u,\"tagCount\":%u,\"tags\":[",
           (unsigned int) cmsGetHeaderRenderingIntent(profile),
           (unsigned int) count);

    for (i = 0; i < count; i++) {
        cmsUInt32Number offset = 0, size = 0;
        cmsTagSignature sig = cmsGetTagSignature(profile, i);
        cmsTagSignature linked = cmsTagLinkedTo(profile, sig);
        char sig_text[5];
        char linked_text[5];
        sig_to_text((cmsUInt32Number) sig, sig_text);
        sig_to_text((cmsUInt32Number) linked, linked_text);
        cmsGetTagOffsetAndSize(profile, i, &offset, &size);

        if (i > 0) printf(",");
        printf("{\"signature\":");
        print_json_string(sig_text);
        printf(",\"offset\":%u,\"size\":%u,\"linkedTo\":",
               (unsigned int) offset,
               (unsigned int) size);
        if (linked == 0) {
            printf("null");
        } else {
            print_json_string(linked_text);
        }
        printf("}");
    }

    printf("]}");
}

static void dump_selection_summary(cmsHPROFILE profile)
{
    cmsUInt32Number intent;
    printf("{\"isMatrixShaper\":%s,\"input\":[",
           cmsIsMatrixShaper(profile) ? "true" : "false");

    for (intent = 0; intent <= 3; intent++) {
        if (intent > 0) printf(",");
        printf("{\"intent\":%u,\"isClut\":%s,\"isSupported\":%s,\"pipeline\":",
               (unsigned int) intent,
               cmsIsCLUT(profile, intent, LCMS_USED_AS_INPUT) ? "true" : "false",
               cmsIsIntentSupported(profile, intent, LCMS_USED_AS_INPUT) ? "true" : "false");
        dump_pipeline_summary(_cmsReadInputLUT(profile, intent));
        printf("}");
    }

    printf("],\"output\":[");
    for (intent = 0; intent <= 3; intent++) {
        if (intent > 0) printf(",");
        printf("{\"intent\":%u,\"isClut\":%s,\"isSupported\":%s,\"pipeline\":",
               (unsigned int) intent,
               cmsIsCLUT(profile, intent, LCMS_USED_AS_OUTPUT) ? "true" : "false",
               cmsIsIntentSupported(profile, intent, LCMS_USED_AS_OUTPUT) ? "true" : "false");
        dump_pipeline_summary(_cmsReadOutputLUT(profile, intent));
        printf("}");
    }

    printf("],\"proof\":[");
    for (intent = 0; intent <= 3; intent++) {
        if (intent > 0) printf(",");
        printf("{\"intent\":%u,\"isClut\":%s,\"isSupported\":%s}",
               (unsigned int) intent,
               cmsIsCLUT(profile, intent, LCMS_USED_AS_PROOF) ? "true" : "false",
               cmsIsIntentSupported(profile, intent, LCMS_USED_AS_PROOF) ? "true" : "false");
    }

    printf("],\"devicelink\":[");
    for (intent = 0; intent <= 3; intent++) {
        if (intent > 0) printf(",");
        printf("{\"intent\":%u,\"pipeline\":", (unsigned int) intent);
        dump_pipeline_summary(_cmsReadDevicelinkLUT(profile, intent));
        printf("}");
    }
    printf("]}");
}

static void dump_profile_summary(cmsHPROFILE profile)
{
    printf("{\"parse\":");
    dump_parse_summary(profile);
    printf(",\"selection\":");
    dump_selection_summary(profile);
    printf("}");
}

int main(int argc, char** argv)
{
    cmsHPROFILE profile;
    cmsHPROFILE reopened = NULL;
    cmsUInt8Number* bytes = NULL;
    cmsUInt32Number bytes_needed = 0;

    if (argc != 2) {
        fprintf(stderr, "usage: %s <profile>\n", argv[0]);
        return 1;
    }

    profile = cmsOpenProfileFromFile(argv[1], "r");
    if (profile == NULL) {
        fprintf(stderr, "failed to open profile: %s\n", argv[1]);
        return 2;
    }

    if (!cmsSaveProfileToMem(profile, NULL, &bytes_needed) || bytes_needed == 0) {
        fprintf(stderr, "failed to query serialized profile size\n");
        cmsCloseProfile(profile);
        return 3;
    }

    bytes = (cmsUInt8Number*) malloc(bytes_needed);
    if (bytes == NULL) {
        fprintf(stderr, "out of memory\n");
        cmsCloseProfile(profile);
        return 4;
    }

    if (!cmsSaveProfileToMem(profile, bytes, &bytes_needed)) {
        fprintf(stderr, "failed to serialize profile\n");
        free(bytes);
        cmsCloseProfile(profile);
        return 5;
    }

    reopened = cmsOpenProfileFromMem(bytes, bytes_needed);
    if (reopened == NULL) {
        fprintf(stderr, "failed to reopen serialized profile\n");
        free(bytes);
        cmsCloseProfile(profile);
        return 6;
    }

    printf("{\"original\":");
    dump_profile_summary(profile);
    printf(",\"saved\":");
    dump_profile_summary(reopened);
    printf("}\n");

    cmsCloseProfile(reopened);
    free(bytes);
    cmsCloseProfile(profile);
    return 0;
}
