import { Box, Button, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { FormRow } from "../../../components/FormRow"
import { NumberField } from "../../../components/NumRow"
import { cupRel, relV } from "../../../core/model/hardwareEdit"
import { evalExpr, type HardwareItem, type HardwareTarget } from "../../../core/model"
import { fmt } from "./format"
import { IconAction } from "../../../components/IconAction"

const TAG_LABEL: Record<string, string> = { hinge: "Cassoleta", "hinge-screw": "Cargol", "hinge-dowel": "Espiga", plate: "Placa", leg: "Cargol", handle: "Forat" }
const num = (e: number | string, vars: Record<string, number>) => {
  try {
    return evalExpr(e, vars)
  } catch {
    return NaN
  }
}

/**
 * Forats d'un ferratge importat, editables: al llarg (u) i cap a dins (v; a la porta, des del centre de la cassoleta),
 * Ø i fondària. La cassoleta (el primer de la porta) pren el Ø i la fondària de «Mides»; els del lateral d'una frontissa
 * són de la placa (es canvien a la placa i tornant-la a triar).
 */
export function OpsEditor({ item, target, onChange }: { item: HardwareItem; target: HardwareTarget; onChange: (t: HardwareTarget) => void }) {
  const fromPlate = item.engine === "cup" && target.key === "side"
  const door = item.engine === "cup" && target.key === "door"
  const leg = item.engine === "leg"
  const vars = item.params
  const setOp = (k: number, patch: { u?: number; v?: number; d?: number; depth?: number }) =>
    onChange({
      ...target,
      ops: target.ops.map((op, i) => {
        if (i !== k || op.kind === "edgeDrill") return op
        const next = { ...op }
        if (patch.u !== undefined && Number.isFinite(patch.u)) next.u = patch.u
        if (patch.v !== undefined && Number.isFinite(patch.v)) next.v = door ? cupRel(patch.v) : patch.v
        if (patch.d !== undefined && patch.d > 0) next.d = patch.d
        if (patch.depth !== undefined && patch.depth > 0 && next.kind === "drill") next.depth = patch.depth
        return next
      }),
    })
  const add = () => onChange({ ...target, ops: [...target.ops, { kind: "drill", face: "A", u: 0, v: door ? cupRel(10) : 0, d: leg ? 3 : 5, depth: leg ? 12 : 10, tag: door ? "hinge-screw" : leg ? "leg" : "plate" }] })
  return (
    <FormRow
      label={target.label}
      help={
        fromPlate ? "De la placa aparellada: per canviar-los, edita la placa i torna-la a triar."
        : door ? "Al llarg del cantell i cap a dins des del centre de la cassoleta (mm)."
        : leg ? "Al voltant de l'eix de la pota, a la cara de sota de la base: al llarg (d'esquerra a dreta del moble) i cap al davant (mm)."
        : "Al llarg (amunt) i cap al darrere des de la referència de la placa (mm)."
      }
    >
      <Stack gap={2} pt="2px" data-testid={`hardware-ops-${target.key}`}>
        {target.ops.map((op, k) => {
          if (op.kind === "edgeDrill") return null
          const cup = door && k === 0
          const ro = fromPlate || cup
          const v = door ? relV(op) : num(op.v, vars)
          const depth = op.kind === "drill" ? num(op.depth, vars) : NaN
          const name = `${TAG_LABEL[op.tag ?? ""] ?? op.tag ?? "Forat"}${cup ? "" : ` ${k + (door ? 0 : 1)}`}`
          if (ro)
            return (
              <Text key={k} fontSize="sm">
                <Text as="span" fontWeight="medium">
                  {name}
                </Text>
                <Text as="span" fontFamily="mono" color="fg.muted">
                  {" "}
                  Ø{fmt(num(op.d, vars))} × {fmt(depth)} a {fmt(num(op.u, vars))} / {fmt(v)}
                </Text>
                {cup && (
                  <Text as="span" color="fg.muted">
                    {" "}
                    (Ø i fondària a Mides)
                  </Text>
                )}
              </Text>
            )
          return (
            <Box key={k} borderWidth="1px" borderColor="border.muted" rounded="md" p={2}>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="medium">
                  {name}
                </Text>
                <IconAction label={`Eliminar ${name}`} tip="Eliminar el forat" size="2xs" variant="ghost" colorPalette="red" onClick={() => onChange({ ...target, ops: target.ops.filter((_, i) => i !== k) })}>
                  <LuTrash2 />
                </IconAction>
              </HStack>
              <SimpleGrid columns={2} gap={2}>
                <NumberField label="Al llarg" ariaLabel={`${name}: al llarg`} value={num(op.u, vars)} min={-300} max={300} step={0.5} onChange={(x) => setOp(k, { u: x })} />
                <NumberField label={door ? "Cap a dins" : leg ? "Cap al davant" : "Al darrere"} ariaLabel={`${name}: ${door ? "cap a dins" : leg ? "cap al davant" : "al darrere"}`} value={v} min={-300} max={300} step={0.5} onChange={(x) => setOp(k, { v: x })} />
                <NumberField label="Ø" ariaLabel={`${name}: diàmetre`} value={num(op.d, vars)} min={1} max={60} step={0.5} onChange={(x) => setOp(k, { d: x })} />
                <NumberField label="Fondària" ariaLabel={`${name}: fondària`} value={depth} min={0.5} max={40} step={0.5} onChange={(x) => setOp(k, { depth: x })} />
              </SimpleGrid>
            </Box>
          )
        })}
        {!fromPlate && (
          <Box>
            <Button size="xs" variant="ghost" onClick={add}>
              <LuPlus /> Afegir forat
            </Button>
          </Box>
        )}
      </Stack>
    </FormRow>
  )
}
