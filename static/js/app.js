/**
 * BigQuery Release Notes — frontend logic
 * Fetches release entries from the Flask API, renders cards, and
 * lets the user select one to compose a tweet.
 */

(function () {
  "use strict";

  /* ── DOM handles ──────────────────────────────────────────── */
  const releaseList = document.getElementById("release-list");
  const refreshBtn = document.getElementById("btn-refresh");
  const spinner = document.getElementById("spinner");
  const entryCount = document.getElementById("entry-count");
  const lastUpdated = document.getElementById("last-updated");
  const tweetBar = document.getElementById("tweet-bar");
  const tweetLabel = document.getElementById("tweet-label");
  const tweetBtn = document.getElementById("btn-tweet");

  let selectedIndex = null; // index of currently selected card
  let entries = []; // cached feed entries

  /* ── Bootstrap ────────────────────────────────────────────── */
  fetchReleases();

  refreshBtn.addEventListener("click", () => {
    fetchReleases();
  });

  tweetBtn.addEventListener("click", composeTweet);

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
