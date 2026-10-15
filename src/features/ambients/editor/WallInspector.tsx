import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { LuAppWindow, LuBrickWall, LuDoorOpen, LuPanelTop, LuRuler, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { FoldItem } from "../../../components/Fold"
import { NumRow } from "../../../components/NumRow"
import { toaster } from "../../../components/ui/toaster"
import { OPENING_DEFAULTS, addOpening, clampOpening, setWallEnds, wallLength, type MaterialPref, type Opening, type Wall } from "../../../core/model"
import { MaterialPick } from "./MaterialPick"

export function WallInspector({ wall, label, materials, onPatch, onDelete }: { wall: Wall; label: string;materials: MaterialPref[]; onPatch: (p: Partial<Wall>) => void; onDelete: () => void }) {
  const L = Math.round(wallLength(wall))
  return (
    <Stack gap={0}>
      <HStack pb={2}>
        <Box color="fg.muted">
          <LuBrickWall />
        </Box>
        <Text fontWeight="semibold" flex={1}>
          {label}
        </Text>
        <IconButton aria-label="Eliminar la paret" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      <FoldItem id="amb-wall" title="Mides i material" icon={LuRuler} badge={`${L} mm`}>
      {/* Recta o corba (Bézier, com la ploma amb clic i arrossegar): en fer-la corba, els punts de control a un terç i dos
          terços, cap a fora un quart del llarg; s'arrosseguen al plànol. Una corba no porta finestres ni portes. */}
      <FormRow label="Forma" help={wall.curve ? "Arrossega els rombes del plànol per canviar la corba. Una paret corba no porta finestres ni portes." : undefined}>
        <ChoiceChips
          label="Forma"
          value={wall.curve ? "curve" : "line"}
          options={[{ id: "line", label: "Recta" }, { id: "curve", label: "Corba" }]}
          onChange={(v) => {
            if (v === "line") return onPatch({ curve: undefined })
            const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1]
            const k = 0.25
            const n: [number, number] = [-dy * k, dx * k]
            onPatch({ curve: { c1: [Math.round(wall.a[0] + dx / 3 + n[0]), Math.round(wall.a[1] + dy / 3 + n[1])], c2: [Math.round(wall.a[0] + (2 * dx) / 3 + n[0]), Math.round(wall.a[1] + (2 * dy) / 3 + n[1])] }, openings: undefined })
          }}
        />
      </FormRow>
      {!wall.curve && <NumRow
        label="Llarg"
        value={L}
        min={50}
        step={10}
        onChange={(len) => {
          if (!(len >= 50) || L < 1) return
          // S'allarga cap al final (b), en la mateixa direcció.
          const k = len / L
          const b: [number, number] = [Math.round(wall.a[0] + (wall.b[0] - wall.a[0]) * k), Math.round(wall.a[1] + (wall.b[1] - wall.a[1]) * k)]
          // Les obertures es queden on eren i, si s'escurça, s'ajusten perquè hi càpiguen.
          onPatch({ b, ...(wall.openings ? { openings: setWallEnds(wall, wall.a, b).openings } : {}) })
        }}
      />}
      <NumRow label="Gruix" value={wall.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onPatch({ thickness })} />
      <NumRow label="Alt" value={wall.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onPatch({ height })} />
      <MaterialPick label="Material d'aquesta paret" value={wall.material ?? ""} materials={materials} onChange={(material) => onPatch({ material: material || undefined })} onlySim emptyLabel="El de totes les parets" />
      <Text fontSize="xs" color="fg.muted">
        Arrossega-la per moure-la (les parets enganxades la segueixen) o arrossega'n els extrems. Maj: sense angles · Alt: sense imant.
      </Text>
      </FoldItem>
      {!wall.curve && <FoldItem id="amb-openings" title="Finestres i portes" icon={LuAppWindow} badge={wall.openings?.length || undefined}>
        {(wall.openings ?? []).map((o, i) => {
          const set = (patch: Partial<Opening>) => onPatch({ openings: wall.openings!.map((q, j) => (j === i ? clampOpening(wall, { ...q, ...patch }) : q)) })
          return (
            <Stack key={i} gap={2} borderWidth="1px" rounded="md" p={2}>
              <HStack align="flex-start" gap={1}>
                <Box flex={1} minW={0}>
                <FormRow label="Tipus" help={o.kind === "glazing" ? "De terra a sostre." : undefined}>
                  <ChoiceChips<Opening["kind"]>
                    label="Tipus d'obertura"
                    options={[
                      { id: "window", label: "Finestra" },
                      { id: "door", label: "Porta" },
                      { id: "glazing", label: "Vidriera" },
                    ]}
                    value={o.kind}
                    onChange={(kind) => set({ kind, ...OPENING_DEFAULTS[kind] })}
                  />
                </FormRow>
                </Box>
                <IconButton aria-label="Treure l'obertura" size="xs" variant="ghost" colorPalette="red" onClick={() => onPatch({ openings: wall.openings!.filter((_, j) => j !== i) })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
              <NumRow label="Centre (des de l'inici)" value={Math.round(o.at)} step={10} onChange={(at) => Number.isFinite(at) && set({ at })} />
              <NumRow label="Ample" value={o.w} min={200} step={10} onChange={(w) => w >= 200 && set({ w })} />
              <NumRow label="Alt" value={o.h} min={200} step={10} onChange={(h) => h >= 200 && set({ h })} />
              {o.kind === "window" && <NumRow label="Ampit (del terra)" value={o.sill} min={0} step={10} onChange={(sill) => sill >= 0 && set({ sill })} />}
              {o.kind !== "door" && <NumRow label="Fulles" value={o.panes ?? Math.max(1, Math.round(o.w / (o.kind === "glazing" ? 1200 : 900)))} min={1} max={12} step={1} onChange={(panes) => panes >= 1 && set({ panes: Math.round(panes) })} />}
            </Stack>
          )
        })}
        <HStack gap={2} wrap="wrap">
          {(["window", "door", "glazing"] as const).map((k) => (
            <Button
              key={k}
              size="xs"
              variant="outline"
              onClick={() => {
                const next = addOpening(wall, k, L / 2)
                if (next) onPatch({ openings: next.openings })
                else toaster.create({ title: "No hi cap", description: "Aquesta paret no té cap tros lliure prou ample.", type: "info" })
              }}
            >
              {k === "window" ? <LuAppWindow /> : k === "door" ? <LuDoorOpen /> : <LuPanelTop />} {k === "window" ? "Finestra" : k === "door" ? "Porta" : "Vidriera"}
            </Button>
          ))}
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          També amb les eines Finestra (F) i Porta (D): clic sobre la paret. Al plànol s'arrosseguen al llarg de la paret.
        </Text>
      </FoldItem>}
    </Stack>
  )
}
