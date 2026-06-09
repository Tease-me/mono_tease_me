# Admin UI Components

This document lists the current admin-focused UI building blocks in the frontend and the patterns that should be reused before adding new one-off admin styles.

## Core Layout

### `AdminLayout`
- Purpose: top-level admin page shell with nav, page title, subtitle, and optional header actions.
- Path: `src/ui/screens/admin/AdminLayout.tsx`
- Use when: building any standalone admin route.
- Notes: page body spacing and header treatment should come from this shell, not per-screen wrappers.

### `AdminTwoColumn`
- Purpose: resizable sidebar + main editor layout for admin workflows.
- Path: `src/ui/screens/admin/AdminTwoColumn.tsx`
- Use when: the page has selection in the left column and detail/editing in the right column.
- Notes: sidebar width is persisted in local storage. Prefer this over custom split layouts.

## Shared Admin Chrome

### `AdminChrome.module.css`
- Purpose: shared visual primitives for admin sidebars, panel headers, messages, pills, empty states, and action rows.
- Path: `src/ui/screens/admin/shared/AdminChrome.module.css`
- Use when: styling admin CRUD/editor screens that follow the standard shell.
- Covers:
  - sidebar containers and list items
  - panel header/title/meta rows
  - success and error banners
  - active/inactive/muted pills
  - empty-state cards
  - shared action rows
- Notes: this is the canonical style source for the new character admin screens. Reuse it before adding screen-local duplicates.

## Navigation and Switching

### `AdminNav`
- Purpose: admin route navigation drawer/sidebar.
- Path: `src/ui/screens/admin/AdminNav.tsx`
- Use when: adding a new top-level admin route entry.
- Notes: keep labels concise and route names stable.

### `TabsLayout`
- Purpose: lightweight shared tab switcher for prompt-editor style segmented content.
- Path: `src/ui/components/tabs/TabsLayout.tsx`
- Use when: switching between sibling content panels within a page.
- Notes: current implementation is simple click-state tabs. It is not a full route-aware nav primitive.

## Inputs and Form Controls

### `TextInput`
- Purpose: shared styled single-line input.
- Path: `src/ui/components/inputs/text-inputs/TextInput.tsx`
- Use when: a form should follow the app-wide input component pattern instead of a custom admin-only raw input.
- Notes: some admin screens still use local `<input>` elements. Prefer reuse if the screen does not need highly custom layout behavior.

### `TextAreaInput`
- Purpose: shared styled multiline input.
- Path: `src/ui/components/inputs/text-inputs/TextAreaInput.tsx`
- Use when: large text editing does not require a custom admin editor surface.

### `CheckBox`
- Purpose: shared checkbox control.
- Path: `src/ui/components/inputs/check-boxes/CheckBox.tsx`
- Use when: a screen needs a reusable checkbox instead of a custom inline input.

### `DropDownMenu`
- Purpose: shared dropdown/select pattern.
- Path: `src/ui/components/inputs/dropdown/DropDownMenu.tsx`
- Use when: a true menu/select interaction is needed instead of an accordion or list selector.

## Buttons and Feedback

### `PrimaryButton`
- Purpose: product-wide primary call-to-action button.
- Path: `src/ui/components/inputs/buttons/PrimaryButton.tsx`
- Use when: admin screens can use the shared button without conflicting with local dense layouts.

### `NormalButton`
- Purpose: general secondary button pattern.
- Path: `src/ui/components/inputs/buttons/NormalButton.tsx`
- Use when: a screen needs a shared button instead of page-local button classes.

### `ErrorMessage`
- Purpose: standalone error display component.
- Path: `src/ui/components/ErrorMessage.tsx`
- Use when: inline error rendering is needed outside the shared admin message card pattern.

### `BlockingLoader` / `LoadingSpinner`
- Purpose: loading states for blocking and inline waits.
- Paths:
  - `src/ui/components/loading/BlockingLoader.tsx`
  - `src/ui/components/loading/LoadingSpinner.tsx`
- Use when: loading needs stronger affordance than text-only placeholders.

## Media and Asset Patterns

### `LottieAnimation`
- Purpose: renders lottie JSON animations.
- Path: `src/ui/components/LottieAnimation.tsx`
- Use when: previewing lottie assets in admin or product UI.
- Notes: base character admin uses this for lottie preview after fetching the JSON.

### Character Admin Asset Preview Pattern
- Purpose: portrait-oriented media preview with upload/delete actions.
- Canonical screens:
  - `src/ui/screens/admin/characters/AdminCharacters.tsx`
  - `src/ui/screens/admin/influencer-character/AdminInfluencerCharacter.tsx`
- Use when: editing adult character artwork, lottie, image, or video assets.
- Notes: keep preview, readiness state, staged upload state, and destructive actions visually separated.

## Current Canonical Admin Screens

### `AdminCharacters`
- Purpose: global adult character catalog CRUD plus base asset management.
- Path: `src/ui/screens/admin/characters/AdminCharacters.tsx`
- Reuse from here:
  - sidebar item summary treatment
  - repeatable string-list editor for `first_messages`
  - base asset preview block

### `AdminInfluencerCharacter`
- Purpose: influencer-scoped adult character asset editing.
- Path: `src/ui/screens/admin/influencer-character/AdminInfluencerCharacter.tsx`
- Reuse from here:
  - accordion row editing pattern
  - staged upload panel UX
  - portrait media preview treatment for vertical assets

## Guidance

- Reuse `AdminLayout` and `AdminTwoColumn` for new admin tools unless the page is genuinely single-panel.
- Reuse `AdminChrome.module.css` for shared admin shell styling before creating new sidebar, banner, pill, or empty-state classes.
- Prefer extending an existing admin pattern over creating one more page-local variant.
- If a new admin screen needs a pattern that appears in more than one screen, extract it immediately or add it here as the canonical source.
