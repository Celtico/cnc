import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { toCutList } from "../cutlist/toCutList"
import { DEFAULT_CABINET } from "../model"
import { cutListToCsv } from "./csv"

describe("cutListToCsv", () => {
  const list = toCutList(buildCabinet({ ...DEFAULT_CABINET, doors: 2 }))
  const csv = cutListToCsv(list)
  const lines = csv.replace("﻿", "").trimEnd().split("\r\n")

  it("comença amb BOM i capçalera en català", () => {
    expect(csv.startsWith("﻿")).toBe(true)
    expect(lines[0]).toBe(
      "Peça;Quantitat;Llarg (mm);Ample (mm);Gruix (mm);Material;Veta;Cantells;Cantell (m);Forats;Superfície (m²)",
    )
  })

  it("una fila per grup, amb decimal coma", () => {
    expect(lines).toHaveLength(1 + list.items.length)
    const door = lines.find((l) => l.startsWith("Porta;"))!
    expect(door).toBe("Porta;2;716;296,5;19;Melamina 19;Llarg;1+2+3+4;4,05;4;0,4246")
  })

  it("permet separador i decimal alternatius", () => {
    const en = cutListToCsv(list, { separator: ",", decimal: "." })
    expect(en).toContain("Porta,2,716,296.5,19,Melamina 19,Llarg,1+2+3+4,4.05,4,0.4246")
  })
})
