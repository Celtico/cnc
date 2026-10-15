import { Box, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, type RefObject } from "react"
import { LuCircleDot, LuCopy, LuListOrdered, LuMoveDiagonal, LuRuler, LuSquareDot, LuTrash2 } from "react-icons/lu"
import { FoldItem } from "../../../components/Fold"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { NumRow } from "../../../components/NumRow"
import { StepRuleRows } from "../../../components/StepRuleRows"
import { pairPlate, setHandleDistance, setHardwareParam } from "../../../core/model/hardwareEdit"
import { HINGE_PLATE_PARAMS, hardwareParamLabel, hardwareParams, hardwareSummary, isPendingImport, type HardwareEngine, type HardwareItem, type HardwareTarget } from "../../../core/model"
import { useDraft } from "../../../lib/useDraft"
import { ApplianceLook } from "../ApplianceLook"
import { ApplianceSections } from "../ApplianceSections"
import { KitSections } from "../KitSections"
import { LightSections } from "../LightSections"
import { ThicknessChips } from "../MaterialBits"
import { DocsSection } from "./DocsSection"
import { slotOfEngine } from "./engineHelp"
import { fmt, opText, stepBadge } from "./format"
import { GeneralSection, ImportedSection } from "./HardwareCardSections"
import { OpsEditor } from "./OpsEditor"
import { UpdateNotice } from "./UpdateNotice"

