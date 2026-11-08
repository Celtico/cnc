import { Button, Stack, Switch, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { LuDownload, LuSave } from "react-icons/lu"
import { FloatingWindow } from "../../components/FloatingWindow"
import { toaster } from "../../components/ui/toaster"
import { ambientFileName } from "../../core/file/ambientFile"
import { mobleFileName } from "../../core/file/mobleFile"
import type { Project } from "../../db/db"
import { useSettings } from "../settings/SettingsContext"
import { ambientBlob, ambientToFile, saveAmbientAsFile } from "./ambientIo"
import { mobleBlob, projectToMoble, saveProjectAsFile, shareOrDownload } from "./mobleIo"
import { readComposition } from "../../db/compositionStore"
import { toTaulell } from "../../core/export/taulellExport"

type Saved = { filename: string; bytes: number; how: "shared" | "downloaded" }
/** Mida del fitxer amb (o sense) les fotos, avisos i si n'hi ha cap per incloure (sense, l'interruptor es desactiva). */
type Measured = { bytes: number; notes?: string[]; hasPhoto: boolean }

/**
 * La finestra «Desar com a fitxer» comuna (`.moble` i `.ambient`): explicació, interruptor de les fotos, mida en viu i avisos.
 * `measure` construeix el fitxer per saber-ne la mida (es torna a fer en canviar l'interruptor); `save` el desa.
 */
function SaveAsFileDialog({
  open,
  onClose,
  name,
  intro,
  photoLabel,
  noPhotoLabel,
  photoDefault,
  measure,
  save,
  extra,
}: {
  open: boolean
  onClose: () => void
  name: string
  intro: ReactNode
  photoLabel: string
  noPhotoLabel: string
  photoDefault: boolean
  measure: ((includePhoto: boolean) => Promise<Measured>) | null
  save: (includePhoto: boolean) => Promise<Saved>
  /** Un altre format, a l'esquerra del peu (el `.taulell` del moble). */
  extra?: ReactNode
}) {
  const [includePhoto, setIncludePhoto] = useState(photoDefault)
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !measure) return
    let alive = true
    setMeasured(null)
    setError(null)
    measure(includePhoto).then(
      (m) => {
        if (alive) setMeasured(m)
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      },
    )
    return () => {
      alive = false
    }
  }, [open, measure, includePhoto])

  const hasPhoto = measured?.hasPhoto ?? false
  const doSave = async () => {
    setBusy(true)
    try {
      const r = await save(includePhoto && hasPhoto)
      toaster.create({ title: r.how === "shared" ? "Fitxer compartit" : "Fitxer desat", description: `${r.filename} · ${fmtBytes(r.bytes)}`, type: "success" })
      onClose()
    } catch (e) {
      toaster.create({ title: "No s'ha pogut desar el fitxer", description: e instanceof Error ? e.message : String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <FloatingWindow
      id="save-file"
      open={open}
      onClose={onClose}
      title={`Desar «${name}» com a fitxer`}
      width={520}
      height={380}
      footer={
        <>
          {extra}
          <Button variant="outline" onClick={onClose}>
            Cancel·lar
          </Button>
          <Button colorPalette="wood" onClick={() => void doSave()} loading={busy} disabled={!!error || measured === null}>
            <LuSave /> Desar
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        <Text fontSize="sm" color="fg.muted">
          {intro}
        </Text>
        <Switch.Root size="sm" checked={includePhoto && hasPhoto} disabled={!hasPhoto} onCheckedChange={(e) => setIncludePhoto(e.checked)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>
            {photoLabel}
            {measured && !hasPhoto ? ` (${noPhotoLabel})` : ""}
          </Switch.Label>
        </Switch.Root>
        {error ? (
          <Text fontSize="sm" color="fg.error">
            {error}
          </Text>
        ) : (
          <Text fontSize="sm">Mida del fitxer: {measured === null ? "calculant…" : fmtBytes(measured.bytes)}</Text>
        )}
        {measured?.notes?.map((n) => (
          <Text key={n} fontSize="sm" color="fg.warning">
            {n}
          </Text>
        ))}
      </Stack>
    </FloatingWindow>
  )
}

/** «Desar com a fitxer» d'un moble o objecte (`.moble`): tria si s'inclou la foto i mostra la mida resultant. */
export function SaveFileDialog({ project, open, onClose }: { project: Project | null; open: boolean; onClose: () => void }) {
  const { settings } = useSettings()
  // Una funció nova per moble i preferències (la mida es torna a calcular).
  const measure = useMemo(() => (project ? async (photo: boolean): Promise<Measured> => ({ bytes: mobleBlob(await projectToMoble(project, settings, photo && !!project.photo)).size, hasPhoto: !!project.photo }) : null), [project, settings])
  return (
    <SaveAsFileDialog
      open={open}
      onClose={onClose}
      name={project?.name ?? ""}
      intro={`Fitxer ${project ? mobleFileName(project.name) : ""}: composició, nesting, calibratge de la foto i les referències que fa servir. Es pot obrir des de «Obrir fitxer» de Mobles o Objectes en aquest o en un altre dispositiu.`}
      photoLabel="Incloure la foto"
      noPhotoLabel="el moble no en té"
      photoDefault
      measure={measure}
      save={(photo) => (project ? saveProjectAsFile(project, settings, photo) : Promise.reject(new Error("Cap moble")))}
      extra={project && <TaulellButton project={project} />}
    />
  )
}

/**
 * «Baixa .taulell» (cel, 2026-11-08: «obro una cuina i l'exporto a un taulell»): el moble com a projecte del Taulell 3D, que
 * s'obre amb «Projectes › Obre fitxer…». Cada peça hi va com a peça solta (`toTaulell`).
 */
function TaulellButton({ project }: { project: Project }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const read = readComposition(project)
      if (read.unreadable) throw new Error("La composició desada no es pot llegir.")
      const { doc, skipped } = toTaulell(read.composition, project.name)
      const filename = `${mobleFileName(project.name).replace(/\.moble$/i, "")}.taulell`
      const how = await shareOrDownload(new Blob([JSON.stringify(doc)], { type: "application/json" }), filename)
      const left = [skipped.cutouts && `${skipped.cutouts} talls passants`, skipped.pockets && `${skipped.pockets} buidats`, skipped.mitres && `${skipped.mitres} peces a inglet (hi van rectes)`].filter(Boolean)
      toaster.create({
        title: how === "shared" ? "Fitxer compartit" : "Fitxer desat",
        description: `${filename}: ${doc.parts.length} peces. Al Taulell, Projectes › Obre fitxer….${left.length ? ` No hi van: ${left.join(", ")}.` : ""}`,
        type: "success",
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut baixar el .taulell", description: e instanceof Error ? e.message : String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="ghost" mr="auto" onClick={() => void run()} loading={busy}>
      <LuDownload /> Baixa .taulell
    </Button>
  )
}

/** «Desar com a fitxer» d'un ambient (`.ambient`): l'ambient amb una còpia dels seus mobles i objectes. */
export function SaveAmbientFileDialog({ ambientId, name, open, onClose }: { ambientId: number | null; name: string; open: boolean; onClose: () => void }) {
  const { settings } = useSettings()
  const measure = useMemo(
    () =>
      ambientId === null
        ? null
        : async (photo: boolean): Promise<Measured> => {
            const r = await ambientToFile(ambientId, settings, photo)
            return { bytes: ambientBlob(r.file).size, notes: r.notes, hasPhoto: r.hasPhotos }
          },
    [ambientId, settings],
  )
  return (
    <SaveAsFileDialog
      open={open}
      onClose={onClose}
      name={name}
      intro={`Fitxer ${ambientFileName(name)}: l'ambient (parets, elements, grups, plànol de fons, materials, càmera i render) amb una còpia dels seus mobles i objectes i els models 3D que fan servir. Es pot obrir des de qualsevol «Obrir fitxer» (Mobles, Objectes o Ambients), en aquest o en un altre dispositiu: l'app sap que és un ambient i en crea un de nou amb còpies dels mobles.`}
      photoLabel="Incloure les fotos dels mobles"
      noPhotoLabel="cap moble en té"
      photoDefault={false}
      measure={measure}
      save={(photo) => (ambientId === null ? Promise.reject(new Error("Cap ambient")) : saveAmbientAsFile(ambientId, settings, photo))}
    />
  )
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
