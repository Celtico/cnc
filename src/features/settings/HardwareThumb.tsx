import { Box } from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import { viewBounds } from "../../core/import/views"
import type { HardwareItem, MaterialPref, Module } from "../../core/model"
import { assetViews, getHardwareAsset } from "../../db/hardwareAssets"
import { useLiveQuery } from "../../db/useLiveQuery"
import { hardwareThumb, hardwareThumbSig, requestHardwareThumb } from "./hardwareThumbs"

/**
 * Miniatura 3D de la targeta, com les de Mobles, Objectes i Ambients (`SnapshotThumb` 2:1, sense cap 3D viu per
 * targeta): el ferratge muntat amb la vista de «Com va muntat», feta pel renderitzador comú fora de pantalla i desada a
 * la Cache Storage (`hardwareThumbs`). Mentre es fa, el requadre buit.
 */
export function HardwareThumb({ item, base, materials }: { item: HardwareItem; base?: Module; materials: MaterialPref[] }) {
  // Només 2D (sense STEP encara): la vista frontal del DXF.
  if (item.engine === "model" && item.imported && !item.imported.bbox) return <ViewThumb asset={item.imported.asset} />
  // Un electrodomèstic: la foto del catàleg (la de la targeta i del selector).
  if (item.appliance?.image) return <SnapshotThumb contain src={`${import.meta.env.BASE_URL}${item.appliance.image}`} />
  return <ModelThumb item={item} base={base} materials={materials} />
}

/** Miniatura d'un «només 2D»: la vista frontal (o la primera) del DXF, al mateix requadre 2:1 que les fotos. */
function ViewThumb({ asset }: { asset?: string }) {
  const a = useLiveQuery(() => (asset ? getHardwareAsset(asset) : undefined), [asset])
  const views = assetViews(a)
  const view = views.find((v) => v.name === "front") ?? views[0]
  const b = view ? viewBounds(view.lines) : null
  if (!view || !b) return <SnapshotThumb />
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  // Encaixat al 2:1 amb marge.
  const W = Math.max(w, h * 2) * 1.15 + 1
  const H = W / 2
  const x = b.x0 - (W - w) / 2
  const y = -b.y1 - (H - h) / 2
  return (
    <Box aspectRatio="2 / 1" rounded="md" overflow="hidden" bg="bg.muted" color="fg.muted" data-testid="hardware-thumb-2d">
      <svg viewBox={`${x} ${y} ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <g transform="scale(1 -1)" fill="none" stroke="currentColor" strokeWidth={W / 400}>
          {view.lines.map((l, i) => (
            <polyline key={i} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} />
          ))}
        </g>
      </svg>
    </Box>
  )
}

function ModelThumb({ item, base, materials }: { item: HardwareItem; base?: Module; materials: MaterialPref[] }) {
  const sig = useMemo(() => hardwareThumbSig(item, base, materials), [item, base, materials])
  const [made, setMade] = useState<{ sig: string; url: string } | null>(null)
  const url = made?.sig === sig ? made.url : hardwareThumb(item, sig)
  useEffect(() => (hardwareThumb(item, sig) ? undefined : requestHardwareThumb(item, base, materials, sig, (u) => setMade({ sig, url: u }))), [item, base, materials, sig])
  return <SnapshotThumb src={url} />
}
