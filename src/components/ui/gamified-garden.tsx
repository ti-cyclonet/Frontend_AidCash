"use client"

import { useEffect, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GamifiedGardenProps {
  isActionPositive: boolean
  freeSpendingExceeded: boolean
  debtPercentage: number
  hasActiveLoan: boolean
  emergencyFundComplete: boolean
  growthLevel: number
}

// ─── Fases de crecimiento ─────────────────────────────────────────────────────
// bottom es relativo al borde inferior del contenedor
// Todos centrados horizontalmente con left:50% + translateX(-50%)

const TREE_PHASES: Record<number, { src: string; width: string; bottom: string }> = {
  1: { src: '/garden/brote.png',           width: '22%',  bottom: '18%' },
  2: { src: '/garden/arbol_pequeno.png',   width: '35%',  bottom: '18%' },
  3: { src: '/garden/arbol_mediano.png',   width: '50%',  bottom: '18%' },
  4: { src: '/garden/arbol_grande.png',    width: '70%',  bottom: '18%' },
}

function getTreeAsset(level: number) {
  if (level <= 1) return TREE_PHASES[1]
  if (level >= 4) return TREE_PHASES[4]
  return TREE_PHASES[level]
}

// ─── Ciclo día/noche ──────────────────────────────────────────────────────────

function getTimeOfDay(): 'day' | 'sunset' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 18) return 'day'
  if (hour >= 18 && hour < 20) return 'sunset'
  return 'night'
}

const SKY = {
  day:    'linear-gradient(180deg, #87CEEB 0%, #B8E4F0 50%, #E0F7FA 100%)',
  sunset: 'linear-gradient(180deg, #FF8C42 0%, #FFB347 40%, #87CEEB 100%)',
  night:  'linear-gradient(180deg, #0F1B2D 0%, #1A2744 50%, #2C3E50 100%)',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function GamifiedGarden({
  isActionPositive,
  freeSpendingExceeded,
  debtPercentage,
  emergencyFundComplete,
  growthLevel,
}: GamifiedGardenProps) {
  const [showWatering, setShowWatering] = useState(false)
  const isOverloaded = debtPercentage >= 70
  const treeAsset = getTreeAsset(growthLevel)
  const timeOfDay = useMemo(() => getTimeOfDay(), [])
  const isNight = timeOfDay === 'night'

  const skyBg = isOverloaded
    ? 'linear-gradient(180deg, #4B5563 0%, #6B7280 50%, #9CA3AF 100%)'
    : SKY[timeOfDay]

  useEffect(() => {
    if (isActionPositive) {
      setShowWatering(true)
      const t = setTimeout(() => setShowWatering(false), 3500)
      return () => clearTimeout(t)
    }
  }, [isActionPositive])

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-3xl">

      {/* ── Cielo ── */}
      <motion.div
        className="absolute inset-0"
        animate={{ background: skyBg }}
        transition={{ duration: 1.5 }}
      />

      {/* ── Sol (día) ── */}
      {timeOfDay === 'day' && !isOverloaded && (
        <motion.div
          style={{
            position: 'absolute', top: '10%', right: '10%',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'radial-gradient(circle, #FDE68A 0%, #FEF3C7 50%, transparent 100%)',
            zIndex: 2,
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      )}

      {/* ── Luna (noche) ── */}
      {isNight && !isOverloaded && (
        <motion.div
          style={{
            position: 'absolute', top: '10%', right: '12%',
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'radial-gradient(circle, #F9FAFB 0%, #E5E7EB 50%, transparent 80%)',
            boxShadow: '0 0 12px rgba(255,255,255,0.4)',
            zIndex: 2,
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      )}

      {/* ── Tierra (pegada al borde inferior) ── */}
      <img
        src="/garden/tierra.png"
        alt="Isla"
        style={{
          position: 'absolute',
          width: '100%',
          bottom: '0',
          left: '0',
          zIndex: 3,
          objectFit: 'contain',
          filter: isOverloaded
            ? 'saturate(0.4) brightness(0.7)'
            : isNight
              ? 'brightness(0.65)'
              : undefined,
        }}
      />

      {/* ── Árbol (centrado, arriba del borde inferior) ── */}
      <motion.img
        src={treeAsset.src}
        alt="Árbol"
        style={{
          position: 'absolute',
          width: treeAsset.width,
          bottom: treeAsset.bottom,
          left: '50%',
          transform: 'translateX(-50%)',
          transformOrigin: 'bottom center',
          zIndex: 10,
          objectFit: 'contain',
        }}
        animate={{
          rotate: [-0.3, 0.3, -0.3],
          filter: freeSpendingExceeded
            ? 'hue-rotate(25deg) saturate(0.5)'
            : isOverloaded
              ? 'saturate(0.5) brightness(0.75)'
              : isNight
                ? 'brightness(0.55)'
                : 'saturate(1) brightness(1)',
        }}
        transition={{
          rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
          filter: { duration: 1.5 },
        }}
      />

      {/* ── Casa de hormigas ── */}
      <img
        src="/garden/casa_hormigas.png"
        alt="Hormiguero"
        style={{
          position: 'absolute',
          width: '13%',
          bottom: '15%',
          left: '20%',
          zIndex: 12,
          objectFit: 'contain',
        }}
      />

      {/* ── Hormigas ── */}
      {freeSpendingExceeded &&
        Array.from({ length: 6 }).map((_, i) => (
          <motion.img
            key={`ant-${i}`}
            src="/garden/hormiga.png"
            alt=""
            style={{
              position: 'absolute',
              width: '11px',
              height: '11px',
              objectFit: 'contain',
              zIndex: 20,
            }}
            animate={{
              left: ['23%', '38%', '48%', '50%'],
              top: ['70%', '66%', '56%', '42%'],
              opacity: [0, 1, 1, 0],
              rotate: [0, -20, -60, -90],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'linear',
            }}
          />
        ))
      }

      {/* ── Cerca (fondo emergencia) ── */}
      <AnimatePresence>
        {emergencyFundComplete && (
          <motion.img
            src="/garden/cerca_completa.png"
            alt="Protección"
            style={{
              position: 'absolute',
              width: '80%',
              bottom: '5%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 4,
              objectFit: 'contain',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        )}
      </AnimatePresence>

      {/* ── Regadera ── */}
      <AnimatePresence>
        {showWatering && (
          <motion.img
            src="/garden/regadera.png"
            alt="Regadera"
            style={{
              position: 'absolute',
              top: '8%',
              left: '8%',
              width: '20%',
              zIndex: 30,
              objectFit: 'contain',
            }}
            initial={{ opacity: 0, x: -20, rotate: -15 }}
            animate={{ opacity: 1, x: 0, rotate: 5 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ── Gotas ── */}
      <AnimatePresence>
        {showWatering && (
          <motion.div
            style={{ position: 'absolute', top: '24%', left: '18%', zIndex: 31 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute w-1 h-2 bg-blue-400/80 rounded-full"
                animate={{ y: [0, 20, 40], opacity: [1, 0.5, 0] }}
                transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                style={{ left: `${i * 5}px` }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Partículas ── */}
      <AnimatePresence>
        {showWatering && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`p-${i}`}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? '#34D399' : '#A78BFA',
                  left: `${46 + (Math.random() - 0.5) * 12}%`,
                  top: '40%',
                  zIndex: 25,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.3, 0], y: [0, -30] }}
                transition={{ duration: 1.5, delay: i * 0.2 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
