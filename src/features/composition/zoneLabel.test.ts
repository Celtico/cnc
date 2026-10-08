import { describe, expect, it } from "vitest"
import type { Zone } from "../../core/model"
import { splitRows, zoneLabel } from "./zoneLabel"

describe("splitRows", () => {
  it("una fila per fill, en ordre: «Amplada 1»… amb el nom de l'arbre, la seva mida i l'última, el que sobra", () => {
    const z: Zone = {
      id: "r",
      split: {
        dir: "v",
        sizes: [300, "auto"],
        children: [{ id: "a" }, { id: "b", front: { kind: "door", mode: "single" } as Zone["front"] }, { id: "c", shelves: { n: 2, adjustable: true } }],
      },
    }
    expect(splitRows(z)).toEqual([
      { id: "a", label: "Amplada 1", name: "Obert", size: 300, rest: false },
      { id: "b", label: "Amplada 2", name: zoneLabel(z.split!.children[1]!), size: "auto", rest: false },
      // Sense mida desada: «auto» (com la construcció).
      { id: "c", label: "Amplada 3", name: "Obert · 2 prestatges", size: "auto", rest: true },
    ])
  })

  it("horitzontal: «Alçada 1», «Alçada 2»", () => {
    const z: Zone = { id: "r", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] } }
    expect(splitRows(z).map((r) => [r.label, r.rest])).toEqual([
      ["Alçada 1", false],
      ["Alçada 2", true],
    ])
  })

  it("sense divisió, cap fila", () => {
    expect(splitRows({ id: "x" })).toEqual([])
  })
})

describe("zoneLabel de l'«Interior»", () => {
  const split: Zone["split"] = { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] }
  it("dividit amb les portes de tot el mòdul (Mòdul › Portes): «Interior · 2 portes»", () => {
    expect(zoneLabel({ id: "r", split, front: { kind: "door", mode: "double", hinge: "left" } }, { root: true })).toBe("Interior · 2 portes")
    expect(zoneLabel({ id: "r", split, front: { kind: "door", mode: "single", hinge: "left" } }, { root: true })).toBe("Interior · Porta")
  })
  it("un front fix de tota la zona (dades d'abans) no es fa: no surt", () => {
    expect(zoneLabel({ id: "r", split, front: { kind: "panel" } }, { root: true })).toBe("Interior · Divisió vertical (2)")
  })
})
