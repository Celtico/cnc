import { useState } from "react"
import { AMBIENT_TAB_KEY } from "../planGeom"

/** La vista (Plànol · 3D) es recorda; els ambients del catàleg s'obren al 3D. */
export function useAmbientTab() {
  const [tab, setTabState] = useState<"plan" | "3d">(() => {
    try {
      return localStorage.getItem(AMBIENT_TAB_KEY) === "3d" ? "3d" : "plan"
    } catch {
      return "plan"
    }
  })
  const setTab = (t: "plan" | "3d") => {
    setTabState(t)
    try {
      localStorage.setItem(AMBIENT_TAB_KEY, t)
    } catch {
      /* sense emmagatzematge */
    }
  }
  return [tab, setTab] as const
}
