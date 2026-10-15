import { Box, Splitter, type SplitterRootProps } from "@chakra-ui/react"
import { useRef } from "react"
import { splitterPanels, splitterSizes, widthUpdates, type SplitPanelSpec } from "./splitSizes"

/**
 * Panells amb vores arrossegables, sobre el **`Splitter` de Chakra** (per decisió de l'usuari, 2026-10-15: «si Chakra ja
 * ho té, no es reinventa la roda»). Aquest component només el configura: els laterals tenen l'amplada en px que es recorda
 * (`panels[].width`, la mateixa clau de sempre), el mínim i el màxim, i es pleguen (`hidden`); el panell sense `width` es
 * queda la resta. Arrossegar, el teclat (fletxes, Inici/Fi, Retorn plega) i el cursor són del Splitter.
 *
 * Per sota de `from` (el mòbil) no hi ha vores: els panells van en columna amb la seva alçada (es treuen els estils en
 * línia del Splitter) i cada pantalla tria què ensenya amb `display` i `order`.
 *
 * Els fills són `Splitter.Panel` (amb `id` com els de `panels`) i `SplitHandle` entre ells.
 */
export function PanelSplit({ panels, from = "md", children, ...rest }: { panels: SplitPanelSpec[]; from?: "md" | "lg" } & Omit<SplitterRootProps, "panels" | "size" | "onResize">) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <Splitter.Root
      ref={root}
      panels={splitterPanels(panels)}
      size={splitterSizes(panels)}
      onResize={(e) => {
        const groupPx = root.current?.getBoundingClientRect().width ?? 0
        for (const u of widthUpdates(panels, e.size, groupPx, e.resizeTriggerId)) {
          if (u.width === null) u.panel.onHide?.()
          else u.panel.setWidth?.(u.width)
        }
      }}
      css={{
        [`${from}Down`]: {
          flexDirection: "column !important",
          height: "auto !important",
          overflow: "visible !important",
          "& > [data-part=panel]": { flex: "1 1 auto !important", overflow: "visible !important", minWidth: "0 !important", maxWidth: "none !important" },
          "& > [data-part=resize-trigger]": { display: "none !important" },
        },
      }}
      {...rest}
    >
      {children}
    </Splitter.Root>
  )
}

/**
 * La vora entre dos panells (`id` = «esquerra:dreta», els `id` dels panells). L'aspecte és el de sempre (com el separador
 * de l'app de Claude): una nansa curta al mig i, en passar-hi per sobre, tota la vora s'il·lumina amb el color principal.
 * `quiet`: sense nansa a la vista (només amb el ratolí a sobre). Doble clic: `onReset` (l'amplada per defecte). `hidden`:
 * el panell del costat és plegat i la vora no hi és.
 */
export function SplitHandle({ id, label, onReset, quiet = false, hidden = false }: { id: `${string}:${string}`; label: string; onReset: () => void; quiet?: boolean; hidden?: boolean }) {
  if (hidden) return null
  return (
    <Splitter.ResizeTrigger
      id={id}
      unstyled
      aria-label={label}
      title="Arrossega per canviar l'amplada · doble clic per restaurar"
      onDoubleClick={onReset}
      display="flex"
      alignSelf="stretch"
      justifyContent="center"
      alignItems="center"
      position="relative"
      w="12px"
      mx="-6px"
      zIndex={2}
      outline="none"
      css={{
        "& > .rh-line": { transition: "background 0.15s", background: "transparent" },
        "& > .rh-grip": { transition: "background 0.15s, height 0.15s" },
        "&:hover > .rh-line, &:focus-visible > .rh-line, &[data-dragging] > .rh-line": { background: "var(--chakra-colors-wood-solid)" },
        "&:hover > .rh-grip, &:focus-visible > .rh-grip, &[data-dragging] > .rh-grip": { background: "var(--chakra-colors-wood-solid)", height: "48px" },
      }}
    >
      <Box className="rh-line" position="absolute" top={0} bottom={0} left="50%" w="2px" ml="-1px" rounded="full" />
      <Splitter.ResizeTriggerIndicator unstyled className="rh-grip" w="4px" h="36px" rounded="full" bg={quiet ? "transparent" : "border.emphasized"} />
    </Splitter.ResizeTrigger>
  )
}
