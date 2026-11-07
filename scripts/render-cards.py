"""Draws the preview pictures listed in og-pending.json (made by generate-blog-pages.mjs)."""
import json, os
from playwright.sync_api import sync_playwright

items = json.load(open("og-pending.json", encoding="utf-8"))
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630})
    for it in items:
        os.makedirs(os.path.dirname(it["out"]), exist_ok=True)
        page.set_content(it["html"])
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(150)
        page.screenshot(path=it["out"], clip={"x": 0, "y": 0, "width": 1200, "height": 630})
        print("drew", it["out"])
    browser.close()
os.remove("og-pending.json")
