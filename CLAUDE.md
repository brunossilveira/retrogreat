# CLAUDE.md

Guidance for working in this repo. RetroGreat is a Manifest V3 Chrome extension
that highlights, inside a Moxfield deck page, which cards have a **modern retro
frame** printing (the 1997 border reintroduced in recent sets).

## What "retro frame" means (authoritative — do not change)

A card qualifies when Scryfall returns a printing matching `frame:1997 year>=2019`.

The Scryfall core lives in `background.js` and must be preserved in spirit:
- Frame filter constant: `frame:1997 year>=2019`
- Exact-name escaping: `!"<name with double-quotes stripped>"`
- Names are de-duplicated before querying.

## Architecture

- **`background.js`** (service worker) — owns host permissions and makes all
  Scryfall calls. `ScryfallClient` does one search request (404 ⇒ zero matches,
  not an error). `RetroFrameFinder` de-dupes names, chunks them (~15 per query),
  OR-joins exact names, waits ~100 ms between requests, and returns matching
  card keys. Message type: `FIND_RETRO_FRAMES` → `{ matches: string[] }`.
- **`content.js`** (runs on the deck page) — gets the card list, asks the worker
  which names match, highlights them. Classes: `MoxfieldApiDeckSource`,
  `DomCardScanner` / `DomDeckSource`, `DeckHighlighter`, `Badge`.
- **`content.css`** — highlight styles, injected via the manifest (NOT from JS).
- **`manifest.json`** — content script matches both `www.moxfield.com` and the
  bare `moxfield.com` (Moxfield's own share URLs omit `www`).

## Card key contract (split / double-faced cards)

Everything keys on the **front face, lowercased**: `cardKey(name) =
name.split("//")[0].trim().toLowerCase()`. This function is duplicated in both
`background.js` and `content.js` and the two copies MUST agree. Moxfield's table
view shows only the front face (`"Bala Ged Recovery"`); Scryfall returns the full
name (`"Bala Ged Recovery // Bala Ged Sanctuary"`); both reduce to the same key.

## Data sources (verified against live decks — re-verify before changing)

**Primary — Moxfield public API:** `GET https://api2.moxfield.com/v3/decks/all/<publicId>`
where `<publicId>` is the path segment after `/decks/`. Card names live at
`boards.<board>.cards.<key>.card.name`, with `<board>` ∈ `mainboard`, `sideboard`,
`maybeboard`, `commanders`, `companions`, `signatureSpells`, … . Fetched from the
content script with `credentials: "include"` so it mirrors the SPA's own request
(inherits its CORS allowance + Cloudflare clearance).

**Fallback — DOM scrape:** if the API fails, scrape the rendered page.
- Table / condensed views: `a.table-deck-row-link[href^="/cards/"]`. The name is
  split across child `<span>`s, so use `textContent` (whitespace-collapsed).
  Section headers ("Creatures", "Lands") share the class but have no `/cards/`
  href, so the selector excludes them.
- Visual views: `img.img-card[alt]`, filtering `Front`/`Back`/`Transform` alts.

Selectors are centralised in `CARD_LINK_SELECTOR` / `CARD_IMAGE_SELECTOR` in
`content.js`. The highlighter reuses the same scanner, so it only ever paints
elements whose name resolves to a confirmed match — a Moxfield CSS-class change at
most means updating those two constants.

## Gotchas learned the hard way

- **Cloudflare** blocks all non-browser requests to Moxfield (curl, server-side
  fetch). You cannot inspect the API or page from a shell — it only works inside a
  real browser, which is where the extension runs. To inspect during development,
  use a JS-rendering reader proxy (e.g. `r.jina.ai`).
- **CSP**: a `<style>` injected from JS can be blocked by Moxfield's CSP, leaving
  cards classed but unstyled. Keep highlight CSS in the manifest-declared
  `content.css`, never inject it from the content script.
- **Timing**: the deck list renders after `document_idle`. `run()` waits for the
  list (`waitForDeck`) and a `MutationObserver` re-applies highlights on view/sort
  changes and SPA navigation between decks. The observer disconnects during
  `apply()` so the badge update doesn't re-trigger it.
- **`www`**: keep both host forms in the manifest `matches` and `host_permissions`.

## Testing / verifying a change

No build step. Load unpacked at `chrome://extensions` (Developer mode → Load
unpacked → this folder); after any edit hit ↻ on the card, then refresh the deck.
`[retro-frame]` console logs trace each stage (load → names → Scryfall matches →
highlighted N/total). Known-good deck with 30 matches:
`https://www.moxfield.com/decks/pH9VNN1t0UuD_X8cihRoaw`.

## Conventions

OOP with clean class boundaries; good names over comments; minimal comments.
Match existing style. No AI attribution in commits or PRs.
