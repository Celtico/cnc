import { Badge, Box, Button, Card, HStack, IconButton, Input, Menu, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuArrowLeft, LuArrowRight, LuBookmark, LuBox, LuCopy, LuPlus, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import {
  BUILTIN_TEMPLATES,
  canBeGhost,
  defaultModule,
  moduleOrigins,
  newId,
  visibleReferences,
  type Composition,
  type Module,
  type RefObject,
} from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"

/** Franja de mòduls (d'esquerra a dreta) i objectes de referència. */
export function ModuleStrip({
  comp,
  selectedId,
  onSelect,
  onChange,
  newModule = defaultModule,
}: {
  comp: Composition
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (c: Composition) => void
  /** Com es crea una caixa buida (amb les preferències de l'usuari aplicades). */
  newModule?: (id: string, name: string) => Module
}) {
  const xs = moduleOrigins(comp)

  const addModule = (m: Module) => {
    onChange({ ...comp, modules: [...comp.modules, { ...m, gapBefore: comp.modules.length ? 0 : m.gapBefore }] })
    onSelect(m.id)
  }
  const duplicate = (i: number) => {
    const src = comp.modules[i]!
    const copy: Module = { ...structuredClone(src), id: newId("m"), name: `${src.name} (còpia)` }
    const modules = [...comp.modules]
    modules.splice(i + 1, 0, copy)
    onChange({ ...comp, modules })
    onSelect(copy.id)
  }
  const remove = (i: number) => {
    if (comp.modules.length <= 1) return
    const modules = comp.modules.filter((_, k) => k !== i)
    onChange({ ...comp, modules })
    onSelect(modules[Math.max(0, i - 1)]!.id)
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= comp.modules.length) return
    const modules = [...comp.modules]
    ;[modules[i], modules[j]] = [modules[j]!, modules[i]!]
    onChange({ ...comp, modules })
  }
  const rename = (i: number, name: string) => {
    onChange({ ...comp, modules: comp.modules.map((m, k) => (k === i ? { ...m, name } : m)) })
  }
  const setGap = (i: number, gapBefore: number) => {
    const modules = comp.modules.map((m, k) => (k === i ? { ...m, gapBefore } : m))
    onChange({ ...comp, modules })
  }

  return (
    <Stack gap={3}>
      <HStack overflowX="auto" py={1} gap={2} align="stretch">
        {comp.modules.map((m, i) => {
          const selected = m.id === selectedId
          return (
            <Card.Root
              key={m.id}
              variant={selected ? "elevated" : "outline"}
              size="sm"
              minW="180px"
              cursor="pointer"
              borderColor={selected ? "wood.solid" : undefined}
              onClick={() => onSelect(m.id)}
            >
              <Card.Body gap={1} p={3}>
                <HStack justify="space-between">
                  {selected ? (
                    <HStack gap={1} flex={1} minW={0} onClick={(e) => e.stopPropagation()}>
                      <Text fontWeight="semibold">{i + 1}.</Text>
                      <Input
                        size="xs"
                        variant="flushed"
                        fontWeight="semibold"
                        aria-label="Nom del mòdul"
                        value={m.name}
                        onChange={(e) => rename(i, e.target.value)}
                      />
                    </HStack>
                  ) : (
                    <Text fontWeight="semibold" truncate>
                      {i + 1}. {m.name}
                    </Text>
                  )}
                  <Badge variant="subtle" size="sm">
                    x {xs[i]}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                  {m.carcass.width} × {m.carcass.height} × {m.carcass.depth}
                </Text>
                {selected && (
                  <HStack gap={1} pt={1} onClick={(e) => e.stopPropagation()}>
                    <IconButton aria-label="Moure a l'esquerra" size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                      <LuArrowLeft />
                    </IconButton>
                    <IconButton aria-label="Moure a la dreta" size="xs" variant="ghost" disabled={i === comp.modules.length - 1} onClick={() => move(i, 1)}>
                      <LuArrowRight />
                    </IconButton>
                    <IconButton aria-label="Duplicar mòdul" size="xs" variant="ghost" onClick={() => duplicate(i)}>
                      <LuCopy />
                    </IconButton>
                    <IconButton aria-label="Eliminar mòdul" size="xs" variant="ghost" colorPalette="red" disabled={comp.modules.length <= 1} onClick={() => remove(i)}>
                      <LuTrash2 />
                    </IconButton>
                  </HStack>
                )}
                {selected && i > 0 && (
                  <Box onClick={(e) => e.stopPropagation()}>
                    <NumberField label="Separació amb l'anterior" value={m.gapBefore} min={0} max={2000} step={10} onChange={(g) => setGap(i, g)} />
                  </Box>
                )}
              </Card.Body>
            </Card.Root>
          )
        })}
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="outline" minW="120px" h="auto" alignSelf="stretch">
              <LuPlus /> Afegir mòdul
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="empty" onClick={() => addModule(newModule(newId("m"), `Mòdul ${comp.modules.length + 1}`))}>
                  <LuBox /> Caixa buida
                </Menu.Item>
                {BUILTIN_TEMPLATES.filter((t) => t.make().modules.length === 1).map((t) => (
                  <Menu.Item key={t.id} value={t.id} onClick={() => addModule(t.make().modules[0]!)}>
                    {t.name}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

    </Stack>
  )
}

export function ReferencesEditor({ comp, onChange }: { comp: Composition; onChange: (c: Composition) => void }) {
  const { settings, save } = useSettings()
  const presets = visibleReferences(settings)
  const update = (i: number, patch: Partial<RefObject>) =>
    onChange({ ...comp, references: comp.references.map((o, k) => (k === i ? { ...o, ...patch } : o)) })
  const remove = (i: number) => onChange({ ...comp, references: comp.references.filter((_, k) => k !== i) })
  const add = (o: Omit<RefObject, "id" | "x" | "y" | "z"> & Partial<Pick<RefObject, "z">>) =>
    onChange({ ...comp, references: [...comp.references, { id: newId("r"), x: 0, y: 0, z: 0, ...o }] })
  /** Desa l'objecte a la llista de preferències (foto i editor), p. ex. "Radiador menjador". */
  const saveAsPreset = (o: RefObject) => {
    void save({ ...settings, references: [{ id: newId("ref"), name: o.name, w: o.w, h: o.h, d: o.d, plane: "wall", wallOffset: Math.max(0, o.z) }, ...settings.references] })
    toaster.create({ title: `«${o.name}» desat a les preferències`, type: "success" })
  }

  return (
    <Stack gap={2}>
      <HStack justify="space-between" align="flex-start">
        <Text fontSize="sm" color="fg.muted">
          Objectes que no formen part del moble (radiador, tele...) i es veuen translúcids per comprovar que tot hi cap.
        </Text>
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="xs" variant="ghost">
              <LuPlus /> Afegir
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxH="60vh" overflowY="auto">
                <Menu.Item value="custom" onClick={() => add({ name: "Objecte", w: 600, h: 600, d: 100 })}>
                  Objecte a mida
                </Menu.Item>
                {presets.filter(canBeGhost).length > 0 && <Menu.Separator />}
                {presets.filter(canBeGhost).map((r) => (
                  <Menu.Item key={r.id} value={r.id} onClick={() => add({ name: r.name, w: r.w, h: r.h, d: r.d!, z: r.wallOffset })}>
                    <Stack gap={0}>
                      <Text>{r.name}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {r.w} × {r.h} × {r.d}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
                {presets.some((r) => !canBeGhost(r)) && (
                  <Text fontSize="xs" color="fg.muted" px={3} py={2}>
                    Les referències sense fondària (A4, rajoles) només serveixen per a la foto.
                  </Text>
                )}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
      {comp.references.map((o, i) => (
        <Card.Root key={o.id} variant="subtle" size="sm">
          <Card.Body p={3} gap={2}>
            <HStack justify="space-between">
              <Box asChild flex={1}>
                <input
                  value={o.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  style={{ background: "transparent", border: "none", outline: "none", fontWeight: 600, fontSize: 16, color: "inherit", width: "100%" }}
                />
              </Box>
              <IconButton aria-label="Desar a les preferències" title="Desar a les preferències" size="xs" variant="ghost" onClick={() => saveAsPreset(o)}>
                <LuBookmark />
              </IconButton>
              <IconButton aria-label="Eliminar objecte" size="xs" variant="ghost" colorPalette="red" onClick={() => remove(i)}>
                <LuTrash2 />
              </IconButton>
            </HStack>
            <SimpleGrid columns={3} gap={2}>
              <NumberField label="Ample" value={o.w} min={1} max={5000} step={10} onChange={(w) => update(i, { w })} />
              <NumberField label="Alt" value={o.h} min={1} max={5000} step={10} onChange={(h) => update(i, { h })} />
              <NumberField label="Fondària" value={o.d} min={1} max={5000} step={10} onChange={(d) => update(i, { d })} />
              <NumberField label="X" value={o.x} min={-5000} max={10000} step={10} onChange={(x) => update(i, { x })} />
              <NumberField label="Y" value={o.y} min={-5000} max={5000} step={10} onChange={(y) => update(i, { y })} />
              <NumberField label="Z" value={o.z} min={-5000} max={5000} step={10} onChange={(z) => update(i, { z })} />
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  )
}
