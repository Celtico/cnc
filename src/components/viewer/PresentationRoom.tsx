import { useEffect, useMemo } from "react"
import { type PresentationScene } from "./presentationScene"
import { makeFloor, ROOM } from "./floorTextures"
import { surfaceMaterial } from "./surfaceMaterial"
import { disposeMaterial, tileClone } from "./textures"
import type { MaterialPref } from "../../core/model"

const SKIRTING = "#fbfaf7"
/** Sòcol de paret: 8 cm d'alt i 15 mm de gruix. */
const SK_H = 0.08
const SK_T = 0.015

/**
 * Estança per al mode «Presentació»: terra de parquet, paret al darrere del moble (el
 * moble hi va recolzat), sòcol de paret i llum d'estudi amb reflexos suaus. Tot es genera
 * aquí, sense xarxa (funciona a la PWA sense connexió).
 */
export function PresentationRoom({ backZ, scene, materials = [], sideWalls }: { backZ: number; scene: PresentationScene; materials?: MaterialPref[]; sideWalls?: { left?: number; right?: number } }) {
  // Terra i paret de la biblioteca de materials (els mateixos dels ambients), a mida real.
  const floorLib = scene.floorMaterial && materials.some((m) => m.name === scene.floorMaterial) ? scene.floorMaterial : null
  const wallLib = scene.wallMaterial && materials.some((m) => m.name === scene.wallMaterial) ? scene.wallMaterial : null
  const floorMat = useMemo(() => (floorLib ? surfaceMaterial(materials, floorLib, ROOM * 1000, ROOM * 1000) : null), [floorLib, materials])
  const wallMat = useMemo(() => (wallLib ? surfaceMaterial(materials, wallLib, ROOM * 1000, 4000) : null), [wallLib, materials])
  const skirtLibMat = useMemo(() => {
    const name = scene.skirting === "floor" ? floorLib : scene.skirting === "wall" ? wallLib : null
    return name ? surfaceMaterial(materials, name, ROOM * 1000, SK_H * 1000) : null
  }, [scene.skirting, floorLib, wallLib, materials])
  useEffect(() => () => void (floorMat && disposeMaterial(floorMat)), [floorMat])
  useEffect(() => () => void (wallMat && disposeMaterial(wallMat)), [wallMat])
  useEffect(() => () => void (skirtLibMat && disposeMaterial(skirtLibMat)), [skirtLibMat])
  // Parquet procedural: només si no hi ha terra de la biblioteca (es genera la primera vegada i es guarda per terra,
  // `makeFloor`); aquí se'n fa un clon amb la repetició, que és l'únic que s'allibera.
  const floor = useMemo(() => {
    if (floorLib) return { map: null, repeat: 1, roughness: 0.7 }
    const f = makeFloor(scene.floor)
    if (!f.map) return f
    const map = tileClone(f.map)
    map.repeat.set(f.repeat, f.repeat)
    return { ...f, map }
  }, [scene.floor, floorLib])
  useEffect(() => () => floor.map?.dispose(), [floor])
  // El sòcol «com el terra» fa servir la mateixa textura, amb la veta al llarg del sòcol.
  const skirtingMap = useMemo(() => {
    if (!floor.map || skirtLibMat || scene.skirting !== "floor") return null
    const t = tileClone(floor.map)
    t.repeat.set(floor.repeat, SK_H / (ROOM / floor.repeat))
    return t
  }, [floor, skirtLibMat, scene.skirting])
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

      {/* Parets dels costats (per decisió de l'usuari, 2026-10-21): a ras del moble, des de la paret del darrere cap endavant. */}
      {(["left", "right"] as const).map((side) => {
        const x = sideWalls?.[side]
        if (x === undefined) return null
        const s = side === "left" ? 1 : -1
        return (
          <group key={side}>
            {/* El mateix material que la del darrere, compartit (`material`, no `primitive`: un objecte només pot penjar d'un lloc). */}
            <mesh position={[x - s * 0.002, 2, backZ + ROOM / 2]} rotation-y={(s * Math.PI) / 2} receiveShadow userData={{ room: "wall" }} {...(wallMat ? { material: wallMat } : {})}>
              <planeGeometry args={[ROOM, 4]} />
              {!wallMat && <meshStandardMaterial color={scene.wall} roughness={0.95} envMapIntensity={0.4} />}
            </mesh>
          </group>
        )
      })}
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

/** Les parets no es poden clicar: els clics passen a les peces del darrere. */
const noRay = () => null

/**
 * L'habitació a les vistes de treball (Modelatge › Espai › Habitació, com al Taulell): la paret del darrere i les dels
 * costats, a ras del moble (`sideWalls`), clares i una mica transparents perquè no tapin res. A Presentació hi ha l'estança.
 */
export function GuideRoom({ backZ, sideWalls }: { backZ: number; sideWalls: { left?: number; right?: number } }) {
  const H = 2.6
  const D = 3
  const mat = <meshStandardMaterial color="#e7e3dc" roughness={0.95} transparent opacity={0.55} depthWrite={false} side={2} />
  return (
    <group userData={{ room: "guide" }}>
      <mesh position={[0, H / 2, backZ - 0.002]} raycast={noRay} renderOrder={-1}>
        <planeGeometry args={[ROOM, H]} />
        {mat}
      </mesh>
      {(["left", "right"] as const).map((side) => {
        const x = sideWalls[side]
        if (x === undefined) return null
        const s = side === "left" ? 1 : -1
        return (
          <mesh key={side} position={[x - s * 0.002, H / 2, backZ + D / 2]} rotation-y={(s * Math.PI) / 2} raycast={noRay} renderOrder={-1}>
            <planeGeometry args={[D, H]} />
            {mat}
          </mesh>
        )
      })}
    </group>
  )
}
