import { Badge, Box, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
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

/**
 * Mostra gran de capçalera (a tota l'amplada de la targeta), a escala real: l'amplada es mesura
 * i sempre representa `PREVIEW_MM` mm. A sota, a la dreta, la mida que es veu.
 */
export function MaterialHero({ m, h = 176, children }: { m: MaterialPref; h?: number; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <Box ref={ref} position="relative" h={`${h}px`} style={previewStyle(m, w)} backgroundRepeat="repeat" borderBottomWidth="1px">
      {children}
      <Text position="absolute" right={3} bottom={2.5} fontSize="2xs" fontWeight="medium" color="white" bg="blackAlpha.600" px={2} py={0.5} rounded="full" backdropFilter="blur(6px)">
        {PREVIEW_MM} × {Math.round((PREVIEW_MM * h) / w)} mm
      </Text>
    </Box>
  )
}

/** Miniatura de la llista (un tros de 300 mm, prou per veure'n la textura). */
export function MaterialThumb({ m, size = 36 }: { m: MaterialPref; size?: number }) {
  return <Box w={`${size}px`} h={`${size}px`} rounded="md" borderWidth="1px" borderColor="border.emphasized" flexShrink={0} style={previewStyle(m, size * 2)} backgroundRepeat="repeat" />
}

/** Gruixos com a etiquetes (treure amb ×, afegir amb «+»), ordenats. */
export function ThicknessChips({ value, onChange, label = true }: { value: number[]; onChange: (v: number[]) => void; label?: boolean }) {
  const [text, setText] = useState("")
  const add = () => {
    const n = Number(text.replace(",", "."))
    if (Number.isFinite(n) && n >= 3 && n <= 60 && !value.includes(n)) onChange([...value, n].sort((a, b) => a - b))
    setText("")
  }
  return (
    <Stack gap={1}>
      {label && (
        <Text fontSize="sm" fontWeight="medium">
          Gruixos
        </Text>
      )}
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
