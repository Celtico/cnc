import { Badge, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import type { Template } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { GalleryCard } from "./GalleryCard"
import { kindLabel } from "./kindLabel"
import { requestTemplateThumb, templateThumb } from "./projectThumbs"

const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`

/** Targeta d'una plantilla (catàleg, col·leccions, objectes): la miniatura es calcula en muntar-la (al catàleg, en obrir la categoria). */
export function TemplateCard({ t, title, kicker, onPick }: { t: Template; title?: string; kicker?: string; onPick: (t: Template) => void }) {
  const comp = useMemo(() => t.make(), [t])
  // Foto 3D feta fora de pantalla (desada entre sessions); mentrestant, el dibuix.
  const { settings } = useSettings()
  const [thumb, setThumb] = useState(() => templateThumb(t.id, comp, settings.materials))
  useEffect(() => (thumb ? undefined : requestTemplateThumb(t.id, () => comp, settings.materials, setThumb)), [t.id, comp, settings.materials, thumb])
  return (
    <GalleryCard
      thumb={<SnapshotThumb src={thumb} />}
      title={title ?? t.name}
      kicker={kicker}
      description={t.description}
      tags={
        <Badge size="xs" variant="subtle" colorPalette="wood">
          {kindLabel(t.kind)}
        </Badge>
      }
      aside={
        t.price !== undefined && (
          <Text fontSize="xs" fontWeight="semibold" color="wood.fg" truncate>
            {euros(t.price)}
          </Text>
        )
      }
      onClick={() => onPick(t)}
    />
  )
}
