"""Exercise organization configuration against the disposable Compose stack."""
import json
import secrets
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from uuid import uuid4


def account():
    client = build_opener(HTTPCookieProcessor(CookieJar()))

    def call(path, method="GET", body=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        data = json.dumps(body).encode() if body is not None else None
        req = Request("http://localhost:5173/api/v1" + path, data=data, headers=headers, method=method)
        with client.open(req, timeout=10) as res:
            result = res.read()
            return json.loads(result) if result else None
    call("/auth/register", "POST", {"email": secrets.token_hex(8) + "@example.test",
                                    "password": secrets.token_urlsafe(24), "name": "Support test"})
    return call


def reject(status, fn):
    try:
        fn()
    except HTTPError as error:
        assert error.code == status, (error.code, error.read())
    else:
        raise AssertionError("Expected HTTP " + str(status))


def main():
    admin, outsider = account(), account()
    ws = "/workspaces/" + admin("/workspaces")[0]["id"]
    config = ws + "/configuration"
    original = admin(config)
    draft = json.loads(json.dumps(original))
    field = str(uuid4())
    draft["configuration"].update({
        "brand": "Example Support", "types": ["Ticket"],
        "fields": [{"id": field, "label": "Customer impact", "required": True, "kind": "select",
                    "options": ["high", "low"], "issue_type": "Ticket"}],
        "templates": [{"name": "Support", "sprints": False,
                       "columns": [{"name": "Triage", "category": "Todo"}, {"name": "Resolved", "category": "Done"}]}],
    })
    assert admin(config + "/preview", "POST", draft["configuration"])["issues_missing_required_fields"] == 0
    saved = admin(config, "PUT", draft)
    reject(409, lambda: admin(config, "PUT", draft))
    reject(403, lambda: outsider(config))
    project = admin(ws + "/projects", "POST", {"name": "Support desk", "project_key": "DESK", "template": "Support"})
    prefix = "/projects/" + project["id"]
    assert not admin(prefix + "/workflow")["sprints"]
    reject(400, lambda: admin(prefix + "/sprints", "POST", {"name": "Disabled sprint"}))
    hooks = ws + "/integrations"
    admin(hooks, "PUT", {"events": ["issue.created"], "destination": "", "notify_assignee": False})
    key = admin(hooks + "/credential", "POST", True)["token"]
    body = {"title": "Customer request", "type": "Ticket", "status_id": project["statuses"][0]["id"]}
    reject(400, lambda: admin(prefix + "/issues", "POST", body))
    body["custom_values"] = {field: "high"}
    issue = admin(prefix + "/issues", "POST", body)
    assert admin(prefix + "/issues?field_id=" + field + "&field_value=high")[0]["id"] == issue["id"]
    assert admin(hooks + "/events", token=key)[0]["payload"]["issue_id"] == issue["id"]
    admin(hooks + "/credential", "POST", False)
    reject(401, lambda: admin(hooks + "/events", token=key))
    restored = admin(config, "PUT", {**original, "revision": saved["revision"]})
    assert restored["configuration"] == original["configuration"]
    assert admin("/issues/" + issue["id"])["custom_values"][field] == "high"


if __name__ == "__main__":
    main()
