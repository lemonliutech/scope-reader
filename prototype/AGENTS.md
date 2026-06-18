# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable design decisions

- The desktop page has exactly two content columns: chapter article on the left and chapter tree on the right.
- The columns must share one `1px` divider with `column-gap: 0`; never place an empty grid track or large gutter between them.
- The article content ends no more than `16px` before the divider. Remaining viewport whitespace stays outside the centered workspace.
- Use Wiki-style information density, heading rules, link color, and outline hierarchy without copying Wiki's extra sidebars or appearance controls.
