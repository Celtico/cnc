import { Alert, Box, Button, CloseButton, Dialog, Portal, Progress, Stack, Text } from "@chakra-ui/react"
import { useImperativeHandle, useRef, useState, type Ref } from "react"
import { LuPalette } from "react-icons/lu"
import { NumRow } from "../../components/NumRow"
import type { PickedFile } from "../../components/pickedFiles"
import { SectionLabel } from "../../components/SectionLabel"
import { forgetModel } from "../../components/viewer/models3d"
import { formatReport, type OptimizeReport } from "../../components/viewer/optimizeGlbPlan"
import { textureTileMm, type PolyHavenInfo } from "../../core/import"
import { groupTextureSets } from "../../core/photo/pbrMaps"
import { addUserModelBuffer, HEAVY_MODEL_BYTES } from "../../db/userModels"
import { fileAccept } from "../file/fileAccept"
import { fetchPolyHavenInfo } from "../file/polyHavenApi"
import { useSettings } from "../settings/SettingsContext"
import { pickFiles } from "../settings/textureImport"
import { convertModelFiles, isModelImportError, type ConvertedModel, type ImportFailure, type ImportProgress } from "./modelImport"
import { materialsFromTextures, textureSetName } from "../settings/textureMaterials"
import { formatBytes, modelChoiceOf, type ModelChoice } from "./useModelAssets"

/** Per obrir els selectors des d'un menú o un botó (el + de «Models 3D», «Canviar» de l'inspector). */
export interface ModelImportHandle {
  pick: (which: "files" | "folder") => void
}

/** Extensions del selector: el model i el que porta (textures, `.bin`), o un `.zip`. */
const ACCEPT = ".glb,.gltf,.bin,.fbx,.blend,.zip,.exr,image/*,model/gltf-binary,model/gltf+json"

type State =
  | { kind: "idle" }
  | { kind: "busy"; progress: ImportProgress }
  | { kind: "done"; model: ConvertedModel; choice: ModelChoice; report: OptimizeReport }
  | { kind: "error"; reason: ImportFailure | "other"; message: string; textures?: Map<string, Blob>; info?: PolyHavenInfo | null; name: string }

/** Alternatives quan no es pot fer el model (per decisió de l'usuari: dir què fer, no només que falla). */
const ALTERNATIVES: Partial<Record<ImportFailure | "other", string[]>> = {
  "blend-offline": [
    "Torna-ho a provar amb connexió: l'app baixarà el mateix model de Poly Haven en glTF.",
    "O, a polyhaven.com, baixa el model en format glTF (a la llista de formats) i importa aquest .zip: funciona sense connexió.",
    "O obre el .blend a Blender i exporta'l: Fitxer › Exportar › glTF 2.0, «glTF Binary (.glb)» (l'script del repositori scripts/polyhaven-tree-to-glb.py ho fa sense obrir Blender).",
  ],
  "blend-not-polyhaven": [
    "El navegador no pot llegir fitxers de Blender. Obre'l a Blender i exporta'l: Fitxer › Exportar › glTF 2.0, «glTF Binary (.glb)».",
    "Si és de Poly Haven però li has canviat el nom, baixa'l en format glTF (a la llista de formats) i importa aquest .zip.",
    "Al repositori, scripts/polyhaven-tree-to-glb.py el converteix sense obrir Blender (Blender com a mòdul de Python).",
  ],
  "blend-no-gltf": [
    "A polyhaven.com, baixa el model en format glTF i importa aquest .zip.",
    "O obre el .blend a Blender i exporta'l: Fitxer › Exportar › glTF 2.0, «glTF Binary (.glb)» (o amb scripts/polyhaven-tree-to-glb.py).",
  ],
  unsupported: ["Obre'l a Blender i exporta'l: Fitxer › Exportar › glTF 2.0, «glTF Binary (.glb)». També serveixen .gltf (amb el .bin i les textures) i .fbx."],
  "texture-only": ["Per fer-ne un material: aquí sota, o a Preferències › Materials › «Afegir» (o «Joc PBR» de l'editor de materials)."],
  "no-model": ["Tria un .glb, un .gltf amb el seu .bin i les textures (o la carpeta), un .fbx o el .zip tal com es baixa de Poly Haven."],
}

/**
 * Importar un model 3D (Objectes › Models 3D): finestra amb el progrés (llegir, baixar de Poly Haven, convertir,
 * optimitzar), el resultat i «Afegir les textures a Materials». Els selectors s'obren amb `handle.pick`.
 */
