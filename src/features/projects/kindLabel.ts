import type { CompositionKind } from "../../core/model"
import { KINDS } from "../composition/kinds"

/** Nom del tipus de moble (Moble, Cuina, Armari, Taula…) per a les targetes i la cerca. */
export const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
