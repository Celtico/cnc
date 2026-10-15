import { useState } from "react"
import { useRenderQuality } from "../../components/viewer/renderQuality"
import { usePersistentFlag } from "../../lib/usePersistentFlag"
import type { ViewerState } from "./ViewerControls"

export type ViewTab = "3d" | "elevation" | "photo"
const TAB_KEY = "mobles:editor-view-tab"
function readTab(): ViewTab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    return v === "elevation" || v === "photo" ? v : "3d"
  } catch {
    return "3d"
  }
}

export type ViewMode = "pieces" | "texture" | "presentation"

/** Opcions de vista de l'editor: pestanya, mode del visor, colors, obertura, forats, explosió, ferratges i panells. */
export function useViewerOptions(isObject: boolean) {
  const [exploded, setExploded] = useState(false)
  const [showHoles, setShowHoles] = useState(false)
  // Visor: vista, obertura de portes i calaixos, colors.
  // En mode Ràpida, per defecte colors per tipus de peça (més clar per treballar);
  // en mode Presentació sempre els materials reals.
  // Els objectes (sofàs, plantes…) només es veuen, no es fabriquen: s'obren amb la textura, no amb
  // els colors per peça (tenen la seva pròpia preferència).
  const [roleColors, setRoleColors] = usePersistentFlag(isObject ? "mobles:viewer-role-colors-object" : "mobles:viewer-role-colors-fast", !isObject)
  const [quality, setQuality] = useRenderQuality()
  const [viewer, setViewerState] = useState<Omit<ViewerState, "materialMode">>({ opening: 0, opacity: 1, openOnlySelected: false })
  const viewerState: ViewerState = { ...viewer, materialMode: quality === "fast" && roleColors ? "role" : "material" }
  // Mode del visor: Per peça (ràpid, colors per tipus), Textura (ràpid, materials) o Presentació.
  const viewMode: ViewMode = quality === "presentation" ? "presentation" : roleColors ? "pieces" : "texture"
  const setViewMode = (m: ViewMode) => {
    setQuality(m === "presentation" ? "presentation" : "fast")
    if (m !== "presentation") setRoleColors(m === "pieces")
  }
  // Ferratges visuals (frontisses, tiradors, potes) i mostres del ray tracing.
  const [hardware, setHardware] = usePersistentFlag("mobles:viewer-hardware", true)
  const setViewer = (patch: Partial<ViewerState>) => {
    const { materialMode, ...rest } = patch
    if (materialMode) setRoleColors(materialMode === "role")
    if (Object.keys(rest).length) setViewerState((v) => ({ ...v, ...rest }))
  }
  // Amaga el panell de paràmetres perquè el 3D ocupi tot l'espai.
  const [formHidden, setFormHidden] = usePersistentFlag("mobles:editor-form-hidden")
  // Pestanya del visor: 3D, alçat (compartiments) o sobre la foto del lloc.
  const [viewTab, setViewTabState] = useState<ViewTab>(readTab)
  const setViewTab = (t: ViewTab) => {
    setViewTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* sense localStorage */
    }
  }
  return { exploded, setExploded, showHoles, setShowHoles, roleColors, setRoleColors, quality, viewer, viewerState, viewMode, setViewMode, hardware, setHardware, setViewer, formHidden, setFormHidden, viewTab, setViewTab }
}

export type ViewerOptions = ReturnType<typeof useViewerOptions>
