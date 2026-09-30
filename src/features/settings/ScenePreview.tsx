import { Box, Text } from "@chakra-ui/react"
import { useMemo } from "react"
import { buildComposition } from "../../core/build/buildComposition"
import { TV_LIVING_ROOM, compositionHeight, compositionWidth, type Composition } from "../../core/model"
import { CabinetViewer } from "../../components/viewer/CabinetViewer"
import { useSettings } from "./SettingsContext"

/**
 * Vista prèvia en viu de l'escena de «Presentació». Mostra el moble obert (si n'hi ha) o
 * una plantilla de mostra, perquè es vegi com queda sense haver d'anar a l'editor.
 */
export function ScenePreview({ composition }: { composition?: Composition }) {
  const { settings } = useSettings()
  const comp = useMemo(() => composition ?? TV_LIVING_ROOM.make(), [composition])
  const data = useMemo(() => {
    try {
      const panels = buildComposition(comp).panels
      const h = compositionHeight(comp)
      let d = 0
      for (const m of comp.modules) d = Math.max(d, m.carcass.depth + m.carcass.thickness)
      return { panels, size: { width: compositionWidth(comp), height: h, depth: d } }
    } catch {
      return null
    }
  }, [comp])
  if (!data) return null
  return (
    <Box>
      <Box aspectRatio={16 / 9} maxH="360px" w="full" rounded="md" overflow="hidden" borderWidth="1px" position="relative">
        <CabinetViewer panels={data.panels} size={data.size} exploded={false} showHoles={false} materials={settings.materials} quality="presentation" />
      </Box>
      <Text textStyle="xs" color="fg.muted" mt={1.5}>
        {composition ? "El moble obert, en mode Presentació." : "Moble de mostra, en mode Presentació."} Arrossega per girar-lo.
      </Text>
    </Box>
  )
}
