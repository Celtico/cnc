import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { BUILTIN_TEMPLATES, TV_LIVING_ROOM, type Zone } from "./index"
import { addChild, countLeaves, duplicateZone, parentOf, removeZone, setChildSize, setFront, setShelves, splitZone, unsplitZone } from "./zoneOps"

describe("zoneOps", () => {
  const leaf: Zone = { id: "root", shelves: { n: 2, adjustable: true }, front: { kind: "door", mode: "single", hinge: "left" } }

  it("splitZone crea n fills auto i el primer hereta el contingut", () => {
    const z = splitZone(leaf, "root", "v", 3)
    expect(z.split?.dir).toBe("v")
    expect(z.split?.children).toHaveLength(3)
    expect(z.split?.sizes).toEqual(["auto", "auto", "auto"])
    expect(z.split?.children[0]!.shelves).toEqual({ n: 2, adjustable: true })
    expect(z.split?.children[1]!.front).toBeUndefined()
    expect(countLeaves(z)).toBe(3)
    // Immutable.
    expect(leaf.split).toBeUndefined()
  })

  it("unsplitZone torna a una fulla amb el contingut del primer fill", () => {
    const z = unsplitZone(splitZone(leaf, "root", "h"), "root")
    expect(z.split).toBeUndefined()
    expect(z.front).toEqual(leaf.front)
  })

  it("addChild, removeZone i parentOf", () => {
    let z = splitZone(leaf, "root", "v", 2)
    z = addChild(z, "root")
    expect(z.split?.children).toHaveLength(3)
    const childId = z.split!.children[1]!.id
    expect(parentOf(z, childId)?.id).toBe("root")
    z = removeZone(z, childId)
    expect(z.split?.children).toHaveLength(2)
    // Amb un sol fill, la divisió desapareix i el fill pren la id del pare.
    z = removeZone(z, z.split!.children[1]!.id)
    expect(z.split).toBeUndefined()
    expect(z.id).toBe("root")
    expect(z.shelves).toEqual({ n: 2, adjustable: true })
  })

  it("removeZone: si totes les que queden són fixes, el veí passa a «auto»", () => {
    const root = { id: "r", split: { dir: "v" as const, sizes: [300, "auto" as const, 300], children: [{ id: "a" }, { id: "b" }, { id: "c" }] } }
    expect(removeZone(root, "b").split!.sizes).toEqual(["auto", 300])
    expect(removeZone(root, "a").split!.sizes).toEqual(["auto", 300])
    const withAuto = { id: "r", split: { dir: "v" as const, sizes: [300, 200, "auto" as const], children: [{ id: "a" }, { id: "b" }, { id: "c" }] } }
    expect(removeZone(withAuto, "a").split!.sizes).toEqual([200, "auto"])
  })

  it("setChildSize, setShelves i setFront", () => {
    let z = splitZone(leaf, "root", "v", 2)
    z = setChildSize(z, "root", 1, 300)
    expect(z.split?.sizes).toEqual(["auto", 300])
    const c0 = z.split!.children[0]!.id
    z = setShelves(z, c0, null)
    expect(z.split!.children[0]!.shelves).toBeUndefined()
    z = setShelves(z, c0, { n: 1, adjustable: false })
    z = setFront(z, c0, { kind: "drawers", n: 3, heights: [] })
    // Els calaixos no treuen els prestatges: amb calaixos no es veuen ni compten (`visibleZone`) i tornen en treure'ls.
    expect(z.split!.children[0]!.shelves).toEqual({ n: 1, adjustable: false })
    expect(z.split!.children[0]!.front?.kind).toBe("drawers")
    z = setFront(z, c0, null)
    expect(z.split!.children[0]!.front).toBeUndefined()
    expect(z.split!.children[0]!.shelves).toEqual({ n: 1, adjustable: false })
    // El front d'abans es recorda per si s'hi torna.
    expect(z.split!.children[0]!.fronts?.drawers?.kind).toBe("drawers")
  })
})

