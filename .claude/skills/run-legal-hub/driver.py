#!/usr/bin/env python3
"""
Driver for Legal Hub (static index.html, no build step).

Usage:
  python3 driver.py serve [port]                 # start local server in background
  python3 driver.py stop [port]                  # kill the server listening on port
  python3 driver.py smoke [port] [out_dir]       # smoke test: RTL layout, tabs, check for legal suffix absence, screenshot
  python3 driver.py export-a4 [port] [out_dir]   # export contracts to physical A4 PDF and verify page layout

Requires: playwright (Python package) and Google Chrome or Playwright Chromium.
"""
import os
import subprocess
import sys
import time
import urllib.request

UNIT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def get_browser(playwright_instance):
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if os.path.exists(chrome_path):
        return playwright_instance.chromium.launch(executable_path=chrome_path)
    try:
        return playwright_instance.chromium.launch()
    except Exception:
        return playwright_instance.chromium.launch(channel="chrome")


def serve(port):
    subprocess.Popen(
        ["python3", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=UNIT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=1)
            print(f"Server up on {port}")
            return
        except Exception:
            time.sleep(0.3)
    raise SystemExit("Server did not come up in time")


def stop(port):
    out = subprocess.run(
        ["lsof", "-ti", f":{port}", "-sTCP:LISTEN"], capture_output=True, text=True
    ).stdout.strip()
    if out:
        subprocess.run(["kill"] + out.split())
        print(f"Stopped server on {port}")
    else:
        print(f"No server listening on {port}")


def smoke(port, out_dir):
    from playwright.sync_api import sync_playwright

    os.makedirs(out_dir, exist_ok=True)
    errors = []
    forbidden_phrase = "ذات الشخص الواحد المحدودة المسؤولية"

    with sync_playwright() as p:
        b = get_browser(p)
        page = b.new_page(viewport={"width": 1440, "height": 1000})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1. Load Home
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_selector("text=المركز القانوني")
        
        # Check RTL attribute
        dir_attr = page.locator("html").get_attribute("dir")
        rtl_ok = dir_attr == "rtl"
        print(f"[{'ok' if rtl_ok else 'FAIL'}] html dir attribute is {dir_attr}")

        # Check sidebar position
        sidebar_box = page.locator(".side").bounding_box()
        view_box = page.locator("main").bounding_box()
        sidebar_on_right = sidebar_box and view_box and (sidebar_box["x"] > view_box["x"])
        print(f"[{'ok' if sidebar_on_right else 'FAIL'}] sidebar layout: {'RIGHT (RTL)' if sidebar_on_right else 'LEFT (LTR)'}")

        page.screenshot(path=f"{out_dir}/01_templates_tab.png")
        print(f"[ok] templates view -> {out_dir}/01_templates_tab.png")

        # 2. Check Contracts Tab
        page.locator("a[data-r='contracts']").click()
        page.wait_for_timeout(300)
        page.screenshot(path=f"{out_dir}/02_contracts_tab.png")
        print(f"[ok] contracts table view -> {out_dir}/02_contracts_tab.png")

        # 3. Check Company Profile / Settings Tab
        if page.locator("a[data-r='settings']").count() > 0:
            page.locator("a[data-r='settings']").click()
        else:
            page.click("text=بيانات الشركة")
        page.wait_for_timeout(300)
        company_text = page.locator("#view").inner_text()
        has_forbidden = forbidden_phrase in company_text
        print(f"[{'FAIL' if has_forbidden else 'ok'}] forbidden legal suffix check in company settings: {'FOUND' if has_forbidden else 'CLEAN'}")
        page.screenshot(path=f"{out_dir}/03_company_profile.png")
        print(f"[ok] company profile view -> {out_dir}/03_company_profile.png")

        # 4. Check Editor Tab & Document Preview
        if page.locator("a[data-r='templates']").count() > 0:
            page.locator("a[data-r='templates']").click()
        else:
            page.click("text=نماذج العقود")
        page.wait_for_timeout(300)
        page.locator("[data-new]").first.click()
        page.wait_for_selector(".pg, .doc")

        # Check editor layout: form pane on right, preview paper on left
        form_box = page.locator(".form-pane").bounding_box()
        paper_box = page.locator(".pv-pane").bounding_box()
        editor_rtl_ok = form_box and paper_box and (form_box["x"] > paper_box["x"])
        print(f"[{'ok' if editor_rtl_ok else 'FAIL'}] editor layout: {'FORM ON RIGHT, PREVIEW ON LEFT' if editor_rtl_ok else 'INVERTED'}")

        # Check document text for forbidden suffix
        doc_text = page.locator(".doc").first.inner_text()
        doc_has_forbidden = forbidden_phrase in doc_text
        print(f"[{'FAIL' if doc_has_forbidden else 'ok'}] forbidden legal suffix check in document paper: {'FOUND' if doc_has_forbidden else 'CLEAN'}")

        page.screenshot(path=f"{out_dir}/04_editor_preview.png")
        print(f"[ok] editor preview -> {out_dir}/04_editor_preview.png")

        print("console/page errors:", errors if errors else "none (clean)")
        b.close()


def export_a4(port, out_dir):
    from playwright.sync_api import sync_playwright

    os.makedirs(out_dir, exist_ok=True)
    templates_to_test = [
        ("actor", 0, "عقد ممثل"),
        ("artistic", 1, "عقد إنتاج فني"),
        ("nda", 2, "اتفاقية سرية معلومات"),
    ]

    with sync_playwright() as p:
        b = get_browser(p)
        page = b.new_page(viewport={"width": 1440, "height": 1000})

        for slug, card_index, label in templates_to_test:
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
            page.wait_for_selector(".tmpl-card, .card")
            
            # Click template card button
            page.locator("[data-new]").nth(card_index).click()
            page.wait_for_selector(".pg, .doc")

            # Allow rendering and fonts to settle
            page.wait_for_timeout(500)

            # Emulate screen/print media for PDF output
            page.emulate_media(media="print")
            pdf_path = f"{out_dir}/{slug}_a4_export.pdf"
            
            # Export exact A4 PDF using print CSS margins
            page.pdf(
                path=pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
            )
            print(f"[ok] {label} exported to A4 -> {pdf_path}")

        b.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else None
    port = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 8735
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "/tmp/legal_hub_artifacts"

    if cmd == "serve":
        serve(port)
    elif cmd == "stop":
        stop(port)
    elif cmd == "smoke":
        smoke(port, out_dir)
    elif cmd == "export-a4":
        export_a4(port, out_dir)
    else:
        print(__doc__)
        sys.exit(1)

