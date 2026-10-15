import { Badge, Stack, Text } from "@chakra-ui/react"
import { useContext, useEffect, useRef, useState } from "react"
import { LuFactory } from "react-icons/lu"
import { MasterDetail } from "../../components/MasterDetail"
import { toaster } from "../../components/ui/toaster"
import { newId, type Machine } from "../../core/model"
import { importMaestroFiles, type PickedFile } from "./machineImport"
import { ImportDropZone, type ImportDropZoneHandle } from "../../components/ImportDropZone"
import { PaneHeadContext } from "./paneHead"
import { useSessionString } from "./useSessionString"
import { MachineDetail } from "./machines/MachineDetail"

const KEY = "mobles:settings-machine"

/**
 * Preferències › Màquines CNC: llista de màquines (importades de Maestro) i detall amb les dades
 * de la màquina, les opcions de l'export .xcs i la taula d'eines per tipus.
 */
export function MachinesList({ machines, onChange }: { machines: Machine[]; onChange: (m: Machine[]) => void }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(KEY)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const zone = useRef<ImportDropZoneHandle>(null)
  const i = machines.findIndex((m) => m.id === sel)
  const m = i >= 0 ? machines[i]! : null
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])

  const update = (patch: Partial<Machine>) => onChange(machines.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const makeDefault = (id: string) => onChange(machines.map((x) => ({ ...x, isDefault: x.id === id })))

  /** Màquina on van els .pgmx sense màquina pròpia: la del botó del detall o la seleccionada. */
  const target = useRef<string | undefined>(undefined)

  const doImport = async (picked: PickedFile[]) => {
    if (!picked.length) return
    setBusy(true)
    try {
      const r = await importMaestroFiles(picked, machines, target.current ?? m?.id)
      onChange(r.machines)
      if (r.selected) setSel(r.selected)
      toaster.create({
        title: "Importat de Maestro",
        description: [...r.lines, ...r.problems].join(" "),
        type: r.problems.length ? "warning" : "success",
        duration: 12000,
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut importar de Maestro", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    } finally {
      setBusy(false)
      target.current = undefined
    }
  }
  const pick = (which: "folder" | "files", machineId?: string) => {
    target.current = machineId
    zone.current?.pick(which)
  }

  const q = query.trim().toLowerCase()
  const shown = machines.filter((x) => !q || `${x.name} ${x.serial} ${x.model}`.toLowerCase().includes(q))

  return (
    <>
      <MasterDetail
        head={
          <Stack gap={3}>
            {head}
            <ImportDropZone title="Importar de Maestro" accept=".pgmx,.xml,.zip,.tlgx,.atrx,.cfgx" busy={busy} onPicked={doImport} testId="machine" handle={zone}>
              Carpeta <Text as="span" fontFamily="mono">.machinecontext</Text> (configuració de la màquina) · Projecte{" "}
              <Text as="span" fontFamily="mono">.pgmx</Text> (fitxer o carpeta desplegada) · fitxers <Text as="span" fontFamily="mono">.tlgx</Text> /{" "}
              <Text as="span" fontFamily="mono">.atrx</Text>. També es poden deixar anar aquí. El context crea o actualitza la màquina; el
              .pgmx hi posa els noms de les eines del taller i la capçalera.
            </ImportDropZone>
          </Stack>
        }
        groups={[
          {
            id: "machines",
            label: "Màquines",
            items: shown.map((x) => ({
              id: x.id,
              lead: <LuFactory />,
              title: x.name,
              subtitle: `${x.tools.length} eines${x.maestroVersion ? ` · Maestro ${x.maestroVersion}` : ""}`,
              badge: x.isDefault ? (
                <Badge size="xs" variant="subtle" colorPalette="wood">
                  per defecte
                </Badge>
              ) : undefined,
            })),
          },
        ]}
        selected={m ? m.id : null}
        onSelect={setSel}
        query={query}
        onQuery={setQuery}
        addLabel="Importar de Maestro"
        onAdd={() => pick("folder")}
        backLabel="Màquines CNC"
        detailMaxW="860px"
        // Sense cap màquina, la llista ja ho diu (i la zona d'importar és a sobre): el detall no ho repeteix.
        empty={
          machines.length ? (
            <Text fontSize="sm" color="fg.muted">
              Tria una màquina de la llista.
            </Text>
          ) : undefined
        }
        detail={
          m && (
            <MachineDetail
              m={m}
              busy={busy}
              update={update}
              onDefault={() => makeDefault(m.id)}
              onDuplicate={() => {
                const copy: Machine = { ...structuredClone(m), id: newId("mach"), name: `${m.name} (còpia)`, isDefault: false }
                const next = [...machines]
                next.splice(i + 1, 0, copy)
                onChange(next)
                setSel(copy.id)
              }}
              onDelete={() => {
                const rest = machines.filter((_, k) => k !== i)
                if (m.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true }
                onChange(rest)
                setSel(null)
              }}
              onPickPgmx={() => pick("files", m.id)}
            />
          )
        }
      />
    </>
  )
}
