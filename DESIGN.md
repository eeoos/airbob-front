# Airbob Design Foundation

Airbob is a calm, trustworthy marketplace for finding a place to stay. Its
visual identity starts with the sky blue already present in the Airbob
wordmark, not with another marketplace's brand color.

The first design slice covers the global header, search results, listing cards,
and the top of accommodation detail. Later routes may keep the legacy coral
tokens until their approved redesign phase. This staged adoption is deliberate:
do not globally remap a legacy token to force an unfinished migration.

## Principles

1. **Airbob first.** Use Airbob's name, wordmark, sky palette, product copy, and
   owned assets. Marketplace patterns may inform hierarchy, but third-party
   logos, copy, proprietary assets, and pixel-matched layouts do not belong here.
2. **The stay is the focus.** Media, destination, dates, guests, price, and the
   next action should win the hierarchy. Decoration should stay quiet.
3. **Calm under uncertainty.** Loading, empty, retryable, terminal, and image
   failure states reserve stable geometry and explain the next available action.
4. **One experience at every width.** Reflow at the existing breakpoint
   contract; do not create a separate, reduced mobile product.
5. **Accessible by default.** A visible keyboard focus, a 44px interaction
   target, semantic state announcements, and reduced motion are product rules.

## Color Roles

| Role           | Token                                            | Default   | Use                                                |
| -------------- | ------------------------------------------------ | --------- | -------------------------------------------------- |
| Identity       | `--color-brand-identity`                         | `#7bc8f0` | Wordmark-adjacent and quiet identity surfaces      |
| Brand ink      | `--color-brand-ink`                              | `#14323f` | High-emphasis Airbob text and illustration details |
| Primary action | `--color-action-primary`                         | `#19769d` | Search, continue, retry, and booking actions       |
| Primary hover  | `--color-action-primary-hover`                   | `#125a79` | Hover/active reinforcement for primary actions     |
| Accent         | `--color-action-accent`                          | `#c9473d` | Favorites and rare high-salience accents           |
| Subtle surface | `--color-surface-brand-subtle`                   | `#f4fafc` | Skeletons, soft hover, and non-critical emphasis   |
| Focus          | `--color-focus-visible` / `--focus-ring-visible` | sky 700   | New and redesigned interactive surfaces            |

`--color-brand-coral` and its related aliases remain compatibility tokens for
routes outside the current slice. New work should choose a purpose-specific
action or identity token instead.

## Typography

Use the shared font family and the existing size scale. Prefer the tokenized
weights and line heights below instead of local numeric values:

- Body: regular or medium with `--line-height-body`.
- Labels and controls: semibold with `--line-height-tight`.
- Section and screen headings: bold with `--line-height-heading`.
- Prices: semibold or bold; use size and spacing rather than extra color for
  hierarchy.

Korean and Latin content must remain readable without a font download. Any
self-hosted font enhancement must keep the shared fallback stack and use
`font-display: swap`.

## Shape, Space, and Elevation

- Keep the existing 4px spacing scale. Default page gutters are 16px on phones,
  24px on intermediate widths, and 40px or more only where the page container
  has room.
- Use `--radius-action` for prominent controls,
  `--radius-content-card` for media/cards, and `--radius-dialog` for overlays.
- Use `--shadow-surface`, `--shadow-floating`, and `--shadow-sticky` according
  to actual elevation. Do not stack decorative shadows.
- Search listing media uses `--listing-card-media-ratio`. The legacy square
  media ratio remains available to routes that have not migrated.

## Motion

Use the shared fast/base/slow durations for interaction feedback. Skeletons may
use the ambient duration, but motion must not communicate information by itself.
Under `prefers-reduced-motion: reduce`, remove shimmer, slide, and scale motion;
preserve state changes with color, borders, text, and layout.

## State and Media Rules

- A cold load announces one polite status and may show screen-owned Skeleton
  geometry. Skeleton elements stay outside the accessibility tree.
- A background refresh keeps useful content visible and announces only its
  local busy state.
- Empty states explain what is empty without implying a failure.
- Retryable failures provide one clear retry action. Terminal failures do not.
- Do not announce the same failure through both a Toast and an inline alert.
- Missing and failed images reserve the same aspect ratio as successful media.
  Meaningful fallbacks use the accommodation name in their accessible label;
  decorative fallback details are hidden.

## Responsive and Interaction Contract

Keep the canonical 480, 768, 1024/1025, 1200, and 1400px boundaries. At 320px,
the primary content and actions must remain visible without horizontal scrolling.
The search map/sheet transition stays at 1024/1025px.

All primary interactive targets are at least `--control-touch-target` in both
dimensions. Keyboard focus uses `--focus-ring-visible`, follows visual order,
is never hidden by sticky UI, and returns to its opener after dismissing an
overlay. Drag interactions retain button or keyboard alternatives.

## Architecture Boundary

This foundation changes presentation and local interaction quality only. It
does not move route ownership, introduce global state, alter API contracts, or
redesign booking/payment workflows. Shared UI remains domain-free: screens own
their content skeletons and state composition, while shared primitives own only
repeatable rendering and accessibility behavior.
