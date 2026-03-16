#include <stdio.h>
#include <string.h>

#include "lcms2.h"
#include "lcms2_plugin.h"
#include "lcms2_internal.h"

static void print_array(const cmsFloat32Number* values, cmsUInt32Number count)
{
    cmsUInt32Number i;

    printf("[");
    for (i = 0; i < count; i++) {
        if (i > 0) {
            printf(",");
        }
        printf("%.9g", values[i]);
    }
    printf("]");
}

static void print_u16_array(const cmsUInt16Number* values, cmsUInt32Number count)
{
    cmsUInt32Number i;

    printf("[");
    for (i = 0; i < count; i++) {
        if (i > 0) {
            printf(",");
        }
        printf("%u", values[i]);
    }
    printf("]");
}

static void create_affine_clut_f32(cmsFloat32Number* table,
                                   const cmsUInt32Number* grid_points,
                                   cmsUInt32Number input_channels,
                                   cmsUInt32Number output_channels,
                                   const cmsFloat32Number coefficients[][5])
{
    cmsUInt32Number coords[4] = { 0, 0, 0, 0 };
    cmsUInt32Number offset = 0;
    cmsUInt32Number i0, i1, i2, i3;

    for (i0 = 0; i0 < (input_channels > 0 ? grid_points[0] : 1); i0++) {
        coords[0] = i0;
        for (i1 = 0; i1 < (input_channels > 1 ? grid_points[1] : 1); i1++) {
            coords[1] = i1;
            for (i2 = 0; i2 < (input_channels > 2 ? grid_points[2] : 1); i2++) {
                coords[2] = i2;
                for (i3 = 0; i3 < (input_channels > 3 ? grid_points[3] : 1); i3++) {
                    cmsUInt32Number out_index;
                    cmsFloat32Number normalized[4] = { 0, 0, 0, 0 };

                    coords[3] = i3;
                    for (out_index = 0; out_index < input_channels; out_index++) {
                        normalized[out_index] = (cmsFloat32Number) coords[out_index] /
                            (cmsFloat32Number) (grid_points[out_index] - 1);
                    }

                    for (out_index = 0; out_index < output_channels; out_index++) {
                        cmsUInt32Number axis;
                        cmsFloat32Number value = coefficients[out_index][0];
                        for (axis = 0; axis < input_channels; axis++) {
                            value += coefficients[out_index][axis + 1] * normalized[axis];
                        }
                        table[offset + out_index] = value;
                    }

                    offset += output_channels;
                }
            }
        }
    }
}

int main(void)
{
    cmsFloat32Number output_f32[4];
    cmsUInt16Number output_u16[4];

    {
        cmsFloat32Number table[] = { 0.0f, 0.5f, 1.0f };
        cmsUInt32Number samples[] = { 3 };
        cmsFloat32Number input_a[] = { 0.25f };
        cmsFloat32Number input_b[] = { 0.75f };
        cmsInterpParams* params = _cmsComputeInterpParamsEx(NULL, samples, 1, 1, table, CMS_LERP_FLAGS_FLOAT);

        params->Interpolation.LerpFloat(input_a, output_f32, params);
        printf("{\"linear025\":");
        print_array(output_f32, 1);

        params->Interpolation.LerpFloat(input_b, output_f32, params);
        printf(",\"linear075\":");
        print_array(output_f32, 1);
        _cmsFreeInterpParams(params);
    }

    {
        cmsUInt32Number samples[] = { 3, 3, 3 };
        cmsFloat32Number table[27];
        cmsFloat32Number coefficients[1][5] = {
            { 0.1f, 0.25f, 0.5f, 0.125f, 0.0f }
        };
        cmsFloat32Number input[] = { 0.2f, 0.4f, 0.6f };
        cmsInterpParams* params;

        create_affine_clut_f32(table, samples, 3, 1, coefficients);
        params = _cmsComputeInterpParamsEx(NULL, samples, 3, 1, table, CMS_LERP_FLAGS_FLOAT);
        params->Interpolation.LerpFloat(input, output_f32, params);
        printf(",\"tetra3d\":");
        print_array(output_f32, 1);
        _cmsFreeInterpParams(params);
    }

    {
        cmsUInt32Number samples[] = { 4, 3, 5, 4 };
        cmsFloat32Number table[240];
        cmsFloat32Number coefficients[1][5] = {
            { 0.05f, 0.1f, 0.2f, 0.3f, 0.15f }
        };
        cmsFloat32Number input[] = { 0.3f, 0.25f, 0.8f, 0.5f };
        cmsInterpParams* params;

        create_affine_clut_f32(table, samples, 4, 1, coefficients);
        params = _cmsComputeInterpParamsEx(NULL, samples, 4, 1, table, CMS_LERP_FLAGS_FLOAT);
        params->Interpolation.LerpFloat(input, output_f32, params);
        printf(",\"tetra4d\":");
        print_array(output_f32, 1);
        _cmsFreeInterpParams(params);
    }

    {
        cmsUInt32Number samples[] = { 4, 4, 4 };
        cmsFloat32Number table[64];
        cmsFloat32Number coefficients[1][5] = {
            { 0.2f, 0.1f, 0.3f, 0.05f, 0.0f }
        };
        cmsFloat32Number input[] = { 0.61f, 0.22f, 0.47f };
        cmsInterpParams* params;

        create_affine_clut_f32(table, samples, 3, 1, coefficients);
        params = _cmsComputeInterpParamsEx(NULL, samples, 3, 1, table, CMS_LERP_FLAGS_FLOAT | CMS_LERP_FLAGS_TRILINEAR);
        params->Interpolation.LerpFloat(input, output_f32, params);
        printf(",\"trilinear3d\":");
        print_array(output_f32, 1);
        _cmsFreeInterpParams(params);
    }

    {
        cmsUInt16Number table[] = { 0, 32768, 65535 };
        cmsUInt32Number samples[] = { 3 };
        cmsUInt16Number input[] = { 32768 };
        cmsInterpParams* params = _cmsComputeInterpParamsEx(NULL, samples, 1, 1, table, 0);

        params->Interpolation.Lerp16(input, output_u16, params);
        printf(",\"u16\":");
        print_u16_array(output_u16, 1);
        _cmsFreeInterpParams(params);
    }

    printf("}\n");
    return 0;
}
