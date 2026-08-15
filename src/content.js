/* FACEIT Crosshair Peek - content script
 *
 * Hovering a match row in a CS2 match history fetches that match's advanced
 * scoreboard and renders every player's crosshair.
 *
 * Copyright (C) 2026 Filip Tomasovych
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version. See the LICENSE file for details.
 */
(() => {
  "use strict";

  const HOVER_DELAY_MS = 180;
  const RENDER_SCALE = 5;          // CSS upscale of the pixel-exact canvas
  const REFERENCE_HEIGHT = 1080;   // game resolution the crosshair is drawn for

  const renderer = new CS2CrosshairRenderer();

  /* Any page under a player's profile, capturing the nickname. Both the activation gate
   * and the self-row lookup need "is this a profile, and whose?", so they share one regex:
   * when these were two patterns they drifted, and the overview page silently matched
   * neither. The trailing (?:\/|$) is what admits /players/donk666 alongside its subpages. */
  const PROFILE_PATH = /\/players(?:-modal)?\/([^/]+)(?:\/|$)/;

  // ---------------------------------------------------------------- caching

  const matchCache = new Map();  // matchId -> Promise<{order, scores}>
  const selfIds = new Map();     // nickname -> Promise<playerId|null>

  // --------------------------------------------------------------- fetching

  async function getJson(url) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) {
      const err = new Error(`${res.status} ${url}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /** The API returns camelCase on some matches and snake_case on others. */
  const pick = (obj, ...keys) => {
    for (const k of keys) if (obj && obj[k] != null) return obj[k];
    return undefined;
  };

  function profileNickname() {
    const m = PROFILE_PATH.exec(location.pathname);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /** Keyed by nickname, so SPA navigation needs no cache invalidation. */
  function getSelfId() {
    const nick = profileNickname();
    if (!nick) return Promise.resolve(null);
    if (!selfIds.has(nick)) {
      selfIds.set(
        nick,
        getJson(`/api/users/v1/nicknames/${encodeURIComponent(nick)}`)
          .then((j) => j?.payload?.id ?? j?.payload?.guid ?? null)
          .catch(() => {
            selfIds.delete(nick); // one flaky lookup shouldn't kill the highlight for good
            return null;
          })
      );
    }
    return selfIds.get(nick);
  }

  function getMatch(matchId) {
    if (matchCache.has(matchId)) return matchCache.get(matchId);

    const id = encodeURIComponent(matchId);
    const p = (async () => {
      const [stats, meta] = await Promise.all([
        getJson(
          `/api/statistics/v1/cs2/matches/${id}` +
            `/match-rounds/1/scoreboard-summary?statsType=2`
        ),
        getJson(`/api/match/v4/match/${id}`).catch(() => null),
      ]);

      const nicknames = new Map(); // playerId -> nickname
      const factions = meta?.payload?.teams ?? {};
      for (const faction of Object.values(factions)) {
        for (const member of faction?.roster ?? []) {
          nicknames.set(member.id, member.nickname);
        }
      }

      const teams = stats?.payload?.cs2?.teams ?? [];
      const order = teams.map((team) =>
        (team.players ?? []).map((pl) => {
          const playerId = pick(pl, "playerId", "player_id");
          const stat = pl.stats ?? {};
          return {
            id: playerId,
            crosshair: pl.crosshair || null,
            nickname: nicknames.get(playerId) ?? playerId?.slice(0, 8) ?? "unknown",
            kills: pick(stat, "kills", "Kills"),
            deaths: pick(stat, "deaths", "Deaths"),
          };
        })
      );

      const scores = teams.map((t) => t.score);
      return { order, scores };
    })();

    matchCache.set(matchId, p);
    // A 404 is permanent - FACEIT never parsed that demo - so keep the rejection cached
    // and let repeat hovers resolve for free. Anything else may be transient: allow a retry.
    p.catch((err) => {
      if (err?.status !== 404) matchCache.delete(matchId);
    });
    return p;
  }

  // -------------------------------------------------------------- rendering

  /* parseCode() never throws. On a bad pattern or a failed checksum it returns its own
   * defaultSettings object *by reference*, and those defaults render as a perfectly
   * plausible green crosshair - i.e. someone else's. Identity is the only reliable failure
   * signal: a valid code always yields a fresh object, even one that happens to decode to
   * exactly the defaults. Should a future version of the vendored renderer return a copy
   * instead, this fails open to the old behaviour rather than breaking. */
  function parseShareCode(code) {
    if (!renderer.CODE_PATTERN.test(code)) return null;
    const settings = renderer.parseCode(code);
    return settings === renderer.defaultSettings ? null : settings;
  }

  function emptyXhair(text, title) {
    const wrap = document.createElement("div");
    wrap.className = "fcp-xhair fcp-xhair-empty";
    wrap.textContent = text;
    if (title) wrap.title = title;
    return wrap;
  }

  function crosshairNode(code) {
    if (!code) return emptyXhair("—");

    const settings = parseShareCode(code);
    if (!settings) return emptyXhair("invalid code", `couldn't decode ${code}`);

    // Styles 0 and 1 are the legacy dynamic ones and can't be drawn statically. Check
    // before rendering, or every dynamic row builds a canvas just to throw it away.
    const style = Number(settings.cl_crosshairstyle);
    if (style < 2) {
      return emptyXhair("dynamic", `crosshairstyle ${style} is not previewable`);
    }

    const wrap = document.createElement("div");
    wrap.className = "fcp-xhair";
    try {
      const canvas = renderer.renderCrosshair(settings, REFERENCE_HEIGHT);
      canvas.style.width = `${canvas.width * RENDER_SCALE}px`;
      canvas.style.height = `${canvas.height * RENDER_SCALE}px`;
      wrap.appendChild(canvas);
    } catch {
      return emptyXhair("?", "render failed");
    }
    return wrap;
  }

  function playerRow(player, isSelf) {
    const row = document.createElement("div");
    row.className = "fcp-player" + (isSelf ? " fcp-self" : "");

    const name = document.createElement("div");
    name.className = "fcp-name";
    name.textContent = player.nickname;
    name.title = player.nickname;

    const kd = document.createElement("div");
    kd.className = "fcp-kd";
    kd.textContent =
      player.kills != null && player.deaths != null
        ? `${player.kills}/${player.deaths}`
        : "";

    const art = crosshairNode(player.crosshair);

    // Restore from `share`, never from the button's own text: two clicks inside the
    // restore window would otherwise capture "copied!" and strand it there.
    const share = player.crosshair;
    const code = document.createElement("button");
    code.className = "fcp-code";
    code.type = "button";
    code.textContent = share ?? "no code";
    code.disabled = !share;
    let restoreTimer = null;
    code.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard
        .writeText(share)
        .then(() => {
          clearTimeout(restoreTimer);
          code.textContent = "copied!";
          code.classList.add("fcp-copied");
          restoreTimer = setTimeout(() => {
            code.textContent = share;
            code.classList.remove("fcp-copied");
          }, 900);
        })
        .catch(() => {}); // rejects when the document isn't focused
    });

    row.append(name, kd, art, code);
    return row;
  }

  function status(text) {
    const el = document.createElement("div");
    el.className = "fcp-status";
    el.textContent = text;
    return el;
  }

  // ----------------------------------------------------------------- popup

  let popup = null;
  let hoverTimer = null;
  let activeRow = null;
  let token = 0;

  function ensurePopup() {
    if (popup) return popup;
    popup = document.createElement("div");
    popup.className = "fcp-popup";
    popup.addEventListener("mouseenter", () => clearTimeout(hoverTimer));
    popup.addEventListener("mouseleave", hidePopup);
    document.body.appendChild(popup);
    return popup;
  }

  function position(el, anchor) {
    const r = anchor.getBoundingClientRect();
    el.style.visibility = "hidden";
    el.style.display = "block";
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    let left = r.right + 12;
    if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 12);
    let top = r.top + r.height / 2 - h / 2;
    top = Math.min(Math.max(8, top), window.innerHeight - h - 8);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }

  function hidePopup() {
    clearTimeout(hoverTimer);
    token++;
    activeRow = null;
    if (popup) popup.style.display = "none";
  }

  /** Leaves no node behind on pages that will never use one. */
  function destroyPopup() {
    hidePopup();
    popup?.remove();
    popup = null;
  }

  async function showFor(anchor, matchId) {
    const my = ++token;
    const el = ensurePopup();
    el.textContent = "";
    el.classList.add("fcp-loading");
    el.append(status("loading crosshairs…"));
    position(el, anchor);

    let data, selfId;
    try {
      [data, selfId] = await Promise.all([getMatch(matchId), getSelfId()]);
    } catch (err) {
      if (my !== token) return;
      el.textContent = "";
      el.classList.remove("fcp-loading");
      el.append(status(
        err?.status === 404
          ? "no advanced stats for this match"
          : "couldn't load crosshairs — try again"
      ));
      position(el, anchor);
      return;
    }
    if (my !== token) return;

    el.textContent = "";
    el.classList.remove("fcp-loading");

    const teams = data.order.filter((t) => t.length);
    if (!teams.length) {
      el.append(status("no advanced stats for this match"));
    } else {
      teams.forEach((team, i) => {
        const box = document.createElement("div");
        box.className = "fcp-team";
        const head = document.createElement("div");
        head.className = "fcp-team-head";
        head.textContent = `Team ${i + 1}${
          data.scores?.[i] != null ? ` — ${data.scores[i]}` : ""
        }`;
        box.appendChild(head);
        for (const p of team) box.appendChild(playerRow(p, p.id === selfId));
        el.appendChild(box);
      });
    }
    position(el, anchor);
  }

  // ------------------------------------------------------------ row wiring

  const MATCH_LINK = 'a[href*="/cs2/room/"]';

  function matchIdOf(a) {
    const m = a.getAttribute("href")?.match(/\/room\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  function onOver(e) {
    // Cheapest check first, and a backstop in case the activation gate ever attaches on a
    // page it shouldn't (a cancelled navigation, say) - one regex beats an ancestor walk.
    if (!PROFILE_PATH.test(location.pathname)) return;
    const a = e.target.closest?.(MATCH_LINK);
    if (!a || a === activeRow) return;
    const id = matchIdOf(a);
    if (!id) return;

    clearTimeout(hoverTimer);
    activeRow = a;
    hoverTimer = setTimeout(() => showFor(a, id), HOVER_DELAY_MS);
  }

  function onOut(e) {
    const a = e.target.closest?.(MATCH_LINK);
    if (!a) return;
    const to = e.relatedTarget;
    if (to && (a.contains(to) || popup?.contains(to))) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (!popup?.matches(":hover")) hidePopup();
    }, 150);
  }

  function onScroll(e) {
    if (!popup || popup.contains(e.target)) return; // the popup scrolls itself now
    hidePopup();
  }

  // ------------------------------------------------------------- activation
  //
  // The manifest has to match all of www.faceit.com: the site is an SPA, so a content script
  // scoped to the profile paths would never inject when you reach a profile by clicking
  // through from anywhere else. Everything below keeps that from costing anything: off a
  // profile the only thing alive is the single `navigate` listener below - no hover or
  // scroll handlers, no injected DOM, no timers, no work per event. There is no service
  // worker, no storage and no polling either, so an idle FACEIT tab runs nothing at all.
  //
  // The gate deliberately covers a whole profile rather than just the match history: the
  // overview lists recent matches too, and both it and the history use the same row links.
  // A profile tab with no match rows costs a `closest()` miss per mouseover, which is
  // cheaper than trying to enumerate which subpages happen to list matches today.

  let listening = false;

  function attach() {
    if (listening) return;
    listening = true;
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    window.addEventListener("scroll", onScroll, true);
  }

  function detach() {
    if (!listening) return;
    listening = false;
    document.removeEventListener("mouseover", onOver, true);
    document.removeEventListener("mouseout", onOut, true);
    window.removeEventListener("scroll", onScroll, true);
    destroyPopup();
  }

  const syncFor = (path) => (PROFILE_PATH.test(path) ? attach() : detach());

  if (typeof navigation !== "undefined") {
    // `navigate` fires before location updates, so read the destination rather than
    // location.pathname. A cancelled navigation can leave us attached early; onOver's own
    // path check covers that.
    navigation.addEventListener("navigate", (e) => {
      let path = location.pathname;
      try {
        path = new URL(e.destination.url).pathname;
      } catch {
        // Some navigation types carry a url we can't parse; falling back to the current
        // path is better than throwing out of the listener and stranding the gate.
      }
      syncFor(path);
    });
    syncFor(location.pathname);
  } else {
    // No Navigation API to tell us about SPA route changes, so stay attached and let the
    // per-event path check in onOver do the gating. Correctness first, cheapness second.
    attach();
  }
})();
