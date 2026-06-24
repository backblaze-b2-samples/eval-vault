"""Tests for user-created eval definitions: the POST /evals create path, name
validation, uniqueness across shipped + B2 definitions, and the resilient merge
in list_definitions. The B2 layer is faked with an in-memory dict store."""

import pytest

from app.service import eval_store

# A complete, valid definition body for the create endpoint.
VALID_DEFINITION = {
    "name": "my-new-eval",
    "description": "A user-created eval",
    "judge_model": "claude-sonnet-4-6",
    "targets": [
        {"id": "opus", "model": "claude-opus-4-8", "max_tokens": 512},
    ],
    "cases": [
        {
            "id": "q1",
            "prompt": "What is the capital of France?",
            "scorer": {"type": "contains", "expected": "Paris"},
        }
    ],
}


@pytest.fixture
def fake_b2(monkeypatch):
    """Back eval_store's B2 helpers with an in-memory dict so create/list/get
    are hermetic. Returns the store dict for assertions / pre-seeding."""
    store: dict[str, dict] = {}

    def fake_put_json(key, obj):
        store[key] = obj

    def fake_get_json(key):
        if key not in store:
            raise RuntimeError(f"missing key: {key}")
        return store[key]

    def fake_list_prefix(prefix, max_keys=1000):
        return [k for k in store if k.startswith(prefix)]

    def fake_delete_file(key):
        store.pop(key, None)

    monkeypatch.setattr(eval_store, "put_json", fake_put_json)
    monkeypatch.setattr(eval_store, "get_json", fake_get_json)
    monkeypatch.setattr(eval_store, "list_prefix", fake_list_prefix)
    monkeypatch.setattr(eval_store, "delete_file", fake_delete_file)
    return store


@pytest.mark.asyncio
async def test_create_definition_happy_path(client, fake_b2):
    response = await client.post("/evals", json=VALID_DEFINITION)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "my-new-eval"
    assert body["targets"][0]["model"] == "claude-opus-4-8"
    # Persisted under the definitions prefix as <name>.json.
    assert "evals/definitions/my-new-eval.json" in fake_b2


