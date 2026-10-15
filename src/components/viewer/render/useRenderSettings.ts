import { useEffect, useRef, useState } from "react"
import { parseHdr } from "./hdr"
import { DEFAULT_LOOK, FORMATS, MOODS, RESOLUTIONS, resolutionAllowed, type Format, type Look, type Mood, type Resolution, type SceneGetter } from "./renderConfig"
import { mergeSaved, readRenderPrefs, writeRenderPrefs } from "./renderPrefs"
import { DEFAULT_RENDER_OPTS, type RenderEnv, type RenderOpts, type RenderRoom } from "./sceneData"
import { SKIES, loadSky, readSky, type SkyId } from "./skies"

/**
 * La configuració del Render (el que tria l'usuari): opcions del càlcul, ambient de llum, resolució, límit, escena,
 * format, cel i aspecte de la imatge. Es desa per document (`useSaveRenderPrefs`) i es llegeix en obrir (`applyOpening`).
 */
export function useRenderSettings(setNotice: (n: string | null) => void) {
  const [opts, setOpts] = useState<RenderOpts>(DEFAULT_RENDER_OPTS)
  const [mood, setMood] = useState<Mood>("day")
  const [res, setRes] = useState<Resolution>("normal")
  const [limit, setLimit] = useState(0)
  const [room, setRoom] = useState<RenderRoom>("room")
  const [format, setFormat] = useState<Format>("view")
  /** Cel HDRI: un dels de l'app (`sky`) o un `.hdr` propi («file»); `null` = cel de dia. */
  const [env, setEnv] = useState<{ name: string; env: RenderEnv; sky: SkyId | "file" } | null>(null)
  const [sky, setSky] = useState<SkyId | "file">("day")
  const skyReq = useRef(0)
  const [look, setLookState] = useState<Look>(DEFAULT_LOOK)
  const skipSave = useRef(false)
  const lookRef = useRef(look)

  /** Tria un dels cels de l'app (es carrega a part; si ja s'ha començat, el render torna a començar amb el cel nou). */
  const chooseSky = (id: SkyId) => {
    const req = ++skyReq.current
    setSky(id)
    if (id === "day") return setEnv(null)
    void loadSky(id).then(
      (e) => req === skyReq.current && e && setEnv({ name: SKIES.find((k) => k.id === id)!.label, env: e, sky: id }),
      (err) => req === skyReq.current && setNotice(`No s'ha pogut carregar el cel: ${err instanceof Error ? err.message : String(err)}`),
    )
  }

  /** L'aspecte nou, a la ref (el llegeix el dibuix) i a l'estat (sense tornar a pintar: ho fa qui crida). */
  const applyLook = (next: Look) => {
    lookRef.current = next
    setLookState(next)
  }

  const patchOpts = (patch: Partial<RenderOpts>) => setOpts((o) => ({ ...o, ...patch }))

  /** Un cel HDRI propi (`.hdr`). */
  const loadHdrFile = async (f: File) => {
    try {
      const parsed = parseHdr(await f.arrayBuffer())
      skyReq.current++
      setEnv({ name: f.name, env: parsed, sky: "file" })
      setSky("file")
      // Un .hdr propi (un jardí, el mar…) es veu tal qual per les finestres.
      setOpts((o) => ({ ...o, view: "sky" }))
      setNotice(null)
    } catch (err) {
      setNotice(`No s'ha pogut llegir el cel HDRI: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** «Restablir» (l'aspecte el posa qui crida: depèn de l'escena). */
  const reset = () => {
    setOpts(DEFAULT_RENDER_OPTS)
    setMood("day")
    setRes("normal")
    setLimit(0)
    setRoom("room")
    setFormat("view")
  }

  /** En obrir el diàleg: el cel, l'ambient de l'escena i la configuració desada (l'efecte d'obrir de `useRenderLifecycle`). */
  const applyOpening = (getScene: SceneGetter, saveKey: string | undefined) => {
    // Als ambients (llum de dia), exposició automàtica i una mica càlid, com les fotos d'interiors.
    const daylight = !!getScene()?.scene.userData.daylight
    chooseSky(readSky(daylight ? "ambient" : "moble"))
    // L'ambient pot portar com s'obre el Render (escenes del catàleg: `Ambient.render`): ambient de llum i objectiu.
    const preset = getScene()?.scene.userData.renderPreset as { mood?: Mood; focal?: number } | undefined
    const mood = preset?.mood && preset.mood in MOODS ? MOODS[preset.mood] : null
    if (daylight || mood) applyLook({ ...lookRef.current, ...(daylight ? { auto: true, warmth: 0.25 } : {}), ...(mood?.look ?? {}) })
    if (preset?.mood && mood) setMood(preset.mood)
    if (mood || preset?.focal) setOpts((o) => ({ ...o, ...(mood?.opts ?? {}), ...(preset?.focal ? { focal: preset.focal } : {}) }))
    // La configuració que s'hi va deixar l'últim cop (mana sobre la de l'escena i la de defecte).
    const saved = readRenderPrefs(saveKey)
    skipSave.current = true
    if (saved) {
      if (saved.opts) setOpts((o) => mergeSaved(o, saved.opts))
      if (saved.look) applyLook(mergeSaved(lookRef.current, saved.look))
      if (saved.mood && saved.mood in MOODS) setMood(saved.mood as Mood)
      if (saved.res && saved.res in RESOLUTIONS && resolutionAllowed(saved.res as Resolution)) setRes(saved.res as Resolution)
      if (typeof saved.limit === "number" && Number.isFinite(saved.limit)) setLimit(saved.limit)
      if (saved.room === "room" || saved.room === "floor" || saved.room === "none") setRoom(saved.room)
      if (saved.format && saved.format in FORMATS) setFormat(saved.format as Format)
      if (saved.sky && saved.sky !== "file" && SKIES.some((k) => k.id === saved.sky)) chooseSky(saved.sky as SkyId)
    }
  }

  return { opts, mood, res, limit, room, format, env, sky, look, lookRef, skipSave, setMood, setRes, setLimit, setRoom, setFormat, chooseSky, applyLook, patchOpts, loadHdrFile, reset, applyOpening }
}

export type RenderSettings = ReturnType<typeof useRenderSettings>

/**
 * Desar la configuració (no la del moment d'obrir: encara és la d'abans de llegir la desada). S'ha de cridar després de
 * `useRenderLifecycle`: el seu efecte d'obrir posa `skipSave` abans que aquest el miri.
 */
export function useSaveRenderPrefs(open: boolean, saveKey: string | undefined, { opts, look, mood, res, limit, room, format, sky, skipSave }: RenderSettings) {
  useEffect(() => {
    if (!open) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    writeRenderPrefs(saveKey, { opts: { ...opts }, look: { ...look }, mood, res, limit, room, format, ...(sky !== "file" ? { sky } : {}) })
  }, [open, saveKey, opts, look, mood, res, limit, room, format, sky, skipSave])
}
