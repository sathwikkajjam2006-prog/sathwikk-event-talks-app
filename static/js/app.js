/**
 * BigQuery Release Notes — frontend logic
 * Fetches release entries from the Flask API, renders cards, and
 * lets the user select one to compose a tweet.
 */

(function () {
  "use strict";

  /* ── Theme toggle ──────────────────────────────────────────── */
  const themeSwitch = document.getElementById("theme-switch");
  const savedTheme = localStorage.getItem("bq-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeSwitch.checked = savedTheme === "light";

  themeSwitch.addEventListener("change", () => {
    const theme = themeSwitch.checked ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bq-theme", theme);
  });

  /* ── DOM handles ──────────────────────────────────────────── */
  const releaseList = document.getElementById("release-list");
  const refreshBtn = document.getElementById("btn-refresh");
  const spinner = document.getElementById("spinner");
  const entryCount = document.getElementById("entry-count");
  const lastUpdated = document.getElementById("last-updated");
  const tweetBar = document.getElementById("tweet-bar");
  const tweetLabel = document.getElementById("tweet-label");
  const tweetBtn = document.getElementById("btn-tweet");
  const exportBtn = document.getElementById("btn-export");

  let selectedIndex = null; // index of currently selected card
  let entries = []; // cached feed entries

  /* ── Bootstrap ────────────────────────────────────────────── */
  fetchReleases();

  refreshBtn.addEventListener("click", () => {
    fetchReleases();
  });

  tweetBtn.addEventListener("click", composeTweet);
  exportBtn.addEventListener("click", exportToCsv);

  /* ── Fetch releases from API ──────────────────────────────── */
  async function fetchReleases() {
    setLoading(true);
    deselectAll();

    try {
      const res = await fetch("/api/releases");
      const data = await res.json();

      if (data.status !== "ok") throw new Error(data.message || "Unknown error");

      entries = data.entries;
      renderEntries(entries);
      entryCount.textContent = entries.length;
      lastUpdated.textContent = new Date().toLocaleTimeString();
      exportBtn.disabled = entries.length === 0;
    } catch (err) {
      showToast("Failed to load releases: " + err.message);
    } finally {
      setLoading(false);
    }
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

      // Count update types in the content
      const typeMatches = entry.content.match(/<h3>(.*?)<\/h3>/gi) || [];
      const types = typeMatches.map((m) =>
        m.replace(/<\/?h3>/gi, "").trim().toLowerCase()
      );
      const badgeLabel =
        types.length === 1
          ? types[0]
          : types.length + " update" + (types.length !== 1 ? "s" : "");

      // Colorize h3 tags inside content
      let styledContent = entry.content.replace(
        /<h3>(.*?)<\/h3>/gi,
        (_, text) => {
          const lower = text.trim().toLowerCase();
          let cls = "tag--" + lower.replace(/\s+/g, "-");
          return `<h3 class="${cls}">${text}</h3>`;
        }
      );

      card.innerHTML = `
        <button class="release-card__copy" id="copy-${idx}" title="Copy to clipboard"
                onclick="event.stopPropagation(); copyToClipboard(${idx})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <div class="release-card__header">
          <span class="release-card__date">${escapeHtml(entry.title)}</span>
          <span class="release-card__badge">${escapeHtml(badgeLabel)}</span>
          <a class="release-card__link" href="${escapeHtml(entry.link)}"
             target="_blank" rel="noopener" onclick="event.stopPropagation()">
            View docs ↗
          </a>
        </div>
        <div class="release-card__body" id="body-${idx}">
          ${styledContent}
        </div>
        <button class="release-card__toggle" id="toggle-${idx}"
                onclick="event.stopPropagation(); toggleExpand(${idx})">
          Show more ▾
        </button>
      `;

      card.addEventListener("click", () => selectCard(idx));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(idx);
        }
      });

      releaseList.appendChild(card);
    });
  }

  /* ── Expand / collapse card body ──────────────────────────── */
  window.toggleExpand = function (idx) {
    const body = document.getElementById("body-" + idx);
    const btn = document.getElementById("toggle-" + idx);
    const expanded = body.classList.toggle("expanded");
    btn.textContent = expanded ? "Show less ▴" : "Show more ▾";
  };

  /* ── Card selection ───────────────────────────────────────── */
  function selectCard(idx) {
    const cards = releaseList.querySelectorAll(".release-card");

    if (selectedIndex === idx) {
      // deselect
      deselectAll();
      return;
    }

    cards.forEach((c) => c.classList.remove("release-card--selected"));
    cards[idx].classList.add("release-card--selected");
    selectedIndex = idx;

    const entry = entries[idx];
    tweetLabel.innerHTML =
      'Tweet about <strong>' + escapeHtml(entry.title) + "</strong>";
    tweetBar.classList.add("tweet-bar--visible");
    tweetBtn.disabled = false;
  }

  function deselectAll() {
    const cards = releaseList.querySelectorAll(".release-card");
    cards.forEach((c) => c.classList.remove("release-card--selected"));
    selectedIndex = null;
    tweetBar.classList.remove("tweet-bar--visible");
    tweetBtn.disabled = true;
  }

  /* ── Copy to clipboard ─────────────────────────────────────── */
  window.copyToClipboard = async function (idx) {
    const entry = entries[idx];
    const copyBtn = document.getElementById("copy-" + idx);

    // Build plain-text version
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entry.content;
    const plainText =
      entry.title + "\n" +
      entry.link + "\n\n" +
      (tempDiv.textContent || tempDiv.innerText || "").trim();

    try {
      await navigator.clipboard.writeText(plainText);

      // Visual feedback — swap icon to checkmark
      copyBtn.classList.add("release-card__copy--copied");
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

      // Show tooltip
      const tooltip = document.createElement("span");
      tooltip.className = "copy-tooltip";
      tooltip.textContent = "Copied!";
      copyBtn.parentElement.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 1500);

      // Reset icon after delay
      setTimeout(() => {
        copyBtn.classList.remove("release-card__copy--copied");
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 2000);
    } catch (err) {
      showToast("Failed to copy: " + err.message);
    }
  };

  /* ── Export to CSV ─────────────────────────────────────────── */
  function exportToCsv() {
    if (!entries.length) return;

    const headers = ["Title", "Date", "Link", "Type", "Content"];
    const rows = [];

    entries.forEach((entry) => {
      // Extract update types
      const typeMatches = entry.content.match(/<h3>(.*?)<\/h3>/gi) || [];
      const types = typeMatches
        .map((m) => m.replace(/<\/?h3>/gi, "").trim())
        .join("; ");

      // Extract plain text content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.content;
      const plainContent = (tempDiv.textContent || tempDiv.innerText || "")
        .trim()
        .replace(/\s+/g, " ");

      rows.push([
        entry.title,
        entry.updated,
        entry.link,
        types,
        plainContent,
      ]);
    });

    // Build CSV string with proper escaping
    const csvContent = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    // Trigger download
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "bigquery-release-notes-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const str = String(value);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /* ── Compose tweet ────────────────────────────────────────── */
  function composeTweet() {
    if (selectedIndex === null) return;
    const entry = entries[selectedIndex];

    // Build a plain-text snippet from the HTML content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entry.content;
    let plainText = (tempDiv.textContent || tempDiv.innerText || "").trim();

    // Truncate to keep tweet concise
    const maxSnippet = 160;
    if (plainText.length > maxSnippet) {
      plainText = plainText.substring(0, maxSnippet).trim() + "…";
    }

    const tweetText =
      "📢 BigQuery Release — " +
      entry.title +
      "\n\n" +
      plainText +
      "\n\n" +
      entry.link +
      "\n\n#BigQuery #GoogleCloud";

    const url =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(tweetText);

    window.open(url, "_blank", "noopener,width=600,height=460");
  }

  /* ── Loading / skeleton state ─────────────────────────────── */
  function setLoading(isLoading) {
    refreshBtn.disabled = isLoading;
    spinner.classList.toggle("spinner--active", isLoading);

    if (isLoading) {
      releaseList.innerHTML = buildSkeleton(5);
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
