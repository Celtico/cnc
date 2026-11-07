import { Box, Button, Checkbox, CloseButton, HStack, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { NumRow } from "../../components/NumRow"
import { boardChoices, isEmptyEdit, type MaterialPref, type Panel, type PieceEdit } from "../../core/model"
import { MaterialSelect } from "../settings/MaterialSelect"
import { machiningRows, withoutRow } from "./ModelingTree"
import { TaulellIcon } from "./TaulellIcon"

const mm = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
/** Els cantells de la peça: els dos llargs (de baix i de dalt) i els dos amples (esquerra i dreta). */
const EDGES: [keyof Panel["edges"], string][] = [
  ["bottom", "Llarg 1"],
  ["top", "Llarg 2"],
  ["left", "Ample 1"],
  ["right", "Ample 2"],
]

/**
 * Les propietats d'una peça d'un moble a Modelatge (com al Taulell, cel 2026-11-07): de quin moble és, que les mides i la
 * posició les porta el moble («Edita el moble» hi torna), i el material, els cantells i els mecanitzats, que es poden retocar
 * a mà. Els retocs (`Module.pieceEdits`) es conserven quan el moble es torna a fer.
 */
export function PieceInspector({
  panel,
  code,
  moduleName,
  onEditModule,
  edit,
  onEdit,
  materials,
}: {
  panel: Panel
  code: string
  moduleName: string
  onEditModule: () => void
  edit: PieceEdit | undefined
  onEdit: (e: PieceEdit | undefined) => void
  materials: MaterialPref[]
}) {
  const rows = machiningRows(panel)
  const set = (e: PieceEdit) => onEdit(isEmptyEdit(e) ? undefined : e)
  const [adding, setAdding] = useState(false)
  return (
    <Stack gap={4} fontSize="sm">
      <Box>
        <Text fontSize="xs" color="fg.muted">
          Peça de {moduleName}
        </Text>
        <HStack gap={2} mt={0.5}>
          <Text fontFamily="mono" fontSize="xs" color="fg.muted">
            {code}
          </Text>
          <Text fontWeight="semibold" fontSize="md">
            {panel.label}
          </Text>
        </HStack>
      </Box>
      <Box bg="bg.muted" rounded="md" p={3}>
        <Text color="fg.muted">
          Peça de <b>{moduleName}</b>. Les mides i la posició les porta el moble; els mecanitzats, cantells i material que hi afegeixis es conserven.
        </Text>
        <HStack mt={2} gap={2}>
          <Button size="xs" variant="outline" colorPalette="wood" onClick={onEditModule}>
            Edita el moble
          </Button>
          {edit && (
            <Button size="xs" variant="ghost" onClick={() => onEdit(undefined)}>
              Treu els retocs
            </Button>
          )}
        </HStack>
      </Box>
      <Stack gap={2}>
        <Field label="Mides" value={`${mm(panel.length)} × ${mm(panel.width)} × ${mm(panel.thickness)} mm`} />
        <MaterialSelect label="Material" materials={boardChoices(materials)} value={edit?.material ?? ""} emptyLabel={edit?.material ? "Com el moble" : `Com el moble (${panel.material})`} onChange={(v) => set({ ...edit, material: v || undefined })} />
      </Stack>
      <Box>
        <Heading>Cantells</Heading>
        <Stack gap={1}>
          {EDGES.map(([k, l]) => (
            <Checkbox.Root key={k} size="sm" checked={panel.edges[k]} colorPalette="wood" onCheckedChange={(e) => set({ ...edit, edges: { ...edit?.edges, [k]: !!e.checked } })}>
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>{l}</Checkbox.Label>
            </Checkbox.Root>
          ))}
        </Stack>
      </Box>
      <Box>
        <HStack justify="space-between" mb={1.5}>
          <Heading>Mecanitzats ({rows.length})</Heading>
          {!adding && (
            <Button size="2xs" variant="ghost" colorPalette="wood" onClick={() => setAdding(true)}>
              + Afegir
            </Button>
          )}
        </HStack>
        {adding && <AddMachining panel={panel} onCancel={() => setAdding(false)} onAdd={(e) => (set({ ...edit, ...e(edit ?? {}) }), setAdding(false))} />}
        {rows.length ? (
          <Stack gap={0.5}>
            {rows.map((r) => (
              <HStack key={r.key} gap={2}>
                <TaulellIcon name={r.icon} size="14px" />
                <Text flex={1}>{r.label}</Text>
                {(r.drop || r.hand) && <CloseButton size="2xs" aria-label={`Treure ${r.label}`} onClick={() => set(withoutRow(edit, r))} />}
              </HStack>
            ))}
          </Stack>
        ) : (
          <Text color="fg.muted">Cap.</Text>
        )}
        {edit?.drop?.length ? (
          <Button size="2xs" variant="ghost" mt={1} onClick={() => set({ ...edit, drop: undefined })}>
            Torna a posar els {edit.drop.length === 1 ? "mecanitzats trets" : `${edit.drop.length} grups de mecanitzats trets`}
          </Button>
        ) : null}
      </Box>
    </Stack>
  )
}

/** Afegir una perforació o una ranura a mà, a una cara de la peça (coordenades de la peça, des de la cantonada). */
function AddMachining({ panel, onAdd, onCancel }: { panel: Panel; onAdd: (f: (e: PieceEdit) => PieceEdit) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<"hole" | "groove">("hole")
  const [face, setFace] = useState<"A" | "B">("A")
  const [x, setX] = useState(Math.round(panel.length / 2))
  const [y, setY] = useState(Math.round(panel.width / 2))
  const [d, setD] = useState(8)
  const [depth, setDepth] = useState(12)
  const [w, setW] = useState(Math.round(panel.length / 2))
  const [h, setH] = useState(8)
  return (
    <Stack gap={2} borderWidth="1px" rounded="md" p={2.5} mb={2}>
      <HStack justify="space-between">
        <SegmentGroup.Root size="xs" value={kind} onValueChange={(e) => e.value && setKind(e.value as "hole" | "groove")}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "hole", label: "Perforació" }, { value: "groove", label: "Ranura" }]} />
        </SegmentGroup.Root>
        <SegmentGroup.Root size="xs" value={face} onValueChange={(e) => e.value && setFace(e.value as "A" | "B")}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "A", label: "Cara A" }, { value: "B", label: "Cara B" }]} />
        </SegmentGroup.Root>
      </HStack>
      <NumRow label={kind === "hole" ? "X (centre)" : "X (inici)"} value={x} min={0} max={panel.length} step={1} onChange={setX} />
      <NumRow label={kind === "hole" ? "Y (centre)" : "Y (inici)"} value={y} min={0} max={panel.width} step={1} onChange={setY} />
      {kind === "hole" ? (
        <NumRow label="Diàmetre" value={d} min={1} max={60} step={1} onChange={setD} />
      ) : (
        <>
          <NumRow label="Llargada" value={w} min={1} max={panel.length} step={1} onChange={setW} />
          <NumRow label="Amplada" value={h} min={1} max={panel.width} step={0.5} onChange={setH} />
        </>
      )}
      <NumRow label="Fondària" value={depth} min={0.5} max={panel.thickness} step={0.5} onChange={setDepth} />
      <HStack justify="flex-end" gap={2}>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel·la
        </Button>
        <Button
          size="xs"
          colorPalette="wood"
          onClick={() =>
            onAdd((e) =>
              kind === "hole"
                ? { holes: [...(e.holes ?? []), { x, y, diameter: d, depth, face }] }
                : { grooves: [...(e.grooves ?? []), { x, y, w, h, depth, face }] },
            )
          }
        >
          Afegeix
        </Button>
      </HStack>
    </Stack>
  )
}

const Heading = ({ children }: { children: ReactNode }) => (
  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
    {children}
  </Text>
)

function Field({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between" gap={3}>
      <Text color="fg.muted">{label}</Text>
      <Text textAlign="end" truncate>
        {value}
      </Text>
    </HStack>
  )
}
