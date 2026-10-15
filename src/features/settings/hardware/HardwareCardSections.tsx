import { Badge, Button, HStack, Input, Spinner, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuCheck, LuInfo, LuUndo2, LuUpload } from "react-icons/lu"
import { FoldItem } from "../../../components/Fold"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { confirmProblem, restoreProposal, setConfirmed } from "../../../core/model/hardwareEdit"
import { HARDWARE_ROLES, type HardwareEngine, type HardwareItem } from "../../../core/model"
import { ENGINE_HELP, ONLY_2D_HELP, PLACED_HELP, type slotOfEngine } from "./engineHelp"

/** «General»: què és (o, d'un importat, canviar-ho), el fabricant, la referència i si és el per defecte. */
export function GeneralSection({
  item,
  slot,
  only2d,
  isDefault,
  onDefault,
  onChange,
  onRetarget,
}: {
  item: HardwareItem
  slot: ReturnType<typeof slotOfEngine>
  only2d: boolean
  isDefault: boolean
  onDefault: () => void
  onChange: (next: HardwareItem) => void
  onRetarget?: (engine: HardwareEngine) => Promise<void>
}) {
  const [retargeting, setRetargeting] = useState(false)
  const setText = (key: "maker" | "ref", v: string) => {
    const { [key]: _old, ...rest } = item
    onChange(v.trim() ? { ...rest, [key]: v } : rest)
  }
  const typeLabel = slot?.label ?? (item.engine === "model" && item.machining?.length ? "Es col·loca a mà" : only2d ? "Només 2D" : (ENGINE_HELP[item.engine]?.label ?? item.engine))
  return (
    <FoldItem id="hw-general" icon={LuInfo} title="General" badge={typeLabel} defaultOpen>
      {item.imported && onRetarget && !item.imported.damaged ? (
        <FormRow
          label="Què és"
          help={`${HARDWARE_ROLES.find((r) => r.engine === item.engine)?.help ?? ""} Canviar-ho posa el ferratge al lloc triat amb els números per defecte d'aquell tipus (per omplir i confirmar) i orienta el model 3D segons el que s'hi troba (la cassoleta, la cara de muntatge i els forats): comprova-ho a «Com va muntat».`}
        >
          <Stack gap={1} pt="2px">
            <ChoiceChips
              label="Què és"
              value={item.engine}
              options={HARDWARE_ROLES.map((r) => ({ id: r.engine, label: r.label }))}
              onChange={(engine) => {
                if (engine === item.engine || retargeting) return
                setRetargeting(true)
                void onRetarget(engine).finally(() => setRetargeting(false))
              }}
            />
            {retargeting && (
              <HStack gap={2} fontSize="xs" color="fg.muted">
                <Spinner size="xs" /> Orientant el model 3D…
              </HStack>
            )}
          </Stack>
        </FormRow>
      ) : (
      <FormRow
        label="Tipus"
        help={
          slot ? `Fa de «${slot.label}»: ${slot.uses}. La regla de cada contingut decideix on va i quants se'n posen.`
          : item.engine === "model" && item.machining?.length ? PLACED_HELP
          : only2d ? ONLY_2D_HELP
          : ENGINE_HELP[item.engine]?.help
        }
      >
        <Text fontSize="sm" pt="6px">
          {typeLabel}
        </Text>
      </FormRow>
      )}
      <FormRow label="Fabricant">
        <Input size="sm" maxW="280px" value={item.maker ?? ""} onChange={(e) => setText("maker", e.target.value)} placeholder="Opcional" />
      </FormRow>
      <FormRow label="Referència">
        <Input size="sm" maxW="280px" value={item.ref ?? ""} onChange={(e) => setText("ref", e.target.value)} placeholder="Opcional" />
      </FormRow>
      {slot && (
        <FormRow label="Per defecte" help={isDefault ? `És el que fan servir els mòduls nous (${slot.uses}). Per canviar-lo, fes per defecte un altre del mateix tipus.` : `Els mòduls nous faran servir aquest (${slot.uses}). Els mobles fets no canvien.`}>
          <Switch.Root size="sm" pt="6px" checked={isDefault} disabled={isDefault} onCheckedChange={(e) => e.checked && onDefault()}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Per defecte als mòduls nous</Switch.Label>
          </Switch.Root>
        </FormRow>
      )}
    </FoldItem>
  )
}

