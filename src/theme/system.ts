import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  globalCss: {
    body: {
      minHeight: "100dvh",
      bg: "bg",
      color: "fg",
      overscrollBehavior: "none",
    },
    "#root": { minHeight: "100dvh", display: "flex", flexDirection: "column" },
    // Cursor, una sola regla (és una app, no una web): fletxa per defecte (res de la I de text sobre etiquetes i
    // títols), la I només on s'escriu, la mà on un clic fa alguna cosa i `not-allowed` als desactivats. Arrossegar
    // (`grab`/`grabbing`), dibuixar (`crosshair`) i les vores (`col-resize`) es posen on es fan.
    html: { height: "100%", cursor: "default" },
    'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable=true]': {
      cursor: "text",
    },
    'button, [role=button], [role=tab], [role=treeitem], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=option], [role=radio], [role=checkbox], [role=switch], a[href], summary, select, label:has(> input:not([type=text]):not([type=number])), [data-scope=accordion][data-part=item-trigger], [data-scope=segment-group][data-part=item], [data-scope=tabs][data-part=trigger], [data-scope=switch][data-part=root], [data-scope=checkbox][data-part=root], [data-scope=radio-group][data-part=item]': {
      cursor: "pointer",
    },
    ":disabled, [aria-disabled=true], [data-disabled], :disabled *, [aria-disabled=true] *, [data-disabled] *": {
      cursor: "not-allowed",
    },
    // Peu dels diàlegs: si els botons no hi caben, baixen de línia; al mòbil, un per fila
    // a tota l'amplada (l'acció principal a dalt, Cancel·lar a baix).
    ".chakra-dialog__footer": {
      flexWrap: "wrap",
      "@media (max-width: 30em)": {
        flexDirection: "column-reverse",
        alignItems: "stretch",
        "& > *": { width: "100%" },
      },
    },
    // Controls segmentats (Plànol · 3D, 3D · Alçat · Foto…): en mode fosc, l'opció triada es
    // distingeix clarament (per defecte l'indicador és del mateix negre que el fons).
    ".dark [data-scope=segment-group][data-part=indicator]": {
      bg: "gray.600",
      boxShadow: "0 0 0 1px {colors.gray.500}",
    },
    ".dark [data-scope=segment-group][data-part=item][data-state=checked]": {
      color: "white",
    },
    // Textos d'interruptors i caselles que salten de línia: interlineat còmode (per defecte quedaven
    // enganxats) i l'interruptor alineat amb la primera línia.
    "[data-scope=switch][data-part=label], [data-scope=checkbox][data-part=label]": {
      lineHeight: "1.4",
    },
    "[data-scope=switch][data-part=root], [data-scope=checkbox][data-part=root]": {
      alignItems: "flex-start",
    },
    "[data-scope=switch][data-part=control], [data-scope=checkbox][data-part=control]": {
      marginTop: "1px",
    },
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
      // Mà = es pot clicar (Chakra hi posa la fletxa als ítems de menú, caselles, opcions i ràdios).
      cursor: {
        menuitem: { value: "pointer" },
        checkbox: { value: "pointer" },
        option: { value: "pointer" },
        radio: { value: "pointer" },
      },
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
