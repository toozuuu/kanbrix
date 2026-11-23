"""Exercise the sprint lifecycle against the disposable CI Compose stack."""
import json
import secrets
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

client = build_opener(HTTPCookieProcessor(CookieJar()))


def api(path, body=None):
    request = Request(
        "http://localhost:5173/api/v1" + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with client.open(request, timeout=10) as response:
        data = response.read()
        return json.loads(data) if data else None


def main():
    api("/auth/register", {"name": "Sprint Test", "email": secrets.token_hex(8) + "@example.test",
                           "password": secrets.token_urlsafe(24)})
    workspace = api("/workspaces")[0]["id"]
    project = api(f"/workspaces/{workspace}/projects", {"name": "Sprint test", "project_key": "CHECK"})
    prefix = "/projects/" + project["id"]
    sprint = api(prefix + "/sprints", {"name": "First sprint"})
    endpoint = "/sprints/" + sprint["id"]
    api(endpoint + "/start", {})
    statuses = {s["category"]: s["id"] for s in project["statuses"]}
    for category in ("Todo", "Done"):
        api(prefix + "/issues", {"title": category + " item", "status_id": statuses[category], "sprint_id": sprint["id"]})
    api(endpoint + "/complete", {})
    first = api(prefix + "/sprints")[0]
    api(endpoint + "/complete", {})
    assert first["end_date"] == api(prefix + "/sprints")[0]["end_date"]
    issues = api(prefix + "/issues")
    assert len(issues) == 2
    for issue in issues:
        expected = sprint["id"] if issue["status_category"] == "Done" else None
        assert issue["sprint_id"] == expected
    try:
        api(endpoint + "/start", {})
    except HTTPError as error:
        assert error.code == 409
    else:
        raise AssertionError("Completed sprint restarted")


if __name__ == "__main__":
    main()
