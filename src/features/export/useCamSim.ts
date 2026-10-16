import { useEffect, useRef, useState, type RefObject } from "react"
import { useLatest } from "../../lib/useLatest"
import { opAt, stepOp, type SimProgram } from "./camSim"

export type SimSpeed = "1" | "5" | "20" | "100"

/** El rellotge de la simulació 3D: el temps va en una ref (el 3D el llegeix a cada fotograma) i a la UI, 10 cops per segon. */
export interface CamSimClock {
  prog: SimProgram
  /** Temps del programa (s), el de debò. */
  time: RefObject<number>
  /** El que mostra la UI (s'actualitza 10 cops per segon mentre va). */
  shown: number
  playing: boolean
  speed: SimSpeed
  /** Índex a `prog.ops` de l'operació en curs (−1 al final). */
  op: number
  setPlaying: (on: boolean) => void
  setSpeed: (s: SimSpeed) => void
  seek: (t: number) => void
  step: (dir: 1 | -1) => void
  /** El 3D la crida a cada fotograma amb el temps real passat (s). */
  tick: (dt: number) => void
}

/** Rellotge d'un programa (es torna a zero si canvia el programa). `null` mentre no hi ha 3D. */
export function useCamSim(prog: SimProgram | null): CamSimClock | null {
  const time = useRef(0)
  const [shown, setShown] = useState(0)
  const [playing, setPlayingState] = useState(false)
  const [speed, setSpeed] = useState<SimSpeed>("20")
  const last = useRef(0)
  const live = useLatest({ prog, playing, speed })

  useEffect(() => {
    time.current = 0
    setShown(0)
    setPlayingState(false)
  }, [prog])

  if (!prog) return null
  const total = prog.total
  const seek = (t: number) => {
    time.current = Math.min(total, Math.max(0, t))
    setShown(time.current)
  }
  return {
    prog,
    time,
    shown,
    playing,
    speed,
    op: opAt(prog, shown),
    setPlaying: (on) => {
      // Al final, tornar a jugar comença de nou.
      if (on && time.current >= total - 1e-6) seek(0)
      setPlayingState(on)
    },
    setSpeed,
    seek,
    step: (dir) => seek(stepOp(prog, time.current, dir)),
    tick: (dt) => {
      const { playing: on, speed: sp, prog: pg } = live.current
      if (!on || !pg) return
      time.current = Math.min(pg.total, time.current + dt * Number(sp))
      const now = performance.now()
      const end = time.current >= pg.total
      if (end || now - last.current > 100) {
        last.current = now
        setShown(time.current)
      }
      if (end) setPlayingState(false)
    },
  }
}
