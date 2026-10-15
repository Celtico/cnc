import { describe, expect, it } from "vitest"
import type { HettichArticle } from "../import/hettich"
import { handleItem, hingeItem, legItem, plateItem } from "../import/importItem"
import { pairPlate, setConfirmed } from "../model/hardwareEdit"
import type { HardwareProposal } from "../import/proposal"
import { DEFAULT_HARDWARE_LIBRARY, DEFAULT_MODULE_HARDWARE, type Vec3 } from "../model"
import { expectFramed } from "./mountCameraCheck"

/**
 * La càmera de «Com va muntat» (editor i miniatura de la targeta) **enquadra el ferratge sempre**: la regió del muntatge
 * (`HardwareMount.region`: el ferratge, els seus forats i un marge de peça) cau sencera dins la imatge amb marge, per a
 * l'aspecte de la miniatura (2:1) i el de l'editor, a tots els ferratges de l'app, als jocs i als importats (de
 * mostra; els de debò, amb `HETTICH_DIR` / `BLUM_DIR`, a `mountCamera.roundtrip.test.ts`). La comprovació és a `mountCameraCheck.ts`.
 */

const art = (article: string, kind: HettichArticle["kind"], category: HettichArticle["category"]): HettichArticle => ({ article, folders: [], category, tags: [], label: `${kind} ${article}`, group: "", kind, files: [] })

describe("la càmera de «Com va muntat» enquadra el ferratge", () => {
  it("tots els ferratges de l'app i els jocs de calaix", () => {
    for (const item of DEFAULT_HARDWARE_LIBRARY) expectFramed(item, `${item.engine} ${item.name}`)
    expect(DEFAULT_HARDWARE_LIBRARY.some((x) => x.engine === "drawerKit")).toBe(true)
  })

  it("importats de mostra: frontissa amb placa (pendent i confirmada), placa sola, tirador, pom, pota i només 3D", () => {
    const frame = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], n: [0, 1, 0] } as HardwareProposal["frame"]
    const hingeP: HardwareProposal = {
      kind: "hinge",
      frame,
      holes: [
        { role: "cup", u: 0, v: 0, d: 35, measured: 35, depth: 13, depthFrom: "file" },
        { role: "screw", u: -26, v: 5.5, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
        { role: "screw", u: 26, v: 5.5, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
      ],
      bbox: { min: [-33.6, -4.3, -12.8], max: [33.6, 19.1, 71] },
      notes: [],
    }
    const plateP: HardwareProposal = {
      kind: "plate",
      frame: { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], n: [1, 0, 0] },
      holes: [
        { role: "dowel", u: -16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
        { role: "dowel", u: 16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
      ],
      bbox: { min: [-27.7, -22.6, -11.4], max: [27.7, 69.5, 6.4] },
      notes: [],
    }
    const hinge = hingeItem(hingeP, art("9071205", "hinge", "hinge"), DEFAULT_MODULE_HARDWARE.hinge, { id: "hw-h", asset: "hwa-1", files: [] })
    const plate = plateItem(plateP, art("9071615", "plate", "plate"), { id: "hw-p", asset: "hwa-2", files: [] })
    const paired = pairPlate(hinge, setConfirmed(plate, true))
    expectFramed(paired, "frontissa pendent")
    expectFramed(setConfirmed(paired, true), "frontissa confirmada")
    expectFramed(hinge, "frontissa sense placa")
    expectFramed(plate, "placa sola")
    const handleP = (dist: number): HardwareProposal => ({
      kind: "handle",
      frame: { origin: [64, 0, 0], u: [1, 0, 0], v: [0, 0, -1], n: [0, -1, 0] } as HardwareProposal["frame"],
      holes: dist ? [-dist / 2, dist / 2].map((u) => ({ role: "hole" as const, u, v: 0, d: 5, measured: 4, depth: 0, depthFrom: "default" as const })) : [{ role: "hole", u: 0, v: 0, d: 5, measured: 4, depth: 0, depthFrom: "default" }],
      bbox: { min: [-dist / 2 - 6, -10, 0], max: [dist / 2 + 6, 10, 35] },
      notes: [],
    })
    for (const dist of [96, 160, 320, 0]) expectFramed(setConfirmed(handleItem(handleP(dist), art(String(dist), "handle", "handle"), DEFAULT_MODULE_HARDWARE.handle, { id: `hw-t${dist}`, asset: "hwa-t", files: [] }), true), `tirador ${dist}`)
    for (const legH of [30, 100, 150, 250]) {
      const legP: HardwareProposal = {
        kind: "leg",
        frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] },
        holes: [[-22.5, -22.5], [-22.5, 22.5], [22.5, -22.5], [22.5, 22.5]].map(([u, v]) => ({ role: "screw" as const, u: u!, v: v!, d: 2.5, measured: 4, depth: 12, depthFrom: "default" as const })),
        bbox: { min: [-30, -30, 0], max: [30, 30, legH] },
        notes: [],
      }
      expectFramed(setConfirmed(legItem(legP, art("1225", "leg", "leg"), { id: "hw-leg", asset: "hwa-l", files: [] }), true), `pota ${legH}`)
    }
    for (const b of [{ min: [0, 0, 0], max: [100, 40, 400] }, { min: [0, 0, 0], max: [1560, 12.5, 6.5] }, { min: [-5, -5, -5], max: [5, 5, 5] }] as { min: Vec3; max: Vec3 }[])
      expectFramed({ ...plate, id: "hw-m", engine: "model", targets: [], imported: { ...plate.imported!, bbox: b } }, `només 3D ${b.max.join("×")}`)
  })
})

