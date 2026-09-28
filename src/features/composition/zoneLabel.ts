import type { Zone } from "../../core/model"

/** Nom curt d'un compartiment per a l'arbre: «2 portes», «3 calaixos», «Obert · 2 prestatges»... */
export function zoneLabel(z: Zone): string {
  if (z.split) return `${z.split.dir === "v" ? "Divisió vertical" : "Divisió horitzontal"} (${z.split.children.length})`
  const parts: string[] = []
  const f = z.front
  if (!f) parts.push("Obert")
  else if (f.kind === "door") parts.push(f.mode === "double" ? "2 portes" : "Porta")
  else if (f.kind === "drawers") parts.push(`${f.n} ${f.n === 1 ? "calaix" : "calaixos"}`)
  else if (f.kind === "flap") parts.push("Abatible")
  else if (f.kind === "grille") parts.push("Reixeta")
  else if (f.kind === "panel") parts.push("Front fix")
  if (z.shelves && z.shelves.n > 0) parts.push(`${z.shelves.n} ${z.shelves.n === 1 ? "prestatge" : "prestatges"}`)
  return parts.join(" · ")
}
