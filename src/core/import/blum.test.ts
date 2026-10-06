import { describe, expect, it } from "vitest"
import { blumFileInfo, blumLabel, blumProduct, blumSeries, classifyBlum, isBlumProductName, migrateBlumItem } from "./blum"
import { detectMaker, groupImport, importCandidate, importFileKind } from "./makers"
import { itemSeries, migrateImportedNames } from "./hettichNames"
import type { HettichFile } from "./hettich"
import type { HardwareItem } from "../model"

const file = (path: string): HettichFile => ({ path, kind: importFileKind(path) })

describe("Blum: noms dels fitxers", () => {
  it("article, document i mà; els de Hettich no ho són", () => {
    expect(blumFileInfo("48N0510.02_41302774_R.pgm")).toEqual({ article: "48N0510.02", doc: "41302774", hand: "R", ext: "pgm" })
    expect(blumFileInfo("z/Envoltura y elem/ 40.2000_45247349.step")).toEqual({ article: "40.2000", doc: "45247349", ext: "step" })
    expect(blumFileInfo("38B355BF22_41275267 (1).step")?.article).toBe("38B355BF22")
    expect(blumFileInfo("70T453T.TL_48515272.pgm")?.article).toBe("70T453T.TL")
    expect(blumFileInfo("ZSI.500BI1S_47045101.dxf")?.ext).toBe("dxf")
    // Hettich: només xifres.
    expect(blumFileInfo("Zubehoer/79349_79350123.dxf")).toBeNull()
    expect(blumFileInfo("9071205_2D_front_view.dxf")).toBeNull()
    expect(blumFileInfo("9071205.stp")).toBeNull()
  })

  it("fabricant, tipus i candidats", () => {
    expect(detectMaker("71T453T_46020103.pgm")).toBe("Blum")
    expect(detectMaker("STEP_Scharniere/Scharniere/Sensys/9071205.stp")).toBe("Hettich")
    expect(importFileKind("71T453T_46020103.dxf")).toBe("dxf3d")
    expect(importFileKind("71T453T_46020103.pgm")).toBe("pgm")
    expect(importFileKind("38B355BF22_41275267.dae")).toBe("dae")
    expect(importFileKind("x/40.2000_45247349.mpr")).toBe("mpr")
    expect(importFileKind("x/40.2000_45247349.hop")).toBe("cam")
    expect(importCandidate("Captura de pantalla 2026-10-06 a las 18.55.05.png")).toBe(false)
    expect(importCandidate("71T453T_46020103.step")).toBe(true)
    expect(importFileKind("IGES_Griffe/Griffe/Classic/115169.igs")).toBe("iges")
    expect(importFileKind("3DS_Griffe/Griffe/Classic/115169_3d.3ds")).toBe("3ds")
  })

  it("el nom del producte és la carpeta (el ZIP de E-SERVICES), sense « (1)»", () => {
    expect(blumProduct("Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos (1)/956.1201_40223089.step")).toBe("Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos")
    expect(blumProduct("02000516/ 40.2000_45247349.pgm")).toBeUndefined()
    expect(blumProduct("71T453T_46020103.pgm")).toBeUndefined()
    expect(isBlumProductName("STEP_Scharniere")).toBe(false)
    // Una carpeta que només diu la marca no és un producte (feia «Accessori Accessoris · 20K1101T»).
    expect(blumProduct("blum/20K1101T_49480533.step")).toBeUndefined()
    expect(blumProduct("Descàrregues de Blum/20K1101T_49480533.step")).toBeUndefined()
    expect(blumProduct("Blum/AVENTOS HK-XS Mecanismo/20K1101T_49480533.step")).toBe("AVENTOS HK-XS Mecanismo")
  })
})