export function HardwareCard({
  item,
  dirty,
  plates,
  library,
  isDefault,
  onDefault,
  onChange,
  onRetarget,
  onDuplicate,
  onDelete,
  autoFocusName,
}: {
  item: HardwareItem
  dirty: RefObject<boolean>
  /** Les plaques de la biblioteca (per aparellar-ne una a una frontissa importada). */
  plates: HardwareItem[]
  /** Tota la biblioteca (una frontissa no es confirma amb la placa sense confirmar). */
  library: HardwareItem[]
  isDefault: boolean
  onDefault: () => void
  onChange: (next: HardwareItem) => void
  /** Canviar «què és» un importat (el lloc, `engine`): refà el model al seu marc i deixa l'item sense confirmar. */
  onRetarget?: (engine: HardwareEngine) => Promise<void>
  onDuplicate: () => void
  onDelete: () => void
  autoFocusName?: boolean
}) {
  const slot = slotOfEngine(item.engine)
  // Importat només amb les vistes DXF (sense STEP): ni 3D ni caixa encara.
  const only2d = item.engine === "model" && !!item.imported && !item.imported.bbox && !item.imported.damaged
  const set = (patch: Partial<HardwareItem>) => onChange({ ...item, ...patch })
  // Canviar els forats d'un importat el torna a deixar sense confirmar (cal tornar-lo a revisar).
  const setTargets = (targets: HardwareTarget[]) => onChange(item.imported ? { ...item, targets, imported: { ...item.imported, confirmed: false } } : { ...item, targets })
  // Canviar el Ø o la fondària de la cassoleta o on va la placa d'un importat el torna a deixar sense confirmar.
  const setParam = (key: string, v: number) => Number.isFinite(v) && onChange(setHardwareParam(item, key, v))
  // Resums de les insígnies de les seccions (tancades es llegeix què hi ha a dins).
  const dimsBadge = hardwareParams(item).slice(0, 2).map((p) => `${hardwareParamLabel(item, p).replace(/ \(.*\)$/, "")} ${fmt(item.params[p.key] ?? 0)}`).join(" · ") || (item.lengths ? `${item.lengths.length} llargades` : undefined)
  const nOps = item.targets.reduce((a, t) => a + t.ops.length, 0)
  const opsBadge = nOps ? `${nOps} ${nOps === 1 ? "forat" : "forats"}` : undefined
  return (
    <Box w={{ base: "full", lg: "min(560px, 48%)" }} flexShrink={0} overflowY={{ lg: "auto" }} borderStartWidth={{ lg: "1px" }} css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}>
      <Box maxW={{ base: "760px", lg: "none" }} mx="auto" pb={{ base: 8, lg: 6 }}>
        <NameHeader item={item} dirty={dirty} onChange={onChange} onDuplicate={onDuplicate} onDelete={onDelete} autoFocusName={autoFocusName} />

        {/* Seccions plegables (l'acordió de l'app, com l'editor de materials): independents i recordades durant la sessió. */}
        <Box className="form-section" borderTopWidth="1px" data-testid="hardware-sections">
        <GeneralSection item={item} slot={slot} only2d={only2d} isDefault={isDefault} onDefault={onDefault} onChange={onChange} onRetarget={onRetarget} />

        {item.kit && <KitSections item={item} kit={item.kit} />}
        {item.light && <LightSections item={item} kit={item.light} />}
        {item.appliance && <ApplianceLook item={item} appliance={item.appliance} onChange={onChange} />}
        {item.appliance && <ApplianceSections item={item} appliance={item.appliance} />}
        {item.imported?.update && <UpdateNotice item={item} onChange={onChange} />}
        {item.imported && <ImportedSection item={item} library={library} only2d={only2d} onChange={onChange} />}
        {item.imported?.asset && <DocsSection asset={item.imported.asset} name={item.name} />}

        {item.imported && item.engine === "cup" && (
          <FoldItem id="hw-plate" icon={LuSquareDot} title="Placa de muntatge" badge={item.plate ? (plates.find((x) => x.id === item.plate!.id)?.name ?? "Del moble") : "Cap"}>
            <FormRow label="Placa" help="La placa del lateral: els seus forats van a la cara de dins del lateral de les frontisses, a la filera de davant i a l'alçada de cada cassoleta. Sense, cap forat al lateral (la filera System 32 la sosté).">
              <ChoiceChips
                label="Placa"
                value={item.plate?.id ?? "none"}
                options={[{ id: "none", label: "Cap" }, ...plates.map((x) => ({ id: x.id, label: `${x.name}${isPendingImport(x) ? " (sense confirmar)" : ""}` }))]}
                onChange={(id) => onChange(pairPlate(item, id === "none" ? null : (plates.find((x) => x.id === id) ?? null)))}
              />
            </FormRow>
            {item.plate &&
              HINGE_PLATE_PARAMS.map((p) => (
                <NumRow key={p.key} label={p.label} help={p.help} value={item.params[p.key] ?? 0} min={p.min} max={p.max} step={p.step} onChange={(v) => setParam(p.key, v)} />
              ))}
          </FoldItem>
        )}

        {(hardwareParams(item).length > 0 || item.lengths) && (
        <FoldItem id="hw-dims" icon={LuMoveDiagonal} title="Mides" badge={dimsBadge}>
          {hardwareParams(item).map((p) => (
            <NumRow key={p.key} label={hardwareParamLabel(item, p)} help={hardwareParamLabel(item, p) === p.label ? p.help : "De la vora de fora del lateral a l'eix de cada pota."} value={item.params[p.key] ?? 0} min={p.min} max={p.max} step={p.step} onChange={(v) => setParam(p.key, v)} />
          ))}
          {item.lengths && (
            <FormRow label="Llargades" help="Les guies que es poden comprar: el calaix agafa la més llarga que hi cap.">
              <ThicknessChips value={item.lengths} onChange={(lengths) => set({ lengths })} label={false} what="llargada" range={[100, 1500]} />
            </FormRow>
          )}
        </FoldItem>
        )}

        {item.count && (
          <FoldItem id="hw-count" icon={LuListOrdered} title="Quantitat per alçada" badge={stepBadge(item.count, "")}>
            <StepRuleRows rule={item.count} kind="count" onChange={(count) => set({ count })} />
          </FoldItem>
        )}
        {item.pitch && item.imported && item.engine === "barHandle" ? (
          <FoldItem id="hw-pitch" icon={LuRuler} title="Distància entre forats" badge={`${fmt(item.pitch.else)} mm`}>
            {(item.targets.find((t) => t.key === "front")?.ops.length ?? 0) >= 2 ? (
              <NumRow
                label="Entre centres"
                help="La del fitxer del fabricant (a la de catàleg més propera si hi era a menys de 0,5 mm). És la mateixa a totes les portes, calaixos i abatibles que triïn aquest tirador. Canviar-la el deixa sense confirmar."
                value={item.pitch.else}
                min={16}
                max={2000}
                step={1}
                onChange={(v) => Number.isFinite(v) && onChange(setHandleDistance(item, v))}
              />
            ) : (
              <Text fontSize="sm" color="fg.muted" pb={2}>
                Pom: un sol forat, al mateix lloc que el centre del tirador de l'app.
              </Text>
            )}
          </FoldItem>
        ) : item.pitch ? (
          <FoldItem id="hw-pitch" icon={LuRuler} title="Distància entre forats" badge={stepBadge(item.pitch, " mm")}>
            <StepRuleRows rule={item.pitch} kind="pitch" onChange={(pitch) => set({ pitch })} />
          </FoldItem>
        ) : null}

        {item.engine === "model" ? null : item.imported && item.engine !== "barHandle" ? (
          <FoldItem id="hw-ops" icon={LuCircleDot} title="Mecanitzats" badge={opsBadge}>
            {item.targets.map((t) => (
              <OpsEditor key={t.key} item={item} target={t} onChange={(next) => setTargets(item.targets.map((x) => (x.key === t.key ? next : x)))} />
            ))}
          </FoldItem>
        ) : (
        <FoldItem id="hw-ops" icon={LuCircleDot} title="Mecanitzats" badge={opsBadge}>
          {item.targets.map((t) => (
            <FormRow key={t.key} label={t.label}>
              <Stack gap={0.5} pt="6px">
                {t.ops.map((op, k) => (
                  <Text key={k} fontSize="sm" fontFamily="mono">
                    {opText(op)}
                    {op.tag ? <Text as="span" color="fg.muted"> · {op.tag}</Text> : null}
                  </Text>
                ))}
              </Stack>
            </FormRow>
          ))}
          <Text fontSize="xs" color="fg.muted" pb={2}>
            {item.imported
              ? "Forats passants al front, al voltant del centre del tirador (pitch = la distància entre forats, diameter = el Ø de Mides)."
              : item.appliance ? "Al darrere del front de moble: les cassoletes de les frontisses de l'aparell (de la fitxa) o, si «Prebroques» és 1, les prebroques de la fixació a la porta de l'aparell o de la guia lliscant (l'estàndard és forar-les amb la plantilla de l'aparell: 0)."
              : item.kit ? "La prebroca de cada cargol (Ø i fondària de la regla del taller, Preferències › Regles de mecanitzat › «Prebroca dels cargols»); on van, ho diu el joc («Mecanitzats del joc»)."
              : "En coordenades de la peça (u al llarg del cantell de referència, v cap a dins), amb els noms de les mides de dalt. Editar-los i afegir-ne és per a més endavant (ferratges manuals)."}
          </Text>
        </FoldItem>
        )}
        </Box>
      </Box>
    </Box>
  )
}

