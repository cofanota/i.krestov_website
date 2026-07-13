Use only components and styles applyed in Figma file - if there is any conflicts to this document - stop working and give me a report of what should be made to system runs smoothly.

**HARD RULE:** Agents must fetch live Figma MCP data in the current session before implementing UI (`/.cursor/rules/figma-mcp-fresh-stop.mdc`). Stale cache or guesses = stop work.

## Global Constraints

- No JavaScript unless explicitly requested
- No CSS frameworks
- Semantic HTML only
- Full responcive web desktop and laptops, tablet and mobile
- Use rem units only

## Borders and component size

Figma strokes on interactive components use **Inside** alignment — stroke weight does not change the component’s outer width or height.

When implementing state borders (default, hover, active) in CSS:

- **Do not** change `border-width` between states — that shifts layout and makes the component jump.
- **Do** simulate inside strokes with `box-shadow: inset 0 0 0 <width> <color>` so only the stroke weight animates, not the box size.
- Keep padding and outer dimensions fixed across all states.

#Variables

##Colors
Colors provided in Figma variants - ignore Style kit page.
Colors devided by 2 groups:
1 – Brand colors as s source of truth
2 – Use colors as an actual tokens applyed to a components

All colors have light and dark versions for modes in interaface.

##Sizes
Sizes divided by a different groups
1 – Radius, use only for a corner radius
2 – Spacing, use for in component/block spacings
3 – Levels, use this as a source of truth for other spacing.

All Sizes provided in 3 size levels. Manually apply size provided by component instance. Bigger sizes applied manually.

##Typography
Describes avaiable fonts and sizes.

#Components
All components page include components itself and their instance test. Divided to a few pages:

1 – Components, ungrouped various components
2 – Actions
3 – Inputs
4 – Selectors
5 – Tech zone, only for Figma usage, igore it.

##Icons
Only avaiable icons to use. Don't create nothing extra.

#Responsivles
Use provided Web and Mobile grid to match visually. I provide only web format. Create matching solutions for tablets and bigger displays. Goal - is to make enough space to place content and keep using the same components.