describe("Blum: què és cada article", () => {
  it("pel nom del producte", () => {
    expect(classifyBlum("956.1201", "Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos")).toMatchObject({ category: "push", noun: "Placa", series: "TIP-ON", part: "side" })
    expect(classifyBlum("750.4501T", "Guía de cuerpo LEGRABOX con TIP-ON, Extensión total, 40 kg, LN=450 mm, dra+izq")).toMatchObject({ category: "slide", noun: "Guia", series: "LEGRABOX", part: "side" })
    expect(classifyBlum("760H3200S", "MOVENTO Sistema int. BLUMOTION_apto para TIP-ON BLUMOTION_apto para SERVO-DRIVE, Extensión total, Guía, 40 kg")).toMatchObject({ category: "slide", series: "MOVENTO" })
    expect(classifyBlum("22F3900", "Compás abatible plegable AVENTOS HF top, palanca (Juego), ACM=840-1200 mm, simétrico")).toMatchObject({ category: "lift", series: "AVENTOS HF top", part: "side" })
    expect(classifyBlum("Z80.000S", "CABLOXX Caja de cierre, Juego (Caja de cierre, pieza frontal, tapa)")).toMatchObject({ category: "misc", series: "CABLOXX", part: "any" })
    expect(classifyBlum("71B3550", "CLIP top BLUMOTION bisagra 110°")).toMatchObject({ category: "hinge", series: "CLIP top", part: "front" })
    expect(classifyBlum("173L6100", "CLIP Placa en cruz, 0 mm")).toMatchObject({ category: "plate", part: "side" })
    // El producte només diu «AVENTOS»: la família, de l'article; un producte que no es reconeix: mana l'article.
    expect(classifyBlum("21FA000", "unidad de accionamiento de SERVO-DRIVE para AVENTOS, HF, HL, HS, preajustado para HF")).toMatchObject({ category: "lift", series: "AVENTOS HF" })
    expect(classifyBlum("20K1101T", "Envoltura y elem. de ensamb.")).toMatchObject({ category: "lift", series: "AVENTOS HK-XS", from: "article" })
  })

  it("pel prefix de l'article (sense producte); si no se sap, sense assignar", () => {
    expect(classifyBlum("71T453T")).toMatchObject({ category: "hinge", noun: "Frontissa", series: "CLIP top", part: "front" })
    expect(classifyBlum("175H3100")).toMatchObject({ category: "plate", part: "side" })
    expect(classifyBlum("20K1101T")).toMatchObject({ category: "lift", noun: "Elevable", series: "AVENTOS HK-XS", part: "side" })
    expect(classifyBlum("20K2C01T")).toMatchObject({ category: "lift", series: "AVENTOS HK-S" })
    expect(classifyBlum("24K2300T")).toMatchObject({ category: "lift", series: "AVENTOS HK top" })
    expect(classifyBlum("22F2500")).toMatchObject({ category: "lift", series: "AVENTOS HF top" })
    expect(classifyBlum("21F8020")).toMatchObject({ category: "lift", series: "AVENTOS HF" })
    expect(classifyBlum("20S42E1")).toMatchObject({ category: "lift", series: "AVENTOS HS" })
    expect(classifyBlum("22L3200")).toMatchObject({ category: "lift", series: "AVENTOS HL top" })
    expect(classifyBlum("750.4501T")).toMatchObject({ category: "slide", series: "LEGRABOX" })
    expect(classifyBlum("760H3200S")).toMatchObject({ category: "slide", series: "MOVENTO" })
    expect(classifyBlum("320K5000C")).toMatchObject({ category: "slide", series: "METABOX" })
    expect(classifyBlum("378L2702SA")).toMatchObject({ category: "slide", series: "TANDEMBOX" })
    expect(classifyBlum("800A0002")).toMatchObject({ category: "misc", series: "REVEGO" })
    // Els 29x.xxxx no són AVENTOS (cal la lletra després de les dues xifres).
    expect(classifyBlum("295.5501")).toMatchObject({ category: "misc", noun: "Ferratge" })
    expect(classifyBlum("560H5000B")).toMatchObject({ category: "slide", part: "side" })
    expect(classifyBlum("956.1201")).toMatchObject({ category: "push", series: "TIP-ON" })
    expect(classifyBlum("ZF7N70T2")).toMatchObject({ category: "misc", part: "any" })
    expect(classifyBlum("48N0510.02")).toMatchObject({ category: "misc", noun: "Ferratge", part: "any" })
  })

  it("nom i sèrie", () => {
    expect(blumLabel("71T453T", classifyBlum("71T453T"))).toBe("Frontissa CLIP top · 71T453T")
    expect(blumLabel("48N0510.02", classifyBlum("48N0510.02"), "R")).toBe("Ferratge · 48N0510.02 · dreta")
    // Mai el nom repetit amb la sèrie.
    expect(blumLabel("ZF7N70T2", classifyBlum("ZF7N70T2"))).toBe("Accessori · ZF7N70T2")
    expect(blumLabel("20K1101T", classifyBlum("20K1101T"))).toBe("Elevable AVENTOS HK-XS · 20K1101T")
    expect(blumLabel("23.8000", classifyBlum("23.8000", "Juego de tapas AVENTOS HF_HS_HL top (incl. Interruptor de activación para taladrar, incluido), dra+izq, para SERVO-DRIVE"))).toBe("Elevable AVENTOS HF/HS/HL top · 23.8000")
    expect(blumSeries("750.4501T", ["Guía de cuerpo LEGRABOX con TIP-ON"])).toEqual({ id: "blum:legrabox", label: "LEGRABOX" })
    const item = { imported: { maker: "Blum", article: "71T453T", folders: [] } } as unknown as HardwareItem
    expect(itemSeries(item)).toEqual({ id: "blum:clip top", label: "CLIP top" })
  })
})

