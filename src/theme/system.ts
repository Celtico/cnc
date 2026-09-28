import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  globalCss: {
    // Evita el zoom automàtic d'iOS en enfocar un camp (< 16px el dispara).
    "input, select, textarea": { fontSize: "16px" },
    html: { height: "100%" },
    body: {
      minHeight: "100dvh",
      bg: "bg",
      color: "fg",
      overscrollBehavior: "none",
    },
    "#root": { minHeight: "100dvh", display: "flex", flexDirection: "column" },
    // Etiquetes de camp sempre en una línia: si no hi caben, punts suspensius (i el text
    // sencer al passar-hi per sobre, vegeu truncatedTitles.ts).
    "[data-scope=field][data-part=label]": {
      display: "block",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "100%",
      minWidth: 0,
    },
  },
  theme: {
    tokens: {
      colors: {
        wood: {
          50: { value: "#fbf6ee" },
          100: { value: "#f3e6d0" },
          200: { value: "#e6cfa6" },
          300: { value: "#d6b076" },
          400: { value: "#c6924f" },
          500: { value: "#b57a37" },
          600: { value: "#98602c" },
          700: { value: "#7a4a27" },
          800: { value: "#653d25" },
          900: { value: "#543321" },
          950: { value: "#2f1a10" },
        },
      },
    },
    semanticTokens: {
      colors: {
        wood: {
          solid: { value: "{colors.wood.500}" },
          contrast: { value: "white" },
          fg: { value: { _light: "{colors.wood.700}", _dark: "{colors.wood.300}" } },
          muted: { value: { _light: "{colors.wood.100}", _dark: "{colors.wood.900}" } },
          subtle: { value: { _light: "{colors.wood.50}", _dark: "{colors.wood.950}" } },
          emphasized: { value: { _light: "{colors.wood.200}", _dark: "{colors.wood.800}" } },
          focusRing: { value: "{colors.wood.500}" },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
