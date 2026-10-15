## 2026-10-15 playtest corrections
- A class name shared between unrelated elements (`.face` on the splash lettering and on HUD portraits) threw the start prompt off
  centre. Before saying a screen is done, measure it (getBoundingClientRect against the container), do not eyeball a screenshot.
- When Gaylord reports how something reads in play (steering pose "turns right"), do it his way the first time and offer the
  convention as the alternative. Arguing geometry cost two rounds.
