import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "./components/ui/provider"
import { App } from "./App"
import { SettingsProvider } from "./features/settings/SettingsContext"
import { initAccent } from "./theme/accent"
import { initTruncatedTitles } from "./theme/truncatedTitles"
import "./theme/touch.css"

initAccent()
initTruncatedTitles()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </Provider>
  </StrictMode>,
)
