import { useEffect, useMemo } from "react"
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"
import { type FloorId, type PresentationScene } from "./presentationScene"
import { surfaceMaterial } from "./surfaceMaterial"
import type { MaterialPref } from "../../core/model"

const SKIRTING = "#fbfaf7"
/** Sòcol de paret: 8 cm d'alt i 15 mm de gruix. */
const SK_H = 0.08
const SK_T = 0.015
/** Mida del terra i amplada de la paret (m): prou gran perquè no se'n vegin les vores. */
const ROOM = 40

const WOOD_TONES: Record<"oak" | "walnut", string[]> = {
  oak: ["#c9a67a", "#c19d71", "#cfae83", "#bb966a", "#c6a376", "#d2b389"],
  walnut: ["#6e4a30", "#5f3f28", "#7a5337", "#654430", "#734d33", "#58392a"],
}

/** Costat de la tessel·la de parquet (m). */
const PARQUET_TILE = 2.4

/**
 * Parquet generat amb un canvas (sense descarregar imatges): lames de 15 cm × 0,8–1,6 m,
 * tons lleugerament diferents, veta i junts. La tessel·la (2,4 × 2,4 m) és contínua: cada
 * filera suma exactament l'amplada i les lames que passen de la vora continuen per l'altre
 * costat, així no es veuen costures ni lames tallades en repetir-se.
 */
