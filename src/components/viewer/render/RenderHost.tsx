import { RenderConflictDialog } from "./RenderConflictDialog"
import { RenderDialog } from "./RenderDialog"
import { closeRender, useRenderHost } from "./renderStore"

/**
 * El Render de tota l'app (`renderStore.ts`): un panell per document (`key` = la seva clau), sempre muntat, i la pregunta
 * de què fer amb el d'ara quan se'n demana un d'un altre document.
 */
export function RenderHost() {
  const { req, open, shown, pending } = useRenderHost()
  if (!req) return null
  return (
    <>
      <RenderDialog key={req.saveKey} open={open} shown={shown} onClose={closeRender} getScene={() => req.getScene()} name={req.name} saveKey={req.saveKey} />
      <RenderConflictDialog pending={pending?.name ?? null} />
    </>
  )
}
