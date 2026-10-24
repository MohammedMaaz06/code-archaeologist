from pathlib import Path

from app.services.graph_service import GraphService
from app.services.vector_service import VectorSearchService


_graph_services: dict[str, GraphService] = {}
_vector_services: dict[str, VectorSearchService] = {}


def repository_key(path: str) -> str:
    return str(Path(path).expanduser().resolve()).casefold()


def register_graph_service(path: str, service: GraphService) -> None:
    _graph_services[repository_key(path)] = service


def get_graph_service(path: str) -> GraphService | None:
    return _graph_services.get(repository_key(path))


def get_vector_service(path: str) -> VectorSearchService | None:
    return _vector_services.get(repository_key(path))


def get_or_create_vector_service(path: str) -> VectorSearchService:
    key = repository_key(path)
    service = _vector_services.get(key)
    if service is None:
        service = VectorSearchService()
        _vector_services[key] = service
    return service
