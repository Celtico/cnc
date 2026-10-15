import { Alert, Box, HStack, SegmentGroup, Slider, Spinner, Stack, Text } from "@chakra-ui/react"
import { Suspense, lazy, useMemo, useState } from "react"
import { LuMap, LuRotate3D } from "react-icons/lu"
import { FormRow } from "../../../components/FormRow"
import { hardwareMount, mountPlan, type HardwareMount } from "../../../core/build/hardwareMount"
import { movingGroups } from "../../../components/viewer/opening"
import type { HardwareItem, MaterialPref, Module } from "../../../core/model"
import { HardwareMountPlan } from "../HardwareMountPlan"
import { useSessionString } from "../useSessionString"

/** El ferratge muntat en 3D (three, les peces i el GLB, quan s'obre l'editor). */
const HardwareMount3D = lazy(() => import("../HardwareMount3D"))
/** Pestanya del muntatge (3D · Pla), recordada durant la sessió. */
const MOUNT_VIEW_KEY = "mobles:hardware-mount-view"

/** Es pot obrir (porta, abatible, calaix) al 3D del muntatge. */
const opensIn = (m: HardwareMount) => movingGroups(m.panels).length > 0
/** Potes dibuixades per l'app (la AXILO 78): el lliscador regula l'alçada (la part mòbil surt per sota, fins a +20). */
const adjustsLegs = (m: HardwareMount) => m.panels.some((p) => p.fittings?.some((f) => f.kind === "leg" && f.leg))

/**
 * Com va muntat (`hardwareMount`): el ferratge sobre un mòdul petit fet pel motor de sempre (porta i lateral de les
 * frontisses i les plaques; el lateral i la caixa de les guies…), amb el gruix i els jocs de les preferències. Dues
 * vistes, com «3D · Alçat» de l'editor: **3D** (un sol `Canvas`, a demanda, `HardwareMount3D`) amb la porta tancada o
 * oberta (lliscador «Obertura»), i **Pla** (`HardwareMountPlan`: vista de dalt tallada a l'alçada de la cassoleta, amb
 * les cotes). D'un importat sense confirmar, els forats proposats en taronja i l'avís.
 */
