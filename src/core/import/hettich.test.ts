import { describe, expect, it } from "vitest"
import { classifyHettich, cleanFolders, groupHettich, hettichArticle, hettichCandidate, hettichFileKind, hettichSeries, refArticles } from "./hettich"

describe("descàrregues de Hettich", () => {
  it("tipus de fitxer i número d'article pel nom", () => {
    expect(hettichFileKind("a/9071205.stp")).toBe("step")
    expect(hettichFileKind("a/9071205_2D_front_view.DXF")).toBe("front")
    expect(hettichFileKind("a/45064_2d_side_view.dxf")).toBe("side")
    expect(hettichFileKind("a/9071205_2D_top_view.dxf")).toBe("top")
    expect(hettichFileKind("a/9071205_3D.DXF")).toBe("dxf3d")
    expect(hettichFileKind("a/9071205_3D.dwg")).toBe("dwg")
    expect(hettichFileKind("a/9071205_3d.3ds")).toBe("3ds")
    expect(hettichArticle("Scharniere/Sensys/9071205_2D_front_view.DXF")).toBe("9071205")
    expect(hettichArticle("90_Sensys_8639i_B3_D0.dxf")).toBeNull()
    expect(hettichCandidate("x/readme.txt")).toBe(false)
  })

  it("carpetes → categories de l'app", () => {
    expect(classifyHettich(["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"])).toMatchObject({ category: "hinge", kind: "hinge", tags: ["recobrent"] })
    expect(classifyHettich(["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend-Mittelseiten"]).tags).toEqual(["mig recobrent"])
    expect(classifyHettich(["Scharniere", "Sensys", "Oeffnungswinkel_165_Glas", "aufliegend"])).toMatchObject({ category: "hinge", tags: ["vidre", "recobrent"], noun: "Frontissa de vidre" })
    expect(classifyHettich(["Scharniere", "Alurahmen-Scharniere"])).toMatchObject({ category: "hinge", tags: ["alumini"] })
    expect(classifyHettich(["Scharniere", "Montageplatten", "System_8099", "Mit_vor_Euroschrauben"])).toMatchObject({ category: "plate", kind: "plate" })
    // Sense regla de mecanitzat: es poden importar igual, «només 3D».
    expect(classifyHettich(["Scharniere", "Zubehoer"])).toMatchObject({ category: "misc", kind: "model", noun: "Accessori" })
    expect(classifyHettich(["Scharniere", "Eingelenkscharniere", "Scharniertoepfe"])).toMatchObject({ kind: "model" })
    expect(classifyHettich(["Schubkastensysteme", "Doppelwandiges_System_ArciTech"])).toMatchObject({ category: "slide", kind: "model" })
  })

  it("altres famílies: tiradors, potes, taules, Cadro, portes corredisses i plegables, accessoris i carpetes desconegudes", () => {
    expect(classifyHettich(["Griffe", "Classic"])).toMatchObject({ category: "handle", kind: "handle", noun: "Tirador" })
    expect(classifyHettich(["Griffe", "Touch_In"])).toMatchObject({ category: "handle", kind: "handle", noun: "Tirador Touch-in" })
    expect(classifyHettich(["Griffe", "Zubehoer"])).toMatchObject({ category: "handle", kind: "model", noun: "Accessori de tirador" })
    const T = "Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen"
    expect(classifyHettich([T, "Stahl_Moebelfuesse"])).toMatchObject({ category: "leg", kind: "leg", noun: "Pota" })
    expect(classifyHettich([T, "Aluminium_Moebelfuesse"])).toMatchObject({ category: "leg", kind: "leg", noun: "Pota" })
    expect(classifyHettich([T, "Tischbeine_Moebelfuesse"])).toMatchObject({ category: "leg", kind: "leg", noun: "Pota de taula" })
    // La carpeta de la família diu «Moebelfuesse», però una estructura no és una pota.
    expect(classifyHettich([T, "LegaDrive"])).toMatchObject({ category: "table", kind: "model", noun: "Estructura de taula" })
    expect(classifyHettich([T, "Change"])).toMatchObject({ category: "table", kind: "model", noun: "Estructura de taula" })
    expect(classifyHettich([T, "Trimanis"])).toMatchObject({ category: "table", kind: "model", noun: "Guia de taula" })
    expect(classifyHettich([T, "Steelforce", "Steelforce_SLS_Professional_Line"])).toMatchObject({ category: "table", kind: "model" })
    expect(classifyHettich([T, "Steelforce", "Steelforce_Elektronik", "Handschalter"])).toMatchObject({ category: "misc", kind: "model", noun: "Accessori" })
    expect(classifyHettich([T, "Steelforce", "Zubehoer", "Kabelmanagement"])).toMatchObject({ category: "misc", kind: "model", noun: "Accessori" })
    expect(classifyHettich(["Cadro_Aluminiumrahmensystem"])).toMatchObject({ category: "profile", kind: "model", noun: "Marc d'alumini (Cadro)" })
    expect(classifyHettich(["Schiebetuersysteme", "TopLine_XL", "Profilsets"])).toMatchObject({ category: "door-system", kind: "model", noun: "Porta corredissa" })
    expect(classifyHettich(["Falttuersysteme", "WingLine_L"])).toMatchObject({ category: "door-system", kind: "model", noun: "Porta plegable" })
    expect(classifyHettich(["Qualsevol_Cosa", "Nova"])).toMatchObject({ category: "misc", kind: "model", noun: "Ferratge" })
  })

  it("agrupa per article els fitxers de diversos ZIP (STEP i DXF junts)", () => {
    const files = [
      "STEP_Scharniere/Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205.stp",
      "Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205_2D_front_view.DXF",
      "Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205_2D_side_view.DXF",
      "Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205_3D.dwg",
      "Scharniere/Montageplatten/System_8099/Mit_vor_Euroschrauben/9071620.stp",
      "Scharniere/Zubehoer/9100116_2D_front_view.dxf",
      "9999999_2D_front_view.dxf",
    ].map((path) => ({ path, kind: hettichFileKind(path) }))
    const g = groupHettich(files)
    expect(g.map((a) => [a.article, a.category, a.kind])).toEqual([
      ["9071205", "hinge", "hinge"],
      ["9071620", "plate", "plate"],
      ["9100116", "misc", "model"],
      ["9999999", "misc", "model"],
    ])
    // Què se'n farà (la nota de la fila del diàleg): mai «Carpeta desconeguda».
    expect(g[0]!.plan).toBe("Frontissa · cassoleta i forats del STEP")
    expect(g[2]!.plan).toMatch(/^Només 2D/)
    expect(g.some((a) => /desconeguda/.test(a.plan ?? ""))).toBe(false)
    const h = g[0]!
    expect(h.folders).toEqual(["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"])
    expect(h.files.map((f) => f.kind)).toEqual(["step", "front", "side", "dwg"])
    expect(h.label).toBe("Frontissa Sensys 110° · 9071205")
    expect(h.group).toBe("Sensys · 110° · recobrent")
    expect(g[1]!.label).toBe("Placa de muntatge amb cargols euro · 9071620")
    // Sense STEP, amb les vistes DXF: «només 2D» (motor `model`, cap forat) fins que s'hi afegeixi el STEP.
    const onlyDxf = groupHettich([{ path: "DWG_DXF_Scharniere/Scharniere/Sensys/9071206_2D_front_view.dxf", kind: "front" }])
    expect(onlyDxf[0]).toMatchObject({ kind: "model", only2d: true, category: "hinge", label: "Frontissa Sensys · 9071206", plan: expect.stringMatching(/STEP/) })
    // Sense STEP ni vistes (només el 3D DWG o el 3DS): no es pot importar.
    const only3d = groupHettich([{ path: "Scharniere/Sensys/9071207_3D.dwg", kind: "dwg" }])
    expect(only3d[0]).toMatchObject({ kind: "none", reason: expect.stringMatching(/STEP/) })
  })

  it("el nom i les carpetes no porten la carpeta de l'usuari ni la del ZIP (STEP_, DWG_DXF_…)", () => {
    const paths = [
      "ferratges/DWG_DXF_Schiebetuersysteme/Schiebetuersysteme/SlideLine_55/9060402_2D_front_view.dxf",
      "ferratges/STEP_Schiebetuersysteme/Schiebetuersysteme/SlideLine_55/9060402.stp",
      "Desktop/ferratges/STEP_Griffe/Griffe/Classic/115001.stp",
      "STEP_Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen/Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen/Stahl_Moebelfuesse/1225.stp",
    ]
    const g = groupHettich(paths.map((path) => ({ path, kind: hettichFileKind(path) })))
    const art = (n: string) => g.find((a) => a.article === n)!
    expect(art("9060402")).toMatchObject({ folders: ["Schiebetuersysteme", "SlideLine_55"], label: "Porta corredissa SlideLine 55 · 9060402", kind: "model" })
    expect(art("9060402").files.map((f) => f.kind).sort()).toEqual(["front", "step"])
    expect(art("115001")).toMatchObject({ folders: ["Griffe", "Classic"], label: "Tirador Classic · 115001" })
    expect(art("1225").label).toBe("Pota d'acer · 1225")
    expect(cleanFolders(["ferratges", "STEP_Scharniere", "Scharniere", "Sensys"])).toEqual(["Scharniere", "Sensys"])
    expect(cleanFolders(["Users", "cel", "Scharniere", "Sensys"])).toEqual(["Scharniere", "Sensys"])
  })

  it("sèries per agrupar la biblioteca (la carpeta de després de la família; les marques en alemany)", () => {
    expect(hettichSeries(["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"])).toEqual({ id: "sensys", label: "Sensys" })
    expect(hettichSeries(["Schiebetuersysteme", "SlideLine_55"])).toEqual({ id: "slideline_55", label: "SlideLine 55" })
    expect(hettichSeries(["Griffe", "New_Modern"])?.label).toBe("New Modern")
    expect(hettichSeries(["Scharniere", "Montageplatten", "System_8099", "Zum_Einpressen"])?.label).toBe("System 8099")
    expect(hettichSeries(["Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen", "Stahl_Moebelfuesse"])?.label).toBe("Acer")
    expect(hettichSeries(["Scharniere", "Winkelscharniere", "Intermat_9904_W45"])?.label).toBe("D'angle")
    expect(hettichSeries(["Cadro_Aluminiumrahmensystem"])).toBeNull()
    expect(hettichSeries([])).toBeNull()
    // Les carpetes d'abans (amb la de l'usuari i la del ZIP) donen la mateixa sèrie.
    expect(hettichSeries(["ferratges", "DWG_DXF_Schiebetuersysteme", "Schiebetuersysteme", "SlideLine_55"])?.label).toBe("SlideLine 55")
  })

  it("plànols de muntatge (dxf_einbau, exemples d'aplicació): s'adjunten als articles que nomenen", () => {
    expect(hettichFileKind("dxf_einbau/Scharniere/Zubehoer/79349_KB_2d/105_Sensys_8639i_B-4_D0_79349_79350_9072231.dxf")).toBe("ref")
    expect(hettichFileKind("dxf_einbau/Scharniere/Korpusbibliothek/2D_PDF/D04_Bath_Sensys.pdf")).toBe("ref")
    expect(refArticles("dxf_einbau/Scharniere/Zubehoer/79349_KB_2d/105_Sensys_8639i_B-4_D0_79349_79350_9072231.dxf")).toEqual(["79349", "79350", "9072231"])
    const ref = "dxf_einbau/Scharniere/Zubehoer/79349_KB_2d/105_Sensys_8639i_B-4_D0_79349_79350_9072231.dxf"
    const files = ["STEP_Scharniere/Scharniere/Zubehoer/79349.stp", ref].map((path) => ({ path, kind: hettichFileKind(path) }))
    // Al lot: s'hi afegeix; un número que no hi és (79350) no fa cap article.
    const g = groupHettich(files)
    expect(g.map((a) => a.article)).toEqual(["79349"])
    expect(g[0]!.files.map((f) => f.kind)).toEqual(["step", "ref"])
    // Només els plànols d'un article que ja és a la biblioteca: una fila per ampliar-lo.
    const known = new Map([["9072231", ["Scharniere", "Zubehoer"]]])
    const k = groupHettich([{ path: ref, kind: "ref" }], known)
    expect(k).toHaveLength(1)
    expect(k[0]).toMatchObject({ article: "9072231", refsOnly: true, plan: "Plànols de muntatge" })
    expect(hettichCandidate(ref)).toBe(true)
    expect(hettichCandidate("Anschlagloesungen_2D_Sensys/Anwendungsbeispiele_Schnittzeichnungen/A/90_Sensys_8645i_B-4_D1_5_A5.dxf")).toBe(false)
  })
})
