"""Flask application to fetch and display BigQuery release notes."""

import xml.etree.ElementTree as ET
from html import unescape

import requests
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = "{http://www.w3.org/2005/Atom}"


def fetch_release_notes():
    """Fetch and parse BigQuery release notes from the Atom XML feed."""
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()

    root = ET.fromstring(response.content)
    entries = []

    for entry in root.findall(f"{ATOM_NS}entry"):
        title = entry.findtext(f"{ATOM_NS}title", default="")
        updated = entry.findtext(f"{ATOM_NS}updated", default="")
        link_el = entry.find(f"{ATOM_NS}link[@rel='alternate']")
        link = link_el.get("href", "") if link_el is not None else ""
        content_html = entry.findtext(f"{ATOM_NS}content", default="")
        content_html = unescape(content_html)

        entries.append(
            {
                "title": title,
                "updated": updated,
                "link": link,
                "content": content_html,
            }
        )

    return entries


@app.route("/")
def index():
    """Render the main page."""
    return render_template("index.html")


@app.route("/api/releases")
def api_releases():
    """API endpoint that returns release notes as JSON."""
    try:
        entries = fetch_release_notes()
        return jsonify({"status": "ok", "entries": entries})
    except requests.RequestException as exc:
        return jsonify({"status": "error", "message": str(exc)}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
