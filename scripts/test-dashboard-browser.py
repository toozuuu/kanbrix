"""Exercise the signed-in workload chart and settings on a disposable Compose stack."""
import json
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect

ORIGIN = "http://localhost:5173"


def account(context, name):
    email = f"{uuid4()}@example.test"
    response = context.request.post("/api/v1/auth/register", data={
        "email": email, "name": name, "password": str(uuid4()),
    })
    assert response.ok, response.status
    return email, context.request.get("/api/v1/auth/me").json()


def check_settings_tabs(page):
    geometry = "items => items.map(item => [item.offsetLeft, item.offsetTop, item.offsetWidth])"
    page.goto("/settings")
    settings = page.get_by_role("navigation", name="Settings sections")
    expect(settings.get_by_role("link", name="Integrations")).to_be_visible()
    links = settings.get_by_role("link")
    positions = links.evaluate_all(geometry)
    settings.get_by_role("link", name="System information").click()
    panel = page.get_by_role("heading", name="System information").locator("..")
    expect(panel).to_be_visible()
    assert panel.evaluate("el => getComputedStyle(el).animationName") == "none"
    assert links.evaluate_all(geometry) == positions

    settings.get_by_role("link", name="Organization").click()
    sections = page.get_by_role("navigation", name="Configuration sections")
    calendar = sections.get_by_role("button", name="Calendar")
    expect(calendar).to_be_visible()
    buttons = sections.get_by_role("button")
    positions = buttons.evaluate_all(geometry)
    calendar.click()
    sections.get_by_role("button", name="History").click()
    expect(page.get_by_role("heading", name="Revision history")).to_be_visible()
    expect(page).to_have_url(ORIGIN + "/settings?view=organization&section=History")
    assert buttons.evaluate_all(geometry) == positions
    page.go_back()
    expect(calendar).to_have_attribute("aria-current", "page")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    owner = browser.new_context(base_url=ORIGIN)
    member = browser.new_context(base_url=ORIGIN)
    _, ada = account(owner, "Ada")
    email, kai = account(member, "Kai")
    api = owner.request
    ws = api.get("/api/v1/workspaces").json()[0]["id"]
    base = f"/api/v1/workspaces/{ws}"
    page = owner.new_page()
    page.goto("/projects")
    page.get_by_role("button", name="Create Project", exact=True).last.click()
    modal = page.get_by_role("dialog")
    modal.get_by_label("Project Name").fill("Pilot")
    modal.get_by_label("Project Key", exact=False).fill("PILOT")
    modal.get_by_role("button", name="Create Project", exact=True).click()
    expect(page.get_by_role("heading", name="Start working in Pilot")).to_be_visible()
    page.get_by_role("button", name="Invite a teammate").click()
    expect(page).to_have_url(ORIGIN + "/members")
    page.get_by_role("button", name="Invite Member", exact=True).click()
    invite = page.get_by_role("dialog")
    invite.locator("input[type=email]").fill(email)
    invite.get_by_role("button", name="Send Invitation").click()
    expect(invite).not_to_be_visible()
    project = next(p for p in api.get(base + "/projects").json() if p["project_key"] == "PILOT")
    project = api.get("/api/v1/projects/" + project["id"]).json()
    stages = {s["category"]: s["id"] for s in project["statuses"]}
    page.goto("/settings?view=integrations")
    page.get_by_role("button", name="CSV / JSON File").click()
    page.get_by_label("Choose CSV or JSON file").set_input_files({
        "name": "jira-export.csv", "mimeType": "text/csv",
        "buffer": (b"Issue key,Summary,Status,Issue Type,Labels,Labels\n"
                   b"SRC-1,Review release,Todo,Task,web,release\n"
                   b"SRC-2,Prepare notes,Todo,Task,docs,release\n"
                   b"SRC-3,Check build,Todo,Bug,ci,release\n"),
    })
    page.get_by_label("Destination project").select_option(project["id"])
    for expected in ("created", "updated"):
        page.get_by_role("button", name="Sync 3 Tickets to Kanbrix").click()
        expect(page.get_by_text(f"3 {expected}", exact=False).first).to_be_visible()
        with page.expect_download() as download:
            page.get_by_role("button", name="Download import report").click()
        report = json.loads(Path(download.value.path()).read_text())
        assert report[expected] == 3
        assert [row["external_id"] for row in report["outcomes"]] == ["SRC-1", "SRC-2", "SRC-3"]
    page.goto("/dashboard")
    chart = page.get_by_role("region", name="Member workload")
    for key, person in [("PILOT-1 Review release", ada), ("PILOT-2 Prepare notes", ada), ("PILOT-3 Check build", kai)]:
        chart.get_by_role("button", name="Unassigned", exact=False).click()
        chart.get_by_role("button", name=key).click()
        select = page.get_by_role("dialog").get_by_label("Assignee", exact=False)
        with page.expect_response(lambda r: r.request.method == "PATCH" and "/issues/" in r.url) as update:
            select.select_option(person["id"])
        assert update.value.ok
        page.keyboard.press("Escape")
    expect(chart.get_by_role("button", name="Ada", exact=False)).to_contain_text("67%")
    expect(chart.get_by_role("button", name="Kai", exact=False)).to_contain_text("33%")
    chart.get_by_role("button", name="Ada", exact=False).click()
    chart.get_by_role("button", name="PILOT-1 Review release").click()
    with page.expect_response(lambda r: r.request.method == "PATCH" and "/issues/" in r.url) as update:
        page.get_by_label("Status", exact=True).select_option(stages["Done"])
    assert update.value.ok
    page.keyboard.press("Escape")
    expect(chart.get_by_text("1 (50%)", exact=True)).to_have_count(2)
    for width in (390, 1280):
        page.set_viewport_size({"width": width, "height": 800})
        check_settings_tabs(page)
    for scheme in ("light", "dark"):
        page.emulate_media(color_scheme=scheme)
        for width in (390, 1280):
            page.set_viewport_size({"width": width, "height": 800})
            for path in ("/settings?view=workflow", "/settings?section=History"):
                page.goto(path)
                heading = "Revision history" if "History" in path else "Pilot workflow"
                expect(page.get_by_role("heading", name=heading)).to_be_visible()
                assert page.locator("main").evaluate("el => el.scrollWidth <= el.clientWidth + 1")
            page.keyboard.press("Control+k")
            dialog = page.get_by_role("dialog")
            expect(dialog).to_be_visible()
            dialog.get_by_role("textbox").press("ArrowDown")
            expect(dialog.locator("button:focus")).to_have_count(1)
            page.keyboard.press("Escape")
    browser.close()
