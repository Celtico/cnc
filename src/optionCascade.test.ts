import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { OPTION_NODES } from "./core/model"

/**
 * Les opcions en cascada (Preferències › Opcions en cascada) són **al dia amb el codi** (`docs/convencions.md`): cada fila
 * i secció dels inspectors de l'Editor porta l'id del registre (`optionId`) i cada id del registre és a la UI, al fitxer
 * que diu el seu `code`. Una opció nova a un inspector s'ha d'afegir al registre (`core/model/options/`).
 */
const SRC = resolve(__dirname)

/** Els fitxers dels inspectors: moble, mòdul, compartiment, peça lliure, objecte de referència i selecció múltiple. */
const INSPECTOR_FILES = [
  "features/editor/EditorInspector.tsx",
  "features/editor/InspectorSections.tsx",
  "features/editor/ModuleTypeSection.tsx",
  "features/composition/SupportForm.tsx",
  "features/composition/CarcassForm.tsx",
  "features/composition/zone/BoxSection.tsx",
  "features/composition/BaseFields.tsx",
  "features/composition/ModuleSupportFields.tsx",
  "features/composition/HardwarePick.tsx",
  "features/composition/ZonePanel.tsx",
  "features/composition/zone/ApplianceSection.tsx",
  "features/composition/zone/DrawerFields.tsx",
  "features/composition/zone/FrontFields.tsx",
  "features/composition/zone/FrontSection.tsx",
  "features/composition/zone/ShelvesSection.tsx",
  "features/composition/zone/SplitSizes.tsx",
  "features/composition/PartInspector.tsx",
  "features/composition/RefInspector.tsx",
]

/** Les files i seccions: totes porten `optionId` (els components que en fan una amb un id fix no compten, `System32Pick`). */
const ROW_TAGS = new Set(["FormRow", "NumRow", "FoldItem", "HardwarePick", "FixedRow", "PrefReset"])
const ID_LIKE = /^(structure|moble|module|zone|part|ref|multi)\.[A-Za-z0-9.]+$/

interface Scan {
  /** Files sense `optionId` («fitxer:línia <Tag>»). */
  missing: string[]
  /** Textos que semblen un id d'opció, amb el fitxer. */
  ids: { file: string; id: string }[]
}

function scan(file: string): Scan {
  const text = readFileSync(join(SRC, file), "utf8")
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: Scan = { missing: [], ids: [] }
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf)
      if (ROW_TAGS.has(tag) && !n.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "optionId")) {
        out.missing.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} <${tag}>`)
      }
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ID_LIKE.test(n.text)) out.ids.push({ file, id: n.text })
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const scans = INSPECTOR_FILES.map(scan)
const used = scans.flatMap((s) => s.ids)

describe("opcions en cascada al dia amb la UI", () => {
  it("cada fila i secció dels inspectors porta el seu `optionId`", () => {
    expect(scans.flatMap((s) => s.missing)).toEqual([])
  })
  it("cada id que fa servir la UI és al registre", () => {
    expect(used.filter((x) => !OPTION_NODES.has(x.id)).map((x) => `${x.file}: ${x.id}`)).toEqual([])
  })
  it("cada opció del registre (fila o secció) és a la UI, al fitxer del seu `code`", () => {
    const missing = [...OPTION_NODES.values()].filter((n) => n.kind !== "group" && !used.some((u) => u.id === n.id && u.file === n.code)).map((n) => `${n.id} (${n.code})`)
    expect(missing).toEqual([])
  })
  it("els fitxers del registre existeixen", () => {
    const codes = new Set([...OPTION_NODES.values()].map((n) => n.code).filter(Boolean))
    for (const c of codes) expect(() => readFileSync(join(SRC, c))).not.toThrow()
  })
})
