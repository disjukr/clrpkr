#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "lcms2.h"

static cmsTagSignature make_tag_signature(const char* text)
{
    if (strlen(text) != 4) {
        return 0;
    }

    return ((cmsTagSignature)(unsigned char) text[0] << 24) |
           ((cmsTagSignature)(unsigned char) text[1] << 16) |
           ((cmsTagSignature)(unsigned char) text[2] << 8) |
           ((cmsTagSignature)(unsigned char) text[3]);
}

int main(int argc, char** argv)
{
    cmsHPROFILE profile;
    cmsPipeline* pipeline;
    cmsTagSignature tag_sig;
    cmsUInt32Number input_channels;
    cmsUInt32Number output_channels;
    cmsFloat32Number input[16];
    cmsFloat32Number output[16];
    cmsUInt32Number i;

    if (argc < 4) {
        fprintf(stderr, "usage: %s <profile> <tag> <v0> [v1 ...]\n", argv[0]);
        return 1;
    }

    tag_sig = make_tag_signature(argv[2]);
    if (tag_sig == 0) {
        fprintf(stderr, "invalid tag signature: %s\n", argv[2]);
        return 2;
    }

    profile = cmsOpenProfileFromFile(argv[1], "r");
    if (profile == NULL) {
        fprintf(stderr, "failed to open profile: %s\n", argv[1]);
        return 3;
    }

    pipeline = (cmsPipeline*) cmsReadTag(profile, tag_sig);
    if (pipeline == NULL) {
        fprintf(stderr, "failed to read tag: %s\n", argv[2]);
        cmsCloseProfile(profile);
        return 4;
    }

    input_channels = cmsPipelineInputChannels(pipeline);
    output_channels = cmsPipelineOutputChannels(pipeline);

    if ((cmsUInt32Number) (argc - 3) != input_channels) {
      fprintf(stderr, "expected %u input values, got %d\n", input_channels, argc - 3);
      cmsCloseProfile(profile);
      return 5;
    }

    if (input_channels > 16 || output_channels > 16) {
        fprintf(stderr, "too many channels: in=%u out=%u\n", input_channels, output_channels);
        cmsCloseProfile(profile);
        return 6;
    }

    for (i = 0; i < input_channels; i++) {
        input[i] = (cmsFloat32Number) atof(argv[3 + i]);
    }

    cmsPipelineEvalFloat(input, output, pipeline);

    printf("{\"inputChannels\":%u,\"outputChannels\":%u,\"output\":[", input_channels, output_channels);
    for (i = 0; i < output_channels; i++) {
        if (i > 0) {
            printf(",");
        }
        printf("%.9g", output[i]);
    }
    printf("]}\n");

    cmsCloseProfile(profile);
    return 0;
}