/** «Importat del fabricant»: l'estat (confirmar-lo o no), d'on ve i tornar a la proposta. */
export function ImportedSection({ item, library, only2d, onChange }: { item: HardwareItem; library: HardwareItem[]; only2d: boolean; onChange: (next: HardwareItem) => void }) {
  const problem = confirmProblem(item, library)
  const importState: { label: string; palette: string } =
    item.engine === "model" && !item.machining?.length ? { label: only2d ? "Només 2D" : "Només 3D", palette: "gray" }
    : item.imported?.confirmed ? { label: "Confirmat", palette: "green" }
    : { label: "Sense confirmar", palette: "orange" }
  if (!item.imported) return null
  return (
    <FoldItem id="hw-imported" icon={LuUpload} title="Importat del fabricant" badge={importState.label} badgePalette={importState.palette} defaultOpen>
      {item.engine === "model" && !item.machining?.length ? (
        <FormRow label="Estat" help={only2d ? ONLY_2D_HELP : "No hi ha cap regla de mecanitzat per a aquest ferratge (o no s'hi ha trobat el patró de forats): el model i el volum, mai cap forat. No cal confirmar-lo."}>
          <HStack gap={2} pt="2px">
            <Badge size="sm" variant="subtle" colorPalette="gray" data-testid="hardware-import-state">
              {only2d ? "Només 2D" : "Només 3D"}
            </Badge>
          </HStack>
        </FormRow>
      ) : (
      <FormRow
        label="Estat"
        help={
          item.imported.confirmed
            ? "Confirmat: fa els forats als mobles (i als fitxers del taller). Si en canvies els forats, cal tornar-lo a confirmar."
            : (problem ?? "Revisa els forats proposats (dibuix i 3D) i confirma'l. Fins aleshores es pot triar, però no fa cap forat i el moble avisa.")
        }
      >
        <HStack gap={2} pt="2px" wrap="wrap">
          <Badge size="sm" variant="subtle" colorPalette={item.imported.confirmed ? "green" : "orange"} data-testid="hardware-import-state">
            {item.imported.confirmed ? "Confirmat" : "Sense confirmar"}
          </Badge>
          {item.imported.confirmed ? (
            <Button size="xs" variant="outline" onClick={() => onChange(setConfirmed(item, false))}>
              Treure la confirmació
            </Button>
          ) : (
            <Button size="xs" colorPalette="wood" disabled={!!problem} onClick={() => onChange(setConfirmed(item, true))} data-testid="hardware-confirm">
              <LuCheck /> Confirmar
            </Button>
          )}
        </HStack>
      </FormRow>
      )}
      <FormRow label="Article">
        <Text fontSize="sm" pt="6px">
          {item.imported.maker} {item.imported.article}
        </Text>
      </FormRow>
      {item.imported.folders.length > 0 && (
        <FormRow label="Carpeta">
          <Text fontSize="sm" pt="6px" wordBreak="break-word">
            {item.imported.folders.join(" › ")}
          </Text>
        </FormRow>
      )}
      <FormRow label="Fitxers">
        <Text fontSize="sm" pt="6px" wordBreak="break-word" fontFamily="mono">
          {item.imported.files.join(" · ")}
        </Text>
      </FormRow>
      {item.imported.notes?.length ? (
        <FormRow label="Proposta">
          <Stack gap={1} pt="6px">
            {item.imported.notes.map((n, k) => (
              <Text key={k} fontSize="sm">
                {n}
              </Text>
            ))}
          </Stack>
        </FormRow>
      ) : null}
      {item.engine !== "model" && (
        <FormRow label="" help="Els forats tornen a ser els que es van llegir del fitxer (sense confirmar).">
          <Button size="xs" variant="ghost" onClick={() => onChange(restoreProposal(item))}>
            <LuUndo2 /> Tornar a la proposta
          </Button>
        </FormRow>
      )}
    </FoldItem>
  )
}