describe("Blum: agrupar per article", () => {
  it("sense el document ni la mà; STEP + PGM + DXF + DAE d'un article van junts; el producte del ZIP", () => {
    const { articles } = groupImport([
      file("71T453T_46020103.step"),
      file("71T453T_46020103.pgm"),
      file("71T453T_46020103.dxf"),
      file("48N0510.02_41302774.step"),
      file("48N0510.02_41302774_R.pgm"),
      file("48N0510.03_45023835_L.pgm"),
      file("38B355BF22_41275267.dae"),
      file("Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos/956.1201_40223089.step"),
      file("Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos/956.1201_46521491.step"),
      file("x/Z40L0002_43164761.dxf"),
    ])
    const by = new Map(articles.map((a) => [a.article, a]))
    const clip = by.get("71T453T")!
    expect(clip).toMatchObject({ maker: "Blum", category: "hinge", kind: "model", part: "front", label: "Frontissa CLIP top · 71T453T" })
    expect(clip.files.map((f) => f.kind).sort()).toEqual(["dxf3d", "pgm", "step"])
    expect(clip.plan).toBe("Mecanitzats exactes (Xilog) · porta / front")
    expect(by.get("48N0510.02")).toMatchObject({ hand: "R", label: "Ferratge · 48N0510.02 · dreta", part: "any" })
    expect(by.get("48N0510.03")).toMatchObject({ hand: "L", plan: "Mecanitzats exactes (Xilog) · peça per triar · sense 3D" })
    expect(by.get("38B355BF22")!.plan).toMatch(/^Només 3D/)
    const tip = by.get("956.1201")!
    expect(tip.files).toHaveLength(2)
    expect(tip.folders).toEqual(["Placa soporte TIP-ON para puertas, Versión corta, recto, Tornillos"])
    expect(tip.label).toBe("Placa TIP-ON · 956.1201")
    expect(by.get("Z40L0002")).toMatchObject({ kind: "none" })
  })

  it("Hettich i Blum al mateix lot; els PDF sense article es diuen a part o s'adjunten a la sèrie", () => {
    const { articles, loose } = groupImport([
      file("STEP_Scharniere/Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205.stp"),
      file("Planungshilfen_Sensys/Planungshilfe_Sensys_Montage.pdf"),
      file("Overview_Uebersicht.pdf"),
      file("71T453T_46020103.pgm"),
    ])
    expect(articles.map((a) => a.maker ?? "Hettich").sort()).toEqual(["Blum", "Hettich"])
    const sensys = articles.find((a) => a.article === "9071205")!
    expect(sensys.files.map((f) => f.path)).toContain("Planungshilfen_Sensys/Planungshilfe_Sensys_Montage.pdf")
    expect(loose).toEqual(["Overview_Uebersicht.pdf"])
  })

  it("Hettich amb IGES o 3DS i sense STEP: només 3D", () => {
    const { articles } = groupImport([file("IGES_Griffe/Griffe/Classic/115169.igs"), file("3DS_Griffe/Griffe/Classic/115170_3d.3ds"), file("SAT_Griffe/Griffe/Classic/115171.sat")])
    const by = new Map(articles.map((a) => [a.article, a]))
    expect(by.get("115169")).toMatchObject({ kind: "model", category: "handle" })
    expect(by.get("115169")!.plan).toMatch(/^Només 3D \(IGES\)/)
    expect(by.get("115170")!.plan).toMatch(/^Només 3D \(3DS\)/)
    expect(by.get("115171")).toMatchObject({ kind: "none" })
  })
})

