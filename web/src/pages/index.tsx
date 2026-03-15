import Head from "next/head";

export default function IndexRoute() {
  return (
    <>
      <Head>
        <title>clrpkr web</title>
      </Head>
      <main className="min-h-screen text-stone-900">
        <div className="pointer-events-none fixed inset-0 opacity-70">
          <div className="absolute left-[-10%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#f97316]/18 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-6%] h-[26rem] w-[26rem] rounded-full bg-[#0f766e]/18 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-5 py-10 lg:px-8">
          <section className="rounded-[2rem] border border-black/8 bg-[#13110f] px-6 py-7 text-stone-50 shadow-[0_30px_80px_rgba(40,24,10,0.22)]">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              clrpkr
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
              A growing set of small tools for working with color profiles and related assets.
            </p>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <a
              className="block rounded-[1.75rem] border border-black/8 bg-[rgba(255,252,246,0.78)] p-5 text-inherit no-underline shadow-[0_18px_45px_rgba(70,48,22,0.1)] backdrop-blur transition hover:translate-y-[-2px] hover:shadow-[0_22px_50px_rgba(70,48,22,0.14)]"
              href="/icc"
            >
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2>ICC Inspector</h2>
                <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">/icc</span>
              </div>
              <p className="m-0 leading-7">
                Upload ICC or ICM profiles and inspect headers, tags, raw payloads, and intent-based LUT selection.
              </p>
            </a>
          </section>
        </div>
      </main>
    </>
  );
}
