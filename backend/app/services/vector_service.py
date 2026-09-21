import math
import re
from collections import Counter
from typing import List, Dict, Any, Tuple
from app.services.chunker_service import CodeChunk


class VectorSearchService:
    def __init__(self):
        self.indexed_chunks: List[CodeChunk] = []
        self.vocab: Dict[str, int] = {}
        self.doc_vectors: List[Dict[str, float]] = []

    def clear(self):
        self.indexed_chunks.clear()
        self.vocab.clear()
        self.doc_vectors.clear()

    @staticmethod
    def tokenize(text: str) -> List[str]:
        # Split on non-alphanumeric characters and camelCase/PascalCase
        tokens = re.findall(r'[a-zA-Z0-9]+', text.lower())
        return [t for t in tokens if len(t) > 1]

    def _compute_tf(self, tokens: List[str]) -> Dict[str, float]:
        counts = Counter(tokens)
        total = len(tokens) or 1
        return {term: count / total for term, count in counts.items()}

    def index_chunks(self, chunks: List[CodeChunk]):
        self.indexed_chunks.extend(chunks)
        
        for chunk in chunks:
            tokens = self.tokenize(chunk.content)
            tf = self._compute_tf(tokens)
            self.doc_vectors.append(tf)

    def query(self, search_query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.indexed_chunks:
            return []

        query_tokens = self.tokenize(search_query)
        query_tf = self._compute_tf(query_tokens)

        results: List[Tuple[float, CodeChunk]] = []

        for idx, doc_tf in enumerate(self.doc_vectors):
            # Compute cosine similarity
            score = 0.0
            doc_norm = math.sqrt(sum(v ** 2 for v in doc_tf.values())) or 1.0
            query_norm = math.sqrt(sum(v ** 2 for v in query_tf.values())) or 1.0

            for term, q_val in query_tf.items():
                if term in doc_tf:
                    score += q_val * doc_tf[term]

            similarity = score / (query_norm * doc_norm)
            if similarity > 0.0:
                results.append((similarity, self.indexed_chunks[idx]))

        results.sort(key=lambda x: x[0], reverse=True)
        top_results = results[:top_k]

        return [
            {
                "score": round(score, 4),
                "chunk": chunk.to_dict()
            }
            for score, chunk in top_results
        ]
