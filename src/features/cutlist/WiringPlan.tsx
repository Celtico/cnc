import { Stack, Text } from "@chakra-ui/react"
import type { CompositionBuild } from "../../core/build/buildComposition"

/** Colors del plànol (tokens del tema, també en mode fosc): els que diu la llegenda de sota. */
const K = {
  cable: "var(--chakra-colors-orange-solid)",
  driver: "var(--chakra-colors-fg)",
  lamp: "var(--chakra-colors-yellow-solid)",
  hole: "var(--chakra-colors-blue-solid)",
  mains: "var(--chakra-colors-red-solid)",
}

const fmt = (v: number) => String(Math.round(v)).replace(".", ",")

/**
 * **Plànol de la instal·lació elèctrica d'un mòdul** (per decisió de l'usuari, 2026-10-14: «el que no és mecanitzat, un
 * plànol»), vist de davant: el contorn del mòdul, l'alimentador sobre la base, cada làmpada amb el recorregut del seu cable
 * fins a l'alimentador i la llargada, els passants del recorregut (ja als programes), l'interruptor i la sortida del cable
 * de xarxa pel fons. Les dades surten de la construcció (`Wiring`, `buildWiring`).
 */
export function WiringPlan({ item }: { item: CompositionBuild["wirings"][number] }) {
  const { width: W, height: H, wiring: w } = item
  const pad = 40
  const fy = (y: number) => H - y
  const fs = Math.max(11, Math.min(W, H) / 28)
  return (
    <Stack gap={1}>
      <Text fontSize="sm" fontWeight="medium">
        Mòdul {item.module} · {item.name}: instal·lació dels llums
      </Text>
      <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`} style={{ width: "100%", maxWidth: 560, height: "auto", background: "var(--chakra-colors-bg-subtle)", borderRadius: 8 }} role="img" aria-label="Plànol de la instal·lació elèctrica">
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--chakra-colors-fg-muted)" strokeWidth={2} />
        {/* Recorreguts dels cables (24 V) fins a l'alimentador. */}
        {w.runs.map((run, i) => (
          <polyline key={i} points={run.points.map(([x, y]) => `${x},${fy(y)}`).join(" ")} fill="none" stroke={K.cable} strokeWidth={3} strokeDasharray="10 6" />
        ))}
        <rect x={w.driver.x0} y={fy(w.driver.y1)} width={w.driver.x1 - w.driver.x0} height={Math.max(16, w.driver.y1 - w.driver.y0)} fill={K.driver} />
        {w.lamps.map((l, i) => (
          <circle key={i} cx={l.x} cy={fy(l.y)} r={14} fill={K.lamp} stroke={K.driver} strokeWidth={2} />
        ))}
        {w.holes.map((h, i) => (
          <circle key={i} cx={h.x} cy={fy(h.y)} r={6} fill="none" stroke={K.hole} strokeWidth={2} />
        ))}
        {w.switch && <rect x={w.switch.x - 8} y={fy(w.switch.y) - 8} width={16} height={16} fill={K.hole} />}
        {w.mains && (
          <>
            <rect x={w.mains.x - 20} y={fy(w.mains.y) - 8} width={40} height={16} fill="none" stroke={K.mains} strokeWidth={3} />
            <line x1={w.mains.x} y1={fy(w.mains.y)} x2={w.mains.x} y2={H + pad * 0.8} stroke={K.mains} strokeWidth={3} />
          </>
        )}
        <text x={w.driver.x0} y={fy(w.driver.y1) - 8} style={{ fontSize: fs }} fill="currentColor">
          Alimentador
        </text>
      </svg>
      <Stack gap={0.5} fontSize="xs" color="fg.muted">
        <Text>
          <b>Alimentador</b> {w.driver.name} ({w.driver.article}), {w.driver.where}, a darrere a l'esquerra, amb 50 mm lliures al voltant.
        </Text>
        {w.runs.map((r, i) => (
          <Text key={i}>
            <b>{r.from}</b>: {fmt(r.length)} mm de cable fins a l'alimentador (línia taronja); si no hi arriba, un cable d'extensió.
          </Text>
        ))}
        {w.holes.length > 0 && <Text>Cercles blaus: passants del cable a les peces (ja als programes, del Ø del cable de la làmpada). Els trams verticals van per darrere, tapats amb la tapa passacables.</Text>}
        {w.switch && <Text>Quadrat blau: l'interruptor ({w.switch.kind === "door" ? "sensor de porta al cantell del lateral esquerre, ja als programes" : "de proximitat, per cargolar on es vulgui"}).</Text>}
        {w.mains ? <Text>Requadre vermell: la sortida del cable de xarxa pel fons (40 × 16, hi passa l'endoll pla europeu), fins a l'endoll de la paret.</Text> : null}
        {w.notes.map((n, i) => (
          <Text key={i}>{n}</Text>
        ))}
      </Stack>
    </Stack>
  )
}
