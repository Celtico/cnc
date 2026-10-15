import { APPLIANCE_LABELS, fillsNiche, zoneAppliance, type Zone } from "../../core/model"

/** Nom del front d'una zona: «2 portes», «3 calaixos», «Obert»… */
function frontLabel(f: Zone["front"]): string {
  if (!f) return "Obert"
  if (f.kind === "door") return f.mode === "double" ? "2 portes" : "Porta"
  if (f.kind === "drawers") return `${f.n} ${f.n === 1 ? "calaix" : "calaixos"}`
  if (f.kind === "flap") return "Abatible"
  if (f.kind === "grille") return "Reixeta"
  return "Front fix"
}

/**
 * Nom curt d'un compartiment per a l'arbre: «2 portes», «3 calaixos», «Obert · 2 prestatges»...
 * L'arrel del mòdul (`root`) és l'«Interior»: «Interior · 2 portes» si porta les portes de tot el mòdul
 * (Mòdul › Portes; un altre front d'una zona dividida no es fa i no surt).
 */
export function zoneLabel(z: Zone, opts?: { root?: boolean }): string {
  if (opts?.root && z.split && z.front?.kind === "door") return `Interior · ${frontLabel(z.front)}`
  const own = ownLabel(z)
  return opts?.root ? `Interior · ${own}` : own
}

function ownLabel(z: Zone): string {
  if (z.split) return `${z.split.dir === "v" ? "Divisió vertical" : "Divisió horitzontal"} (${z.split.children.length})`
  // Un electrodomèstic que ocupa el compartiment és el que s'hi veu; la placa i la campana s'afegeixen al contingut.
  const ap = zoneAppliance(z)
  if (ap && fillsNiche(ap)) return APPLIANCE_LABELS[ap.kind]
  const parts: string[] = [frontLabel(z.front)]
  if (ap) parts.push(APPLIANCE_LABELS[ap.kind].toLowerCase())
  // Amb calaixos, els prestatges i la barra es conserven però no es veuen (res amagat compta).
  if (z.front?.kind === "drawers") return parts[0]!
  if (z.rail) parts.push("barra")
  if (z.shelves && z.shelves.n > 0) parts.push(`${z.shelves.n} ${z.shelves.n === 1 ? "prestatge" : "prestatges"}`)
  return parts.join(" · ")
}

/**
 * Les files de la secció «Divisió» d'una zona dividida, una per fill i en ordre (per decisió de l'usuari): «Amplada 1»,
 * «Amplada 2»… amb una divisió vertical i «Alçada 1»… amb una d'horitzontal; `name` és el nom de l'arbre del compartiment
 * («Obert», «Porta»…), `size` la mida desada (mm o «auto»; si en falta, «auto», com `padSizes`) i `rest` marca l'última,
 * que no s'edita: és el que sobra. Sense divisió, cap.
 */
export function splitRows(z: Zone): { id: string; label: string; name: string; size: number | "auto"; rest: boolean }[] {
  if (!z.split) return []
  const { children, sizes, dir } = z.split
  const what = dir === "v" ? "Amplada" : "Alçada"
  return children.map((c, i) => ({ id: c.id, label: `${what} ${i + 1}`, name: zoneLabel(c), size: sizes[i] ?? "auto", rest: i === children.length - 1 }))
}
