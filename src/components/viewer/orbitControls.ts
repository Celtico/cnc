import type { OrbitControls } from "@react-three/drei"
import { useThree } from "@react-three/fiber"
import type { ComponentRef } from "react"

/** Els `OrbitControls` de drei (el `makeDefault` de l'escena). */
export type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

/** Els controls per defecte de l'escena (`<OrbitControls makeDefault />`), o `null` si no n'hi ha. */
export function useOrbitControls(): OrbitControlsImpl | null {
  // R3F els tipa com un `EventDispatcher` genèric: a l'app sempre són els `OrbitControls` de drei.
  return useThree((st) => st.controls) as unknown as OrbitControlsImpl | null
}
