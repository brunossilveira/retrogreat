# RetroGreat

A Manifest V3 Chrome extension that highlights, inside a Moxfield deck page, which
cards have a **modern retro-frame** printing — the 1997-style border reintroduced
as a treatment in recent sets (Modern Horizons and friends).

A card qualifies when Scryfall returns a printing matching `frame:1997 year>=2019`.

## How it works

- **`background.js`** — service worker. Holds the host permissions and makes all
  Scryfall calls (so the page's CORS never gets in the way). It dedupes names,
  splits them into ~15-name chunks, OR-joins them with exact-name syntax
  (`(!"A" or !"B") frame:1997 year>=2019`), waits ~100 ms between requests, and
  treats a `404` as "zero matches". Returns the set of matching cards.
- **`content.js`** — runs on the deck page. It reads the deck's card list, asks
  the worker which names have a retro-frame printing, and marks those cards (a
  gold ★ before list names, a gold outline on card images), plus a small count
  badge.
- **`shared.js`** — the card-key helpers and message name both contexts share.

Classes: `ScryfallClient` / `RetroFrameFinder` (worker), and
`MoxfieldApiDeckSource` / `DomDeckSource` / `DomCardScanner` / `DeckHighlighter` /
`Badge` (content).

Double-faced, split, and adventure cards are normalised to their front face
(`"Fire // Ice"` → `"Fire"`) for both the Scryfall query and the highlight match,
since that is how Scryfall's exact-name search keys them.

## Card-list source

**Primary: Moxfield's public deck API** — `GET https://api2.moxfield.com/v3/decks/all/<publicId>`,
where `<publicId>` is the segment after `/decks/` in the URL. The response shape
was confirmed against live decks:

```
boards.<board>.cards.<key>.card.name
```

with `<board>` ∈ `mainboard`, `sideboard`, `maybeboard`, `commanders`,
`companions`, `signatureSpells`, … . `card.name` follows Scryfall's naming
(double-faced cards are `"Front // Back"`). The fetch runs from the content
script with `credentials: "include"`, i.e. the exact request Moxfield's own SPA
makes, so it inherits the site's CORS allowance and the browser's Cloudflare
clearance.

This was verified end-to-end against a real deck
(`moxfield.com/decks/pH9VNN1t0UuD_X8cihRoaw`): 100 card names resolved to 30
retro-frame matches.

**Fallback: DOM scrape** — if the API call fails, `DomCardScanner` reads card
names already rendered in the page. Verified against the live deck DOM:

- Table / condensed views: card links `a.table-deck-row-link[href^="/cards/"]`.
  The name is split across `<span>`s, so `textContent` is concatenated and
  whitespace-collapsed (e.g. `"Allosaurus "` + `"Shepherd"` → `Allosaurus Shepherd`).
  Section headers ("Creatures", "Lands", …) use the same class but have no
  `/cards/` href, so they're excluded.
- Visual views: card images `img.img-card[alt]`, with `alt` values like
  `Front` / `Back` / `Transform` filtered out.

The two selectors live in `CARD_LINK_SELECTOR` / `CARD_IMAGE_SELECTOR` in
`content.js`; update them there if Moxfield changes its markup.

**Highlighting** uses the same scanner and is therefore markup-tolerant: it only
paints elements whose card name resolves to a confirmed retro-frame match, so a
CSS-class change at most requires updating those two selectors. The bottom-right
badge shows `found/total` while the list is still rendering and settles on the
final count.

## Load unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open any public deck, e.g. `https://www.moxfield.com/decks/pH9VNN1t0UuD_X8cihRoaw`.
   Retro-frame cards get a gold ★ and a count badge appears bottom-right.

Reload the extension from `chrome://extensions` after editing any file.