/** El nom (editable, gran) i les accions de dalt de l'editor. */
function NameHeader({ item, dirty, onChange, onDuplicate, onDelete, autoFocusName }: { item: HardwareItem; dirty: RefObject<boolean>; onChange: (next: HardwareItem) => void; onDuplicate: () => void; onDelete: () => void; autoFocusName?: boolean }) {
  // El nom es canvia en acabar (sortir del camp o Retorn), com als materials; buit, es queda l'antic. Esc el desfà.
  const [nameText, setNameText] = useDraft(item.name)
  const cancelName = useRef(false)
  useEffect(() => {
    dirty.current = nameText !== item.name
  })
  const commitName = () => {
    if (cancelName.current) {
      cancelName.current = false
      setNameText(item.name)
      return
    }
    const next = nameText.trim().replace(/\s+/g, " ")
    if (!next || next === item.name) {
      setNameText(item.name)
      return
    }
    onChange({ ...item, name: next })
  }
  return (
    <HStack gap={2} px={{ base: 4, sm: 6 }} pt={4} pb={4} align="flex-start">
      <Stack gap={0.5} flex={1} minW={0}>
        <Input
          variant="flushed"
          size="md"
          fontSize="lg"
          fontWeight="semibold"
          value={nameText}
          onChange={(e) => setNameText(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            else if (e.key === "Escape") {
              cancelName.current = true
              setNameText(item.name)
              e.currentTarget.blur()
            }
          }}
          autoFocus={autoFocusName}
          onFocus={(e) => autoFocusName && e.currentTarget.select()}
          aria-label="Nom del ferratge"
          data-hardware-name=""
          borderColor="transparent"
          _hover={{ borderColor: "border" }}
          _focus={{ borderColor: "wood.solid" }}
        />
        <Text fontSize="xs" color="fg.muted" truncate>
          {hardwareSummary(item)}
        </Text>
      </Stack>
      <HStack gap={0} flexShrink={0} pt={1.5}>
        <IconButton aria-label="Duplicar ferratge" title="Duplicar" size="sm" variant="ghost" onClick={onDuplicate}>
          <LuCopy />
        </IconButton>
        <IconButton aria-label="Eliminar ferratge" title="Eliminar" size="sm" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
    </HStack>
  )
}
