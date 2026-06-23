"""Unit tests for upload filename handling."""

from app.service import upload as upload_service
from app.types import FileUploadResponse


def _fake_upload_file(file_data, key, content_type):
    return FileUploadResponse(
        key=key,
        filename="eval.yaml",
        size_bytes=len(file_data),
        size_human="5 B",
        content_type=content_type,
        uploaded_at="2026-02-14T00:00:00Z",
        url=None,
    )


def test_upload_allows_duplicate_filename(monkeypatch):
    """B2 is always versioned — re-uploading the same name creates a new version."""
    monkeypatch.setattr(upload_service, "upload_file", _fake_upload_file)

    result = upload_service.process_upload(
        file_data=b"hello",
        filename="eval.yaml",
        content_type="text/yaml",
        content_length=5,
    )

    assert result.key == "uploads/eval.yaml"


def test_upload_uses_original_filename(monkeypatch):
    monkeypatch.setattr(upload_service, "upload_file", _fake_upload_file)

    result = upload_service.process_upload(
        file_data=b"hello",
        filename="eval.yaml",
        content_type="text/yaml",
        content_length=5,
    )

    assert result.key == "uploads/eval.yaml"
