import type { Project } from "../../db/db"
import { isObject } from "../objects/isObject"

/** Els models de Modelatge: mobles com els altres, marcats per sortir a Modelatge (`Project.modeling`). */
export const isModel = (p: Pick<Project, "modeling">) => !!p.modeling

/** Els de la pàgina Mobles: ni objectes ni models. */
export const isMoble = (p: Pick<Project, "params" | "composition" | "name" | "modeling">) => !isObject(p) && !isModel(p)
