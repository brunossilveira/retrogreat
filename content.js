"use strict";

(() => {
  console.log("[retro-frame] content script loaded on", location.href);

  // Canonical key shared with the background worker: split / double-faced names
  // ("Front // Back") collapse to their front face, lowercased.
  const frontFace = (name) => name.split("//")[0].trim();
  const cardKey = (name) => frontFace(name).toLowerCase();

  const DeckUrl = {
    // https://www.moxfield.com/decks/<publicId>[/...]
    publicId(href) {
      const match = new URL(href).pathname.match(/^\/decks\/([^/?#]+)/);
      const id = match?.[1];
      if (!id || id === "public") return null;
      return id;
    },
  };

  // Walks the verified v3 shape: boards.<board>.cards.<key>.card.name.
  // Tolerates the older flat shape (mainboard/sideboard/... at the top level).
  class MoxfieldApiDeckSource {
    constructor(publicId) {
      this.publicId = publicId;
    }

    async cardNames() {
      const url = `https://api2.moxfield.com/v3/decks/all/${this.publicId}`;
      const response = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Moxfield responded ${response.status}`);
      return this._extractNames(await response.json());
    }

    _extractNames(deck) {
      const boards = deck.boards || deck;
      const names = [];
      for (const board of Object.values(boards)) {
        const cards = board?.cards;
        if (!cards || typeof cards !== "object") continue;
        for (const entry of Object.values(cards)) {
          const name = entry?.card?.name;
          if (name) names.push(name);
        }
      }
      return names;
    }
  }

  // Card-name nodes Moxfield renders into the page. Verified against the live
  // DOM: table/condensed views use card links (the name is split across spans,
  // so textContent is concatenated); visual views use card images (alt = name).
  // Selectors are centralised here; update them if Moxfield changes its markup.
  const CARD_LINK_SELECTOR = 'a.table-deck-row-link[href^="/cards/"]';
  const CARD_IMAGE_SELECTOR = "img.img-card[alt]";
  const NON_CARD_ALT = /^(front|back|transform|card|loading)$/i;

  const cleanName = (text) => (text || "").replace(/\s+/g, " ").trim();

  class DomCardScanner {
    static scan() {
      const found = [];
      for (const link of document.querySelectorAll(CARD_LINK_SELECTOR)) {
        const name = cleanName(link.textContent);
        if (name) found.push({ element: link, name });
      }
      for (const image of document.querySelectorAll(CARD_IMAGE_SELECTOR)) {
        const alt = cleanName(image.getAttribute("alt"));
        if (alt && !NON_CARD_ALT.test(alt)) found.push({ element: image, name: alt });
      }
      return found;
    }
  }

  class DomDeckSource {
    cardNames() {
      return [...new Set(DomCardScanner.scan().map((hit) => hit.name))];
    }
  }

  const deckIsRendered = () =>
    document.querySelector(CARD_LINK_SELECTOR) || document.querySelector(CARD_IMAGE_SELECTOR);

  function waitForDeck(timeoutMs = 15000) {
    return new Promise((resolve) => {
      if (deckIsRendered()) return resolve(true);
      const observer = new MutationObserver(() => {
        if (deckIsRendered()) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeoutMs);
    });
  }

  class DeckHighlighter {
    constructor(matchKeys, total) {
      this.matchKeys = matchKeys;
      this.total = total;
      this.painted = new WeakSet();
      this.found = new Set();
    }

    apply() {
      for (const { element, name } of DomCardScanner.scan()) {
        const key = cardKey(name);
        if (!this.matchKeys.has(key)) continue;
        if (!this.painted.has(element)) {
          element.classList.add(element.tagName === "IMG" ? "rgf-hit-img" : "rgf-hit-text");
          element.title = "Has a modern retro-frame printing (frame:1997, 2019+)";
          this.painted.add(element);
        }
        this.found.add(key);
      }
      Badge.show(this.found.size, this.total);
    }

    // Re-run as Moxfield re-renders rows on view/sort changes. The observer is
    // detached during apply() so painting and the badge update don't re-trigger it.
    observe() {
      let scheduled = false;
      const watch = () => this._observer.observe(document.body, { childList: true, subtree: true });
      this._observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          this._observer.disconnect();
          this.apply();
          watch();
        });
      });
      watch();
    }
  }

  class Badge {
    static show(found, total) {
      let node = document.getElementById("rgf-badge");
      if (!node) {
        node = document.createElement("div");
        node.id = "rgf-badge";
        document.body.appendChild(node);
      }
      const label = `retro-frame card${total === 1 ? "" : "s"}`;
      node.textContent = found < total ? `★ ${found}/${total} ${label}` : `★ ${total} ${label}`;
    }
  }

  const log = (...args) => console.log("[retro-frame]", ...args);

  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      const publicId = DeckUrl.publicId(location.href);
      log("start, publicId =", publicId);

      let names = [];
      if (publicId) {
        try {
          names = await new MoxfieldApiDeckSource(publicId).cardNames();
          log("API returned", names.length, "names");
        } catch (error) {
          log("API failed, will scrape DOM:", error.message);
        }
      }

      if (!names.length) {
        const rendered = await waitForDeck();
        names = new DomDeckSource().cardNames();
        log("DOM scrape (deck rendered:", rendered + ") returned", names.length, "names");
      }

      if (!names.length) {
        log("no card names found — nothing to do");
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: "FIND_RETRO_FRAMES", names });
      if (!response || response.error) {
        log("background error:", response?.error);
        return;
      }
      log("Scryfall matched", response.matches.length, "card keys");

      const matchKeys = new Set(response.matches);
      const total = new Set(names.map(cardKey).filter((key) => matchKeys.has(key))).size;
      log(total, "of this deck's cards have a retro-frame printing");

      await waitForDeck();
      const highlighter = new DeckHighlighter(matchKeys, total);
      highlighter.apply();
      highlighter.observe();
      log("highlighted", highlighter.found.size, "/", total);
    } catch (error) {
      console.warn("[retro-frame] run failed:", error);
    } finally {
      running = false;
    }
  }

  // Run on load and on SPA navigations between decks.
  let lastPath = location.pathname;
  const onMaybeNavigated = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (/^\/decks\//.test(location.pathname)) run();
  };
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onMaybeNavigated();
      return result;
    };
  }
  window.addEventListener("popstate", onMaybeNavigated);

  run();
})();
