import { Button, HStack, Kbd, Stack, Text } from "@chakra-ui/react"
import { LuCircleHelp, LuMousePointer2, LuSpline, LuSquircle, LuTrash2 } from "react-icons/lu"
import { edgeOf, filletNode } from "../../../core/model"
import { NumberField, NumRow } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { FoldItem } from "../../../components/Fold"
import { MOD } from "../../../components/modKey"
import type { ProfileShape } from "./useProfileShape"
import { IconAction } from "../../../components/IconAction"

/** Què fa cada tipus de node (ajuda de «Manegadors»). */
const HANDLE_HELP: Record<"corner" | "smooth" | "symmetric", string> = {
  corner: "Lliures: cada manegador va per lliure (fa punxa).",
  smooth: "Alineats: mateixa direcció, cada un amb la seva llargada (corba suau).",
  symmetric: "Simètrics: mateixa direcció i mateixa llargada.",
}

/** Opcions de l'editor de perfil: el node seleccionat (o l'ajuda de la ploma), arrodonir la punta i com funciona. */
export function ProfileOptions({ shape, axes, radius, setRadius, minor }: { shape: ProfileShape; axes: [string, string]; radius: number; setRadius: (r: number) => void; minor: number }) {
  const { nodes, setNodes, sel, setSel, drawing, set, remove, setType } = shape
  const selNode = sel !== null ? nodes[sel] : undefined
  const selType = selNode ? (selNode.in || selNode.out ? (selNode.t ?? "corner") : "corner") : "corner"
  const canFillet = sel !== null && filletNode(nodes, sel, radius) !== null
  return (
    <Stack w={{ base: "full", md: "280px" }} gap={0} flexShrink={0}>
      <FoldItem
        id="profile-node"
        icon={LuMousePointer2}
        title="Selecció"
        badge={drawing ? "Ploma" : sel !== null ? `Node ${sel + 1}` : undefined}
        size="sm"
        defaultOpen
        actions={
          // Treure el node: al costat de la capçalera (mai a dins: un botó dins d'un botó no és vàlid).
          !drawing && selNode ? (
            <IconAction label="Eliminar el node" size="xs" variant="ghost" disabled={nodes.length <= 3} onClick={() => remove(sel!)}>
              <LuTrash2 />
            </IconAction>
          ) : undefined
        }
      >
        {drawing ? (
          <Text textStyle="xs" color="fg.muted">
            Clic: node de cantonada. Clic i arrossegar: node suau (defineixes la corba). Clica el primer node (verd) o prem <Kbd>Retorn</Kbd> per tancar la forma; <Kbd>Esc</Kbd> la descarta.
          </Text>
        ) : selNode ? (
          <>
            <NumRow label={axes[0]} value={selNode.x} step={1} onChange={(v) => Number.isFinite(v) && set(sel!, { ...selNode, x: v }, { group: `x:${sel}` })} />
            <NumRow label={axes[1]} value={selNode.y} step={1} onChange={(v) => Number.isFinite(v) && set(sel!, { ...selNode, y: v }, { group: `y:${sel}` })} />
            <FormRow label="Manegadors" help={HANDLE_HELP[selType]}>
              <ChoiceChips
                label="Manegadors"
                value={selType}
                options={[
                  { id: "corner", label: "Lliures" },
                  { id: "smooth", label: "Alineats" },
                  { id: "symmetric", label: "Simètrics" },
                ]}
                onChange={(t) => setType(sel!, t)}
              />
            </FormRow>
            {(selNode.in || selNode.out) && (
              <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => set(sel!, { x: selNode.x, y: selNode.y })}>
                Treure els manegadors (cantonada recta)
              </Button>
            )}
          </>
        ) : (
          <Text textStyle="xs" color="fg.muted">
            Tria un node per moure'l amb precisió, canviar-ne el tipus o arrodonir-lo.
          </Text>
        )}
      </FoldItem>
      {/* Arrodonir la punta: només en un node entre dos costats rectes. */}
      {!drawing && selNode && edgeOf(nodes, (sel! - 1 + nodes.length) % nodes.length).kind === "line" && edgeOf(nodes, sel!).kind === "line" && (
        <FoldItem id="profile-fillet" icon={LuSquircle} title="Arrodonir la punta" badge={`${radius} mm`} size="sm">
          <Text textStyle="xs" color="fg.muted">
            La cantonada passa a ser un arc d'aquest radi, tangent als dos costats.
          </Text>
          <FormRow label="Radi">
            <HStack gap={1} align="start">
              <NumberField label="" ariaLabel="Radi" value={radius} min={1} max={2000} step={5} onChange={(v) => Number.isFinite(v) && v > 0 && setRadius(v)} />
              <Button
                size="sm"
                variant="outline"
                disabled={!canFillet}
                title={canFillet ? undefined : "El radi és massa gran per als costats"}
                onClick={() => {
                  const next = filletNode(nodes, sel!, radius)
                  if (next) {
                    setNodes(next)
                    setSel(null)
                  }
                }}
              >
                <LuSpline /> Arrodonir
              </Button>
            </HStack>
          </FormRow>
        </FoldItem>
      )}
      <FoldItem id="profile-help" icon={LuCircleHelp} title="Com funciona" size="sm">
        <Stack gap={1}>
          <Text textStyle="xs" color="fg.muted">
            · Quadrat = cantonada; cercle = node amb corba. Doble clic (o l'eina Corbar) canvia l'un per l'altre.
          </Text>
          <Text textStyle="xs" color="fg.muted">
            · Els manegadors (rombes blaus) donen la direcció i la força de la corba; amb <Kbd>Alt</Kbd> es trenquen.
          </Text>
          <Text textStyle="xs" color="fg.muted">
            · El punt del mig d'un costat: clic hi afegeix un node; arrossegar-lo corba el costat.
          </Text>
          <Text textStyle="xs" color="fg.muted">
            · Imant de {minor} mm (<Kbd>{MOD.replace("+", "")}</Kbd>: lliure). <Kbd>Maj</Kbd>: angles de 45° (ploma i manegadors). <Kbd>Supr</Kbd> treu el node; fletxes l'afinen.
          </Text>
          <Text textStyle="xs" color="fg.muted">
            · <Kbd>{MOD}Z</Kbd> desfà i <Kbd>⇧{MOD}Z</Kbd> refà (amb la ploma, treu l'últim node).
          </Text>
        </Stack>
      </FoldItem>
    </Stack>
  )
}