function makeParquet(tones: string[]): CanvasTexture {
  const px = 2048
  const rows = 16
  const perM = px / PARQUET_TILE
  const c = document.createElement("canvas")
  c.width = px
  c.height = px
  const g = c.getContext("2d")!
  const plankW = px / rows // 15 cm
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  /** Dibuixa `fn` a x i als seus desplaçaments de ±px (continuïtat horitzontal). */
  const wrapped = (fn: (dx: number) => void) => {
    for (const dx of [-px, 0, px]) fn(dx)
  }

  for (let row = 0; row < rows; row++) {
    const y0 = row * plankW
    // Llargades que sumen exactament px (s'escalen), començant en un punt aleatori.
    const lens: number[] = []
    let sum = 0
    while (sum < px) {
      const l = perM * (0.8 + rnd() * 0.8)
      lens.push(l)
      sum += l
    }
    const k = px / sum
    let x = rnd() * px
    for (const raw of lens) {
      const len = raw * k
      const tone = tones[Math.floor(rnd() * tones.length)]!
      const shade = (rnd() - 0.5) * 0.08
      const lines = Array.from({ length: 16 }, (_, i) => ({
        y: y0 + rnd() * plankW,
        a: 0.04 + rnd() * 0.08,
        w: 0.6 + rnd() * 1.4,
        amp: 1 + rnd() * 2,
        ph: i + rnd() * 3,
      }))
      wrapped((dx) => {
        const x0 = x + dx
        if (x0 + len < 0 || x0 > px) return
        g.save()
        g.beginPath()
        g.rect(x0, y0, len, plankW)
        g.clip()
        g.fillStyle = tone
        g.fillRect(x0, y0, len, plankW)
        g.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`
        g.fillRect(x0, y0, len, plankW)
        // veta: línies fines i lleugerament ondulades al llarg de la lama
        for (const ln of lines) {
          g.strokeStyle = `rgba(90, 60, 30, ${ln.a})`
          g.lineWidth = ln.w
          g.beginPath()
          g.moveTo(x0, ln.y)
          for (let t = 0; t <= 1.001; t += 0.05) g.lineTo(x0 + len * t, ln.y + Math.sin(t * 6 + ln.ph) * ln.amp)
          g.stroke()
        }
        g.restore()
        // junt de testa
        g.fillStyle = "rgba(60, 40, 20, 0.45)"
        g.fillRect(x0 + len - 1, y0, 2, plankW)
      })
      x += len
    }
    // junt longitudinal
    g.fillStyle = "rgba(60, 40, 20, 0.5)"
    g.fillRect(0, y0, px, 2)
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

/** Microciment: gris amb taques suaus i gra fi. */
function makeConcrete(): CanvasTexture {
  const px = 512
  const c = document.createElement("canvas")
  c.width = px
  c.height = px
  const g = c.getContext("2d")!
  g.fillStyle = "#a9a59f"
  g.fillRect(0, 0, px, px)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * px
    const y = rnd() * px
    const r = 30 + rnd() * 120
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const a = 0.04 + rnd() * 0.06
    grad.addColorStop(0, rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(60,55,50,${a})`)
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    // es dibuixa també desplaçat perquè la tessel·la no tingui costures
    for (const dx of [-px, 0, px]) for (const dy of [-px, 0, px]) {
      g.save()
      g.translate(dx, dy)
      g.fillRect(x - r, y - r, r * 2, r * 2)
      g.restore()
    }
  }
  const img = g.getImageData(0, 0, px, px)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 10
    img.data[i]! += n
    img.data[i + 1]! += n
    img.data[i + 2]! += n
  }
  g.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function makeFloor(id: FloorId): { map: CanvasTexture | null; repeat: number; roughness: number } {
  if (id === "oak" || id === "walnut") return { map: makeParquet(WOOD_TONES[id]), repeat: ROOM / PARQUET_TILE, roughness: 0.55 }
  if (id === "concrete") return { map: makeConcrete(), repeat: ROOM / 2, roughness: 0.8 }
  return { map: null, repeat: 1, roughness: 0.7 }
}

const swatchCache = new Map<FloorId, string | null>()

/** Imatge petita (data URL) de la textura del terra, per a les mostres de les preferències. */
export function floorSwatchUrl(id: FloorId): string | null {
  if (!swatchCache.has(id)) {
    const f = makeFloor(id)
    const src = f.map?.image as HTMLCanvasElement | undefined
    let url: string | null = null
    if (src) {
      const c = document.createElement("canvas")
      c.width = c.height = 96
      // un tros de ~40 cm perquè es vegin les lames
      c.getContext("2d")!.drawImage(src, 0, 0, src.width / 6, src.height / 6, 0, 0, 96, 96)
      url = c.toDataURL("image/jpeg", 0.85)
    }
    f.map?.dispose()
    swatchCache.set(id, url)
  }
  return swatchCache.get(id)!
}

/**
 * Estança per al mode «Presentació»: terra de parquet, paret al darrere del moble (el
 * moble hi va recolzat), sòcol de paret i llum d'estudi amb reflexos suaus. Tot es genera
 * aquí, sense xarxa (funciona a la PWA sense connexió).
 */
export function PresentationRoom({ backZ, scene, materials = [] }: { backZ: number; scene: PresentationScene; materials?: MaterialPref[] }) {
  // Terra i paret de la biblioteca de materials (els mateixos dels ambients), a mida real.
  const floorLib = scene.floorMaterial && materials.some((m) => m.name === scene.floorMaterial) ? scene.floorMaterial : null
  const wallLib = scene.wallMaterial && materials.some((m) => m.name === scene.wallMaterial) ? scene.wallMaterial : null
  const floorMat = useMemo(() => (floorLib ? surfaceMaterial(materials, floorLib, ROOM * 1000, ROOM * 1000) : null), [floorLib, materials])
  const wallMat = useMemo(() => (wallLib ? surfaceMaterial(materials, wallLib, ROOM * 1000, 4000) : null), [wallLib, materials])
  const skirtLibMat = useMemo(() => {
    const name = scene.skirting === "floor" ? floorLib : scene.skirting === "wall" ? wallLib : null
    return name ? surfaceMaterial(materials, name, ROOM * 1000, SK_H * 1000) : null
  }, [scene.skirting, floorLib, wallLib, materials])
  useEffect(() => () => floorMat?.dispose(), [floorMat])
  useEffect(() => () => wallMat?.dispose(), [wallMat])
  useEffect(() => () => skirtLibMat?.dispose(), [skirtLibMat])
  const floor = useMemo(() => {
    const f = makeFloor(scene.floor)
    f.map?.repeat.set(f.repeat, f.repeat)
    return f
  }, [scene.floor])
  useEffect(() => () => floor.map?.dispose(), [floor])
  // El sòcol «com el terra» fa servir la mateixa textura, amb la veta al llarg del sòcol.
  const skirtingMap = useMemo(() => {
    if (!floor.map) return null
    const t = floor.map.clone()
    t.repeat.set(floor.repeat, SK_H / (ROOM / floor.repeat))
    t.needsUpdate = true
    return t
  }, [floor])
  useEffect(() => () => skirtingMap?.dispose(), [skirtingMap])

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.0005, 0]} receiveShadow userData={{ room: "floor" }}>
        <planeGeometry args={[ROOM, ROOM]} />
        {floorMat ? (
          <primitive key={`lib:${floorLib}`} object={floorMat} attach="material" />
        ) : (
          <meshStandardMaterial key={scene.floor} map={floor.map} color={floor.map ? "#ffffff" : "#eeeeec"} roughness={floor.roughness} metalness={0} envMapIntensity={0.6} />
        )}
      </mesh>

      <mesh position={[0, 2, backZ - 0.002]} receiveShadow userData={{ room: "wall" }}>
        <planeGeometry args={[ROOM, 4]} />
        {wallMat ? <primitive key={`lib:${wallLib}`} object={wallMat} attach="material" /> : <meshStandardMaterial key="wall-color" color={scene.wall} roughness={0.95} envMapIntensity={0.4} />}
      </mesh>

      {scene.skirting !== "none" && (
        <mesh position={[0, SK_H / 2, backZ + SK_T / 2]} receiveShadow castShadow userData={{ room: "wall" }}>
          <boxGeometry args={[ROOM, SK_H, SK_T]} />
          {skirtLibMat ? (
            <primitive key="sk-lib" object={skirtLibMat} attach="material" />
          ) : scene.skirting === "floor" && skirtingMap ? (
            <meshStandardMaterial key="sk-tex" map={skirtingMap} roughness={floor.roughness} />
          ) : (
            <meshStandardMaterial key="sk-color" color={scene.skirting === "wall" ? scene.wall : scene.skirting === "floor" ? "#eeeeec" : SKIRTING} roughness={0.45} />
          )}
        </mesh>
      )}
    </>
  )
}
