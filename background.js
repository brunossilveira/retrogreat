"use strict";

importScripts("shared.js");
const { frontFace, cardKey, MESSAGE_TYPE } = globalThis.RetroGreat;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Verified Scryfall core (do not change in spirit).
const FRAME_FILTER = "frame:1997 year>=2019";
const exactName = (name) => `!"${name.replace(/"/g, "")}"`;

class ScryfallClient {
  constructor({ endpoint = "https://api.scryfall.com/cards/search" } = {}) {
    this.endpoint = endpoint;
  }

  // A 404 from Scryfall means "zero matches", not an error.
  async search(query) {
    const url = `${this.endpoint}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Scryfall responded ${response.status}`);
    const body = await response.json();
    return body.data || [];
  }
}

class RetroFrameFinder {
  constructor(client, { chunkSize = 15, delayMs = 100 } = {}) {
    this.client = client;
    this.chunkSize = chunkSize;
    this.delayMs = delayMs;
  }

  // Returns the set of canonical keys whose card has a retro-frame printing.
  async matchingKeys(names) {
    const queryNames = this._dedupeFrontFaces(names);
    const matches = new Set();

    const chunks = this._chunk(queryNames, this.chunkSize);
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await sleep(this.delayMs);
      try {
        const cards = await this.client.search(this._buildQuery(chunks[i]));
        for (const card of cards) matches.add(cardKey(card.name));
      } catch (error) {
        console.warn("[retro-frame] Scryfall chunk failed:", error);
      }
    }
    return [...matches];
  }

  _dedupeFrontFaces(names) {
    const byKey = new Map();
    for (const name of names) {
      const key = cardKey(name);
      if (!byKey.has(key)) byKey.set(key, frontFace(name));
    }
    return [...byKey.values()];
  }

  _buildQuery(frontFaceNames) {
    const ors = frontFaceNames.map(exactName).join(" or ");
    return `(${ors}) ${FRAME_FILTER}`;
  }

  _chunk(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
  }
}

const finder = new RetroFrameFinder(new ScryfallClient());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPE) return false;
  finder
    .matchingKeys(message.names || [])
    .then((matches) => sendResponse({ matches }))
    .catch((error) => sendResponse({ error: String(error) }));
  return true; // keep the message channel open for the async response
});
