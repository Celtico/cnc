import { describe, expect, it } from "vitest"
import { classifyHettich, groupHettich, hettichArticle, hettichCandidate, hettichFileKind } from "./hettich"

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
      ["9100116", "misc", "none"],
      ["9999999", "misc", "none"],
    ])
    // Què se'n farà (la nota de la fila del diàleg): mai «Carpeta desconeguda».
    expect(g[0]!.plan).toBe("Frontissa · cassoleta i forats del STEP")
    expect(g[2]!.plan).toMatch(/STEP/)
    expect(g.some((a) => /desconeguda/.test(a.plan ?? ""))).toBe(false)
    const h = g[0]!
    expect(h.folders).toEqual(["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"])
    expect(h.files.map((f) => f.kind)).toEqual(["step", "front", "side", "dwg"])
    expect(h.label).toBe("Frontissa Sensys 110° recobrent 9071205")
    expect(h.group).toBe("Sensys · 110° · recobrent")
    expect(g[1]!.label).toBe("Placa de muntatge amb cargols euro 9071620")
    // Un article de frontissa sense STEP no es pot importar (els forats surten del STEP).
    const onlyDxf = groupHettich([{ path: "Scharniere/Sensys/9071206_2D_front_view.dxf", kind: "front" }])
    expect(onlyDxf[0]).toMatchObject({ kind: "none", reason: expect.stringMatching(/STEP/) })
  })
})
