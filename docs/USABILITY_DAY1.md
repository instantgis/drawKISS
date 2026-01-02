# Usability Observations - Day 1

First day of real usage: 3 sketches completed. The following issues were identified.

---

## Issue 1: Raw Image Wastes Screen Space

**Location:** Capture page, after saving an image

**Problem:** After saving a captured photo, the raw image preview occupies half the screen. The user's focus shifts to adding filter layers, but the filter work area is cramped and requires scrolling.

**Impact:** Frustrating on mobile. Hard to work with filters when half the viewport is occupied by an image you already saved.

---

## Issue 2: Capture and Layer Editing Are Coupled

**Location:** Capture page

**Problem:** Filter/layer creation is tightly coupled to the capture flow. There's no way to:
- Capture multiple photos in a session
- Leave and come back later to add filter layers
- Edit layers on an existing gallery image

**Impact:** Forces a linear workflow. Can't batch-capture then batch-edit.

---

## Issue 3: Filter Selector UI Is Clunky

**Location:** Capture page, filter controls

**Problem:** Native `<select>` dropdown with 11 filter options is:
- Too large on mobile
- Not touch-friendly
- Doesn't scale well as more filters are added
- Doesn't show all options at a glance

**Impact:** Slows down the filter selection workflow.

---

## Proposed Solutions

### Decouple Capture from Layer Editing

**Capture page** (`/capture`)
- Focused only on camera and saving photos
- After save: "Capture More" or "Edit Layers →"

**Layer Editor page** (`/edit/:imageId`) - NEW
- Dedicated page for adding/managing layers
- No raw image display (user already saw it)
- Accessible from:
  - Capture page (after save)
  - Gallery (click on image)
  - Easel (edit layers link)

### New Filter Selector Component

Replace dropdown with a grid of filter buttons:
- Visual, touch-friendly
- Shows all options at a glance
- Scales for future filters
- Current selection highlighted

---

## Status

- [ ] Create FilterSelectorComponent
- [ ] Create LayerEditorComponent with route `/edit/:imageId`
- [ ] Simplify Capture page (remove layer editing)
- [ ] Add "Edit Layers" action to Gallery
- [ ] Add "Edit Layers" link to Easel

---

*Documented: January 2026*