describe("plantilles", () => {
  it("totes construeixen sense avisos bloquejants i amb ids úniques", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const comp = t.make()
      const { panels, warnings, extras } = buildComposition(comp)
      expect(panels.length + extras.length, t.name).toBeGreaterThan(t.kind === "taula" || t.kind === "lliure" ? 2 : 3)
      const ids = panels.map((p) => p.id)
      expect(new Set(ids).size, t.name).toBe(ids.length)
      expect(warnings.filter((w) => w.code === "layout" || w.code === "collision"), t.name).toEqual([])
    }
  })

  it("el moble TV del menjador: 3 portes, 3 prestatges, passacables, cobreradiador amb reixeta i trapa", () => {
    const comp = TV_LIVING_ROOM.make()
    const { panels, warnings, modules } = buildComposition(comp)
    const tv = panels.filter((p) => p.module === 1)
    expect(tv.filter((p) => p.role === "door")).toHaveLength(3)
    expect(tv.filter((p) => p.role === "shelf")).toHaveLength(3)
    expect(tv.filter((p) => p.role === "divider")).toHaveLength(2)
    expect(tv.find((p) => p.role === "plinth")).toBeDefined()
    expect(tv.find((p) => p.role === "back")!.cutouts?.[0]).toMatchObject({ kind: "circle", diameter: 60 })
    const rad = panels.filter((p) => p.module === 2)
    expect(rad.find((p) => p.role === "grille")).toBeDefined()
    expect(rad.find((p) => p.role === "hatch")).toBeDefined()
    expect(rad.find((p) => p.role === "bottom")).toBeUndefined()
    expect(modules[1]!.x).toBe(1900)
    expect(modules[1]!.build.openRatios[comp.modules[1]!.root.id]).toBeGreaterThan(0.4)
    expect(warnings.some((w) => w.code === "material-heat")).toBe(true)
    expect(warnings.some((w) => w.code === "collision")).toBe(false)
  })

  it("duplicateZone insereix una còpia al costat dins d'una divisió de la mateixa direcció", () => {
    const grille: Zone = { id: "g", front: { kind: "grille", pattern: { kind: "slotsH", slotWidth: 10, slotGap: 10, margin: 40, holeDiameter: 8, holePitch: 16 }, mount: "removable", hinge: "left" } }
    const root: Zone = { id: "root", split: { dir: "v", sizes: [300, "auto"], children: [{ id: "a" }, grille] } }
    const { root: z, copyId } = duplicateZone(root, "g", "v")
    expect(z.split?.children.map((c) => c.id)).toEqual(["a", "g", copyId])
    expect(z.split?.sizes).toEqual([300, "auto", "auto"])
    expect(z.split?.children[2]!.front).toEqual(grille.front)
    expect(z.split?.children[2]!.front).not.toBe(grille.front)
  })

  it("duplicateZone divideix la zona si la direcció no coincideix", () => {
    const door: Zone = { id: "root", front: { kind: "door", mode: "single", hinge: "left" } }
    const { root: z, copyId } = duplicateZone(door, "root", "h")
    expect(z.id).toBe("root")
    expect(z.split?.dir).toBe("h")
    expect(z.split?.children).toHaveLength(2)
    expect(z.split?.children[1]!.id).toBe(copyId)
    expect(z.split?.children.every((c) => c.front?.kind === "door")).toBe(true)
    expect(new Set(z.split?.children.map((c) => c.id)).size).toBe(2)
  })
})

describe("zoneOps: barra de penjar", () => {
  it("dividir i desfer la divisió conserven la barra", () => {
    const z = splitZone({ id: "a", rail: true, shelves: { n: 1, adjustable: true } }, "a", "h")
    expect(z.split!.children[0]!.rail).toBe(true)
    expect(unsplitZone(z, "a").rail).toBe(true)
  })
})