export function MountPreview({ item, base, materials, noModel }: { item: HardwareItem; base?: Module; materials: MaterialPref[]; noModel: boolean }) {
  const [tab, setTab] = useSessionString(MOUNT_VIEW_KEY)
  const view = tab === "plan" ? "plan" : "3d"
  const [open, setOpen] = useState(0)
  const mount = useMemo(() => hardwareMount(item, base), [item, base])
  const plan = useMemo(() => mountPlan(mount), [mount])
  if (mount.error || (!mount.panels.length && !mount.model)) return null
  if (mount.model) return <ModelPreview mount={mount} materials={materials} noModel={noModel} generated={item.machining?.length ?? 0} />
  const cutY = plan ? Math.round(plan.sectionY * 10) / 10 : null
  return (
    <Stack gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
      <HStack justify="space-between" gap={3} wrap="wrap">
        <Stack gap={0} minW={0}>
          <Text fontSize="sm" fontWeight="semibold">
            Com va muntat
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Mòdul d'exemple de {mount.size.width} × {mount.size.height} × {mount.size.depth} amb tauler de {mount.panels[0]!.thickness} mm
          </Text>
        </Stack>
        <SegmentGroup.Root size="sm" value={view} onValueChange={(e) => e.value && setTab(e.value)}>
          <SegmentGroup.Indicator />
          {(
            [
              ["3d", "3D", LuRotate3D, "El ferratge muntat en 3D"],
              ["plan", "Pla", LuMap, "Pla del muntatge: vista de dalt amb les cotes"],
            ] as const
          ).map(([v, label, Icon, aria]) => (
            <SegmentGroup.Item key={v} value={v} aria-label={aria}>
              <SegmentGroup.ItemText>
                <HStack gap={1.5}>
                  <Icon /> {label}
                </HStack>
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </HStack>
      {mount.pending && (
        <Alert.Root status="warning" size="sm" data-testid="hardware-mount-pending">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Sense confirmar: <strong>en taronja, els forats proposats</strong>. Fins que el confirmis, el moble no els fa{mount.hinge ? " (ni a la porta ni al lateral)" : ""}.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {view === "3d" ? (
        <Stack gap={2}>
          <Box h={{ base: "300px", md: "420px", lg: "min(560px, 55dvh)" }} rounded="md" overflow="hidden" bg="bg.subtle" data-testid="hardware-mount-3d">
            <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
              <HardwareMount3D mount={mount} materials={materials} open={open} frameKey={item.id} />
            </Suspense>
          </Box>
          {(opensIn(mount) || adjustsLegs(mount)) && (
            <FormRow
              label={opensIn(mount) ? "Obertura" : "Regulació"}
              help={opensIn(mount) ? "Obre la porta (o l'abatible, o el calaix) per veure'n la cara de dins." : "La part mòbil de la pota (el tub i el peu) surt de la placa fixa: fins a 20 mm més alta."}
            >
              <Slider.Root size="sm" w="full" maxW="280px" pt="10px" aria-label={[opensIn(mount) ? "Obertura" : "Regulació"]} min={0} max={1} step={0.05} value={[open]} onValueChange={(e) => setOpen(e.value[0] ?? 0)}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
            </FormRow>
          )}
          <Text fontSize="xs" color="fg.muted">
            Arrossega per girar-lo; amb dos dits o la roda, més a prop. Les peces, els forats{mount.hinge ? ", la frontissa i la placa" : ""} surten del mateix càlcul que el moble.
            {noModel && " Sense el model 3D del fitxer: es veu la caixa que ocupa."}
          </Text>
        </Stack>
      ) : plan ? (
        <Stack gap={2}>
          <Box w="full" maxW="1100px" mx="auto">
            <HardwareMountPlan plan={plan} />
          </Box>
          <Text fontSize="xs" color="fg.muted">
            Vista de dalt tallada a {String(cutY).replace(".", ",")} mm d'alçada{mount.hinge ? " (al centre de la cassoleta de baix)" : ""}; el davant del moble, a baix. Forats tallats buits; els de sobre o sota, discontinus{mount.pending ? "; els proposats, en taronja" : ""}. {mount.hinge ? "Cotes: joc i recobriment de la porta, del cantell de la porta al centre de la cassoleta i a la seva vora (C), fondària, i la filera del lateral des del davant. " : ""}Mides en mm.
          </Text>
        </Stack>
      ) : null}
      {mount.warnings.map((w, i) => (
        <Text key={i} fontSize="xs" color="orange.fg">
          {w}
        </Text>
      ))}
    </Stack>
  )
}

/** Un ferratge «només 3D»: el model sol (sense mòdul ni forats), en 3D, amb les mides de la caixa. */
function ModelPreview({ mount, materials, noModel, generated }: { mount: HardwareMount; materials: MaterialPref[]; noModel: boolean; generated: number }) {
  const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
  if (!mount.model?.bbox && !mount.model?.asset)
    return null
  if (!mount.model?.bbox)
    return (
      <Stack gap={1} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
        <Text fontSize="sm" fontWeight="semibold">
          Només 2D
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Només s'han importat les vistes del DXF (a sota) i els punts de connexió: falta el STEP, d'on surten el 3D i, a les frontisses, plaques, tiradors i
          potes, els forats proposats. (La importació del fabricant ja no es fa des de l'app: els ferratges nous es fan a partir del catàleg.)
        </Text>
      </Stack>
    )
  return (
    <Stack gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
      <Stack gap={0}>
        <Text fontSize="sm" fontWeight="semibold">
          {generated ? "Model 3D" : "Només 3D"}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {mount.model?.bbox ? `Caixa de ${n(mount.size.width)} × ${n(mount.size.height)} × ${n(mount.size.depth)} mm · ` : ""}{generated ? `cap regla del moble: els seus ${generated} mecanitzats es fan als mobles on ja està col·locat a mà.` : "sense cap forat: no hi ha cap regla del moble per a aquest ferratge."}
        </Text>
      </Stack>
      <Box h={{ base: "300px", md: "420px", lg: "min(560px, 55dvh)" }} rounded="md" overflow="hidden" bg="bg.subtle" data-testid="hardware-mount-3d">
        <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
          <HardwareMount3D mount={mount} materials={materials} open={0} />
        </Suspense>
      </Box>
      <Text fontSize="xs" color="fg.muted">
        Arrossega per girar-lo; amb dos dits o la roda, més a prop.{noModel && " Sense el model 3D del fitxer: es veu la caixa que ocupa."}
      </Text>
    </Stack>
  )
}
