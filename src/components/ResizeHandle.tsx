import { Box } from "@chakra-ui/react"
import { useRef, type KeyboardEvent, type PointerEvent } from "react"

interface ResizeHandleProps {
  /** Amplada actual del panell que es redimensiona (px). */
  width: number
  onWidth: (w: number) => void
  min: number
  max: number
  /** Amplada inicial, per al doble clic. */
  defaultWidth: number
  /** A quin costat de la vora queda el panell: arrossegar cap a fora l'eixampla. */
  panelSide: "left" | "right"
  label: string
  /** Breakpoint a partir del qual els panells van en fila i la vora es mostra. */
  from?: "md" | "lg"
}

/**
 * Vora arrossegable entre dos panells (només escriptori). Accessible: és un
 * `separator` amb focus, i les fletxes l'ajusten de 16 en 16 px.
 */
export function ResizeHandle({ width, onWidth, min, max, defaultWidth, panelSide, label, from = "md" }: ResizeHandleProps) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const clamp = (w: number) => Math.min(max, Math.max(min, w))
  const sign = panelSide === "left" ? 1 : -1

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, w: width }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    onWidth(clamp(start.current.w + sign * (e.clientX - start.current.x)))
  }
  const onPointerUp = () => {
    start.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16
    if (e.key === "ArrowLeft") onWidth(clamp(width - sign * step))
    else if (e.key === "ArrowRight") onWidth(clamp(width + sign * step))
    else if (e.key === "Home") onWidth(min)
    else if (e.key === "End") onWidth(max)
    else return
    e.preventDefault()
  }

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Arrossega per canviar l'amplada · doble clic per restaurar"
      display={{ base: "none", [from]: "flex" }}
      alignSelf="stretch"
      justifyContent="center"
      alignItems="center"
      position="relative"
      w="12px"
      mx="-6px"
      flexShrink={0}
      cursor="col-resize"
      touchAction="none"
      zIndex={2}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onWidth(defaultWidth)}
      onKeyDown={onKeyDown}
      // Com el separador de l'app de Claude: una nansa curta al mig; en passar-hi per sobre,
      // tota la vora s'il·lumina.
      css={{
        "& > .rh-line": { transition: "background 0.15s", background: "transparent" },
        "& > .rh-grip": { transition: "background 0.15s, height 0.15s" },
        "&:hover > .rh-line, &:focus-visible > .rh-line": { background: "var(--chakra-colors-wood-solid)" },
        "&:hover > .rh-grip, &:focus-visible > .rh-grip": { background: "var(--chakra-colors-wood-solid)", height: "48px" },
      }}
      _focusVisible={{ outline: "none" }}
    >
      <Box className="rh-line" position="absolute" top={0} bottom={0} left="50%" w="2px" ml="-1px" rounded="full" />
      <Box className="rh-grip" w="4px" h="36px" rounded="full" bg="border.emphasized" />
    </Box>
  )
}
