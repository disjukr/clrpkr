#include "lcms2.h"

#include <stdio.h>

static
void print_profile_results(const char* label, cmsHPROFILE profile)
{
    printf("\"%s\":{", label);
    printf("\"color_u8\":%u,", cmsFormatterForColorspaceOfProfile(profile, 1, 0));
    printf("\"color_u16\":%u,", cmsFormatterForColorspaceOfProfile(profile, 2, 0));
    printf("\"color_float\":%u,", cmsFormatterForColorspaceOfProfile(profile, 4, 1));
    printf("\"pcs_u16\":%u,", cmsFormatterForPCSOfProfile(profile, 2, 0));
    printf("\"pcs_float\":%u", cmsFormatterForPCSOfProfile(profile, 4, 1));
    printf("}");
}

int main(int argc, char** argv)
{
    cmsHPROFILE rgb;
    cmsHPROFILE cmyk;

    if (argc < 3) {
        fprintf(stderr, "Usage: %s <rgb-profile> <cmyk-profile>\n", argv[0]);
        return 1;
    }

    rgb = cmsOpenProfileFromFile(argv[1], "r");
    cmyk = cmsOpenProfileFromFile(argv[2], "r");

    if (rgb == NULL || cmyk == NULL) {
        fprintf(stderr, "Failed to open profiles\n");
        if (rgb != NULL) cmsCloseProfile(rgb);
        if (cmyk != NULL) cmsCloseProfile(cmyk);
        return 1;
    }

    printf("{");
    print_profile_results("rgb", rgb);
    printf(",");
    print_profile_results("cmyk", cmyk);
    printf("}\n");

    cmsCloseProfile(rgb);
    cmsCloseProfile(cmyk);
    return 0;
}
