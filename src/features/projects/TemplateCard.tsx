import { Badge, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import type { Composition, Template } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { GalleryCard } from "./GalleryCard"
import { kindLabel } from "./kindLabel"
import { lastTemplateThumb, requestTemplateThumb, templateThumb } from "./projectThumbs"

const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`

// Les plantilles es fan d'una en una, quan el navegador queda lliure: obrir una categoria amb mobles cars de fer (els
// llistons, ~1 s cadascun) o cercar no penja la pàgina; cada targeta surt quan la seva està feta.
const makeQueue: { run: () => void; live: boolean }[] = []
let making = false
function drainMakes() {
  const job = makeQueue.shift()
  if (!job) {
    making = false
    return
  }
  if (job.live) job.run()
  setTimeout(drainMakes, 0)
}
function enqueueMake(run: () => void): () => void {
  const job = { run, live: true }
  makeQueue.push(job)
  if (!making) {
    making = true
    setTimeout(drainMakes, 0)
  }
  return () => {
    job.live = false
  }
}

/**
 * Les plantilles ja fetes en aquesta sessió: tornar a la galeria (en tancar un moble) no les torna a fer (els llistons
 * costen ~1 s cadascun). Les plantilles són fixes (les del codi), així que el mateix objecte fa sempre el mateix.
 */
const made = new WeakMap<Template, Composition>()

/** Targeta d'una plantilla (catàleg, col·leccions, objectes): la miniatura es calcula en muntar-la (al catàleg, en obrir la categoria). */
export function TemplateCard({ t, title, kicker, onPick }: { t: Template; title?: string; kicker?: string; onPick: (t: Template) => void }) {
  const [comp, setComp] = useState<Composition | null>(null)
  useEffect(() => {
    const done = made.get(t)
    if (done) return setComp(done)
    return enqueueMake(() => {
      const c = t.make()
      made.set(t, c)
      setComp(c)
    })
  }, [t])
  // Foto 3D feta fora de pantalla (desada entre sessions); mentrestant, l'última que se n'ha vist i, si no n'hi ha cap,
  // el dibuix.
  const { settings } = useSettings()
  const [thumb, setThumb] = useState<string | undefined>()
  useEffect(() => {
    let live = true
    lastTemplateThumb(t.id, (url) => live && setThumb((cur) => cur ?? url))
    return () => {
      live = false
    }
  }, [t.id])
  useEffect(() => {
    if (!comp) return
    const stored = templateThumb(t.id, comp, settings.materials)
    if (stored) {
      setThumb(stored)
      return
    }
    return requestTemplateThumb(t.id, () => comp, settings.materials, setThumb)
  }, [t.id, comp, settings.materials])
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
