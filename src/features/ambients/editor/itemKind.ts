import type { AmbientItem, AmbientItemKind } from "../../../core/model"
import type { Project } from "../../../db/db"
import { isObject } from "../../objects/isObject"

/** Un objecte (o un bloc d'abans), no un moble. */
export const isObjItem = (it: AmbientItem, projects: Project[] | undefined) => it.kind === "block" || !!projects?.some((p) => p.id === it.projectId && isObject(p))

// Un moble enllaçat que ja no és a la llista surt com a absent (mentre la llista es llegeix, encara no).
export const kindOf = (it: AmbientItem, projects: Project[] | undefined): AmbientItemKind =>
  it.kind === "block" ? "object" : !projects ? "moble" : !projects.some((p) => p.id === it.projectId) ? "missing" : isObjItem(it, projects) ? "object" : "moble"
