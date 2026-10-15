import { Box, Button, Stack, Text } from "@chakra-ui/react"
import { LuBoxes, LuFileDown, LuFileText } from "react-icons/lu"
import { downloadBlob } from "../../../lib/download"
import { FoldItem } from "../../../components/Fold"
import { FormRow } from "../../../components/FormRow"
import { assetDocs, getHardwareAsset } from "../../../db/hardwareAssets"
import { useLiveQuery } from "../../../db/useLiveQuery"

/** «Plànols i documents»: el GLB per baixar i els plànols del fabricant (només si l'asset en porta). */
export function DocsSection({ asset, name }: { asset: string; name: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  const docs = assetDocs(a)
  if (!a?.glb && !docs.length) return null
  const badge = [a?.glb ? "GLB" : "", docs.length ? `${docs.length} ${docs.length === 1 ? "plànol" : "plànols"}` : ""].filter(Boolean).join(" · ")
  return (
    <FoldItem id="hw-docs" icon={LuFileText} title="Plànols i documents" badge={badge}>
      <GlbRow asset={asset} name={name} />
      <DocsRow asset={asset} />
    </FoldItem>
  )
}

/** «Model 3D»: baixar el GLB que es va fer en importar (per posar-lo en un objecte com a model 3D). */
function GlbRow({ asset, name }: { asset: string; name: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  if (!a?.glb) return null
  const glb = a.glb
  return (
    <FormRow label="Model 3D" help="El model del fitxer en GLB (metres, al marc del ferratge). Per veure'l en un objecte: Models 3D › Triar fitxers.">
      <Box pt="2px">
        <Button size="xs" variant="outline" onClick={() => downloadBlob(glb, `${name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "ferratge"}.glb`)} data-testid="hardware-glb">
          <LuBoxes /> Baixar el model 3D (.glb)
        </Button>
      </Box>
    </FormRow>
  )
}

/** «Plànols de muntatge»: els DXF i PDF del fabricant adjuntats en importar (`dxf_einbau`, exemples d'aplicació), per baixar-los. */
function DocsRow({ asset }: { asset: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  const docs = assetDocs(a)
  if (!docs.length) return null
  return (
    <FormRow label="Plànols" help="Plànols de muntatge i exemples d'aplicació del fabricant que nomenen aquest article (tal com venen, per consultar-los).">
      <Stack gap={1} pt="2px" data-testid="hardware-docs">
        {docs.map((d) => (
          <Box key={d.name}>
            <Button size="xs" variant="ghost" onClick={() => downloadBlob(d.blob, d.name)} title={d.name} maxW="full" justifyContent="flex-start">
              <LuFileDown /> <Text as="span" truncate>{d.name}</Text>
            </Button>
          </Box>
        ))}
      </Stack>
    </FormRow>
  )
}
