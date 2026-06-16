# ⚡ BigQuery Release Notes

A sleek, dark-mode web application that fetches the latest **Google BigQuery release notes** from the official Atom XML feed and displays them as interactive, color-coded cards — with the ability to **tweet about any update** in one click.

Built with **Python Flask** on the backend and **vanilla HTML, CSS, and JavaScript** on the frontend.

---

## ✨ Features

- **Live Feed** — Pulls release notes directly from Google's official [BigQuery release notes XML feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml)
- **Refresh on Demand** — A single refresh button with an animated spinner and skeleton loading placeholders
- **Color-Coded Updates** — Each update type is visually distinguished:
  - 🟢 **Feature** — green
  - 🟠 **Issue** — orange
  - 🔵 **Change** — blue
  - 🩷 **Breaking / Deprecation** — pink
  - 🟣 **Announcement** — purple
- **Expand / Collapse** — Long entries are truncated with a "Show more" toggle
- **Tweet Sharing** — Select any release card, then click "Tweet" to open a pre-composed tweet via [Twitter Web Intent](https://developer.twitter.com/en/docs/twitter-for-websites/tweet-button/guides/web-intent) (no API keys needed)
- **Premium Dark UI** — Gradient accents, glassmorphism, hover animations, and responsive design

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, Flask 3.x |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Styling | CSS Custom Properties, Glassmorphism, Keyframe Animations |
| Font | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| Package Manager | [uv](https://github.com/astral-sh/uv) |
| Data Source | [BigQuery Atom XML Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml) |

---

## 📁 Project Structure

```
bq-releases-notes/
├── app.py                  # Flask server — routes + XML parsing
├── requirements.txt        # Python dependencies
├── pyproject.toml          # uv project configuration
├── uv.lock                 # Dependency lockfile
├── .python-version         # Python version pin (3.14)
├── .gitignore              # Git ignore rules
├── static/
│   ├── css/
│   │   └── style.css       # Dark-mode design system (430 lines)
│   └── js/
│       └── app.js          # Frontend logic — fetch, render, tweet (224 lines)
└── templates/
    └── index.html          # Jinja2 HTML template
```

---

## 🚀 Getting Started

### Prerequisites

- [uv](https://github.com/astral-sh/uv) (Python package manager) — it will auto-install Python if needed

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/sathwikkajjam2006-prog/sathwikk-event-talks-app.git
cd sathwikk-event-talks-app

# Install dependencies and run (uv handles Python + virtualenv automatically)
uv sync
uv run python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

### Alternative (with pip)

```bash
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

---

## 🔄 How It Works

```
┌──────────┐       GET /api/releases       ┌──────────────┐      GET XML       ┌─────────────────┐
│          │ ──────────────────────────────▶│              │ ──────────────────▶│  Google Cloud    │
│  Browser │                                │  Flask Server │                    │  Atom XML Feed   │
│          │◀────────────────────────────── │              │◀────────────────── │                  │
└──────────┘       JSON response            └──────────────┘    XML response    └─────────────────┘
     │
     │  Click card → Select → Tweet button
     │
     ▼
┌──────────────┐
│  Twitter     │  ← Pre-composed tweet via Web Intent URL
│  (popup)     │
└──────────────┘
```

1. **Browser** loads the page from Flask (`GET /`)
2. **JavaScript** immediately calls `GET /api/releases`
3. **Flask** fetches the Atom XML feed from Google, parses it with `xml.etree.ElementTree`, and returns clean JSON
4. **JavaScript** renders the entries as interactive cards with color-coded badges
5. **User** clicks a card → selects it → clicks "Tweet" → a popup opens with a pre-filled tweet including the release title, summary, link, and hashtags

> **Why does Flask act as a proxy?** The browser cannot directly fetch the Google XML feed due to CORS (Cross-Origin Resource Sharing) restrictions. Flask fetches it server-side and serves it from the same origin.

---

## 🐦 Tweet Format

When you tweet about a release, the composed message looks like:

```
📢 BigQuery Release — June 15, 2026

Use Gemini Cloud Assist to analyze your SQL queries and receive
recommendations to optimize query performance in BigQuery…

https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026

#BigQuery #GoogleCloud
```

---

## 📡 API Reference

### `GET /api/releases`

Returns all BigQuery release notes as JSON.

**Success Response (200):**
```json
{
  "status": "ok",
  "entries": [
    {
      "title": "June 15, 2026",
      "updated": "2026-06-15T00:00:00-07:00",
      "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026",
      "content": "<h3>Feature</h3><p>Use Gemini Cloud Assist to...</p>"
    }
  ]
}
```

**Error Response (502):**
```json
{
  "status": "error",
  "message": "Connection timeout"
}
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
