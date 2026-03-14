import { Float, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function SpinningKnot() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.4;
    meshRef.current.rotation.y += delta * 0.7;
  });

  return (
    <Float speed={2} rotationIntensity={1.2} floatIntensity={1.4}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[0.9, 0.28, 192, 32]} />
        <meshStandardMaterial
          color="#f97316"
          metalness={0.45}
          roughness={0.15}
        />
      </mesh>
    </Float>
  );
}

function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937_0%,#111827_35%,#020617_100%)] text-slate-50">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-sm text-slate-200 backdrop-blur">
            Vite 8 + React 19 + TypeScript + Tailwind 4 + R3F
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              3D UI starting point for the{" "}
              <span className="text-orange-400">web</span> app
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Tailwind is wired into Vite, and React Three Fiber is ready for
              interactive scenes. Start editing <code>src/App.tsx</code> to
              build from here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-200">
            <div className="glass-panel">Fast refresh enabled</div>
            <div className="glass-panel">Strict TypeScript defaults</div>
            <div className="glass-panel">Three.js scene mounted</div>
          </div>
        </section>

        <section className="h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 shadow-2xl shadow-orange-950/20 backdrop-blur">
          <Canvas camera={{ position: [0, 0, 4], fov: 42 }}>
            <color attach="background" args={["#020617"]} />
            <fog attach="fog" args={["#020617", 4, 8]} />
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[2, 3, 4]}
              intensity={2.2}
              color="#fff7ed"
            />
            <pointLight position={[-2, -1, 2]} intensity={18} color="#fb923c" />
            <SpinningKnot />
            <OrbitControls enablePan={false} />
          </Canvas>
        </section>
      </div>
    </main>
  );
}

export default App;
