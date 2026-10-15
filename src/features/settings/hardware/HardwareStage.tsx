import { Alert, Box, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useMemo } from "react"
import type { HardwareView } from "../../../core/import/views"
import { assetViews, getHardwareAsset } from "../../../db/hardwareAssets"
import { useLiveQuery } from "../../../db/useLiveQuery"
import { PanelDrawing } from "../../../components/PanelDrawing"
import { featureCrop, hardwarePreview } from "../../../core/build/hardwarePreview"
import type { HardwareItem, MaterialPref, Module, Panel } from "../../../core/model"
import { MountPreview } from "./MountPreview"
import { ViewDrawing } from "./ViewDrawing"

/** La vista registrada al marc del ferratge (la que mira la cara de la peça; a les frontisses, la frontal), o `null`. */
function frontView(views: HardwareView[]): HardwareView | null {
  return views.find((v) => v.name === "front" && v.registered) ?? views.find((v) => v.registered) ?? null
}

/** La vista (marc u, v del ferratge) posada a cada punt d'ancoratge de la peça: u al llarg de x, v al llarg de y. */
function placeView(view: HardwareView | null, anchors: [number, number][]): number[][] | undefined {
  if (!view || !anchors.length) return undefined
  return anchors.flatMap(([ax, ay]) => view.lines.map((l) => l.map((c, k) => (k % 2 ? c + ay : c + ax))))
}

/** Dibuix de fons de cada peça d'exemple d'un ferratge importat (la vista frontal a cada cassoleta o placa). */
function underlays(item: HardwareItem, panels: Panel[], own: HardwareView[], plate: HardwareView[]): Record<string, number[][] | undefined> {
  const out: Record<string, number[][] | undefined> = {}
  const door = panels.find((p) => p.id === "door")
  const cups: [number, number][] = door ? door.holes.filter((h) => h.tag === "hinge").map((h) => [h.x, h.y]) : []
  if (door) out.door = placeView(frontView(own), cups)
  const side = panels.find((p) => p.id === "side")
  if (side) {
    const anchors: [number, number][] =
      item.engine === "plate" ? [[360 + (item.params.offset ?? 0), item.params.setback ?? 37]] : cups.map(([x]) => [x + (item.params.plateOffset ?? 0), item.params.plateSetback ?? 37])
    out.side = placeView(frontView(item.engine === "plate" ? own : plate), anchors)
  }
  return out
}

/**
 * L'escenari de l'editor (a l'esquerra, a la columna gran a l'ordinador): a dalt, **com va muntat** (`MountPreview`: el
 * ferratge sobre un mòdul petit fet pel motor, en 3D o en pla); a sota, el patró de mecanitzats sobre una peça d'exemple
 * (els de cantell, discontinus; els passants, buits) i, d'un importat, la vista frontal del fitxer de fons (si s'ha pogut
 * registrar sobre els forats proposats) i les vistes 2D tal com venen.
 */
export function HardwareStage({ item, base, materials }: { item: HardwareItem; base?: Module; materials: MaterialPref[] }) {
  const preview = useMemo(() => hardwarePreview(item), [item])
  const ownId = item.imported?.asset
  const plateId = item.plate?.asset
  const own = useLiveQuery(() => (ownId ? getHardwareAsset(ownId) : undefined), [ownId])
  const plate = useLiveQuery(() => (plateId ? getHardwareAsset(plateId) : undefined), [plateId])
  const ownViews = useMemo(() => assetViews(own), [own])
  const plateViews = useMemo(() => assetViews(plate), [plate])
  const under = useMemo(() => (item.imported ? underlays(item, preview.panels, ownViews, plateViews) : {}), [item, preview, ownViews, plateViews])
  return (
    <Box flex={{ lg: 1 }} flexShrink={0} minW={0} minH={0} bg="bg.subtle" overflowY={{ lg: "auto" }} p={{ base: 3, sm: 4, lg: 6 }}>
      {/* A tota l'amplada de la columna (per decisió de l'usuari): el 3D, el pla i les vistes aprofiten la pantalla. */}
      <Stack gap={5} w="full">
        {preview.error && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>No es pot fer servir</Alert.Title>
              <Alert.Description>{preview.error} Els mobles faran servir el d'inici de l'app.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {!preview.error && <MountPreview item={item} base={base} materials={materials} noModel={!!item.imported && own !== undefined && !own?.glb} />}
        {preview.panels.map((p) => {
          // Al costat, el detall dels forats (amb el cantell): a la peça sencera, una espiga Ø8 és un punt.
          const crop = featureCrop(p)
          return (
            <SimpleGrid key={p.id} columns={{ base: 1, md: crop ? 2 : 1 }} gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} alignItems="center" data-testid={`hardware-sample-${p.id}`}>
              <PanelDrawing panel={p} dims="full" underlay={under[p.id]} />
              {crop && (
                <Stack gap={1}>
                  <Box rounded="md" borderWidth="1px" borderColor="border.muted" overflow="hidden">
                    <PanelDrawing panel={p} crop={crop} caption={false} dims underlay={under[p.id]} />
                  </Box>
                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Detall ({Math.round(crop.w)} × {Math.round(crop.h)} mm)
                  </Text>
                </Stack>
              )}
            </SimpleGrid>
          )
        })}
        {preview.panels.length > 0 && (
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          Patró de mecanitzats sobre una peça d'exemple, vist des de la cara A: forats de cara plens, de cantell discontinus i passants buits. Al moble, la regla de cada contingut els col·loca (les cassoletes, a la filera System 32).
          {item.imported && " En gris, la vista del fitxer del fabricant que mira la cara de la peça, encaixada sobre els forats proposats (si hi encaixa)."}
        </Text>
        )}
        {item.imported && ownViews.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            {ownViews.map((v) => (
              <ViewDrawing key={v.name} view={v} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}
