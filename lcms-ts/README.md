# lcms-ts

TypeScript port foundation for [Little CMS](https://github.com/mm2/Little-CMS).

## Commands

```bash
pnpm --filter lcms-ts fetch:upstream
pnpm --filter lcms-ts sync:api
pnpm --filter lcms-ts typecheck
pnpm --filter lcms-ts test
pnpm --filter lcms-ts build
```

## Upstream source

The default upstream checkout lives at `lcms-ts/tmp/Little-CMS`.
Run `pnpm --filter lcms-ts fetch:upstream` to clone or refresh it.
Override with `LCMS_UPSTREAM_DIR` only when you explicitly want a different checkout.

See `docs/PORTING.md` for implementation status.
