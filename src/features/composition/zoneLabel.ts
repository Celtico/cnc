import type { Zone } from "../../core/model"

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
 * L'arrel del mòdul (`root`) és l'«Interior»: «Interior · 2 portes» si porta el front de tot el mòdul.
 */
export function zoneLabel(z: Zone, opts?: { root?: boolean }): string {
  if (opts?.root && z.split && z.front) return `Interior · ${frontLabel(z.front)}`
  const own = ownLabel(z)
  return opts?.root ? `Interior · ${own}` : own
}

function ownLabel(z: Zone): string {
  if (z.split) return `${z.split.dir === "v" ? "Divisió vertical" : "Divisió horitzontal"} (${z.split.children.length})`
  const parts: string[] = [frontLabel(z.front)]
  if (z.rail) parts.push("barra")
  if (z.shelves && z.shelves.n > 0) parts.push(`${z.shelves.n} ${z.shelves.n === 1 ? "prestatge" : "prestatges"}`)
  return parts.join(" · ")
}
