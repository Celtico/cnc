import { Box, Text } from "@chakra-ui/react"
import type { ModuleBuild } from "../../core/build/buildModule"
import { partsOnlyKind, type Composition, type compositionKind, type Module, type Panel } from "../../core/model"
import { ElevationEditor } from "../composition/ElevationEditor"
import type { Selection } from "../composition/StructureTree"

/** La pestanya Alçat: el mòdul de treball de cara (compartiments) amb els veïns translúcids. */
export function ElevationView({
  comp,
  kind,
  module,
  moduleBuild,
  moduleX,
  moduleY,
  panels,
  selectedZone,
  select,
  selectModule,
  formHidden,
}: {
  comp: Composition
  kind: ReturnType<typeof compositionKind>
  module: Module | undefined
  moduleBuild: ModuleBuild | undefined
  moduleX: number | undefined
  moduleY: number | undefined
  panels: Panel[]
  selectedZone: string | null
  select: (s: Selection) => void
  selectModule: (id: string) => void
  formHidden: boolean
}) {
  return (
    <>
      {moduleBuild && module && (
        <Box
          w="full"
          maxW="900px"
          flex={1}
          minH={0}
          display="flex"
          alignItems="center"
          // Alçada disponible per al dibuix: el visor menys la barra de pestanyes i el peu.
          css={{ "--elev-h": { base: formHidden ? "calc(100dvh - 20rem)" : "calc(42vh - 6rem)", md: "calc(100dvh - 48px - 0.75rem - 8rem)" } }}
        >
          <ElevationEditor
            module={module}
            build={moduleBuild}
            selectedZoneId={selectedZone}
            onSelectZone={(id) => select({ kind: "zone", moduleId: module.id, zoneId: id })}
            references={comp.references}
            moduleX={moduleX ?? 0}
            moduleY={moduleY ?? 0}
            neighbors={comp.modules
              .filter((m) => m.id !== module.id)
              .map((m) => {
                const idx = comp.modules.indexOf(m) + 1
                return { id: m.id, name: m.name, panels: panels.filter((p) => p.module === idx) }
              })}
            onSelectModule={selectModule}
            maxH="var(--elev-h)"
          />
        </Box>
      )}
      {module ? (
        <Text fontSize="xs" color="fg.muted" textAlign="center" display={{ base: "none", md: "block" }}>
          Alçat de «{module.name}». Toca un compartiment per editar-lo; llums interiors en mm.
          {comp.modules.length > 1 && " Els mòduls del costat surten translúcids: clica'n un per passar-hi."}
        </Text>
      ) : (
        <Text fontSize="sm" color="fg.muted" textAlign="center" m="auto">
          {partsOnlyKind(kind) ? "L'alçat és dels mòduls: aquí no n'hi ha." : "Encara no hi ha cap mòdul: afegeix-ne un amb el + de «Mòduls» a l'estructura."}
        </Text>
      )}
    </>
  )
}
