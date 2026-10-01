import type { RenderJob } from "./engine"

/**
 * Llum típica de l'escena (`sceneKey` del `pathWorker`, en un worker a part): la GPU la fa
 * servir per als màxims de les ateses, igual que la CPU (que la calcula a cada worker).
 */
export function estimateSceneKey(job: RenderJob): Promise<number> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
    w.onmessage = (e: MessageEvent<{ type: string; key: number }>) => {
      if (e.data.type !== "estimate") return
      w.terminate()
      resolve(e.data.key)
    }
    w.onerror = (ev) => {
      w.terminate()
      reject(new Error(ev.message || "Error en preparar el render"))
    }
    w.postMessage({ type: "estimate", scene: job.scene, width: job.w, height: job.h, seed: 1, opts: job.opts, env: job.env })
  })
}
