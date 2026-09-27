import { Badge, Box, Button, Card, HStack, IconButton, Menu, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuArrowLeft, LuArrowRight, LuBox, LuCopy, LuPlus, LuTrash2 } from "react-icons/lu"
import {
  BUILTIN_TEMPLATES,
  defaultModule,
  moduleOrigins,
  newId,
  type Composition,
  type Module,
  type RefObject,
} from "../../core/model"
import { NumberField } from "../editor/ParamsForm"

/** Franja de mòduls (d'esquerra a dreta) i objectes de referència. */
export function ModuleStrip({
  comp,
  selectedId,
  onSelect,
  onChange,
}: {
  comp: Composition
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (c: Composition) => void
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
                  <Text fontWeight="semibold" truncate>
                    {i + 1}. {m.name}
                  </Text>
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
                <Menu.Item value="empty" onClick={() => addModule(defaultModule(newId("m"), `Mòdul ${comp.modules.length + 1}`))}>
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

      <ReferencesEditor comp={comp} onChange={onChange} />
    </Stack>
  )
}

function ReferencesEditor({ comp, onChange }: { comp: Composition; onChange: (c: Composition) => void }) {
  const update = (i: number, patch: Partial<RefObject>) =>
    onChange({ ...comp, references: comp.references.map((o, k) => (k === i ? { ...o, ...patch } : o)) })
  const remove = (i: number) => onChange({ ...comp, references: comp.references.filter((_, k) => k !== i) })
  const add = () =>
    onChange({ ...comp, references: [...comp.references, { id: newId("r"), name: "Objecte", w: 600, h: 600, d: 100, x: 0, y: 0, z: 0 }] })

  return (
    <Stack gap={2}>
      <HStack justify="space-between">
        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
          Objectes de referència (fantasma)
        </Text>
        <Button size="xs" variant="ghost" onClick={add}>
          <LuPlus /> Afegir
        </Button>
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
              <IconButton aria-label="Eliminar objecte" size="xs" variant="ghost" colorPalette="red" onClick={() => remove(i)}>
                <LuTrash2 />
              </IconButton>
            </HStack>
            <SimpleGrid columns={{ base: 3, md: 6 }} gap={2}>
              <NumberField label="Ample" value={o.w} min={1} max={5000} step={10} onChange={(w) => update(i, { w })} />
              <NumberField label="Alt" value={o.h} min={1} max={5000} step={10} onChange={(h) => update(i, { h })} />
              <NumberField label="Fondària" value={o.d} min={1} max={5000} step={10} onChange={(d) => update(i, { d })} />
              <NumberField label="X" value={o.x} min={-5000} max={10000} step={10} onChange={(x) => update(i, { x })} />
              <NumberField label="Y (alçada)" value={o.y} min={-5000} max={5000} step={10} onChange={(y) => update(i, { y })} />
              <NumberField label="Z (des del darrere)" value={o.z} min={-5000} max={5000} step={10} onChange={(z) => update(i, { z })} />
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  )
}