@pytest.mark.asyncio
async def test_create_definition_appears_in_list(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    response = await client.get("/evals")
    assert response.status_code == 200
    names = [d["name"] for d in response.json()]
    assert "my-new-eval" in names
    # Shipped YAML examples still merge in alongside the created one.
    assert "factual-qa" in names


@pytest.mark.asyncio
async def test_create_definition_duplicate_b2_conflicts(client, fake_b2):
    first = await client.post("/evals", json=VALID_DEFINITION)
    assert first.status_code == 201
    second = await client.post("/evals", json=VALID_DEFINITION)
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"]


@pytest.mark.asyncio
async def test_create_definition_duplicate_shipped_conflicts(client, fake_b2):
    """Uniqueness spans shipped YAML, not just B2 — factual-qa ships in /evals."""
    body = {**VALID_DEFINITION, "name": "factual-qa"}
    response = await client.post("/evals", json=body)
    assert response.status_code == 409


@pytest.mark.parametrize("bad_name", ["../etc", "Has Spaces", "", "UPPER", "a"])
@pytest.mark.asyncio
async def test_create_definition_invalid_name_rejected(client, fake_b2, bad_name):
    body = {**VALID_DEFINITION, "name": bad_name}
    response = await client.post("/evals", json=body)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_definition_invalid_body_rejected(client, fake_b2):
    # max_tokens above the Pydantic ceiling (8192) -> 422 at the boundary.
    bad_tokens = {
        **VALID_DEFINITION,
        "targets": [{"id": "t", "model": "m", "max_tokens": 99999}],
    }
    assert (await client.post("/evals", json=bad_tokens)).status_code == 422

    # Empty targets / cases are meaningless and rejected by min_length=1.
    no_targets = {**VALID_DEFINITION, "targets": []}
    assert (await client.post("/evals", json=no_targets)).status_code == 422
    no_cases = {**VALID_DEFINITION, "cases": []}
    assert (await client.post("/evals", json=no_cases)).status_code == 422


@pytest.mark.asyncio
async def test_list_definitions_degrades_when_b2_down(client, monkeypatch):
    """If B2 listing fails, the read path still returns shipped definitions."""

    def boom(prefix, max_keys=1000):
        raise RuntimeError("B2 unreachable")

    monkeypatch.setattr(eval_store, "list_prefix", boom)
    response = await client.get("/evals")
    assert response.status_code == 200
    names = [d["name"] for d in response.json()]
    assert "factual-qa" in names


def test_name_ok_table():
    good = ["factual-qa", "eval1", "a-b-c", "x1", "my-new-eval"]
    bad = ["", "a", "UPPER", "has space", "../etc", "-leading", "a/b", "with.dot"]
    assert all(eval_store._name_ok(n) for n in good)
    assert not any(eval_store._name_ok(n) for n in bad)


# --- list editable flag ---


@pytest.mark.asyncio
async def test_list_marks_user_definitions_editable(client, fake_b2):
    """GET /evals tags user-created definitions editable and shipped YAML not."""
    await client.post("/evals", json=VALID_DEFINITION)
    by_name = {d["name"]: d for d in (await client.get("/evals")).json()}
    assert by_name["my-new-eval"]["editable"] is True
    # factual-qa ships as a read-only YAML example.
    assert by_name["factual-qa"]["editable"] is False


# --- update (PUT /evals/{name}) ---


@pytest.mark.asyncio
async def test_update_definition_happy_path(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    edited = {**VALID_DEFINITION, "description": "Edited description"}
    response = await client.put("/evals/my-new-eval", json=edited)
    assert response.status_code == 200
    assert response.json()["description"] == "Edited description"
    # The B2 object is overwritten in place, not duplicated.
    stored = fake_b2["evals/definitions/my-new-eval.json"]
    assert stored["description"] == "Edited description"


@pytest.mark.asyncio
async def test_update_definition_reflected_in_list(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    edited = {**VALID_DEFINITION, "description": "Now updated"}
    await client.put("/evals/my-new-eval", json=edited)
    listed = {d["name"]: d for d in (await client.get("/evals")).json()}
    assert listed["my-new-eval"]["description"] == "Now updated"


@pytest.mark.asyncio
async def test_update_definition_unknown_name_404(client, fake_b2):
    body = {**VALID_DEFINITION, "name": "does-not-exist"}
    response = await client.put("/evals/does-not-exist", json=body)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_definition_shipped_rejected(client, fake_b2):
    """Shipped YAML examples are read-only — editing one 404s (not user-created)."""
    body = {**VALID_DEFINITION, "name": "factual-qa"}
    response = await client.put("/evals/factual-qa", json=body)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_definition_name_mismatch_400(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    body = {**VALID_DEFINITION, "name": "different-name"}
    response = await client.put("/evals/my-new-eval", json=body)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_definition_invalid_body_422(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    body = {**VALID_DEFINITION, "cases": []}  # min_length=1
    response = await client.put("/evals/my-new-eval", json=body)
    assert response.status_code == 422


# --- delete (DELETE /evals/{name}) ---


@pytest.mark.asyncio
async def test_delete_definition_happy_path(client, fake_b2):
    await client.post("/evals", json=VALID_DEFINITION)
    response = await client.delete("/evals/my-new-eval")
    assert response.status_code == 200
    assert response.json() == {"deleted": True, "name": "my-new-eval"}
    assert "evals/definitions/my-new-eval.json" not in fake_b2
    names = [d["name"] for d in (await client.get("/evals")).json()]
    assert "my-new-eval" not in names


@pytest.mark.asyncio
async def test_delete_definition_unknown_name_404(client, fake_b2):
    assert (await client.delete("/evals/never-existed")).status_code == 404


@pytest.mark.asyncio
async def test_delete_definition_shipped_rejected(client, fake_b2):
    """Deleting a shipped YAML example 404s — only user-created defs are deletable."""
    assert (await client.delete("/evals/factual-qa")).status_code == 404


# --- CORS (the edit/delete methods must survive the browser preflight) ---


@pytest.mark.parametrize("method", ["PUT", "DELETE", "POST"])
@pytest.mark.asyncio
async def test_cors_preflight_allows_write_methods(client, method):
    """A browser sends an OPTIONS preflight before a cross-origin PUT/DELETE with
    a JSON body. If the method isn't in the CORS allowlist the browser blocks the
    real request and the UI shows a bare "Network error" — regression guard for
    edit-save, which uses PUT (was omitted from allow_methods)."""
    response = await client.options(
        "/evals/my-new-eval",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": method,
        },
    )
    assert response.status_code == 200
    assert method in response.headers.get("access-control-allow-methods", "")
