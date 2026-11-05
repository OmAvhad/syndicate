# Web3 Product UI --- Shared Design System & Development Guidelines

> **Purpose:** This document is the single source of truth for the
> visual language, interaction patterns, motion design, and frontend
> conventions of this application. Every contributor and every AI coding
> agent must follow it when creating or modifying a screen.
>
> **Creative direction:** CRED-inspired premium digital experience ---
> cinematic, refined, expressive, and highly interactive --- adapted for
> a trustworthy blockchain product. Take inspiration from the quality of
> the experience, not by copying CRED's branding or screens.

------------------------------------------------------------------------

## 1. Non-negotiable principles

1.  **One product, one design language.** Every screen must feel like
    part of the same application, regardless of who builds it.
2.  **Experience over template.** Do not default to generic SaaS
    dashboards, generic Web3 layouts, or collections of identical cards.
3.  **Premium, not noisy.** Use dramatic visual moments intentionally.
    Avoid constant glow, excessive gradients, random glassmorphism, and
    animation for animation's sake.
4.  **Function before spectacle.** Important blockchain actions must
    remain clear, understandable, accessible, and predictable.
5.  **Reuse before inventing.** Check existing tokens and shared
    components before creating new styles or patterns.
6.  **Responsive by design.** Every screen must work on desktop, tablet,
    and mobile.
7.  **Performance is part of design.** Motion and 3D effects must not
    make the product sluggish.

If a design decision conflicts with this document, follow this document
unless the team explicitly updates it.

------------------------------------------------------------------------

## 2. Brand and visual direction

### Desired feel

-   Premium fintech with a distinctive Web3 identity.
-   Dark, atmospheric surfaces with carefully controlled highlights.
-   Strong editorial typography and deliberate negative space.
-   Layered compositions, subtle depth, and purposeful motion.
-   Precise alignment, consistent spacing, and excellent readability.
-   Trustworthy enough for financial and blockchain-related actions.

### Avoid

-   Generic dashboard templates.
-   Rainbow gradients or unrelated accent colors.
-   Glowing borders on every card.
-   Excessive blur and glass panels.
-   Random floating coins, tokens, cubes, or crypto clip art.
-   Too many cards competing for attention.
-   Large empty hero sections with generic copy.
-   Emoji used as interface icons.
-   Unnecessary animation on every element.

------------------------------------------------------------------------

## 3. Design tokens

Use these values as the initial shared palette. Implement them as CSS
variables or the project's existing token format. Do not scatter raw
color values throughout components.

