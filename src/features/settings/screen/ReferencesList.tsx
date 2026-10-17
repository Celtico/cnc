import { Badge, Input, Stack, Text } from "@chakra-ui/react"
import { useContext, useEffect, useState } from "react"
import { LuArrowDown, LuArrowUp, LuCopy, LuEye, LuEyeOff, LuScan, LuTrash2 } from "react-icons/lu"
import { MasterDetail } from "../../../components/MasterDetail"
import { ConfirmDialog } from "../../../components/ConfirmDialog"
import { IconAction } from "../../../components/IconAction"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { NumRow } from "../../../components/NumRow"
import { newId, type RefPreset } from "../../../core/model"
import { PaneHeadContext } from "../paneHead"
import { useSessionString } from "../useSessionString"
import { DETAIL_KEYS } from "./detailKeys"

export function ReferencesList({ refs, onChange }: { refs: RefPreset[]; onChange: (r: RefPreset[]) => void }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(DETAIL_KEYS.references)
  const [query, setQuery] = useState("")
  const update = (i: number, patch: Partial<RefPreset>) => onChange(refs.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= refs.length) return
    const next = [...refs]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  const add = () => {
    const r: RefPreset = { id: newId("ref"), name: "Objecte nou", w: 600, h: 600, plane: "wall", wallOffset: 0 }
    onChange([r, ...refs])
    setSel(r.id)
  }
  const duplicate = (i: number) => {
    const src = refs[i]!
    const copy: RefPreset = { ...src, id: newId("ref"), name: `${src.name} (còpia)`, builtin: undefined, hidden: undefined }
    const next = [...refs]
    next.splice(i + 1, 0, copy)
    onChange(next)
    setSel(copy.id)
  }
  const [deleting, setDeleting] = useState<RefPreset | null>(null)
  const q = query.trim().toLowerCase()
  const shown = refs.filter((r) => !q || r.name.toLowerCase().includes(q))
  const i = refs.findIndex((r) => r.id === sel)
  const r = i >= 0 ? refs[i]! : null
  // Un element que ja no existeix no compta com a obert.
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])
  return (
    <>
    <ConfirmDialog
      open={deleting !== null}
      title={`Eliminar «${deleting?.name ?? ""}»?`}
      body="Surt de la llista d'objectes de referència. No es pot desfer."
      confirmLabel="Eliminar"
      onConfirm={() => {
        if (!deleting) return
        onChange(refs.filter((x) => x.id !== deleting.id))
        setSel(null)
      }}
      onClose={() => setDeleting(null)}
    />
    <MasterDetail
      head={
        <Stack gap={3}>
          {head}
          <Text fontSize="sm" color="fg.muted">
            Una sola llista per a la foto (es calibra amb la cara del davant, amplada × alçada) i per a l'editor (fantasma 3D, cal
            fondària). La distància a la paret corregeix l'escala si l'objecte no hi toca.
          </Text>
        </Stack>
      }
      groups={[
        {
          id: "refs",
          label: "Objectes",
          hint: "Els inicials es poden amagar; els teus, eliminar.",
          items: shown.map((x) => ({
            id: x.id,
            lead: <LuScan />,
            title: x.name,
            subtitle: `${x.w} × ${x.h}${x.d ? ` × ${x.d}` : ""} mm · ${x.plane === "floor" ? "terra" : "paret"}`,
            badge: x.builtin ? (
              <Badge size="xs" variant="subtle">
                inicial
              </Badge>
            ) : undefined,
            dimmed: x.hidden,
          })),
        },
      ]}
      selected={r ? r.id : null}
      onSelect={setSel}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Cercar objectes de referència…"
      searchLabel="Cercar objectes de referència"
      addLabel="Afegir"
      onAdd={add}
      backLabel="Objectes de referència"
      empty={<Text fontSize="sm" color="fg.muted">Tria un objecte de la llista per editar-lo.</Text>}
      detail={
        r && (
          <SettingsGroup
            icon={<LuScan />}
            title={r.name}
            summary={r.builtin ? "Objecte inicial (es pot amagar, no eliminar)" : "Objecte teu"}
            actions={
              <>
                <IconAction label="Pujar a la llista" size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  <LuArrowUp />
                </IconAction>
                <IconAction label="Baixar a la llista" size="xs" variant="ghost" disabled={i === refs.length - 1} onClick={() => move(i, 1)}>
                  <LuArrowDown />
                </IconAction>
                <IconAction label="Duplicar l'objecte" size="xs" variant="ghost" onClick={() => duplicate(i)}>
                  <LuCopy />
                </IconAction>
                {r.builtin ? (
                  <IconAction label={r.hidden ? "Mostrar l'objecte" : "Amagar l'objecte"} size="xs" variant="ghost" onClick={() => update(i, { hidden: !r.hidden })}>
                    {r.hidden ? <LuEyeOff /> : <LuEye />}
                  </IconAction>
                ) : (
                  <IconAction label="Eliminar l'objecte" size="xs" variant="ghost" colorPalette="red" onClick={() => setDeleting(r)}>
                    <LuTrash2 />
                  </IconAction>
                )}
              </>
            }
          >
            <FormRow label="Nom" maxW="360px">
              <Input size="sm" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            </FormRow>
            <NumRow label="Amplada" value={r.w} min={1} max={10000} step={10} onChange={(w) => update(i, { w })} />
            <NumRow label="Alçada" value={r.h} min={1} max={10000} step={10} onChange={(h) => update(i, { h })} />
            <NumRow label="Fondària" help={r.d ? undefined : "Buida: només per a la foto (no surt al 3D)."} value={r.d ?? NaN} allowEmpty min={1} max={10000} step={10} onChange={(d) => update(i, { d: Number.isFinite(d) && d > 0 ? d : undefined })} />
            <FormRow label="Pla">
              <ChoiceChips<RefPreset["plane"]>
                label="Pla"
                options={[
                  { id: "wall", label: "Paret" },
                  { id: "floor", label: "Terra" },
                ]}
                value={r.plane}
                onChange={(plane) => update(i, { plane })}
              />
            </FormRow>
            <NumRow label="A la paret" help="Distància a la paret si l'objecte no hi toca (corregeix l'escala de la foto)." value={r.wallOffset} min={0} max={5000} step={10} onChange={(wallOffset) => update(i, { wallOffset })} />
          </SettingsGroup>
        )
      }
    />
    </>
  )
}
