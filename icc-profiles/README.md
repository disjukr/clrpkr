# ICC Profiles

This directory stores ICC profiles gathered from authoritative upstream sources.

## Layout

- `color/`: flattened `.icc` files from `color.org`, plus `tmp/` for working files.
- `eci/`: flattened `.icc` files from `eci.org`, plus `tmp/` for working files.
- `scripts/`: download scripts for each upstream source.

## Usage

From the repository root:

```bash
node icc-profiles/scripts/download-color.mjs
node icc-profiles/scripts/download-eci.mjs
```

Or via `pnpm`:

```bash
pnpm icc:download:color
pnpm icc:download:eci
pnpm icc:download:all
```
