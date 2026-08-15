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

  // ---------------------------------------------------------------- caching

  const matchCache = new Map();  // matchId -> Promise<{players, order}>
  let selfIdPromise = null;      // Promise<playerId|null> for the profile owner

  // --------------------------------------------------------------- fetching

  async function getJson(url) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  /** The API returns camelCase on some matches and snake_case on others. */
  const pick = (obj, ...keys) => {
    for (const k of keys) if (obj && obj[k] != null) return obj[k];
    return undefined;
  };

  function profileNickname() {
    const m = location.pathname.match(/\/players(?:-modal)?\/([^/]+)\//);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getSelfId() {
    if (selfIdPromise) return selfIdPromise;
    const nick = profileNickname();
    if (!nick) return (selfIdPromise = Promise.resolve(null));
    selfIdPromise = getJson(`/api/users/v1/nicknames/${encodeURIComponent(nick)}`)
      .then((j) => j?.payload?.id ?? j?.payload?.guid ?? null)
      .catch(() => null);
    return selfIdPromise;
  }

  function getMatch(matchId) {
    if (matchCache.has(matchId)) return matchCache.get(matchId);

    const p = (async () => {
      const [stats, meta] = await Promise.all([
        getJson(
          `/api/statistics/v1/cs2/matches/${matchId}` +
            `/match-rounds/1/scoreboard-summary?statsType=2`
        ),
        getJson(`/api/match/v4/match/${matchId}`).catch(() => null),
      ]);

      // playerId -> { nickname, avatar }
      const info = new Map();
      const factions = meta?.payload?.teams ?? {};
      for (const faction of Object.values(factions)) {
        for (const p of faction?.roster ?? []) {
          info.set(p.id, { nickname: p.nickname, avatar: p.avatar });
        }
      }

      const teams = stats?.payload?.cs2?.teams ?? [];
      const order = teams.map((team) =>
        (team.players ?? []).map((pl) => {
          const id = pick(pl, "playerId", "player_id");
          return {
            id,
            crosshair: pl.crosshair || null,
            elo: pl.elo,
            nickname: info.get(id)?.nickname ?? id?.slice(0, 8) ?? "unknown",
            avatar: info.get(id)?.avatar ?? null,
            kills: pick(pl.stats ?? {}, "kills"),
            deaths: pick(pl.stats ?? {}, "deaths"),
          };
        })
      );

      const scores = teams.map((t) => t.score);
      return { order, scores };
    })();

    matchCache.set(matchId, p);
    p.catch(() => matchCache.delete(matchId)); // let it retry after a failure
    return p;
  }

  // -------------------------------------------------------------- rendering

  function crosshairNode(code) {
    const wrap = document.createElement("div");
    wrap.className = "fcp-xhair";
    if (!code) {
      wrap.classList.add("fcp-xhair-empty");
      wrap.textContent = "—";
      return wrap;
    }
    try {
      const settings = renderer.parseCode(code);
      const canvas = renderer.renderCrosshair(settings, REFERENCE_HEIGHT);
      if (Number(settings.cl_crosshairstyle) < 2) {
        wrap.classList.add("fcp-xhair-empty");
        wrap.textContent = "dynamic";
        wrap.title = `crosshairstyle ${settings.cl_crosshairstyle} is not previewable`;
        return wrap;
      }
      canvas.style.width = `${canvas.width * RENDER_SCALE}px`;
      canvas.style.height = `${canvas.height * RENDER_SCALE}px`;
      wrap.appendChild(canvas);
    } catch (err) {
      wrap.classList.add("fcp-xhair-empty");
      wrap.textContent = "?";
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
      player.kills != null ? `${player.kills}/${player.deaths}` : "";

    const art = crosshairNode(player.crosshair);

    const code = document.createElement("button");
    code.className = "fcp-code";
    code.type = "button";
    code.textContent = player.crosshair ?? "no code";
    code.disabled = !player.crosshair;
    code.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(player.crosshair).then(() => {
        const old = code.textContent;
        code.textContent = "copied!";
        code.classList.add("fcp-copied");
        setTimeout(() => {
          code.textContent = old;
          code.classList.remove("fcp-copied");
        }, 900);
      });
    });

    row.append(name, kd, art, code);
    return row;
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

  async function showFor(anchor, matchId) {
    const my = ++token;
    const el = ensurePopup();
    el.textContent = "";
    el.classList.add("fcp-loading");
    el.append(Object.assign(document.createElement("div"), {
      className: "fcp-status",
      textContent: "loading crosshairs…",
    }));
    position(el, anchor);

    let data, selfId;
    try {
      [data, selfId] = await Promise.all([getMatch(matchId), getSelfId()]);
    } catch (err) {
      if (my !== token) return;
      el.textContent = "";
      el.append(Object.assign(document.createElement("div"), {
        className: "fcp-status",
        textContent: "no advanced stats for this match",
      }));
      el.classList.remove("fcp-loading");
      position(el, anchor);
      return;
    }
    if (my !== token) return;

    el.textContent = "";
    el.classList.remove("fcp-loading");

    const teams = data.order.filter((t) => t.length);
    if (!teams.length) {
      el.append(Object.assign(document.createElement("div"), {
        className: "fcp-status",
        textContent: "no advanced stats for this match",
      }));
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
    const a = e.target.closest?.(MATCH_LINK);
    if (!a || a === activeRow) return;
    if (!/\/players(?:-modal)?\/[^/]+\/cs2\//.test(location.pathname)) return;
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

  document.addEventListener("mouseover", onOver, true);
  document.addEventListener("mouseout", onOut, true);
  window.addEventListener("scroll", hidePopup, true);

  // SPA navigation: drop the cached profile id when the URL changes
  let lastPath = location.pathname;
  new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      selfIdPromise = null;
      hidePopup();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
