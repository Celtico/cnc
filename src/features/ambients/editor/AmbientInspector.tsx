import { Alert, Badge, Box, Button, HStack, IconButton, Slider, Stack, Switch, Text } from "@chakra-ui/react"
import { LuBrickWall, LuHouse, LuImageUp, LuMoveDiagonal2, LuMoveHorizontal, LuPalette, LuPencilRuler, LuPlus, LuTrash2, LuWarehouse } from "react-icons/lu"
import { AxisLabel } from "../../../components/AxisLabel"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { FoldItem } from "../../../components/Fold"
import { NumRow } from "../../../components/NumRow"
import { Tooltip } from "../../../components/ui/tooltip"
import { roofBox, type Ambient, type AmbientSummary, type MaterialPref, type Roof, type Skylight } from "../../../core/model"
import { MaterialPick } from "./MaterialPick"

const ROOF_KINDS = [
  { value: "none", label: "Cap" },
  { value: "flat", label: "Plana" },
  { value: "shed", label: "Una aigua" },
  { value: "gable", label: "Dues aigües" },
] as const

/** La teulada de l'ambient (`Ambient.roof`): tipus, pendent, carener, voladís, gruix, alçada, material i claraboies. */
function RoofSection({ amb, materials, onChange }: { amb: Ambient; materials: MaterialPref[]; onChange: (a: Ambient) => void }) {
  const roof = amb.roof
  const set = (r: Partial<Roof>) => roof && onChange({ ...amb, roof: { ...roof, ...r } })
  const box = roofBox(amb)
  const wallTop = amb.walls.length ? Math.max(...amb.walls.map((w) => w.height)) : 2500
  const sky = roof?.skylights ?? []
  const setSky = (i: number, p: Partial<Skylight>) => set({ skylights: sky.map((k, j) => (j === i ? { ...k, ...p } : k)) })
  const label = ROOF_KINDS.find((k) => k.value === (roof?.kind ?? "none"))!.label
  return (
    <FoldItem id="amb-roof" title="Teulada" icon={LuWarehouse} badge={roof ? label : undefined}>
      <FormRow label="Tipus" help={!amb.walls.length ? "Dibuixa primer les parets: la teulada les cobreix amb el voladís." : roof?.kind === "gable" ? "Dues aigües: la «V» de casa, amb el carener al mig i les puntes tancades." : roof?.kind === "shed" ? "Una aigua: puja d'un costat a l'altre; la paret alta i les puntes s'hi tanquen." : undefined}>
        <ChoiceChips
          label="Tipus de teulada"
          value={roof?.kind ?? "none"}
          options={ROOF_KINDS.map((k) => ({ id: k.value, label: k.label }))}
          onChange={(v) => onChange({ ...amb, roof: v === "none" ? undefined : { pitch: 30, ridge: "x", overhang: 300, thickness: 200, ...roof, kind: v as Roof["kind"] } })}
        />
      </FormRow>
      {roof && (
        <>
          {roof.kind !== "flat" && <NumRow label="Pendent" value={roof.pitch} min={1} max={70} step={1} suffix="°" onChange={(pitch) => pitch >= 1 && pitch <= 70 && set({ pitch })} />}
          {roof.kind !== "flat" && (
            <FormRow label="Carener" help={roof.kind === "shed" ? "La direcció de la vora alta." : "La direcció de la línia de dalt (on es troben les dues aigües)."}>
              <ChoiceChips label="Carener" value={roof.ridge} options={[{ id: "x", label: "Al llarg de X" }, { id: "y", label: "Al llarg de Y" }]} onChange={(ridge) => set({ ridge: ridge as Roof["ridge"] })} />
            </FormRow>
          )}
          <NumRow label="Voladís" value={roof.overhang} min={0} max={3000} step={10} onChange={(overhang) => overhang >= 0 && set({ overhang })} />
          <NumRow label="Gruix" value={roof.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && set({ thickness })} />
          <NumRow label="Alçada" value={roof.height ?? wallTop} min={200} max={20000} step={10} help={roof.height === undefined ? "Com la paret més alta." : undefined} onChange={(height) => height >= 200 && set({ height: height === wallTop ? undefined : height })} />
          <MaterialPick label="Material" value={roof.material ?? "Formigó"} materials={materials} onChange={(material) => set({ material })} />
          <FormRow label="Claraboies" help="Finestres a la teulada: al render la llum del cel hi entra. X i Y són el centre al plànol.">
            <Button
              size="xs"
              variant="outline"
              alignSelf="flex-start"
              disabled={!box}
              onClick={() => box && set({ skylights: [...sky, { x: Math.round((box.x0 + box.x1) / 2), y: Math.round((box.y0 + box.y1) / 2), w: 800, d: 1000 }] })}
            >
              <LuPlus /> Afegir claraboia
            </Button>
          </FormRow>
          {sky.map((k, i) => (
            <Stack key={i} gap={2}>
              <HStack gap={2}>
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" flex={1}>
                  Claraboia {i + 1}
                </Text>
                <Tooltip content="Eliminar la claraboia">
                  <IconButton size="2xs" variant="ghost" aria-label="Eliminar la claraboia" onClick={() => set({ skylights: sky.filter((_, j) => j !== i) })}>
                    <LuTrash2 />
                  </IconButton>
                </Tooltip>
              </HStack>
              <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="El centre, d'esquerra a dreta del plànol" />} ariaLabel="De costat (X)" value={k.x} step={10} onChange={(x) => Number.isFinite(x) && setSky(i, { x })} />
              <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="El centre, de dalt a baix del plànol" />} ariaLabel="Fondària (Z)" value={k.y} step={10} onChange={(y) => Number.isFinite(y) && setSky(i, { y })} />
              <NumRow label="Amplada" value={k.w} min={100} max={5000} step={10} onChange={(w) => w >= 100 && setSky(i, { w })} />
              <NumRow label="Fondària" value={k.d} min={100} max={5000} step={10} onChange={(d) => d >= 100 && setSky(i, { d })} />
            </Stack>
          ))}
        </>
      )}
    </FoldItem>
  )
}

