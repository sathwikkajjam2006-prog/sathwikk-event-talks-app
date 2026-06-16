/**
 * BigQuery Release Notes — frontend logic
 * All 17 UX improvements implemented.
 */

(function () {
  "use strict";

  /* ── Theme toggle ──────────────────────────────────────────── */
  // data-theme is already set in <head> to prevent flash;
  // just sync the checkbox to match the stored value.
  const themeSwitch = document.getElementById("theme-switch");
  themeSwitch.checked = (localStorage.getItem("bq-theme") || "dark") === "light";

  themeSwitch.addEventListener("change", () => {
    const theme = themeSwitch.checked ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bq-theme", theme);
  });

  /* ── DOM handles ──────────────────────────────────────────── */
  const releaseList   = document.getElementById("release-list");
  const refreshBtn    = document.getElementById("btn-refresh");
  const refreshLabel  = document.getElementById("refresh-label");
  const spinner       = document.getElementById("spinner");
  const entryCount    = document.getElementById("entry-count");
  const lastUpdated   = document.getElementById("last-updated");
  const toolbarHint   = document.getElementById("toolbar-hint");
  const tweetBar      = document.getElementById("tweet-bar");
  const tweetLabel    = document.getElementById("tweet-label");
  const tweetBtn      = document.getElementById("btn-tweet");
  const exportBtn     = document.getElementById("btn-export");
  const exportLabel   = document.getElementById("export-label");
  const backToTop     = document.getElementById("back-to-top");
  const appShell      = document.querySelector(".app-shell");

  let selectedIndex   = null;
  let entries         = [];
  let isFirstLoad     = true;
  let lastRefreshTime = null;
  let relativeTimer   = null;

  /* ── Bootstrap ────────────────────────────────────────────── */
  fetchReleases();

  refreshBtn.addEventListener("click", () => fetchReleases());
  tweetBtn.addEventListener("click", composeTweet);
  exportBtn.addEventListener("click", exportToCsv);

  // Fix #2: Escape to deselect
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedIndex !== null) deselectAll();
  });

  // Fix #17: Back-to-top visibility
  window.addEventListener("scroll", () => {
    backToTop.classList.toggle("back-to-top--visible", window.scrollY > 400);
  }, { passive: true });

  backToTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );

  /* ── Fetch releases from API ──────────────────────────────── */
  async function fetchReleases() {
    setLoading(true);
    deselectAll();

    try {
      const res = await fetch("/api/releases");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "Unknown error");

      entries = data.entries;

      // Fix #4: Empty state
      if (entries.length === 0) {
        showEmptyState();
        entryCount.textContent = "0";
      } else {
        renderEntries(entries);
        entryCount.textContent = entries.length;
        // Fix #1: Hint appears once data loads
        toolbarHint.textContent = "· Click any card to select it for sharing";
      }

      exportBtn.disabled = entries.length === 0;
      lastRefreshTime = new Date();
      updateRelativeTime();
    } catch (err) {
      // Fix #5: Error state with retry
      showErrorState(err.message);
      entryCount.textContent = "–";
      exportBtn.disabled = true;
    } finally {
      setLoading(false);
      isFirstLoad = false;
    }
  }

  /* ── Fix #11: Relative "last refreshed" timestamp ─────────── */
  function updateRelativeTime() {
    if (!lastRefreshTime) return;
    clearTimeout(relativeTimer);

    const diffSec = Math.floor((Date.now() - lastRefreshTime) / 1000);
    let label;
    if (diffSec < 10)        label = "just now";
    else if (diffSec < 60)   label = `${diffSec}s ago`;
    else if (diffSec < 3600) label = `${Math.floor(diffSec / 60)}m ago`;
    else                     label = lastRefreshTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    lastUpdated.textContent = label;

    // Keep updating every 10s for the first minute, then every minute
    relativeTimer = setTimeout(updateRelativeTime, diffSec < 60 ? 10000 : 60000);
  }

  /* ── Render cards ─────────────────────────────────────────── */
  function renderEntries(list) {
    releaseList.innerHTML = "";

    list.forEach((entry, idx) => {
      const card = document.createElement("article");
      card.className = "release-card";
      card.dataset.index = idx;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `${entry.title} — press Enter to select for sharing`);

      // Count update types
      const typeMatches = entry.content.match(/<h3>(.*?)<\/h3>/gi) || [];
      const types = typeMatches.map((m) => m.replace(/<\/?h3>/gi, "").trim().toLowerCase());

      // Fix #14: badge fallback for zero types
      const badgeLabel =
        types.length === 0 ? "release" :
        types.length === 1 ? types[0] :
        `${types.length} updates`;

      // Colorize h3 tags inside content
      const styledContent = entry.content.replace(
        /<h3>(.*?)<\/h3>/gi,
        (_, text) => `<h3 class="tag--${text.trim().toLowerCase().replace(/\s+/g, "-")}">${text}</h3>`
      );

      // Fix #3: copy button is now inside header row, not absolutely positioned
      // Fix #18: aria-label on "View docs" link
      card.innerHTML = `
        <div class="release-card__header">
          <span class="release-card__date">${escapeHtml(entry.title)}</span>
          <span class="release-card__badge">${escapeHtml(badgeLabel)}</span>
          <div class="release-card__actions">
            <button class="release-card__copy" id="copy-${idx}"
                    title="Copy to clipboard"
                    aria-label="Copy ${escapeHtml(entry.title)} to clipboard"
                    onclick="event.stopPropagation(); copyToClipboard(${idx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <a class="release-card__link" href="${escapeHtml(entry.link)}"
               target="_blank" rel="noopener"
               aria-label="View documentation for ${escapeHtml(entry.title)} (opens in new tab)"
               onclick="event.stopPropagation()">
              View docs ↗
            </a>
          </div>
        </div>
        <div class="release-card__body" id="body-${idx}">
          ${styledContent}
        </div>
        <div class="release-card__footer">
          <button class="release-card__toggle" id="toggle-${idx}"
                  onclick="event.stopPropagation(); toggleExpand(${idx})">
            Show more ▾
          </button>
        </div>
      `;

      card.addEventListener("click", () => selectCard(idx));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCard(idx); }
        // Fix #6: Arrow-key navigation between cards
        if (e.key === "ArrowDown") { e.preventDefault(); focusCard(idx + 1); }
        if (e.key === "ArrowUp")   { e.preventDefault(); focusCard(idx - 1); }
      });

      releaseList.appendChild(card);
    });
  }

  // Fix #6: Move focus to adjacent card
  function focusCard(idx) {
    const cards = releaseList.querySelectorAll(".release-card");
    const clamped = Math.max(0, Math.min(idx, cards.length - 1));
    if (cards[clamped]) cards[clamped].focus();
  }

  /* ── Fix #4 & #5: Empty and error states ─────────────────── */
  function showEmptyState() {
    releaseList.innerHTML = `
      <div class="state-card state-card--empty">
        <div class="state-card__icon">📭</div>
        <h2 class="state-card__title">No release notes found</h2>
        <p class="state-card__msg">The feed returned no entries. This may be temporary.</p>
        <button class="btn btn--primary" onclick="fetchReleases()">Try Again</button>
      </div>`;
  }

  function showErrorState(message) {
    releaseList.innerHTML = `
      <div class="state-card state-card--error">
        <div class="state-card__icon">⚠️</div>
        <h2 class="state-card__title">Couldn't load release notes</h2>
        <p class="state-card__msg">${escapeHtml(message)}</p>
        <button class="btn btn--primary" onclick="fetchReleases()">Try Again</button>
      </div>`;
  }

  /* ── Fix #12: Expand / collapse with visible separator ────── */
  window.toggleExpand = function (idx) {
    const body = document.getElementById("body-" + idx);
    const btn  = document.getElementById("toggle-" + idx);
    const expanded = body.classList.toggle("expanded");
    btn.textContent = expanded ? "Show less ▴" : "Show more ▾";
  };

  /* ── Card selection ───────────────────────────────────────── */
  function selectCard(idx) {
    const cards = releaseList.querySelectorAll(".release-card");
    if (selectedIndex === idx) { deselectAll(); return; }

    cards.forEach((c) => c.classList.remove("release-card--selected"));
    cards[idx].classList.add("release-card--selected");
    selectedIndex = idx;

    const entry = entries[idx];
    tweetLabel.innerHTML = "Tweet about <strong>" + escapeHtml(entry.title) + "</strong>";
    tweetBar.classList.add("tweet-bar--visible");
    tweetBtn.disabled = false;

    // Fix #16: Dynamically pad the shell so tweet bar doesn't cover cards
    adjustBottomPadding();
  }

  function deselectAll() {
    const cards = releaseList.querySelectorAll(".release-card");
    cards.forEach((c) => c.classList.remove("release-card--selected"));
    selectedIndex = null;
    tweetBar.classList.remove("tweet-bar--visible");
    tweetBtn.disabled = true;
    appShell.style.paddingBottom = "";
  }

  // Fix #16: Measure actual tweet bar height and apply as padding
  function adjustBottomPadding() {
    requestAnimationFrame(() => {
      const h = tweetBar.getBoundingClientRect().height;
      appShell.style.paddingBottom = (h + 24) + "px";
    });
  }

  /* ── Copy to clipboard ─────────────────────────────────────── */
  window.copyToClipboard = async function (idx) {
    const entry   = entries[idx];
    const copyBtn = document.getElementById("copy-" + idx);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entry.content;
    const plainText = [
      entry.title,
      entry.link,
      "",
      (tempDiv.textContent || tempDiv.innerText || "").trim(),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(plainText);

      // Swap to checkmark
      copyBtn.classList.add("release-card__copy--copied");
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

      // Show tooltip anchored to the actions row
      const tooltip = document.createElement("span");
      tooltip.className = "copy-tooltip";
      tooltip.textContent = "Copied!";
      copyBtn.parentElement.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 1500);

      // Reset
      setTimeout(() => {
        copyBtn.classList.remove("release-card__copy--copied");
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 2000);
    } catch (err) {
      showToast("Failed to copy: " + err.message);
    }
  };

  /* ── Export to CSV ─────────────────────────────────────────── */
  function exportToCsv() {
    if (!entries.length) return;

    const headers = ["Title", "Date", "Link", "Type", "Content"];
    const rows = entries.map((entry) => {
      const typeMatches = entry.content.match(/<h3>(.*?)<\/h3>/gi) || [];
      const types = typeMatches.map((m) => m.replace(/<\/?h3>/gi, "").trim()).join("; ");
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.content;
      const plain = (tempDiv.textContent || tempDiv.innerText || "").trim().replace(/\s+/g, " ");
      return [entry.title, entry.updated, entry.link, types, plain];
    });

    const csv  = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `bigquery-release-notes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Fix #10: Visual confirmation after export
    exportLabel.textContent = "✓ Exported!";
    exportBtn.classList.add("btn--export-done");
    setTimeout(() => {
      exportLabel.textContent = "Export CSV";
      exportBtn.classList.remove("btn--export-done");
    }, 2000);
  }

  function csvEscape(value) {
    const s = String(value);
    return (s.includes('"') || s.includes(",") || s.includes("\n"))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  /* ── Compose tweet ────────────────────────────────────────── */
  function composeTweet() {
    if (selectedIndex === null) return;
    const entry = entries[selectedIndex];
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entry.content;
    let plain = (tempDiv.textContent || tempDiv.innerText || "").trim();
    if (plain.length > 160) plain = plain.substring(0, 160).trim() + "…";

    const text = `📢 BigQuery Release — ${entry.title}\n\n${plain}\n\n${entry.link}\n\n#BigQuery #GoogleCloud`;
    window.open(
      "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,width=600,height=460"
    );
  }

  /* ── Fix #7: Loading state with contextual label ──────────── */
  function setLoading(isLoading) {
    refreshBtn.disabled = isLoading;
    spinner.classList.toggle("spinner--active", isLoading);
    refreshLabel.textContent = isLoading
      ? (isFirstLoad ? "Loading…" : "Refreshing…")
      : "Refresh";

    if (isLoading) {
      releaseList.innerHTML = buildSkeleton(5);
      exportBtn.disabled = true;
    }
  }

  function buildSkeleton(n) {
    let html = '<div class="skeleton">';
    for (let i = 0; i < n; i++) {
      html += `
        <div class="skeleton__card">
          <div class="skeleton__line skeleton__line--title"></div>
          <div class="skeleton__line skeleton__line--long"></div>
          <div class="skeleton__line skeleton__line--short"></div>
          <div class="skeleton__line skeleton__line--long"></div>
        </div>`;
    }
    return html + "</div>";
  }

  /* ── Toast notification ───────────────────────────────────── */
  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  /* ── Utility ──────────────────────────────────────────────── */
  function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }
})();
