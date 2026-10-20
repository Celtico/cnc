import { Box, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import {
  setDrawerHeight,
  KIT_BACKS,
  KIT_CLOSINGS,
  KIT_FINISHES,
  KIT_LEVEL_LABEL,
  hardwareSummary,
  isDrawerKit,
  kitOptionsOf,
  type Front,
  type HardwareItem,
} from "../../../core/model"
import { HardwareSelect } from "../../settings/HardwareSelect"
import { useSettings } from "../../settings/SettingsContext"
import type { KitOrder } from "../../../core/build/buildModule"
import { kitBottomThickness, kitLineText, kitWoodText } from "../../../core/build/drawerKit"
import { NumberField } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { fmtNum } from "../../../lib/format"

/**
 * Alçada del front de cada calaix, de baix a dalt, com les mides de la Divisió (`SplitSizes`): «Alçada 1»… amb «Auto» o
 * els mm, l'última no s'edita (el que sobra) i al costat de les «Auto» els mm reals (`real`, de la construcció).
 */
export function DrawerHeights({ front, real, onChange }: { front: Extract<Front, { kind: "drawers" }>; real?: number[]; onChange: (f: Front) => void }) {
  const set = (i: number, size: number | "auto") => onChange(setDrawerHeight(front, i, size, real))
  return (
    <Stack gap={2}>
      <Text textStyle="xs" color="fg.muted">
        Alçada de cada front, de baix a dalt. Les «Auto» es reparteixen el que queda; l'última és el que sobra.
      </Text>
      {Array.from({ length: front.n }, (_, i) => {
        const mm = real?.[i]
        const size = front.heights[i] ?? "auto"
        const label = `Alçada ${i + 1}`
        return (
          <FormRow key={i} optionId="zone.front.drawers.height" label={label}>
            {i === front.n - 1 ? (
              <Text fontSize="sm" color="fg.muted">
                {mm !== undefined ? `${fmtNum(mm)} mm` : "—"} (el que sobra)
              </Text>
            ) : (
              <HStack gap={3}>
                <Switch.Root size="sm" flexShrink={0} checked={size === "auto"} onCheckedChange={(e) => set(i, e.checked ? "auto" : mm !== undefined && mm > 0 ? Math.round(mm) : 150)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Auto</Switch.Label>
                </Switch.Root>
                {size !== "auto" ? (
                  <Box flex="1" minW={0} maxW="160px">
                    <NumberField label="" ariaLabel={`${label} del front del calaix`} value={size} min={30} max={2000} step={5} onChange={(v) => set(i, v)} />
                  </Box>
                ) : mm !== undefined ? (
                  <Text fontSize="sm" color="fg.muted">
                    {fmtNum(mm)} mm
                  </Text>
                ) : null}
              </HStack>
            )}
          </FormRow>
        )
      })}
    </Stack>
  )
}

/**
 * La guia de cada calaix de baix a dalt (per decisió de l'usuari, 2026-10-14: «un selector de guia a cada calaix; si en
 * canvies un, el següent igual que l'anterior»): el primer és la «Guia de calaix»; cada un dels altres, «Com el calaix n»
 * (el de sota) o un joc propi (`front.drawerSlides`). Al costat, el joc que s'ha fet (el més alt de la sèrie que hi cap).
 */
export function DrawerSlides({ front, kits, onChange, optionId = "zone.front.drawers.slides" }: { front: Extract<Front, { kind: "drawers" }>; kits?: KitOrder[]; onChange: (f: Front) => void; /** L'id de les files (els calaixos interiors en tenen un de propi). */ optionId?: string }) {
  const { settings } = useSettings()
  const items = settings.hardwareLibrary.filter((x) => isDrawerKit(x))
  // El que ha fet la construcció, calaix a calaix (només si tots en porten: si no, no se sap quin és quin).
  const built = kits?.length === front.n ? kits : undefined
  const set = (i: number, h: HardwareItem | undefined) => {
    const own = Array.from({ length: front.n }, (_, j) => (j === i ? (h ?? null) : (front.drawerSlides?.[j] ?? null)))
    const { drawerSlides: _old, ...rest } = front
    void _old
    onChange(own.some((x) => x) ? { ...rest, drawerSlides: own } : rest)
  }
  return (
    <>
      {Array.from({ length: front.n - 1 }, (_, j) => {
        const i = j + 1
        const own = front.drawerSlides?.[i] ?? undefined
        const label = `Guia del calaix ${i + 1}`
        const made = built?.[i]
        return (
          <FormRow key={i} optionId={optionId} label={label} help={`${own ? hardwareSummary(own) : `La mateixa que el calaix ${i}.`}${made ? ` Es fa amb ${made.kit}.` : ""}`}>
            <HardwareSelect label={label} items={items} current={own} emptyLabel={`Com el calaix ${i}`} onPick={(h) => set(i, h)} />
          </FormRow>
        )
      })}
    </>
  )
}

/** Els ids de les files de `KitFields`. */
export interface KitFieldIds {
  closing: string
  back: string
  finish: string
  bottom: string
  info: string
}

/** Els de Front › Calaixos. */
const FRONT_KIT_IDS: KitFieldIds = { closing: "zone.front.drawers.kit.closing", back: "zone.front.drawers.kit.back", finish: "zone.front.drawers.kit.finish", bottom: "zone.front.drawers.kit.bottom", info: "zone.front.drawers.kit.info" }

/**
 * Calaixos amb un joc paramètric de doble paret (triat a «Guia» o com a guia del mòdul): les opcions del joc (tancament,
 * darrere i acabat) i el que el constructor n'ha tret per a aquest compartiment (`kits`): la NL triada, els números
 * d'article i les mides del fons A i del darrere B. Cap lateral de fusta; el gruix del fons el demana el joc (16).
 */
export function KitFields({ front, kit, kits, onChange, ids = FRONT_KIT_IDS }: { front: Extract<Front, { kind: "drawers" }>; kit: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }; kits?: KitOrder[]; onChange: (f: Front) => void; /** Els ids de les files (els calaixos interiors en tenen uns de propis). */ ids?: KitFieldIds }) {
  const o = kitOptionsOf(kit.kit, front.kit)
  const setKit = (patch: Partial<typeof o>) => onChange({ ...front, kit: { ...o, ...patch } })
  const first = kits?.[0]
  const finishes = kit.kit.options.finish ?? []
  const TB = kitBottomThickness(kit)
  // Van plegades a «Opcions de la guia de calaix» (`FrontFields`).
  return (
    <>
      <FormRow optionId={ids.closing} label="Tancament" help="Com tanca el calaix: suau (amortit), push-open (sense tirador, amb barra de sincronització) o les dues coses. Canvia els números d'article i si cal la barra.">
        <ChoiceChips label="Tancament" value={o.closing} options={kit.kit.options.closing.map((c) => ({ id: c, label: KIT_CLOSINGS.find((x) => x.id === c)!.short }))} onChange={(closing) => setKit({ closing })} />
      </FormRow>
      <FormRow optionId={ids.back} label="Darrere" help="De fusta (peça B del tauler del cos, amb els suports de darrere) o metàl·lic del fabricant (per amplada del moble; el fons és 2 mm més llarg).">
        <ChoiceChips label="Darrere" value={o.back} options={kit.kit.options.back.map((b) => ({ id: b, label: KIT_BACKS.find((x) => x.id === b)!.short }))} onChange={(back) => setKit({ back })} />
      </FormRow>
      {finishes.length > 1 && o.finish && (
        <FormRow optionId={ids.finish} label="Color dels laterals" help="Els laterals de doble paret (només canvia el 3D; els números d'article són els mateixos).">
          <ChoiceChips label="Color dels laterals" value={o.finish} options={finishes.map((f) => ({ id: f, label: KIT_FINISHES.find((x) => x.id === f)!.short }))} onChange={(finish) => setKit({ finish })} />
        </FormRow>
      )}
      <FormRow optionId={ids.bottom} label="Fons del calaix" help={`El joc demana un fons del calaix de ${TB} mm (catàleg): el gruix no es tria. El material, a Materials › «Fons del calaix» (sense, el del fons del mòdul adaptat al gruix, o el del cos si fa ${TB} mm).`}>
        <Text fontSize="sm" pt="6px" data-testid="kit-bottom">
          {TB} mm · el joc demana {TB} mm
        </Text>
      </FormRow>
      {first ? (
        <FormRow optionId={ids.info} label="Joc" help={`${first.kit}: la llargada nominal més gran que hi cap darrere del front (LT = NL + 3). Sense laterals de fusta: el fons i el darrere surten de les fórmules del catàleg. Els components i els números són a Peces › «Ferratges dels jocs».`}>
          <Stack gap={0.5} pt="6px" fontSize="sm" data-testid="kit-info">
            <Text fontWeight="medium">NL {first.nl} · {kits!.length} {kits!.length === 1 ? "calaix" : "calaixos"}</Text>
            {first.lines.slice(0, 4).map((l) => (
              <Text key={l.component} fontSize="xs" color="fg.muted">
                {kitLineText(l)}
              </Text>
            ))}
            {first.wood.map((w) => (
              <Text key={w.key} fontSize="xs">
                {kitWoodText(w)}
              </Text>
            ))}
            {first.rule && (
              <Text fontSize="xs" color="fg.muted">
                Estabilitzador {KIT_LEVEL_LABEL[first.rule.stabilizer]} · barra {KIT_LEVEL_LABEL[first.rule.syncRod]}{first.syncRod !== undefined ? ` (tallar a ${fmtNum(first.syncRod)})` : ""}
              </Text>
            )}
          </Stack>
        </FormRow>
      ) : (
        <Text fontSize="xs" color="fg.muted">
          El joc no hi cap: mira els avisos del moble (fondària, alçada o laterals).
        </Text>
      )}
    </>
  )
}
