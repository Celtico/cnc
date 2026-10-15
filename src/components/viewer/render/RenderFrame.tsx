import type { ReactNode } from "react"
import { FloatingWindow } from "../../FloatingWindow"

/**
 * La finestra del Render: una `FloatingWindow` (no modal: es pot continuar treballant mentre calcula), gran i al mig de la
 * zona de treball. Minimitzada, només la barra, amb el progrés. Al mòbil, sempre a tota la pantalla; es tanca (el render
 * continua) i es torna a obrir des del menú (`RenderStatusNav`). `shown` puja cada cop que es demana veure'l: si era
 * minimitzat, es restaura.
 */
export function RenderFrame({ open, onClose, shown, name, progress, onMinimizedChange, children }: { open: boolean; onClose: () => void; shown: number; name: string; /** Progrés curt per a la barra de títol (buit si encara no ha començat). */ progress: string; onMinimizedChange: (minimized: boolean) => void; children: ReactNode }) {
  return (
    <FloatingWindow
      id="render"
      open={open}
      onClose={onClose}
      shown={shown}
      title={`Render · ${name}`}
      subtitle={progress || undefined}
      initialFocus={false}
      onStageChange={(stage) => onMinimizedChange(stage === "minimized")}
      minimizeHint="Minimitzar: el render continua"
      closeHint="Tancar: si calcula, continua (es torna a obrir des del menú)"
      // El cos és un contenidor: la imatge i les opcions van de costat o una sota l'altra segons l'amplada del panell.
      bodyProps={{ p: 3, css: { containerType: "inline-size", containerName: "render" } }}
    >
      {children}
    </FloatingWindow>
  )
}
