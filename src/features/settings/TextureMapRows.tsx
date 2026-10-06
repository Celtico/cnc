import { Box, Button, HStack, Image, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuFileUp, LuFolderOpen, LuImagePlus, LuTrash2 } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"
import { toaster } from "../../components/ui/toaster"
import type { Finish } from "../../core/model"
import { classifyTextureFile } from "../../core/photo/pbrMaps"
import { pickedFromDrop, type PickedFile } from "./machineImport"
import { encodeMap, pickFiles, srcBlob, textureSetSummary, withTextureSet, type ImageFinish } from "./textureImport"
import { readPickedTextureSet } from "./textureMaterials"

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const imgUrl = (src: string) => (src.startsWith("data:") ? src : `${import.meta.env.BASE_URL}${src}`)

/** Miniatura d'un mapa o de la foto de color (o el requadre buit). */
export function MapThumb({ src, label }: { src?: string; label: string }) {
  return (
    <Box w="56px" h="56px" flexShrink={0} rounded="md" borderWidth="1px" overflow="hidden" bg="bg.subtle" data-testid={`map-thumb-${label}`} data-filled={src ? "true" : "false"}>
      {src && <Image src={imgUrl(src)} alt={label} w="full" h="full" objectFit="cover" />}
    </Box>
  )
}

/** Un mapa amb la miniatura, «Posar…» o «Canviar» i «Treure». */
function MapPicker({ title, src, busy, onPick, onRemove }: { title: string; src?: string; busy: boolean; onPick: () => void; onRemove: () => void }) {
  return (
    <HStack gap={3} align="center">
      <MapThumb src={src} label={title} />
      <Stack gap={1} minW={0}>
        <Text fontSize="sm">
          {title}
        </Text>
        <HStack gap={1.5} wrap="wrap">
          <Button size="xs" variant="outline" loading={busy} onClick={onPick} aria-label={src ? `Canviar el ${title.toLowerCase()}` : `Posar un ${title.toLowerCase()}`}>
            <LuImagePlus /> {src ? "Canviar" : "Posar"}
          </Button>
          {src && (
            <Button size="xs" variant="ghost" colorPalette="red" onClick={onRemove} aria-label={`Treure el ${title.toLowerCase()}`}>
              <LuTrash2 /> Treure
            </Button>
          )}
        </HStack>
      </Stack>
    </HStack>
  )
}

/**
 * Mapes PBR d'un material de foto (com els jocs de Poly Haven): relleu (normal, OpenGL; «Invertir el verd» per als
 * DirectX, aplicat en carregar-lo) i brillantor (rugositat, en grisos).
 */
