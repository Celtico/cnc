import { Text } from "@chakra-ui/react"
import { LuMove } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { mountOf, type Composition, type Module } from "../../core/model"
import { ModulePositionFields } from "./InspectorSections"

/** **Posició** (com abans del 2026-10-15): la fila (arrambat, penjat o lliure al terra) i on va. */
export function ModulePositionSection({ comp, module, moduleX, updateModule, islandFront }: { comp: Composition; module: Module; moduleX: number | undefined; updateModule: (m: Module) => void; /** El mòdul és el de darrere d'una illa: el nom del de davant. */ islandFront?: string }) {
  const badge = islandFront ? "Illa · darrere" : module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : mountOf(module) === "floor" ? `Lliure al terra · ${module.wallGap ?? 0} de la paret` : "Arrambat a la paret"
  return (
    <FoldItem optionId="module.position" id="mod-position" title="Posició" icon={LuMove} badge={badge}>
      {islandFront ? (
        <Text fontSize="sm" color="fg.muted">
          És el mòdul de darrere de l'illa amb «{islandFront}»: es gira 180° i es col·loca sol, enganxat al seu darrere.
        </Text>
      ) : (
        <ModulePositionFields comp={comp} module={module} moduleX={moduleX} updateModule={updateModule} />
      )}
    </FoldItem>
  )
}
