import type { IconType } from "react-icons"
import { LuBox, LuDownload, LuDraftingCompass, LuHouse, LuLayoutGrid, LuList, LuMessageSquare, LuSettings, LuSofa } from "react-icons/lu"

export type Screen = "projects" | "objects" | "editor" | "photo" | "cutlist" | "nesting" | "export" | "settings" | "ambients" | "ambient"

/** Apartat del menú global. */
export type Section = "ambients" | "objects" | "projects" | "settings"

type NavEntry = { id: Screen; label: string; icon: IconType }

/** Pàgines del moble obert. Només surten quan n'hi ha un d'obert. */
export const PROJECT_NAV: NavEntry[] = [
  { id: "editor", label: "Editor", icon: LuDraftingCompass },
  { id: "cutlist", label: "Peces", icon: LuList },
  { id: "nesting", label: "Nesting", icon: LuLayoutGrid },
  { id: "export", label: "Exportar", icon: LuDownload },
]
export const PROJECTS_ENTRY: NavEntry = { id: "projects", label: "Mobles", icon: LuBox }
export const OBJECTS_ENTRY: NavEntry = { id: "objects", label: "Objectes", icon: LuSofa }
const AMBIENTS_ENTRY: NavEntry = { id: "ambients", label: "Ambients", icon: LuHouse }
export const SETTINGS_ENTRY: NavEntry = { id: "settings", label: "Preferències", icon: LuSettings }
/** Apartats del menú global (barra lateral); Preferències va a baix de tot. */
export const GLOBAL_NAV: NavEntry[] = [PROJECTS_ENTRY, AMBIENTS_ENTRY, OBJECTS_ENTRY]

/** L'assistent personal (per decisió de l'usuari, 2026-10-13): sota els apartats, obre el calaix amb el xat. */
export const ASSISTANT_ENTRY = { id: "assistant", label: "Assistent", icon: LuMessageSquare } as const
/** Mòbil: la barra de baix amb els apartats, l'Assistent i Preferències. */
export const MOBILE_BAR: { id: string; label: string; icon: IconType }[] = [...GLOBAL_NAV, ASSISTANT_ENTRY, SETTINGS_ENTRY]
