import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { ambientSummary, expandWalls, floorArea, OBJECT_TEMPLATES, roofBox, roomWalls, TV_LIVING_ROOM, wallLength, wallLoops, wallOpenings, wallSegments, type Ambient } from "../model"
import { ambientToJson, buildAmbientFile, parseAmbientFile } from "./ambientFile"
import { mutate, rng } from "./fuzz"
import { buildMobleFile } from "./mobleFile"

/**
 * Fitxers `.ambient` malmesos a l'atzar: obrir-los mai llança, i el que s'obre (parets, obertures, terra, mobles) es
 * calcula sense llançar. Més casos o una altra llavor: FUZZ_N=4000 FUZZ_SEED=7.
 */
const N = Number(process.env.FUZZ_N ?? 200)

const ambient: Ambient = {
  walls: [
    ...roomWalls(0, 0, 4000, 3000).map((w, i) => (i === 0 ? { ...w, material: "Pintura verda", openings: [{ kind: "window" as const, at: 1500, w: 1200, h: 1200, sill: 900 }, { kind: "door" as const, at: 3200, w: 800, h: 2000, sill: 0 }] } : w)),
    { id: "wc", a: [4000, 0], b: [6000, 1500], thickness: 120, height: 2500, curve: { c1: [4800, -300], c2: [5600, 600] } },
  ],
  items: [
    { id: "i1", kind: "moble", projectId: 12, x: 1200, y: 300, rot: 0, group: "Saló" },
    { id: "i2", kind: "moble", projectId: 40, x: 2000, y: 1500, rot: 90 },
    { id: "b1", kind: "block", name: "Catifa", shape: "box", w: 2000, h: 10, d: 3000, material: "Catifa beix", x: 2000, y: 1500, rot: 0 },
  ],
  floorMaterial: "Parquet de roure",
  camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 55, pose: "eye" },
}
const furniture = new Map([
  [12, buildMobleFile({ name: "Moble TV", composition: TV_LIVING_ROOM.make(), references: [] })],
  [40, buildMobleFile({ name: "Sofà", composition: { ...OBJECT_TEMPLATES[0]!.make(), kind: "objecte" as const }, references: [] })],
])
const base = JSON.parse(ambientToJson(buildAmbientFile({ name: "Saló", ambient, furniture }).file)) as unknown

/** Tot el que l'app calcula d'un ambient obert sense el 3D. */
function use(text: string): void {
  const res = parseAmbientFile(text)
  if (!res.ok) return
  const a = res.file.ambient.data
  floorArea(a.walls)
  wallLoops(a.walls)
  expandWalls(a.walls)
  roofBox(a)
  ambientSummary(a, (it) => (it.kind === "moble" ? "moble" : "object"))
  for (const w of a.walls) {
    wallLength(w)
    wallOpenings(w)
    wallSegments(w)
  }
  for (const f of res.file.furniture) buildComposition(f.moble.project.composition)
}

describe("fitxers .ambient malmesos", () => {
  it("el fitxer de prova s'obre bé", () => {
    const res = parseAmbientFile(JSON.stringify(base))
    expect(res.ok ? res.warnings : res.error).toEqual([])
  })

  it(`${N} fitxers a l'atzar: cap error en obrir-los ni en fer-ne els càlculs`, () => {
    const rand = rng(Number(process.env.FUZZ_SEED ?? 20261023))
    const failures: string[] = []
    for (let i = 0; i < N; i++) {
      // La meitat dels canvis a l'ambient (parets, elements), l'altra a qualsevol lloc (mobles inclosos).
      const bad = mutate(base, rand, i % 2 ? ["ambient"] : [])
      try {
        use(JSON.stringify(bad))
      } catch (e) {
        failures.push(`#${i}: ${(e as Error).message} ${(e as Error).stack?.split("\n")[1]?.trim() ?? ""}`)
      }
    }
    expect(failures.slice(0, 10)).toEqual([])
  }, 600_000)
})
