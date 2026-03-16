#include "lcms2.h"

#include <stdio.h>

static
void print_u8_array(const cmsUInt8Number* values, cmsUInt32Number count)
{
    cmsUInt32Number i;
    printf("[");
    for (i = 0; i < count; i++) {
        if (i != 0) printf(",");
        printf("%u", values[i]);
    }
    printf("]");
}

int main(int argc, char** argv)
{
    cmsHPROFILE input;
    cmsHPROFILE output;
    cmsHTRANSFORM xform;
    cmsHTRANSFORM nullXform;
    cmsUInt8Number rgbInput[6] = { 15, 75, 160, 220, 120, 45 };
    cmsUInt8Number rgbOutput[6] = { 0 };
    cmsUInt8Number argbInput[8] = { 170, 16, 32, 48, 187, 64, 80, 96 };
    cmsUInt8Number argbOutput[8] = { 0 };

    if (argc < 3) {
        fprintf(stderr, "Usage: %s <input-profile> <output-profile>\n", argv[0]);
        return 1;
    }

    input = cmsOpenProfileFromFile(argv[1], "r");
    output = cmsOpenProfileFromFile(argv[2], "r");
    if (input == NULL || output == NULL) {
        fprintf(stderr, "Failed to open profiles\n");
        if (input != NULL) cmsCloseProfile(input);
        if (output != NULL) cmsCloseProfile(output);
        return 1;
    }

    xform = cmsCreateTransform(input, TYPE_RGB_8, output, TYPE_RGB_8, INTENT_PERCEPTUAL, 0);
    nullXform = cmsCreateTransform(input, TYPE_ARGB_8, input, TYPE_ARGB_8, INTENT_PERCEPTUAL, cmsFLAGS_NULLTRANSFORM | cmsFLAGS_COPY_ALPHA);
    if (xform == NULL || nullXform == NULL) {
        fprintf(stderr, "Failed to create transform\n");
        if (xform != NULL) cmsDeleteTransform(xform);
        if (nullXform != NULL) cmsDeleteTransform(nullXform);
        cmsCloseProfile(input);
        cmsCloseProfile(output);
        return 1;
    }

    cmsDoTransform(xform, rgbInput, rgbOutput, 2);
    cmsDoTransform(nullXform, argbInput, argbOutput, 2);

    printf("{");
    printf("\"rgb\":");
    print_u8_array(rgbOutput, 6);
    printf(",");
    printf("\"argb\":");
    print_u8_array(argbOutput, 8);
    printf("}\n");

    cmsDeleteTransform(xform);
    cmsDeleteTransform(nullXform);
    cmsCloseProfile(input);
    cmsCloseProfile(output);
    return 0;
}
