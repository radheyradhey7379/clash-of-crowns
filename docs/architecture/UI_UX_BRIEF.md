# UI/UX Design Brief & Guidelines - Clash of Crowns

## 1. Visual Aesthetics & Design Palette (UI_GUIDELINES)
The design philosophy of Clash of Crowns is "Vibrant Neo-Classicism". It couples rich classic textures (gold, polished wood, hand-sculpted marble) with clean, high-contrast digital utility layouts (neon shadows, semi-transparent dark borders, glassmorphism overlays).

### A. Color Palette
*   **Slate Dark Background (Canvas):** `rgb(9, 9, 11)` (Tailwind Zinc-950) - provides an ultra-premium, dark, cinematic viewport contrast.
*   **Gold Premium Accent:** `rgb(234, 179, 8)` (Tailwind Yellow-500) - used for champion rankings, premium badges, and active selections.
*   **Level Borders (Tiers):**
    *   *Beginner Green:* `#338033` (Representing fresh cadet growth).
    *   *Intermediate Ochre:* `#80660d` (Representing rising commanders).
    *   *Grandmaster Imperial:* `#99660d` (Representing the highest elite crowns).
*   **Board Coordinates (Dark & Light squares):** Customized to match selected styles (Wood grain textures, Marble greyscale, Neon luminescent cyan/pink).

### B. Typography
*   **Interface sans-serif:** **Inter** (Primary sans), sleek and highly legible for settings, data charts, and coordinate grids.
*   **Display / Large Headers:** **Outfit / Space Grotesk** - delivers a tech-forward royal chess ambiance.
*   **Status / Log Indicators:** **JetBrains Mono** - utilized for real-time move telemetry, coordinates, statistics values, and ping/RTT indicators.

---

## 2. Interactive Components & Layout Rules (UI_UX_BRIEF)

### A. Glassmorphism HUD (Heads-Up Display)
During 3D chess matches, the controls must float cleanly over the active arena.
*   Use `backdrop-blur-md` with semi-transparent borders (`border border-white/10`) to let the ambient 3D scene glow behind the HUD controls.
*   Active buttons should pop on hover (`transition-all durations-300 hover:scale-105 hover:border-white/20`).

### B. The 360° Responsive Arena
*   The chess canvas is fluid: `w-full h-full max-w-7xl mx-auto`.
*   Mobile responsive: HUD overlays are repositioned to stack vertically at the bottom on standard mobile layouts, while keeping the main central board within the thumb touch zone.
*   Touch targets for buttons and side navigation must remain at least **44px** to allow fast, fat-finger-free navigation on phones.

### C. Aesthetic Material Themes

```
+------------------+-------------------------------------------------------------+
| Theme            | Core Visual Accent & Textures                               |
+------------------+-------------------------------------------------------------+
| Classical Slate  | Alabaster white, obsidian pieces, emerald felt tiles        |
| Wood & Forest    | Walnut dark grain, maple light grain, warm bronze lighting  |
| Nero Marble      | Black Onyx and white Carrara marble tiles, chrome pieces     |
| Cyber Neon       | Cyberpunk grid matching neon-pink & electric cyan lights     |
+------------------+-------------------------------------------------------------+
```

---

## 3. Standard UI Rules & Transitions
*   **Animations:** Use Framer Motion (`motion`) for screen entry. Avoid harsh, jarring element injections. Use light fade-staggers (`y: 10 -> 0`, `opacity: 0 -> 1`) on card grids.
*   **Hover States:** All interactive 3D assets or regular HTML buttons must provide visible cursor transitions.
*   **Contrast Standards:** Ensure any text or numeric values overlaying dark cards are styled in high-visibility grey or clear white (`text-zinc-100`/`text-zinc-400`) to guarantee extreme clarity under low-lit ambient conditions.
