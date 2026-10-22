import { Accordion, Badge, Box, HStack, Heading, Stack, Text, chakra, useAccordionContext, useAccordionItemContext, useAccordionStyles, type AccordionRootProps } from "@chakra-ui/react"
import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type TransitionEvent } from "react"
import type { IconType } from "react-icons"
import { LuChevronRight } from "react-icons/lu"
import { readSessionFlag, readSessionList, writeSessionFlag } from "./sessionState"
import { useFoldRequest } from "./foldOpen"
import { FoldContext, STATIC_VARIANTS, sectionKey, type FoldGroupState, type FoldVariant } from "./foldContext"
import { InlineWarningList } from "./inlineWarnings"
import { useFoldWarnings } from "./inlineWarningsContext"

/**
 * L'acordió de tota l'app (sobre `Accordion` de Chakra): un sol component per a les seccions dels inspectors, el
 * Render, la Foto, Exportar, les galeries, el calaix de materials, els taulells i les eines de la màquina.
 *
 * **Una sola oberta alhora, a tota l'app** (per decisió de l'usuari, 2026-10-14: «a tots els acordions el mateix»):
 * - **`FoldItem` sol** (sense `FoldGroup`): comença tancat (llevat de `defaultOpen`) i es recorda durant la sessió amb la
 *   clau `mobles:section:<id>`; en obrir-lo, es tanquen els altres sols del mateix nivell (els germans: els de l'arrel de
 *   la pantalla, o els de dins d'una mateixa secció, `SoloScope`). Les subseccions de dins d'una secció no la tanquen.
 * - **`FoldGroup`**: un `Accordion.Root` compartit; per defecte només una oberta (`multiple` per obrir-ne diverses; la
 *   cerca, `forceOpen`, n'obre les que calgui). L'estat és controlat
 *   (`value`/`onValueChange`), de la sessió (`storageKey`: una llista) o intern (`defaultValue`). `forceOpen` (p. ex. la
 *   cerca de les galeries) obre aquests i no deixa canviar res.
 *
 * El contingut només es munta en obrir-lo (`lazyMount`); les variants de formulari (`section`, `card`, `row`) el desmunten
 * quan s'acaba d'animar el tancament. **Totes s'obren i es tanquen amb animació** (`FoldContent`): una graella que passa
 * de `0fr` a `1fr` (200 ms, `ease`), sense mesurar l'alçada. El `Collapsible` de Chakra la mesurava en obrir i, si el
 * contingut arribava després (preferències que es carreguen, un portal), es quedava a 0; amb la graella, la fila sempre
 * fa l'alçada del contingut. Les variants de formulari només retallen mentre s'anima (després, `overflow: visible`).
 */
export function FoldGroup({
  variant = "section",
  size = "md",
  multiple = false,
  value,
  onValueChange,
  storageKey,
  defaultValue,
  forceOpen,
  className,
  children,
}: {
  variant?: FoldVariant
  size?: "sm" | "md"
  /** `false`: només un obert alhora (en obrir-ne un, es tanca l'altre). */
  multiple?: boolean
  value?: string[]
  onValueChange?: (value: string[]) => void
  /** Recorda els oberts durant la sessió (sessionStorage, una llista). */
  storageKey?: string
  /** Els oberts d'entrada (si no n'hi ha de desats). */
  defaultValue?: string[]
  /** Oberts a la força (la cerca): mentre hi és, no es pot plegar res. */
  forceOpen?: string[] | null
  className?: string
  children: ReactNode
}) {
  const [own, setOwn] = useState<string[]>(() => (storageKey ? readSessionList(storageKey) : null) ?? defaultValue ?? [])
  useEffect(() => {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(own))
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [storageKey, own])
  // Només una oberta (llevat de la cerca): d'una llista desada o donada de diverses, la primera.
  const raw = forceOpen ?? value ?? own
  const current = multiple || forceOpen ? raw : raw.slice(0, 1)
  const change = (next: string[]) => {
    if (forceOpen) return
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
  }
  return (
    <FoldContext.Provider value={{ variant, size }}>
      <Accordion.Root {...rootProps(variant, className)} multiple={multiple || !!forceOpen} value={current} onValueChange={(e) => change(e.value)}>
        {children}
      </Accordion.Root>
    </FoldContext.Provider>
  )
}