``` css
:root {
  /* Core surfaces */
  --color-bg: #0B0D0F;
  --color-surface: #141719;
  --color-surface-raised: #1A1E21;
  --color-surface-hover: #202629;

  /* Brand accents */
  --color-accent: #C6F36A;
  --color-accent-muted: #9FCA4F;
  --color-accent-soft: rgba(198, 243, 106, 0.12);

  /* Text */
  --color-text-primary: #F4F5F2;
  --color-text-secondary: #A0A6A8;
  --color-text-muted: #737B7E;
  --color-text-inverse: #0B0D0F;

  /* Borders */
  --color-border: #252A2D;
  --color-border-strong: #343B3F;

  /* Semantic states */
  --color-success: #79D99A;
  --color-warning: #F0C674;
  --color-danger: #F07F7F;
  --color-info: #83B9F2;

  /* Shape */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  /* Spacing — use a consistent 4px base scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Motion */
  --motion-fast: 160ms;
  --motion-normal: 260ms;
  --motion-slow: 420ms;
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### Token usage rules

-   `--color-bg` is the main application background.
-   `--color-surface` is for standard panels and cards.
-   `--color-surface-raised` is for popovers, menus, and elevated
    content.
-   Use the accent color for primary actions, active states, and key
    highlights --- not as a general decoration.
-   Use semantic colors consistently. Green means success/positive,
    amber means warning/pending attention, and red means error/negative.
-   Borders should usually be subtle. Prefer a 1px border over a heavy
    shadow.
-   Do not introduce a new color for an individual screen without adding
    it to the shared token system.

------------------------------------------------------------------------

## 4. Typography

### Font direction

Use **Geist** or **Inter**, depending on what is already installed in
the project. Do not mix multiple unrelated font families.

### Hierarchy

-   Display: large, expressive headlines for hero or campaign moments.
-   H1: page title.
-   H2: major section heading.
-   H3: card or subsection heading.
-   Body: readable interface content.
-   Caption: metadata, helper text, timestamps, and secondary labels.

### Rules

-   Use a clear, consistent type scale and weight hierarchy.
-   Avoid making every heading oversized or bold.
-   Use tabular numerals for balances, prices, percentages, and
    transaction values.
-   Keep body text readable; do not use low-contrast grey for important
    instructions.
-   Use uppercase sparingly, mainly for short metadata labels.
-   Do not use typography as decoration at the expense of clarity.

------------------------------------------------------------------------

## 5. Layout and composition

### Global layout

-   Establish a consistent page container and content width.
-   Align page titles, section headings, content blocks, and controls to
    a shared grid.
-   Use consistent horizontal gutters and vertical spacing.
-   Navigation should be recognizable and consistent across all screens.
-   Use a sidebar only if it supports the product's information
    architecture. Do not add one automatically.
-   Keep primary actions visually prominent and in predictable
    locations.

### Cards and panels

-   Use cards when they group related information or actions.
-   Avoid putting every individual data point inside its own card.
-   Use consistent padding, radius, border, and heading placement.
-   Use elevation sparingly to establish hierarchy.
-   Keep card content aligned across related screens.

### Responsive behaviour

-   Desktop: use the available width with deliberate maximum content
    widths.
-   Tablet: simplify multi-column layouts without shrinking content
    excessively.
-   Mobile: stack content logically, preserve action priority, and avoid
    horizontal overflow.
-   Tables should have a mobile-friendly alternative such as stacked
    rows or a controlled horizontal scroll area.
-   Touch targets should be comfortably tappable.

------------------------------------------------------------------------

## 6. Motion and interaction system

Motion is a core part of the product identity. It should feel smooth,
intentional, and premium --- never distracting.

### Motion principles

-   Prefer smooth easing over linear movement for interface transitions.
-   Use short transitions for controls and slightly longer sequences for
    page-level storytelling.
-   Animate opacity and transform where possible.
-   Avoid animating layout-heavy properties when a transform can achieve
    the same result.
-   Do not animate every element simultaneously.
-   Use staggered sequences to guide attention.
-   Provide reduced-motion alternatives.

### Approved motion patterns

  -----------------------------------------------------------------------
  Pattern                 Appropriate use         Guidance
  ----------------------- ----------------------- -----------------------
  Fade + rise             Content and section     Subtle vertical
                          entrances               movement with opacity

  Stagger                 Lists, grids, and       Reveal items in a
                          grouped content         controlled sequence

  Parallax                Hero or storytelling    Keep movement
                          sections                restrained

  3D tilt                 Featured interactive    Small angle; disable on
                          cards                   touch if unsuitable

  Magnetic response       Prominent CTA buttons   Subtle cursor response;
                                                  preserve click target

  Number animation        Balances and analytics  Animate only when
                                                  values update or first
                                                  appear

  Shared-element          Navigation between      Maintain continuity and
  transition              related views           avoid disorientation

  Modal transition        Dialogs and             Fade and scale gently
                          confirmations           

  Progress animation      Transaction lifecycle   Reflect actual
                                                  progress, never fake
                                                  confirmation

  Hover feedback          Buttons, links, cards   Small color, border, or
                                                  transform response
  -----------------------------------------------------------------------

### Suggested timing

-   Micro-interactions: 120--200ms.
-   Standard component transitions: 180--300ms.
-   Dialog and panel transitions: 220--360ms.
-   Hero and storytelling sequences: 400--800ms, only when appropriate.

These are guidelines, not a reason to slow down frequent interactions.

### Blockchain-specific motion

A blockchain transaction must have clear and honest states:

1.  **Ready:** action can be initiated.
2.  **Wallet request:** user is asked to review and approve in their
    wallet.
3.  **Submitted / pending:** transaction has been submitted; show a
    pending state and transaction reference when available.
4.  **Confirmed:** show success only after confirmation is verified by
    the application.
5.  **Failed / rejected:** explain whether the wallet request was
    rejected or the transaction failed, when that information is
    available.

Never show a success animation before the application has verified
success. Never use animation to hide latency or uncertainty. Provide a
useful fallback if the transaction status cannot be determined.

------------------------------------------------------------------------

## 7. Shared component standards

Build and reuse shared components wherever possible. Suggested shared
components include:

-   `AppShell` --- global page structure.
-   `TopNavigation` / `SidebarNavigation` --- shared navigation.
-   `PageHeader` --- title, description, and page actions.
-   `Button` --- primary, secondary, tertiary, and destructive variants.
-   `IconButton` --- accessible icon-only control with a tooltip or
    label.
-   `Surface` / `Card` --- shared panel treatment.
-   `StatusBadge` --- consistent pending, success, failed, and neutral
    states.
-   `Modal` / `Drawer` --- shared dialog and mobile panel behaviour.
-   `Tooltip` --- consistent contextual help.
-   `Toast` --- success, warning, and error feedback.
-   `Skeleton` --- loading placeholders.
-   `EmptyState` --- helpful no-data presentation.
-   `ErrorState` --- actionable error presentation.
-   `TransactionStatus` --- shared transaction lifecycle display.
-   `WalletConnectButton` --- consistent wallet connection states.
-   `NetworkSelector` --- consistent chain/network selection.
-   `DataTable` --- shared table density, typography, and responsive
    behaviour.

### Component requirements

Every interactive component must define:

-   Default state.
-   Hover state (where relevant).
-   Focus-visible state.
-   Active state.
-   Disabled state.
-   Loading state (where relevant).
-   Error or success feedback (where relevant).

Use semantic HTML and accessible labels. Icon-only buttons must have
accessible names. Do not create visually clickable elements that do
nothing.

------------------------------------------------------------------------

## 8. Data visualisation and blockchain information

-   Make balances, token amounts, fees, and transaction details easy to
    scan.
-   Use consistent number formatting, currency formatting, and decimal
    precision.
-   Distinguish estimated values from confirmed on-chain values.
-   Label networks and tokens clearly; do not rely on color alone.
-   Show timestamps and transaction identifiers where useful.
-   Use charts only when they help explain a trend or comparison.
-   Keep chart axes, tooltips, legends, and empty states consistent.
-   Make copyable addresses and hashes visibly discoverable.
-   Long wallet addresses and hashes should be truncated visually but
    remain copyable in full.
-   Explain unfamiliar blockchain terms with concise helper text or
    tooltips.

------------------------------------------------------------------------

## 9. Icons, imagery, and 3D

-   Use one consistent icon family, preferably Lucide.
-   Keep icon stroke weight and sizing consistent.
-   Do not mix outline, filled, emoji, and 3D icons randomly.
-   Use custom 3D assets only when they support the product story.
-   3D elements should have a clear focal point and restrained lighting.
-   Avoid stock crypto imagery and generic coin illustrations.
-   Provide a static or simplified fallback if 3D cannot load.
-   Optimise 3D assets and lazy-load non-critical visual elements.

------------------------------------------------------------------------

## 10. Technical implementation guidance

Use the stack already established by the project. Do not replace
frameworks or introduce dependencies without a reason.

Preferred tools when compatible with the existing project:

-   **React / Next.js:** application UI.
-   **Tailwind CSS:** styling and responsive utilities.
-   **Motion (Framer Motion):** component and page transitions.
-   **GSAP:** complex timeline and scroll-driven sequences.
-   **Three.js / React Three Fiber:** purposeful 3D scenes.
-   **Lenis:** smooth scrolling, only if it does not interfere with
    native scrolling or accessibility.

### Engineering rules

-   Use shared design tokens rather than one-off values.
-   Extract reusable components instead of duplicating markup and
    styles.
-   Keep animation logic local to the component or shared motion
    utilities.
-   Avoid unnecessary dependencies and oversized bundles.
-   Lazy-load heavy scenes and below-the-fold content.
-   Respect `prefers-reduced-motion`.
-   Avoid scroll hijacking and interactions that block normal
    navigation.
-   Ensure keyboard navigation and visible focus states.
-   Test on touch devices; do not make hover the only way to access
    functionality.
-   Do not add fake data or pretend a blockchain action is connected to
    a real network.

------------------------------------------------------------------------

## 11. Screen design workflow for every contributor

Before implementing a screen:

1.  Understand the screen's purpose and primary user action.
2.  Review this document and inspect existing screens.
3.  Reuse existing components and tokens.
4.  Sketch the content hierarchy and responsive layout.
5.  Identify which interactions need motion and why.
6.  Implement the screen using the shared design system.
7.  Add loading, empty, error, disabled, and success states as
    applicable.
8.  Test the screen at desktop and mobile widths.
9.  Check keyboard access and reduced-motion behaviour.
10. Compare the finished screen against the rest of the application.

Do not invent a new navigation pattern, color palette, button style,
card radius, or animation language for an individual screen.

------------------------------------------------------------------------

## 12. Definition of done

A screen is not complete until:

-   [ ] It uses the shared color, typography, spacing, and radius
    tokens.
-   [ ] It looks and feels consistent with the other application
    screens.
-   [ ] It reuses shared components where applicable.
-   [ ] Its primary action is immediately understandable.
-   [ ] Interactive controls have hover, focus, active, and disabled
    states as applicable.
-   [ ] Loading, empty, error, and success states are handled where
    relevant.
-   [ ] Motion is purposeful, smooth, and not excessive.
-   [ ] Reduced-motion preferences are respected.
-   [ ] It works on desktop, tablet, and mobile.
-   [ ] There is no horizontal overflow or broken layout.
-   [ ] Blockchain status is truthful and based on actual application
    state.
-   [ ] No placeholder controls or misleading success states remain.

------------------------------------------------------------------------

## 13. Mandatory instructions for AI coding agents

When asked to build or modify any screen, follow these instructions:

1.  Read this entire `UI_GUIDELINES.md` before writing code.
2.  Inspect the existing project structure, shared components, tokens,
    and neighbouring screens.
3.  Extend the current design system; do not create a competing one.
4.  Use the established project stack and conventions.
5.  Reuse shared components. If a reusable component is missing and
    would benefit multiple screens, create it in the shared component
    area.
6.  Do not rewrite unrelated screens or change global styles
    unnecessarily.
7.  Do not remove existing functionality to achieve a visual result.
8.  Do not add arbitrary colors, fonts, shadows, radii, or animation
    styles.
9.  Make the requested screen responsive and accessible.
10. After implementation, report which shared components and tokens were
    reused, what new shared components were added, and any deviations
    from this guide.

**If a requested design conflicts with these guidelines, preserve the
shared design language and explain the conflict before introducing a new
pattern.**

------------------------------------------------------------------------

## 14. How the team should maintain this document

This file is a living design-system contract.

-   Keep it in the root of the repository as `UI_GUIDELINES.md`.
-   Ask every contributor to read it before implementing a screen.
-   Ask every AI coding agent to read it before generating UI.
-   Put shared tokens and reusable components in the actual codebase;
    this Markdown file documents their intended use but does not replace
    implementation.
-   If the team approves a new visual pattern, update this document and
    the shared components together.
-   Avoid screen-specific exceptions unless there is a clear product
    reason.

**The standard:** A user should be able to move from one screen to
another and feel that the same thoughtful, premium product designed both
--- even when different developers built those screens.
