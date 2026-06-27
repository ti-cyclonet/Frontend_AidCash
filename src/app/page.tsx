"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sprout } from "lucide-react"

export default function SplashScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 500)
    const t2 = setTimeout(() => setPhase("exit"), 2200)
    const t3 = setTimeout(() => router.replace("/login"), 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [router])

  return (
    <div
      className="flex h-screen flex-col items-center justify-center bg-kiri-forest gap-8 transition-opacity duration-500"
      style={{ opacity: phase === "exit" ? 0 : 1 }}
    >
      {/* Logo icon */}
      <div
        className="transition-all duration-700 ease-out"
        style={{
          transform: phase === "enter" ? "scale(0.7) translateY(20px)" : "scale(1) translateY(0)",
          opacity: phase === "enter" ? 0 : 1,
        }}
      >
        <div className="h-28 w-28 bg-kiri-sage/40 backdrop-blur-sm rounded-[2rem] shadow-2xl shadow-black/20 flex items-center justify-center">
          <Sprout className="h-14 w-14 text-kiri-cream" strokeWidth={1.5} />
        </div>
      </div>

      {/* Brand name */}
      <div
        className="flex flex-col items-center gap-2 transition-all duration-700 delay-150 ease-out"
        style={{
          transform: phase === "enter" ? "translateY(16px)" : "translateY(0)",
          opacity: phase === "enter" ? 0 : 1,
        }}
      >
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Kiri Finance
        </h1>
        <p className="text-white/50 text-sm font-medium">
          Your finances, in order.
        </p>
      </div>

      {/* Loading bar */}
      <div
        className="w-40 h-1 bg-white/10 rounded-full overflow-hidden mt-4 transition-opacity duration-300"
        style={{ opacity: phase === "hold" ? 1 : 0 }}
      >
        <div
          className="h-full bg-white/60 rounded-full transition-all duration-[1500ms] ease-out"
          style={{ width: phase === "hold" ? "100%" : "0%" }}
        />
      </div>
    </div>
  )
}
