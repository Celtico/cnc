import { describe, expect, it } from "vitest"
import type { Zone } from "../../core/model"
import { splitRows, zoneLabel } from "./zoneLabel"

describe("splitRows", () => {
  it("una fila per fill, en ordre, amb el nom de l'arbre i la seva mida", () => {
    const z: Zone = {
      id: "r",
      split: {
        dir: "v",
        sizes: [300, "auto"],
        children: [{ id: "a" }, { id: "b", front: { kind: "door", mode: "single" } as Zone["front"] }, { id: "c", shelves: { n: 2, adjustable: true } }],
      },
    }
    expect(splitRows(z)).toEqual([
      { id: "a", label: "1 · Obert", size: 300 },
      { id: "b", label: `2 · ${zoneLabel(z.split!.children[1]!)}`, size: "auto" },
      // Sense mida desada: «auto» (com la construcció).
      { id: "c", label: "3 · Obert · 2 prestatges", size: "auto" },
    ])
  })

  it("sense divisió, cap fila", () => {
    expect(splitRows({ id: "x" })).toEqual([])
  })
})