describe("Sense assignar", () => {
  it("un importat amb mecanitzats sense assignar no es confirma fins que s'assignen a una peça", async () => {
    const { confirmProblem } = await import("./importItem")
    const { reassignMachining } = await import("../model")
    const op = { id: "a", part: "any" as const, kind: "drill" as const, face: "A" as const, p: { from: "ref" as const, at: 0 }, q: { from: "ref" as const, at: 0 }, d: 2.5, depth: 3 }
    const item = { id: "hw", name: "x", category: "misc", engine: "model", params: {}, targets: [{ key: "model", label: "Només 3D", ops: [] }], version: 1, machining: [op], imported: { maker: "Blum", article: "48N0510.02", folders: [], files: [], proposed: [], confirmed: false } } as HardwareItem
    expect(confirmProblem(item)).toMatch(/sense assignar/)
    const moved = reassignMachining(item.machining!, "any", "side")
    expect(moved[0]!.part).toBe("side")
    expect(confirmProblem({ ...item, machining: moved })).toBeNull()
  })
})

describe("Blum: noms dels importats d'abans", () => {
  const item = (name: string, article: string, folders: string[] = [], category = "misc") =>
    ({ id: "hw-1", name, category, engine: "model", params: {}, targets: [], version: 1, imported: { maker: "Blum", article, folders, files: [], proposed: [], confirmed: false } }) as unknown as HardwareItem

  it("el nom automàtic d'abans passa al d'ara (i la categoria, si era «Altres»); el de l'usuari es queda", () => {
    const a = migrateBlumItem(item("Accessori Accessoris · 20K1101T", "20K1101T", ["blum"]))
    expect(a).toMatchObject({ name: "Elevable AVENTOS HK-XS · 20K1101T", category: "lift", imported: { folders: [] } })
    expect(migrateBlumItem(a)).toBe(a)
    expect(migrateBlumItem(item("Accessori Accessoris · ZF7N70T2 2", "ZF7N70T2")).name).toBe("Accessori · ZF7N70T2 2")
    expect(migrateBlumItem(item("Elevable AVENTOS · 24K2300T · dreta", "24K2300T", [], "lift")).name).toBe("Elevable AVENTOS HK top · 24K2300T · dreta")
    const mine = item("El meu braç de la cuina", "20K1101T")
    expect(migrateBlumItem(mine)).toBe(mine)
    const ok = item("Frontissa CLIP top · 71T453T", "71T453T", [], "hinge")
    expect(migrateImportedNames([ok])).toEqual({ library: [ok], changed: false })
    expect(migrateImportedNames([item("Accessori Accessoris · 20K1101T", "20K1101T")]).changed).toBe(true)
  })
})
