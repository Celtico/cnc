import { Badge, Box, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuPlus, LuX } from "react-icons/lu"
import type { MaterialPref } from "../../core/model"
import { PREVIEW_MM, previewStyle } from "./materialPreview"

/** Mostra gran del material a escala real (com el previsualitzador de materials de Blender o Figma). */
export function MaterialPreview({ m, w = 240, h = 150, caption = true }: { m: MaterialPref; w?: number; h?: number; caption?: boolean }) {
  return (
    <Stack gap={1} flexShrink={0}>
      <Box w={`${w}px`} maxW="100%" h={`${h}px`} rounded="md" borderWidth="1px" style={previewStyle(m, w)} backgroundRepeat="repeat" />
      {caption && (
        <Text fontSize="2xs" color="fg.subtle">
          Mostra de {PREVIEW_MM} × {Math.round((PREVIEW_MM * h) / w)} mm
        </Text>
      )}
    </Stack>
  )
}

/** Gruixos com a etiquetes (treure amb ×, afegir amb «+»), ordenats. */
export function ThicknessChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState("")
  const add = () => {
    const n = Number(text.replace(",", "."))
    if (Number.isFinite(n) && n >= 3 && n <= 60 && !value.includes(n)) onChange([...value, n].sort((a, b) => a - b))
    setText("")
  }
  return (
    <Stack gap={1}>
      <Text fontSize="sm" fontWeight="medium">
        Gruixos
      </Text>
      <HStack gap={1.5} wrap="wrap">
        {value.map((t) => (
          <Badge key={t} size="lg" variant="subtle" colorPalette="wood" pr={0.5}>
            {t} mm
            <IconButton aria-label={`Treure el gruix de ${t} mm`} size="2xs" variant="ghost" disabled={value.length <= 1} onClick={() => onChange(value.filter((x) => x !== t))}>
              <LuX />
            </IconButton>
          </Badge>
        ))}
        <HStack gap={0} as="form" onSubmit={(e) => (e.preventDefault(), add())}>
          <Input size="xs" w="72px" type="number" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="mm" aria-label="Gruix nou (mm)" />
          <IconButton type="submit" aria-label="Afegir el gruix" size="xs" variant="ghost" disabled={!text}>
            <LuPlus />
          </IconButton>
        </HStack>
      </HStack>
    </Stack>
  )
}