export function ModelImportDialog({ handle, onImported, onBusy }: { handle?: Ref<ModelImportHandle>; onImported: (m: ModelChoice) => void; onBusy?: (busy: boolean) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" })
  const running = useRef(false)
  const run = async (picked: PickedFile[]) => {
    if (!picked.length || running.current) return
    running.current = true
    onBusy?.(true)
    setState({ kind: "busy", progress: { stage: "read", label: "Llegint els fitxers…" } })
    const fallbackName = picked[0]!.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Model"
    try {
      const model = await convertModelFiles(picked, (progress) => setState({ kind: "busy", progress }))
      setState({ kind: "busy", progress: { stage: "optimize", label: "Optimitzant el model per al mòbil…" } })
      const { model: m, report } = await addUserModelBuffer(model.glb, model.name)
      forgetModel(m.id)
      const choice = modelChoiceOf(m)
      onImported(choice)
      setState({ kind: "done", model, choice, report })
    } catch (e) {
      if (isModelImportError(e)) {
        const info = e.info !== undefined ? e.info : e.polyHaven && e.textures?.size ? await fetchPolyHavenInfo(e.polyHaven.id) : null
        setState({ kind: "error", reason: e.reason, message: e.message, ...(e.textures?.size ? { textures: e.textures } : {}), info, name: info?.name ?? fallbackName })
      } else setState({ kind: "error", reason: "other", message: e instanceof Error ? e.message : String(e), name: fallbackName })
    } finally {
      running.current = false
      onBusy?.(false)
    }
  }
  useImperativeHandle(handle, () => ({
    pick: (which) => void pickFiles(which === "folder" ? { folder: true, testId: "model-folder" } : { multiple: true, accept: fileAccept(ACCEPT), testId: "model-files" }).then(run),
  }))
  const close = () => {
    if (state.kind !== "busy") setState({ kind: "idle" })
  }
  return (
    <Dialog.Root open={state.kind !== "idle"} onOpenChange={(e) => !e.open && close()} size={{ base: "full", md: "md" }} placement="center" scrollBehavior="inside" lazyMount unmountOnExit closeOnInteractOutside={false}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }} pb={{ base: "env(safe-area-inset-bottom, 0px)", md: 0 }} data-testid="model-import-dialog">
            <Dialog.Header>
              <Dialog.Title>Importar un model 3D</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {state.kind === "busy" && <Busy progress={state.progress} />}
              {state.kind === "done" && <Done state={state} />}
              {state.kind === "error" && <Failed state={state} />}
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="wood" disabled={state.kind === "busy"} onClick={close}>
                {state.kind === "done" ? "Fet" : "Tancar"}
              </Button>
            </Dialog.Footer>
            {state.kind !== "busy" && (
              <Dialog.CloseTrigger asChild top={{ base: "calc(env(safe-area-inset-top, 0px) + 8px)", md: 2 }}>
                <CloseButton size="sm" aria-label="Tancar" />
              </Dialog.CloseTrigger>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function Busy({ progress }: { progress: ImportProgress }) {
  return (
    <Stack gap={3} data-testid="model-import-progress">
      <Text fontSize="sm">{progress.label}</Text>
      <Progress.Root value={progress.frac === undefined ? null : Math.round(progress.frac * 100)} colorPalette="wood" size="sm">
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      {progress.stage === "download" && (
        <Text fontSize="xs" color="fg.muted">
          El navegador no pot llegir el fitxer de Blender: es baixa el mateix model de Poly Haven en glTF (les textures que ja porta el zip no es tornen a baixar).
        </Text>
      )}
    </Stack>
  )
}

function Done({ state }: { state: Extract<State, { kind: "done" }> }) {
  const { model, choice, report } = state
  const bytes = choice.bytes ?? 0
  const notes = [
    model.source === "polyhaven" &&
      `El .blend no es pot llegir al navegador: s'ha baixat el mateix model de Poly Haven en glTF (${formatBytes(model.downloaded ?? 0)}; les textures del zip s'han aprofitat).`,
    model.source === "gltf" && "El glTF s'ha passat a un sol .glb amb les textures a dins.",
    model.source === "fbx" && "L'FBX s'ha passat a .glb (materials aproximats: revisa'l al 3D).",
    report.changed && `Optimitzat per al mòbil: ${formatReport(report)}.`,
    bytes > HEAVY_MODEL_BYTES && `Fa ${formatBytes(bytes)}: a l'iPhone pot anar lent o no carregar-se.`,
    model.missing.length > 0 && `Faltaven ${model.missing.slice(0, 5).join(", ")}${model.missing.length > 5 ? "…" : ""}: es veurà sense aquestes textures.`,
  ].filter((x): x is string => !!x)
  const fallbackTile = Math.max(...choice.size)
  return (
    <Stack gap={4}>
      <Alert.Root status={bytes > HEAVY_MODEL_BYTES || model.missing.length ? "warning" : "success"} size="sm">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Model «{choice.name}» afegit</Alert.Title>
          {notes.map((n) => (
            <Alert.Description key={n}>{n}</Alert.Description>
          ))}
        </Alert.Content>
      </Alert.Root>
      {model.textures.size > 0 && <TexturesToMaterials textures={model.textures} info={model.info} fallbackName={choice.name} defaultTile={textureTileMm(model.info ?? null, Math.min(5000, Math.max(50, Math.round(fallbackTile / 10) * 10)))} />}
    </Stack>
  )
}

function Failed({ state }: { state: Extract<State, { kind: "error" }> }) {
  const alt = ALTERNATIVES[state.reason] ?? []
  return (
    <Stack gap={4}>
      <Alert.Root status={state.reason === "texture-only" ? "info" : "error"} size="sm" data-testid="model-import-error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{state.reason === "texture-only" ? "No és un model 3D" : "No s'ha pogut importar el model"}</Alert.Title>
          <Alert.Description>{state.message}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      {alt.length > 0 && (
        <Stack gap={1.5} fontSize="sm" color="fg.muted" as="ul" ps={4} listStyleType="disc">
          {alt.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </Stack>
      )}
      {state.textures && <TexturesToMaterials textures={state.textures} info={state.info} fallbackName={state.name} defaultTile={textureTileMm(state.info ?? null, 1000)} />}
    </Stack>
  )
}

/** «Afegir les textures a Materials»: un material de Simulació per joc, amb la mida real triada. */
function TexturesToMaterials({ textures, info, fallbackName, defaultTile }: { textures: Map<string, Blob>; info?: PolyHavenInfo | null; fallbackName: string; defaultTile: number }) {
  const { settings, save, loading } = useSettings()
  const [tile, setTile] = useState(defaultTile)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const sets = groupTextureSets([...textures.keys()])
  if (!sets.length) return null
  const names = sets.map((s) => textureSetName(s.key, info, sets.length, fallbackName))
  const add = async () => {
    setBusy(true)
    try {
      const r = await materialsFromTextures(textures, { info, fallbackName, tileMm: tile, materials: settings.materials })
      if (r.added.length) await save({ ...settings, materials: [...r.added, ...settings.materials] })
      const skipped = r.skipped.length ? ` Sense foto de color (no s'han afegit): ${r.skipped.join(", ")}.` : ""
      setResult(
        r.added.length
          ? { ok: true, text: `Afegits a Preferències › Materials (Simulació): ${r.added.map((m) => `«${m.name}»`).join(", ")}.${skipped}` }
          : { ok: false, text: `Cap joc té foto de color.${skipped}` },
      )
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack gap={2} data-testid="model-import-textures">
      <SectionLabel>Textures</SectionLabel>
      <Text fontSize="sm" color="fg.muted">
        {sets.length === 1 ? `Un joc de textures: ${names[0]}.` : `${sets.length} jocs de textures: ${names.join(", ")}.`} En pots fer materials (foto amb relleu i brillantor) per a objectes i ambients.
      </Text>
      <NumRow label="Mida real" help="Amplada real d'una repetició de la textura." value={tile} min={50} max={5000} step={10} onChange={(v) => Number.isFinite(v) && v >= 50 && v <= 5000 && setTile(v)} />
      <Box>
        <Button size="sm" variant="outline" colorPalette="wood" loading={busy} disabled={loading || !!result?.ok} onClick={() => void add()}>
          <LuPalette /> Afegir les textures a Materials
        </Button>
      </Box>
      {result && (
        <Alert.Root status={result.ok ? "success" : "warning"} size="sm">
          <Alert.Indicator />
          <Alert.Description>{result.text}</Alert.Description>
        </Alert.Root>
      )}
    </Stack>
  )
}