export function AmbientInspector({
  name,
  summary: s,
  size,
  onRemoveMissing,
  amb,
  materials,
  wallDefaults,
  onWallDefaults,
  onChange,
  onImportPlan,
  onCalibrate,
}: {
  name: string
  summary: AmbientSummary
  /** Caixa de les parets (mm), si n'hi ha. */
  size: { w: number; d: number } | null
  onRemoveMissing: () => void
  amb: Ambient
  materials: MaterialPref[]
  wallDefaults: { thickness: number; height: number }
  onWallDefaults: (v: { thickness: number; height: number }) => void
  onChange: (a: Ambient) => void
  onImportPlan: () => void
  onCalibrate: () => void
}) {
  const plan = amb.plan
  const m = (mm: number) => (mm / 1000).toLocaleString("ca-ES", { maximumFractionDigits: 2 })
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const line = [
    n(s.walls, "paret", "parets"),
    s.area > 0 && `${(s.area / 1e6).toLocaleString("ca-ES", { maximumFractionDigits: 1 })} m² de terra`,
    size && `${m(size.w)} × ${m(size.d)} m`,
  ].filter(Boolean)
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        <Box color="wood.fg">
          <LuHouse />
        </Box>
        <Text fontWeight="semibold" truncate flex={1} data-truncate="">
          {name || "Ambient"}
        </Text>
      </HStack>
      {/* Resum, com el del moble a l'editor (mateix `FoldItem`): què hi ha a l'ambient. */}
      <FoldItem id="amb-summary" title="Resum" icon={LuHouse} badge={s.missing.length ? `${s.missing.length} ⚠` : undefined} badgePalette={s.missing.length ? "red" : undefined}>
        <Text fontSize="sm" color="fg.muted">
          {line.join(" · ")}
        </Text>
        <HStack gap={2} wrap="wrap">
          <Badge variant="subtle">{n(s.mobles, "moble", "mobles")}</Badge>
          <Badge variant="subtle">{n(s.objects, "objecte", "objectes")}</Badge>
          {s.windows > 0 && <Badge variant="subtle">{n(s.windows, "finestra", "finestres")}</Badge>}
          {s.doors > 0 && <Badge variant="subtle">{n(s.doors, "porta", "portes")}</Badge>}
          {s.glazing > 0 && <Badge variant="subtle">{n(s.glazing, "vidriera", "vidrieres")}</Badge>}
          {s.groups > 0 && <Badge variant="subtle">{n(s.groups, "grup", "grups")}</Badge>}
        </HStack>
        {s.missing.length > 0 && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{s.missing.length === 1 ? "Un moble ja no hi és" : `${s.missing.length} mobles ja no hi són`}</Alert.Title>
              <Alert.Description>
                <Stack gap={2} align="flex-start">
                  <Text>S'han esborrat de la llista de Mobles o d'Objectes: a l'ambient no es veuen.</Text>
                  <Button size="xs" variant="outline" onClick={onRemoveMissing}>
                    <LuTrash2 /> Eliminar-los de l'ambient
                  </Button>
                </Stack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        <Text fontSize="xs" color="fg.muted">
          Selecciona una paret o un element a l'esquerra (o clica'l al plànol o al 3D) per editar-lo.
        </Text>
      </FoldItem>
      <FoldItem id="amb-newwalls" title="Parets noves" icon={LuBrickWall} badge={`${wallDefaults.thickness} · ${wallDefaults.height}`}>
        <NumRow label="Gruix" value={wallDefaults.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onWallDefaults({ ...wallDefaults, thickness })} />
        <NumRow label="Alçada" value={wallDefaults.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onWallDefaults({ ...wallDefaults, height })} />
      </FoldItem>

      <FoldItem id="amb-finish" title="Acabats" icon={LuPalette}>
        <MaterialPick label="Terra" value={amb.floorMaterial ?? "Parquet de roure"} materials={materials} onChange={(floorMaterial) => onChange({ ...amb, floorMaterial })} onlySim />
        <MaterialPick label="Terra de fora" value={amb.outsideFloorMaterial ?? "Gespa"} materials={materials} onChange={(outsideFloorMaterial) => onChange({ ...amb, outsideFloorMaterial })} onlySim />
        <MaterialPick label="Parets" value={amb.wallMaterial ?? "Pintura blanca"} materials={materials} onChange={(wallMaterial) => onChange({ ...amb, wallMaterial })} onlySim />
        <MaterialPick label="Sostre" value={amb.ceilingMaterial ?? "Pintura blanca"} materials={materials} onChange={(ceilingMaterial) => onChange({ ...amb, ceilingMaterial })} onlySim />
      </FoldItem>

      <RoofSection amb={amb} materials={materials} onChange={onChange} />

      <FoldItem id="amb-plan" title="Plànol de fons" icon={LuImageUp} badge={plan ? "Sí" : undefined}>
        {plan ? (
          <>
            <HStack gap={3}>
              <Box w="72px" h="52px" rounded="sm" borderWidth="1px" bgImage={`url(${plan.src})`} bgSize="cover" backgroundPosition="center" flexShrink={0} />
              <Text fontSize="xs" color="fg.muted">
                {Math.round((plan.pxW * plan.mmPerPx) / 10) / 100} × {Math.round((plan.pxH * plan.mmPerPx) / 10) / 100} m
              </Text>
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Button size="xs" variant="outline" onClick={onCalibrate}>
                <LuPencilRuler /> Calibrar
              </Button>
              <Button size="xs" variant="outline" onClick={onImportPlan}>
                <LuImageUp /> Canviar
              </Button>
              <Button size="xs" variant="ghost" colorPalette="red" onClick={() => onChange({ ...amb, plan: undefined })}>
                <LuTrash2 /> Treure'l
              </Button>
            </HStack>
            <FormRow label="Opacitat">
              <Slider.Root size="sm" w="full" pt="10px" aria-label={["Opacitat"]} min={0.1} max={1} step={0.05} value={[plan.opacity]} onValueChange={(e) => onChange({ ...amb, plan: { ...plan, opacity: e.value[0]! } })}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
            </FormRow>
            <FormRow label="Bloqueig">
              <Switch.Root size="sm" pt="6px" checked={plan.locked !== false} onCheckedChange={(e) => onChange({ ...amb, plan: { ...plan, locked: e.checked } })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Bloquejat (desbloquejat, s'arrossega)</Switch.Label>
              </Switch.Root>
            </FormRow>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={onImportPlan}>
              <LuImageUp /> Posar un plànol (imatge)
            </Button>
            <Text fontSize="xs" color="fg.muted">
              Una foto o captura del plànol de la casa. Després marques dos punts d'una mida coneguda i queda a escala; a sobre hi dibuixes les parets.
            </Text>
          </>
        )}
      </FoldItem>
      <Text fontSize="xs" color="fg.muted" pt={4}>
        <LuPlus style={{ display: "inline" }} /> Afegeix mobles i objectes des de l'esquerra. Selecciona'ls per moure'ls, girar-los (R) o canviar-ne les mides.
      </Text>
    </Stack>
  )
}
