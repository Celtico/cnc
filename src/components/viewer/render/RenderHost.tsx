import { RenderDialog } from "./RenderDialog"
import { closeRender, useRenderHost } from "./renderStore"

/** El `RenderDialog` de tota l'app (`renderHost.ts`): un per document (`key` = la seva clau), sempre muntat. */
export function RenderHost() {
  const { req, open } = useRenderHost()
  if (!req) return null
  return <RenderDialog key={req.saveKey} open={open} onClose={closeRender} getScene={() => req.getScene()} name={req.name} saveKey={req.saveKey} />
}
