"use strict";

// Shared by the service worker (via importScripts) and the content script (listed
// first in the manifest's content_scripts). Holds the few things both sides must
// agree on, so the card-key contract and message name live in exactly one place.
(() => {
  // Split / double-faced names ("Front // Back") collapse to their front face,
  // lowercased. Moxfield's table view shows only the front face while Scryfall
  // returns the full name; both reduce to the same key.
  const frontFace = (name) => name.split("//")[0].trim();
  const cardKey = (name) => frontFace(name).toLowerCase();

  globalThis.RetroGreat = {
    frontFace,
    cardKey,
    MESSAGE_TYPE: "FIND_RETRO_FRAMES",
  };
})();
