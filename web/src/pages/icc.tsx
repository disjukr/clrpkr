import Head from "next/head";
import { startTransition, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  cmsGetProfileInfoUTF8,
  cmsInfoCopyright,
  cmsInfoDescription,
  cmsInfoManufacturer,
  cmsInfoModel,
  cmsOpenProfileFromMem,
  cmsReadDevicelinkLUT,
  cmsReadInputLUT,
  cmsReadOutputLUT,
  INTENT_ABSOLUTE_COLORIMETRIC,
  INTENT_PERCEPTUAL,
  INTENT_RELATIVE_COLORIMETRIC,
  INTENT_SATURATION,
  parseIccProfile,
  type CmsIccProfileRecord,
  type CmsPipeline,
  type CmsProfile,
} from "lcms-ts";

type LoadedProfile = {
  readonly fileName: string;
  readonly fileSize: number;
  readonly bytes: Uint8Array;
  readonly parsed: ReturnType<typeof parseIccProfile>;
  readonly profile: CmsProfile;
};

type IntentDescriptor = {
  readonly label: string;
  readonly value: number;
};

type IccPreset = {
  readonly path: string;
  readonly label: string;
  readonly fileName: string;
};

const INTENTS: readonly IntentDescriptor[] = [
  { label: "Perceptual", value: INTENT_PERCEPTUAL },
  { label: "Relative", value: INTENT_RELATIVE_COLORIMETRIC },
  { label: "Saturation", value: INTENT_SATURATION },
  { label: "Absolute", value: INTENT_ABSOLUTE_COLORIMETRIC },
];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}): string {
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${value.year}-${pad(value.month)}-${pad(value.day)} ${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`;
}

function summarizePipeline(pipeline: CmsPipeline | null): string {
  if (!pipeline) return "Unavailable";
  return pipeline.stages.map((stage) => stage.kind).join(" -> ");
}

function summarizeRecord(record: CmsIccProfileRecord): string {
  if (record.rawOnly) {
    return `raw payload (${formatBytes(record.rawPayload?.byteLength ?? 0)})`;
  }
  const value = record.value;
  if (!value) {
    return "No parsed value";
  }

  switch (value.kind) {
    case "desc":
    case "text":
      return value.text;
    case "mluc":
      return `${value.entries.length} localized string(s)`;
    case "XYZ":
      return `X ${value.value.X.toFixed(4)} / Y ${value.value.Y.toFixed(4)} / Z ${value.value.Z.toFixed(4)}`;
    case "curv":
      return value.entryCount <= 1 ? `gamma ${value.curve.params?.[0] ?? 1}` : `${value.entryCount} curve entries`;
    case "para":
      return `parametric type ${value.functionType}`;
    case "data":
      return `${formatBytes(value.bytes.byteLength)} data payload`;
    case "dtim":
      return formatDate(value.value);
    case "meas":
      return `observer ${value.observer}, illuminant ${value.illuminantType}`;
    case "view":
      return `illuminant ${value.illuminantType}`;
    case "sig":
      return value.signature;
    case "chrm":
      return `${value.channels} channels`;
    case "clrt":
      return `${value.entries.length} colorants`;
    case "pseq":
    case "psid":
      return `${value.entries.length} sequence entries`;
    case "bfd":
      return `${value.ucr.entryCount}/${value.bg.entryCount} UCR/BG entries`;
    case "crdi":
      return value.productName;
    case "scrn":
      return `${value.channels.length} screening channels`;
    case "ncl2":
      return `${value.entries.length} named colors`;
    case "dict":
      return `${value.entries.length} dictionary entries`;
    case "sf32":
    case "uf32":
      return `${value.values.length} values`;
    case "clro":
      return `${value.colorants.length} colorants`;
    case "ui08":
    case "ui32":
    case "ui64":
      return `${value.values.length} values`;
    case "cicp":
      return `primaries ${value.colourPrimaries}, transfer ${value.transferCharacteristics}`;
    case "vcgt":
      return value.storage === "formula" ? "formula VCGT" : `${value.curves.length} VCGT curves`;
    case "MHC2":
      return `${value.curveEntries} MHC2 curve entries`;
    case "mft1":
    case "mft2":
      return `${value.inputChannels} -> ${value.outputChannels} LUT`;
    case "mAB":
    case "mBA":
      return `${value.inputChannels} -> ${value.outputChannels} multi-process LUT`;
    case "mpet":
      return `${value.elements.length} process elements`;
  }

  return "unknown";
}

function hexPreview(bytes: Uint8Array, limit = 24): string {
  return Array.from(bytes.slice(0, limit), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function inspectValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { type: "Uint8Array", length: value.length, previewHex: hexPreview(value) };
  }
  if (value instanceof Uint16Array || value instanceof Uint32Array || value instanceof Float32Array) {
    return { type: value.constructor.name, length: value.length, preview: Array.from(value.slice(0, 12)) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((entry) => inspectValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, inspectValue(entry)]));
  }
  return value;
}

function readFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

async function loadProfileBytes(fileName: string, bytes: Uint8Array): Promise<LoadedProfile> {
  const parsed = parseIccProfile(bytes);
  const opened = cmsOpenProfileFromMem(bytes);
  return {
    fileName,
    fileSize: bytes.byteLength,
    bytes,
    parsed,
    profile: opened,
  };
}

export default function IccRoute() {
  const fileInputId = useId();
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presets, setPresets] = useState<readonly IccPreset[]>([]);
  const deferredTagFilter = useDeferredValue(tagFilter);

  useEffect(() => {
    let cancelled = false;

    async function loadPresets() {
      try {
        const response = await fetch("/api/icc-presets");
        if (!response.ok) {
          throw new Error(`Failed to load presets: ${response.status}`);
        }
        const payload = (await response.json()) as { presets?: IccPreset[] };
        if (!cancelled) {
          setPresets(payload.presets ?? []);
        }
      } catch {
        if (!cancelled) {
          setPresets([]);
        }
      }
    }

    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    if (!profile) return [];
    const needle = deferredTagFilter.trim().toLowerCase();
    if (!needle) return profile.parsed.records;
    return profile.parsed.records.filter((record) => {
      const kind = record.rawOnly ? "raw" : record.value?.kind ?? "";
      return (
        record.signature.toLowerCase().includes(needle) ||
        kind.toLowerCase().includes(needle) ||
        summarizeRecord(record).toLowerCase().includes(needle)
      );
    });
  }, [deferredTagFilter, profile]);

  const selectedRecord =
    filteredRecords.find((record) => record.signature === selectedSignature) ??
    profile?.parsed.records.find((record) => record.signature === selectedSignature) ??
    filteredRecords[0] ??
    null;
  const selectedTagEntry =
    selectedRecord && profile
      ? profile.parsed.tags.find((tag) => tag.signature === selectedRecord.signature)
      : undefined;
  const selectedPayload =
    selectedRecord?.rawPayload ??
    (selectedTagEntry && profile
      ? profile.bytes.slice(selectedTagEntry.offset, selectedTagEntry.offset + selectedTagEntry.size)
      : undefined);

  const profileInfo = useMemo(() => {
    if (!profile) return null;
    return {
      description: cmsGetProfileInfoUTF8(profile.profile, cmsInfoDescription) ?? "Untitled profile",
      manufacturer: cmsGetProfileInfoUTF8(profile.profile, cmsInfoManufacturer) ?? "Unknown",
      model: cmsGetProfileInfoUTF8(profile.profile, cmsInfoModel) ?? "Unknown",
      copyright: cmsGetProfileInfoUTF8(profile.profile, cmsInfoCopyright) ?? "Unavailable",
    };
  }, [profile]);

  const pipelineRows = useMemo(() => {
    if (!profile) return [];
    return INTENTS.map((intent) => ({
      label: intent.label,
      input: summarizePipeline(cmsReadInputLUT(profile.profile, intent.value)),
      output: summarizePipeline(cmsReadOutputLUT(profile.profile, intent.value)),
      devicelink: summarizePipeline(cmsReadDevicelinkLUT(profile.profile, intent.value)),
    }));
  }, [profile]);

  const headerFacts = profile
    ? [
        { label: "File", value: profile.fileName },
        { label: "Size", value: formatBytes(profile.fileSize) },
        {
          label: "ICC Version",
          value: `${profile.parsed.header.versionMajor}.${profile.parsed.header.versionMinor}.${profile.parsed.header.versionBugfix}`,
        },
        { label: "Class", value: profile.parsed.header.deviceClass },
        { label: "Color Space", value: profile.parsed.header.colorSpace },
        { label: "PCS", value: profile.parsed.header.pcs },
        { label: "Intent", value: String(profile.parsed.header.renderingIntent) },
        { label: "Created", value: formatDate(profile.parsed.header.createdAt) },
        { label: "Profile ID", value: profile.parsed.header.profileId },
      ]
    : [];

  async function loadProfile(file: File) {
    setIsBusy(true);
    setError(null);

    try {
      const bytes = await readFileBytes(file);
      const loaded = await loadProfileBytes(file.name, bytes);

      startTransition(() => {
        setProfile(loaded);
        setSelectedSignature(loaded.parsed.records[0]?.signature ?? null);
        setTagFilter("");
        setSelectedPreset("");
        setError(null);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown ICC parse error";
      startTransition(() => {
        setProfile(null);
        setSelectedSignature(null);
        setError(message);
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function loadPreset(url: string) {
    const preset = presets.find((entry) => entry.path === url);
    if (!preset) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/icc-presets/file?path=${encodeURIComponent(preset.path)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const loaded = await loadProfileBytes(preset.fileName, bytes);

      startTransition(() => {
        setProfile(loaded);
        setSelectedSignature(loaded.parsed.records[0]?.signature ?? null);
        setTagFilter("");
        setSelectedPreset(preset.path);
        setError(null);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown ICC preset error";
      startTransition(() => {
        setError(message);
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>ICC Inspector</title>
      </Head>
      <main className="min-h-screen text-stone-900">
        <div className="pointer-events-none fixed inset-0 opacity-70">
          <div className="absolute left-[-10%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#f97316]/18 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-6%] h-[26rem] w-[26rem] rounded-full bg-[#0f766e]/18 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-[96rem] flex-col gap-5 px-4 py-5 lg:px-6">
          <header className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
            <section className="rounded-[1.6rem] border border-black/8 bg-[#13110f] px-5 py-5 text-stone-50 shadow-[0_24px_70px_rgba(40,24,10,0.18)]">
              <div className="mb-3 inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-orange-200">
                /icc
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Inspect the inside of an
                <span className="block text-[#fdba74]">ICC profile</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
                Use the `lcms-ts` parser directly to inspect headers, tags, raw payload linkage, and intent-based LUT selection in one place.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="inline-flex rounded-full border border-white/14 px-4 py-2 text-sm text-stone-100 no-underline transition hover:bg-white/8" href="/">
                  Back to index
                </Link>
                {profile ? (
                  <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-stone-200">
                    {profile.parsed.records.length} tags
                  </div>
                ) : null}
              </div>
            </section>

            <div
              className="group flex min-h-[220px] cursor-pointer flex-col justify-between rounded-[1.6rem] border border-dashed border-black/15 bg-white/70 p-5 shadow-[0_18px_40px_rgba(88,65,34,0.1)] backdrop-blur"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void loadProfile(file);
              }}
            >
              <div>
                <span className="inline-flex rounded-full bg-stone-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-stone-100">
                  Drop .icc
                </span>
                <div>
                  <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-stone-900">Open an ICC or ICM file</div>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    Drop a file or click to load it. Parsing happens in memory in the browser and nothing is written back.
                  </p>
                </div>
                <div className="mt-4 rounded-[1rem] border border-black/8 bg-white/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-stone-500">
                    <span>Preset Profiles</span>
                    <span>{presets.length}</span>
                  </div>
                  <select
                    className="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-700/55 focus:shadow-[0_0_0_4px_rgba(15,118,110,0.11)]"
                    value={selectedPreset}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelectedPreset(next);
                      if (next) {
                        void loadPreset(next);
                      }
                    }}
                  >
                    <option value="">Choose from icc-profiles...</option>
                    {presets.map((preset) => (
                      <option key={preset.path} value={preset.path}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] bg-stone-900 px-4 py-3 text-sm text-stone-100 transition group-hover:bg-[#0f766e]">
                <label
                  className="cursor-pointer rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-stone-50 transition hover:bg-white/8"
                  htmlFor={fileInputId}
                >
                  {isBusy ? "Parsing..." : "Choose profile"}
                </label>
                <span className="max-w-[12rem] truncate text-stone-300">{profile ? profile.fileName : "No file loaded"}</span>
              </div>
              <input
                id={fileInputId}
                className="hidden"
                type="file"
                accept=".icc,.icm,application/vnd.iccprofile"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void loadProfile(file);
                }}
              />
            </div>
          </header>

          {error ? (
            <section className="rounded-[1.6rem] border border-red-900/15 bg-red-50 px-5 py-4 text-sm text-red-900">
              Parse failed: {error}
            </section>
          ) : null}

          {profile ? (
            <>
              <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2>Profile Overview</h2>
                    <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">{profile.parsed.records.length} tags</span>
                  </div>
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                    {headerFacts.map((fact) => (
                      <div key={fact.label} className="rounded-[1rem] bg-[#f7f1e5] px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">{fact.label}</div>
                        <div className="mt-1.5 break-words text-[0.92rem] font-semibold leading-5">{fact.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2>Profile Text</h2>
                    <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">Localized tags</span>
                  </div>
                  <div className="grid gap-2">
                    <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Description</div>
                      <div className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-6">{profileInfo?.description}</div>
                    </div>
                    <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Manufacturer</div>
                      <div className="mt-1.5 text-sm leading-6">{profileInfo?.manufacturer}</div>
                    </div>
                    <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Model</div>
                      <div className="mt-1.5 text-sm leading-6">{profileInfo?.model}</div>
                    </div>
                    <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Copyright</div>
                      <div className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm leading-6">{profileInfo?.copyright}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <h2>Intent Pipelines</h2>
                  <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">Upstream-aligned LUT selection</span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-black/8 px-2.5 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-stone-500">Intent</th>
                        <th className="border-b border-black/8 px-2.5 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-stone-500">Input</th>
                        <th className="border-b border-black/8 px-2.5 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-stone-500">Output</th>
                        <th className="border-b border-black/8 px-2.5 py-2.5 text-left text-[10px] uppercase tracking-[0.14em] text-stone-500">Devicelink</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineRows.map((row) => (
                        <tr key={row.label}>
                          <td className="border-b border-black/8 px-2.5 py-2.5 align-top text-[13px] leading-5">{row.label}</td>
                          <td className="border-b border-black/8 px-2.5 py-2.5 align-top text-[13px] leading-5">{row.input}</td>
                          <td className="border-b border-black/8 px-2.5 py-2.5 align-top text-[13px] leading-5">{row.output}</td>
                          <td className="border-b border-black/8 px-2.5 py-2.5 align-top text-[13px] leading-5">{row.devicelink}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.85fr)]">
                <div className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2>Tags</h2>
                    <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">{filteredRecords.length} visible</span>
                  </div>
                  <div>
                    <input
                      className="w-full rounded-full border border-black/12 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-teal-700/55 focus:shadow-[0_0_0_4px_rgba(15,118,110,0.11)]"
                      placeholder="Filter by signature, kind, summary"
                      value={tagFilter}
                      onChange={(event) => setTagFilter(event.target.value)}
                    />
                  </div>
                  <div className="mt-3 grid max-h-[58rem] gap-1.5 overflow-auto pr-1">
                    {filteredRecords.map((record) => {
                      const entry = profile.parsed.tags.find((tag) => tag.signature === record.signature);
                      const selected = selectedRecord?.signature === record.signature;
                      const rowClass = selected ? "bg-[#13110f] text-stone-100 border-black/10" : "bg-white/62 text-stone-900 border-black/8";
                      const kindClass = selected ? "bg-white/14 text-stone-100" : "bg-teal-700/12 text-stone-800";
                      const metaClass = selected ? "text-stone-300" : "text-stone-500";
                      return (
                        <button
                          key={`${record.signature}-${entry?.offset ?? 0}`}
                          className={`w-full rounded-[0.55rem] border px-2.5 py-2 text-left transition hover:translate-y-[-1px] hover:shadow-[0_8px_18px_rgba(70,48,22,0.07)] ${rowClass} ${selected ? "" : "hover:bg-white/96"}`}
                          onClick={() => setSelectedSignature(record.signature)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="font-mono text-[13px] font-semibold">{record.signature}</div>
                            <div className={`rounded-[0.4rem] px-2 py-[3px] text-[9px] uppercase tracking-[0.1em] ${kindClass}`}>
                              {record.rawOnly ? "raw" : record.value?.kind ?? "unknown"}
                            </div>
                          </div>
                          <div className="mt-1.5 line-clamp-2 text-[12px] leading-[1.35rem]">{summarizeRecord(record)}</div>
                          <div className={`mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.06em] ${metaClass}`}>
                            <span>offset {entry?.offset ?? "-"}</span>
                            <span>size {entry?.size ?? record.rawPayload?.byteLength ?? "-"}</span>
                            {record.linkedTo ? <span>linked to {record.linkedTo}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2>Selected Tag</h2>
                    <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">{selectedRecord?.signature ?? "No selection"}</span>
                  </div>
                  {selectedRecord ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-[10px] uppercase tracking-[0.08em]">
                          {selectedRecord.rawOnly ? "Raw-only tag" : selectedRecord.value?.kind ?? "unknown"}
                        </span>
                        {selectedRecord.linkedTo ? (
                          <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-[10px] uppercase tracking-[0.08em]">
                            Linked to {selectedRecord.linkedTo}
                          </span>
                        ) : null}
                      </div>
                      <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Summary</div>
                        <div className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{summarizeRecord(selectedRecord)}</div>
                      </div>
                      <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Payload Preview</div>
                        <div className="mt-1.5 overflow-auto break-all rounded-[0.9rem] bg-[#161310] px-3 py-3 font-mono text-[12px] leading-6 text-stone-100">
                          {selectedPayload ? hexPreview(selectedPayload, 48) : "No payload available"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] bg-[rgba(28,25,23,0.04)] px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">Structured Value</div>
                        <pre className="mt-1.5 max-h-[34rem] overflow-auto rounded-[0.9rem] bg-[#161310] p-3 font-mono text-[12px] leading-6 text-stone-100">
                          {JSON.stringify(
                            inspectValue(
                              selectedRecord.rawOnly
                                ? {
                                    signature: selectedRecord.signature,
                                    linkedTo: selectedRecord.linkedTo,
                                    rawPayload: selectedRecord.rawPayload,
                                  }
                                : selectedRecord.value,
                            ),
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="grid min-h-[220px] place-items-center text-center leading-8 text-stone-600">
                      Select a tag to inspect its decoded structure.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="grid min-h-[220px] place-items-center rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-5 text-center leading-7 text-stone-600 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
              <div>
                No ICC file is loaded yet. Upload a profile or choose a preset such as `Display P3.icc` or `eciCMYK_v2.icc` to inspect tag structure and LUT selection.
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
