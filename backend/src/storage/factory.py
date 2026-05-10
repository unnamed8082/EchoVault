from storage.base import StorageBackend
from storage.filesystem import FilesystemStorage
from storage.database_storage import DatabaseStorage


def create_storage_backend(mode: str = "filesystem", **kwargs) -> StorageBackend:
    if mode == "filesystem":
        return FilesystemStorage(
            skills_dir=kwargs["skills_dir"],
            uploads_dir=kwargs["uploads_dir"],
        )
    elif mode == "database":
        return DatabaseStorage(session_factory=kwargs["session_factory"])
    else:
        raise ValueError(f"Unknown storage mode: {mode}")
