import type { Template } from "./templates"

/** Categories del catàleg d'objectes (com les dels ambients i de les plantilles de botiga). */
export const OBJECT_CATEGORIES = [
  { id: "seients", label: "Sofàs i seients" },
  { id: "taules", label: "Taules" },
  { id: "llits", label: "Llits" },
  { id: "parets", label: "Quadres, miralls i cortines" },
  { id: "llums", label: "Llums" },
  { id: "plantes", label: "Plantes" },
  { id: "textils", label: "Catifes, tèxtils i complements" },
  { id: "cuina", label: "Electrodomèstics" },
  { id: "blocs", label: "Blocs" },
] as const

export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number]["id"]

const BY_ID: Record<string, ObjectCategory> = {
  // Blocs d'abans (`BLOCK_PRESETS`) i els primers objectes.
  "sofa-3": "seients", "sofa-2": "seients", armchair: "seients", chair: "seients",
  "bed-150": "llits", "bed-90": "llits",
  dining: "taules", desk: "taules", "round-table": "taules",
  fridge: "cuina", washer: "cuina",
  rug: "textils", tv: "parets", mirror: "parets",
  box: "blocs", "floor-lamp": "llums", plant: "plantes",
  // Objectes de revista (`MAG_OBJECTS`).
  "sofa-linen": "seients", "sofa-l": "seients", "sofa-olive": "seients", daybed: "seients", "lounge-chair": "seients",
  "armchair-grey": "seients", "chair-leather": "seients", "chair-oak": "seients", stool: "seients", pouf: "seients",
  "pouf-bean": "seients", "bench-builtin": "seients",
  "coffee-brass": "taules", "cube-walnut": "taules", "low-table-black": "taules", "table-cloth": "taules",
  "oval-white": "taules", "stone-table": "taules", "concrete-cart": "taules",
  "art-abstract": "parets", "art-dark": "parets", "mirror-rect": "parets", "mirror-arch": "parets", "tv-65": "parets",
  "curtain-linen": "parets", "curtain-tulle": "parets",
  "pendant-dome": "llums", "pendant-black": "llums", "pendant-drum": "llums", "table-lamp": "llums", "floor-lamp-arc": "llums",
  "plant-tropical": "plantes", "plant-tropical-small": "plantes", olive: "plantes", pine: "plantes", "plant-small": "plantes",
  planter: "plantes", "branches-vase": "plantes",
  // Models 3D.
  "model-fern-02-a": "plantes", "model-fern-02-b": "plantes", "model-fern-02-c": "plantes", "model-fern-02-d": "plantes", "model-fern-pot": "plantes", "model-jacaranda": "plantes", "model-fir-01": "plantes",
  cushion: "textils", throw: "textils", books: "textils", "rug-jute": "textils", "rug-kilim": "textils", "rug-grey": "textils",
  "rug-round": "textils", "rug-white": "textils",
}

/** Categoria d'una plantilla d'objecte (els nous sense categoria van a «Blocs»). */
export function objectCategory(t: Pick<Template, "id">): ObjectCategory {
  return BY_ID[t.id.replace(/^object-/, "")] ?? "blocs"
}
