import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react"
import { LuExternalLink, LuImport } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import { fromTaulell, taulellMaterial, type TaulellDoc } from "../../core/import/taulell"
import { createProject, db } from "../../db/db"
import { publicUrl } from "../../lib/publicUrl"
import { useSettings } from "../settings/SettingsContext"

const TAULELL = "taulell/index.html"

/** Llegeix del navegador un JSON que el Taulell hi ha desat (és la mateixa adreça, i per tant el mateix navegador). */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Modelatge (cel, 2026-11-07): el Taulell 3D tal com és, dins del cnc, per dissenyar-hi mòduls a mà. «Porta a Mobles»
 * agafa el moble que hi ha obert i en fa un moble del cnc (`fromTaulell`): els seus mobles paramètrics passen a mòduls
 * del cnc i les peces soltes rectes, a peces lliures.
 */
export function ModelingScreen({ onOpen }: { onOpen: (id: number) => void }) {
  const { settings } = useSettings()
  const bring = async () => {
    const doc = readJson<TaulellDoc>("taulell3d-doc-v2")
    if (!doc || (!doc.cabs?.length && !doc.parts?.length)) {
      toaster.create({ title: "No hi ha cap moble al Modelatge", description: "Fes-ne un (o posa'n un del Catàleg) i torna-ho a provar.", type: "info" })
      return
    }
    const names = settings.materials.map((m) => m.name)
    const fallback = settings.defaults.material
    const userMats = readJson<{ k?: string; n?: string }[]>("taulell3d-mats") ?? []
    const r = fromTaulell(doc, (k) => taulellMaterial(k, names, fallback, userMats))
    const existing = (await db.projects.toArray()).map((p) => p.name)
    const id = await createProject(uniqueName(r.name, existing), undefined, { composition: r.composition })
    const left = [r.skipped.shapes ? `${r.skipped.shapes} peces amb forma o girades` : "", r.skipped.feats ? `${r.skipped.feats} mecanitzats de peces soltes` : ""].filter(Boolean)
    toaster.create({
      title: `«${r.name}» és a Mobles`,
      description: `${r.modules} ${r.modules === 1 ? "mòdul" : "mòduls"} i ${r.parts} ${r.parts === 1 ? "peça lliure" : "peces lliures"}.${left.length ? ` Encara no es passen: ${left.join(" i ")}.` : ""}`,
      type: "success",
    })
    onOpen(id)
  }
  return (
    <Stack gap={3} height={{ base: "calc(100dvh - 140px)", md: "calc(100dvh - 48px)" }}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Stack gap={0}>
          <Text fontSize="xl" fontWeight="semibold">
            Modelatge
          </Text>
          <Text fontSize="sm" color="fg.muted">
            El Taulell 3D dins del cnc: dissenya el mòdul a mà i porta'l a Mobles, on els mobles paramètrics passen a mòduls del cnc.
          </Text>
        </Stack>
        <HStack gap={2}>
          <Button size="sm" variant="ghost" asChild>
            <a href={publicUrl(TAULELL)} target="_blank" rel="noreferrer">
              <LuExternalLink /> Obre a part
            </a>
          </Button>
          <Button size="sm" colorPalette="wood" onClick={() => void bring()}>
            <LuImport /> Porta a Mobles
          </Button>
        </HStack>
      </HStack>
      <Box flex={1} minH="420px" borderWidth="1px" borderRadius="md" overflow="hidden">
        <iframe title="Taulell 3D" src={publicUrl(TAULELL)} style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
      </Box>
    </Stack>
  )
}