export function TextureMapRows({ finish, onChange }: { finish: ImageFinish; onChange: (f: ImageFinish) => void }) {
  const [busy, setBusy] = useState<"normal" | "rough" | "flip" | null>(null)
  const run = async (which: "normal" | "rough" | "flip", f: () => Promise<void>) => {
    setBusy(which)
    try {
      await f()
    } catch (e) {
      toaster.create({ title: "No s'ha pogut llegir la imatge", description: errText(e), type: "error", duration: 8000 })
    } finally {
      setBusy(null)
    }
  }
  // Primer es tria (cancel·lar no deixa el botó carregant) i després es llegeix.
  const pickNormal = () =>
    void pickFiles({ accept: "image/*" }).then(([p]) => p && run("normal", async () => {
      const dx = classifyTextureFile(p.path)?.directX ?? !!finish.normalDx
      const m = await encodeMap(p.file, "normal", { flip: dx })
      const next: ImageFinish = { ...finish, normalMap: m.src }
      if (dx) next.normalDx = true
      else delete next.normalDx
      onChange(next)
    }))
  const pickRough = () =>
    void pickFiles({ accept: "image/*" }).then(([p]) => p && run("rough", async () => {
      const c = classifyTextureFile(p.path)
      const m = await encodeMap(p.file, "rough", c?.channel ? { channel: c.channel } : {})
      onChange({ ...finish, roughMap: m.src })
    }))
  const setFlip = (on: boolean) =>
    void run("flip", async () => {
      const next: ImageFinish = { ...finish }
      if (on) next.normalDx = true
      else delete next.normalDx
      // El desat ja és OpenGL: canviar de convenció torna a invertir el verd del que hi ha.
      if (finish.normalMap) next.normalMap = (await encodeMap(await srcBlob(finish.normalMap), "normal", { flip: true })).src
      onChange(next)
    })
  const without = (key: "normalMap" | "roughMap") => {
    const next: ImageFinish = { ...finish }
    delete next[key]
    if (key === "normalMap") delete next.normalDx
    onChange(next)
  }
  return (
    <>
      <FormRow label="Relleu" help={<>Normal en format OpenGL (com Poly Haven); si és DirectX, activa «Invertir el verd».</>}>
        <Stack gap={2}>
          <MapPicker title="Mapa de relleu (normal)" src={finish.normalMap} busy={busy === "normal"} onPick={pickNormal} onRemove={() => without("normalMap")} />
          <Switch.Root size="sm" disabled={busy === "flip"} checked={!!finish.normalDx} onCheckedChange={(e) => setFlip(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Invertir el verd (DirectX)</Switch.Label>
          </Switch.Root>
        </Stack>
      </FormRow>
      <FormRow label="Brillantor" help="Rugositat en grisos (blanc = mat, negre = brillant); d'un ARM/ORM se'n fa servir el verd.">
        <MapPicker title="Mapa de brillantor (rugositat)" src={finish.roughMap} busy={busy === "rough"} onPick={pickRough} onRemove={() => without("roughMap")} />
      </FormRow>
    </>
  )
}

/**
 * «Carregar joc de textures…»: diversos fitxers, una carpeta o un .zip d'un cop (també deixant-los anar a sobre). Es
 * reconeixen pel nom (`planTextureSet`): color, relleu (normal, `_gl`/`_dx`) i brillantor (rugositat o ARM/ORM).
 */
export function TextureSetRow({ finish, onChange }: { finish: Finish; onChange: (f: ImageFinish) => void }) {
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const load = async (picked: PickedFile[]) => {
    if (!picked.length) return
    setBusy(true)
    try {
      const r = await readPickedTextureSet(picked, finish.kind === "image" && !!finish.normalDx)
      const set = r.set
      let next = withTextureSet(finish, set)
      // Un joc de Poly Haven sap la mida real d'una repetició (API): la d'abans era d'una altra foto.
      if (next && set.color && r.tileMm) next = { ...next, tileMm: r.tileMm }
      if (!next) {
        toaster.create({
          title: "No s'ha trobat el joc de textures",
          description: `${finish.kind === "image" || set.normal || set.rough ? "Falta la foto de color (diff, color, albedo…)." : "Cap fitxer té un nom de mapa (diff, nor, rough…)."}${set.ignored.length ? ` Fitxers: ${set.ignored.slice(0, 6).join(", ")}.` : ""}`,
          type: "warning",
          duration: 10000,
        })
        return
      }
      onChange(next)
      const size = set.color && r.tileMm ? ` Mida real ${r.tileMm} mm (Poly Haven).` : ""
      toaster.create({ title: "Joc de textures carregat", description: textureSetSummary(set) + size, type: set.ignored.length ? "info" : "success", duration: 8000 })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut carregar el joc de textures", description: errText(e), type: "error", duration: 8000 })
    } finally {
      setBusy(false)
    }
  }
  return (
    <FormRow label="Joc PBR" help="Color, relleu i brillantor d'un cop, com els de Poly Haven (el .zip tal com es baixa, en qualsevol format; també els EXR): fitxers, una carpeta o un .zip. Es reconeixen pel nom (diff/color/albedo, nor/normal amb _gl o _dx, rough o ARM); la resta (disp, ao…) no es fa servir.">
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor={dragOver ? "wood.solid" : "border"}
        bg={dragOver ? "wood.subtle" : "bg.subtle"}
        rounded="l2"
        p={2}
        data-testid="texture-set-drop"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void pickedFromDrop(e.dataTransfer).then(load)
        }}
      >
        <HStack gap={1.5} wrap="wrap">
          <Button size="xs" variant="outline" colorPalette="wood" loading={busy} onClick={() => void pickFiles({ multiple: true, accept: "image/*,.zip,.exr" }).then(load)}>
            <LuFileUp /> Carregar joc de textures…
          </Button>
          <Button size="xs" variant="ghost" disabled={busy} onClick={() => void pickFiles({ folder: true }).then(load)}>
            <LuFolderOpen /> Carpeta…
          </Button>
        </HStack>
      </Box>
    </FormRow>
  )
}
