import { HStack, IconButton, Slider, Stack, Text } from "@chakra-ui/react"
import { LuPause, LuPlay, LuSkipBack, LuSkipForward, LuStepBack, LuStepForward } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { Tooltip } from "../../components/ui/tooltip"
import type { ReactNode } from "react"
import { opLabel, type CamSheetView } from "./camDrawing"
import type { CamSimClock, SimSpeed } from "./useCamSim"

/** Temps en «m:ss» (o «h:mm:ss»). */
const fmtTime = (s: number) => {
  const t = Math.round(s)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const ss = String(t % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

/** Controls de la simulació 3D: jugar, velocitat, lliscador de tot el programa, operació anterior / següent i final. */
export function CamSimControls({ clock, view }: { clock: CamSimClock; view: CamSheetView }) {
  const { prog } = clock
  const sop = clock.op >= 0 ? prog.ops[clock.op] : undefined
  const op = sop ? view.preview.ops.find((o) => o.n === sop.n) : undefined
  const btn = (label: string, icon: ReactNode, onClick: () => void, disabled = false) => (
    <Tooltip content={label}>
      <IconButton aria-label={label} size="sm" variant="ghost" onClick={onClick} disabled={disabled}>
        {icon}
      </IconButton>
    </Tooltip>
  )
  const end = clock.shown >= prog.total - 1e-6
  return (
    <Stack gap={2}>
      <HStack gap={1} wrap="wrap" rowGap={2}>
        {btn("Al començament", <LuSkipBack />, () => clock.seek(0), clock.shown <= 0)}
        {btn("Operació anterior", <LuStepBack />, () => clock.step(-1), clock.shown <= 0)}
        <Tooltip content={clock.playing ? "Pausa" : "Jugar"}>
          <IconButton aria-label={clock.playing ? "Pausa" : "Jugar"} size="sm" colorPalette="wood" onClick={() => clock.setPlaying(!clock.playing)}>
            {clock.playing ? <LuPause /> : <LuPlay />}
          </IconButton>
        </Tooltip>
        {btn("Operació següent", <LuStepForward />, () => clock.step(1), end)}
        {btn("Al final (el tauler acabat)", <LuSkipForward />, () => clock.seek(prog.total), end)}
        <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" ms={2} me={3}>
          {fmtTime(clock.shown)} / {fmtTime(prog.total)}
        </Text>
        <ChoiceChips<SimSpeed>
          label="Velocitat"
          options={[
            { id: "1", label: "×1" },
            { id: "5", label: "×5" },
            { id: "20", label: "×20" },
            { id: "100", label: "×100" },
          ]}
          value={clock.speed}
          onChange={clock.setSpeed}
        />
      </HStack>
      <Slider.Root size="sm" aria-label={["Temps del programa"]} min={0} max={Math.max(prog.total, 0.001)} step={Math.max(prog.total / 2000, 0.001)} value={[clock.shown]} onValueChange={(e) => clock.seek(e.value[0] ?? 0)}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Text fontSize="xs" color={op ? "fg" : "fg.muted"} truncate>
        {op ? `${op.n} · ${[op.ref, opLabel(op)].filter(Boolean).join(" · ")} · ${op.tool === "-1" ? "eina automàtica" : op.tool}` : end ? "Programa acabat." : "Abans de començar."}
      </Text>
    </Stack>
  )
}