interface FoldItemProps {
  /** Valor dins del grup i, sol, la clau de la sessió (`mobles:section:<id>`). */
  id: string
  title: ReactNode
  /** Icona del catàleg (`react-icons/lu`): obligatòria a les seccions. */
  icon?: IconType
  /** Resum curt al costat del títol, en una insígnia (p. ex. el nombre de prestatges). */
  badge?: ReactNode
  /** Color de la insígnia (per defecte el color principal; `orange` per a avisos). */
  badgePalette?: string
  /** Nombre d'elements (galeries), en una insígnia grisa. */
  count?: number
  /** Línia a sota del títol, sempre (galeries: per a què serveix). */
  description?: ReactNode
  /** Línia a sota del títol quan és tancat (`card`: «de → fins a · gruix»). */
  summary?: ReactNode
  /** Botons al costat de la capçalera (mai a dins: un botó dins d'un botó no és vàlid). No pleguen. */
  actions?: ReactNode
  /** Capçalera feta per qui el fa servir (variant `row`: la fila de la taula). */
  header?: ReactNode
  /** Sol: si comença obert (per defecte, tancat; després es recorda el que triï l'usuari durant la sessió). */
  defaultOpen?: boolean
  /** Sol: `false` = no es recorda (cada vegada, `defaultOpen`). */
  persist?: boolean
  /** Sol: l'aspecte (dins d'un grup, el del grup). */
  variant?: FoldVariant
  /** Sol: `sm` per a les subseccions (dins d'una altra secció). */
  size?: "sm" | "md"
  /** A l'Editor, l'id de la secció al registre de les opcions en cascada (`core/model/options`; només el comprova el test). */
  optionId?: string
  children?: ReactNode
}

/** Un element plegable: dins d'un `FoldGroup` fa servir el seu acordió; sol, en fa un de propi (independent). */
export function FoldItem({ optionId: _optionId, ...rest }: FoldItemProps) {
  const group = useContext(FoldContext)
  // Els avisos que s'arreglen en aquesta secció (sense una opció pròpia), a dalt de tot del contingut.
  const warnings = useFoldWarnings(rest.id)
  const props = warnings.length ? { ...rest, children: <Stack gap={3}><InlineWarningList items={warnings} />{rest.children}</Stack> } : rest
  if (!group) return <SoloFold {...props} />
  return <FoldItemBody {...props} group={group} />
}

/**
 * Els `FoldItem` sols germans (el mateix `SoloScope`): quin és obert a cada nivell. Una botiga petita de mòdul (sense
 * React): obrir-ne un tanca els altres del mateix nivell, també si són de components diferents.
 */
const soloOpen = new Map<string, string | null>()
const soloListeners = new Set<() => void>()
const setSolo = (scope: string, id: string | null) => {
  soloOpen.set(scope, id)
  for (const l of soloListeners) l()
}
const subscribeSolo = (l: () => void) => {
  soloListeners.add(l)
  return () => soloListeners.delete(l)
}
/** El nivell dels `FoldItem` sols: l'arrel o el contingut d'una secció. */
const SoloScope = createContext("root")

function SoloFold(props: FoldItemProps) {
  const { id, defaultOpen = false, persist = true, variant = "section", size = "md" } = props
  const key = sectionKey(id)
  const scope = useContext(SoloScope)
  // D'entrada, l'obert desat (o `defaultOpen`) si cap germà ja ho és.
  const [init] = useState(() => {
    const want = (persist ? readSessionFlag(key) : null) ?? defaultOpen
    if (want && !soloOpen.get(scope)) soloOpen.set(scope, id)
    return true
  })
  void init
  // En desmuntar-se l'obert (una altra pantalla), el nivell queda lliure.
  useEffect(
    () => () => {
      if (soloOpen.get(scope) === id) soloOpen.delete(scope)
    },
    [scope, id],
  )
  const openId = useSyncExternalStore(subscribeSolo, () => soloOpen.get(scope) ?? null)
  const open = openId === id
  const setOpen = (next: boolean) => {
    if (next) {
      const prev = soloOpen.get(scope)
      if (prev && prev !== id && persist) writeSessionFlag(sectionKey(prev), false)
      setSolo(scope, id)
    } else if (open) setSolo(scope, null)
  }
  const group: FoldGroupState = { variant, size }
  return (
    <FoldContext.Provider value={group}>
      <Accordion.Root
        {...rootProps(variant)}
        value={open ? [id] : []}
        onValueChange={(e) => {
          const next = e.value.includes(id)
          setOpen(next)
          if (persist) writeSessionFlag(key, next)
        }}
      >
        <FoldItemBody {...props} group={group} />
      </Accordion.Root>
    </FoldContext.Provider>
  )
}

