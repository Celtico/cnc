import { compositionKind } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import type { Project } from "../../db/db"

/** Els objectes són mobles del tipus «objecte» (es guarden igual i s'editen amb el mateix Editor). */
export const isObject = (p: Pick<Project, "params" | "composition" | "name">) => compositionKind(compositionOf(p)) === "objecte"