function rootProps(variant: FoldVariant, className?: string): AccordionRootProps {
  const cls = [variant === "gallery" ? "gallery-accordion" : variant === "nested" ? "inner-accordion" : undefined, className].filter(Boolean).join(" ")
  // `lazyMount` i el desmuntatge en tancar els fa `FoldContent` (no es fa servir l'`ItemContent` de Chakra).
  return {
    collapsible: true,
    variant: variant === "gallery" ? "enclosed" : "plain",
    className: cls || undefined,
    ...(variant === "card" ? { display: "flex", flexDirection: "column", gap: 3 } : {}),
  }
}

function FoldItemBody({ id, children, group, ...p }: FoldItemProps & { group: FoldGroupState }) {
  const { variant, size } = group
  const stat = STATIC_VARIANTS.has(variant)
  // Obrir des de fora (`openFolds`: un avís que porta on s'arregla): s'obre (sol o dins d'un grup, pel seu acordió) i, la
  // de més endins, es mostra i s'il·lumina un moment.
  const api = useAccordionContext()
  const req = useFoldRequest(id)
  useEffect(() => {
    if (!req) return
    if (!api.value.includes(id)) api.setValue([id])
    if (!req.last) return
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-fold-id="${CSS.escape(id)}"]`)
      if (!el) return
      el.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })
      el.setAttribute("data-flash", "")
      window.setTimeout(() => el.removeAttribute("data-flash"), 1800)
    }, FOLD_MS + 80)
    return () => window.clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- només amb una petició nova
  }, [req?.n])
  return (
    <Accordion.Item value={id} data-fold-id={id} {...itemStyle(variant)} css={FLASH}>
      <FoldHead {...p} id={id} variant={variant} size={size} />
      <FoldContent id={id} form={stat}>
        {/* Dins del contingut, un FoldItem sol torna a ser independent (no és del grup de fora). */}
        <FoldContext.Provider value={null}>
          <ScopeFor id={id}>
            <Accordion.ItemBody {...bodyStyle(variant)}>{wrapContent(variant, size, children)}</Accordion.ItemBody>
          </ScopeFor>
        </FoldContext.Provider>
      </FoldContent>
    </Accordion.Item>
  )
}

/** Les seccions soles de dins d'una secció són germanes entre elles (no de les de fora). */
function ScopeFor({ id, children }: { id: string; children: ReactNode }) {
  const uid = useId()
  return <SoloScope.Provider value={`${id}:${uid}`}>{children}</SoloScope.Provider>
}

/** Durada de l'animació d'obrir i tancar (la de les galeries de Chakra, `moderate`). */
const FOLD_MS = 200

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * El contingut d'un element, amb l'animació d'obrir i tancar. En lloc de l'`ItemContent` de Chakra (que mesura l'alçada),
 * una graella d'una fila: `grid-template-rows` passa de `0fr` a `1fr` i la fila fa sempre l'alçada del contingut, encara
 * que arribi tard o canviï amb la secció oberta. Porta els atributs de l'acordió (`role="region"`, `aria-labelledby`,
 * l'id de l'`aria-controls`, `data-part="item-content"`, `data-state`).
 * - `lazyMount`: el contingut es munta en obrir-lo per primer cop.
 * - `form` (`section`, `card`, `row`): es desmunta quan s'acaba de tancar i, obert i quiet, no retalla (`overflow:
 *   visible`). Les galeries el conserven tancat (amagat amb `visibility: hidden`: el tabulador no hi entra).
 * - `prefers-reduced-motion`: sense animació.
 */
function FoldContent({ id, form, children }: { id: string; form: boolean; children: ReactNode }) {
  const api = useAccordionContext()
  const { expanded } = useAccordionItemContext()
  const styles = useAccordionStyles()
  const { hidden: _hidden, ...region } = api.getItemContentProps({ value: id })
  const [present, setPresent] = useState(expanded)
  const [moving, setMoving] = useState(false)
  // Obrir o tancar: es munta el contingut (si cal) i comença l'animació. L'estat s'ajusta durant el render (sense
  // efecte): la graella ja era al DOM a `0fr` i el contingut hi entra al mateix commit que passa a `1fr`.
  const [seen, setSeen] = useState(expanded)
  if (seen !== expanded) {
    setSeen(expanded)
    const still = reducedMotion()
    if (expanded) setPresent(true)
    else if (still && form) setPresent(false)
    setMoving(!still)
  }
  const done = useRef(() => {})
  useEffect(() => {
    done.current = () => {
      setMoving(false)
      if (!expanded && form) setPresent(false)
    }
  })
  // Per si no arriba el `transitionend` (pestanya amagada, cap canvi d'alçada).
  useEffect(() => {
    if (!moving) return
    const t = window.setTimeout(() => done.current(), FOLD_MS + 150)
    return () => window.clearTimeout(t)
  }, [moving, expanded])
  const onEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === "grid-template-rows") done.current()
  }
  const clip = !expanded || moving || !form
  return (
    <chakra.div
      {...region}
      data-state={expanded ? "open" : "closed"}
      css={[
        styles.itemContent,
        {
          animation: "none",
          overflow: "visible",
          borderRadius: 0,
          display: "grid",
          // Una columna que no s'eixampla amb el contingut (una taula ampla es desplaça a dins, no estira la secció).
          gridTemplateColumns: "minmax(0, 1fr)",
          gridTemplateRows: "0fr",
          opacity: 0,
          visibility: "hidden",
          transition: `grid-template-rows ${FOLD_MS}ms ease, opacity ${FOLD_MS}ms ease, visibility 0s linear ${FOLD_MS}ms`,
          "&[data-state=open]": { gridTemplateRows: "1fr", opacity: 1, visibility: "visible", transition: `grid-template-rows ${FOLD_MS}ms ease, opacity ${FOLD_MS}ms ease, visibility 0s` },
          _motionReduce: { transition: "none !important" },
        },
      ]}
      onTransitionEnd={onEnd}
    >
      <Box className="fold-clip" minH={0} minW={0} overflow={clip ? "hidden" : "visible"}>
        {present && children}
      </Box>
    </chakra.div>
  )
}

/** Una secció oberta des d'un avís s'il·lumina un moment (`data-flash`). */
const FLASH = {
  transition: "background-color 600ms ease",
  "&[data-flash]": { bgColor: "orange.subtle", transition: "background-color 150ms ease" },
} as const

function itemStyle(variant: FoldVariant) {
  if (variant === "section") return { borderBottomWidth: "1px" }
  if (variant === "card") return { borderWidth: "1px", rounded: "md", _closed: { bg: "bg.subtle" } }
  return {}
}

function bodyStyle(variant: FoldVariant) {
  if (variant === "gallery") return {}
  if (variant === "nested") return { px: 0 }
  return { p: 0 }
}

function wrapContent(variant: FoldVariant, size: "sm" | "md", children: ReactNode) {
  if (variant === "section")
    return (
      <Stack gap={size === "sm" ? 3 : 4} pb={4}>
        {children}
      </Stack>
    )
  if (variant === "card")
    return (
      <Stack gap={3} px={3} pb={3} pt={1}>
        {children}
      </Stack>
    )
  if (variant === "row") return <Box borderTopWidth="1px">{children}</Box>
  return children
}

function FoldHead({ title, icon: Icon, badge, badgePalette = "wood", count, description, summary, actions, header, variant, size }: Omit<FoldItemProps, "children"> & { variant: FoldVariant; size: "sm" | "md" }) {
  const { expanded } = useAccordionItemContext()
  const hasBadge = badge !== undefined && badge !== null && badge !== ""

  if (variant === "row")
    return (
      <Accordion.ItemTrigger display="block" p={0} gap={0} rounded="none" textAlign="left" fontWeight="inherit" borderTopWidth="1px" css={{ "&[data-state=open]": { bg: "wood.subtle" }, "&:hover:not([data-state=open])": { bg: "bg.muted" } }}>
        {header}
      </Accordion.ItemTrigger>
    )

  if (variant === "section") {
    const sm = size === "sm"
    return (
      <HStack gap={1}>
        <Accordion.ItemTrigger flex={1} minW={0} justifyContent="space-between" px={0} py={sm ? 2 : 3} rounded="none" fontWeight="inherit" color={expanded ? "fg" : "fg.muted"} _hover={{ color: "fg" }}>
          <HStack gap={sm ? 2 : 2.5} minW={0}>
            {Icon && (
              <Box color={expanded ? "wood.fg" : "fg.muted"} fontSize={sm ? "sm" : "md"} display="inline-flex" flexShrink={0}>
                <Icon />
              </Box>
            )}
            <Heading size={sm ? "xs" : "sm"} truncate>
              {title}
            </Heading>
            {hasBadge && (
              <Badge size={sm ? "xs" : "sm"} variant="subtle" colorPalette={badgePalette} flexShrink={0}>
                {badge}
              </Badge>
            )}
          </HStack>
          <Accordion.ItemIndicator color="inherit" />
        </Accordion.ItemTrigger>
        {actions}
      </HStack>
    )
  }

  if (variant === "card") {
    const sm = size === "sm"
    return (
      <HStack gap={1} pl={2} pr={1} py={sm ? 1 : 1.5}>
        <Accordion.ItemTrigger flex={1} minW={0} gap={2} p={0} rounded="sm" fontWeight="inherit">
          <Box color="fg.muted" flexShrink={0} display="inline-flex" transition="rotate 0.2s" rotate={expanded ? "90deg" : undefined}>
            <LuChevronRight />
          </Box>
          {Icon && (
            <Box color="wood.fg" flexShrink={0} display="inline-flex">
              <Icon />
            </Box>
          )}
          <Stack gap={0} minW={0}>
            <Text fontWeight="semibold" fontSize="sm" truncate>
              {title}
            </Text>
            {!expanded && summary && (
              <Text fontSize="xs" color="fg.muted" truncate>
                {summary}
              </Text>
            )}
          </Stack>
        </Accordion.ItemTrigger>
        {actions}
      </HStack>
    )
  }

  // Galeries (`gallery`) i acordions de dins (`nested`): icona, nom i comptador, la fletxa a la dreta.
  const nested = variant === "nested"
  const trigger = (
    <Accordion.ItemTrigger
      {...(nested && !actions ? { className: "inner-head", borderBottomWidth: "1px" } : {})}
      {...(nested ? { rounded: "none", px: 0 } : {})}
      flex={actions ? 1 : undefined}
    >
      <Stack flex={1} gap={0.5} minW={0} textAlign="left">
        <HStack gap={2} minW={0}>
          {Icon && (
            <Box color="wood.fg" display="inline-flex" flexShrink={0}>
              <Icon />
            </Box>
          )}
          <Text fontWeight="semibold" fontSize="sm" truncate>
            {title}
          </Text>
          {count !== undefined && (
            <Badge size="xs" variant="subtle" colorPalette="gray" flexShrink={0}>
              {count}
            </Badge>
          )}
          {hasBadge && (
            <Badge size="xs" variant="subtle" colorPalette={badgePalette} flexShrink={0}>
              {badge}
            </Badge>
          )}
        </HStack>
        {description && (
          <Text fontSize="xs" color="fg.muted" fontWeight="normal">
            {description}
          </Text>
        )}
        {!expanded && summary && (
          <Text fontSize="xs" color="fg.muted" fontWeight="normal" truncate>
            {summary}
          </Text>
        )}
      </Stack>
      <Accordion.ItemIndicator />
    </Accordion.ItemTrigger>
  )
  if (!actions) return trigger
  return (
    <HStack className={nested ? "inner-head" : undefined} gap={1} borderBottomWidth={nested ? "1px" : undefined}>
      {trigger}
      {actions}
    </HStack>
  )
}
