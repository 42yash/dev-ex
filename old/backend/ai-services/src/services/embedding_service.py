"""
Embedding Service for Vector Search
Handles document chunking, embedding generation, and vector storage
"""

import asyncio
import hashlib
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np

import google.generativeai as genai
from asyncpg import Connection
import tiktoken

from ..config import Config
from ..db.connection import DatabaseManager
from ..cache.redis_client import RedisCache

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating and managing embeddings for semantic search"""
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        cache: RedisCache
    ):
        self.config = config
        self.db = db_manager
        self.cache = cache
        
        # Initialize embedding model
        self.embedding_model = None
        if config.gemini.api_key:
            genai.configure(api_key=config.gemini.api_key)
            # Use text-embedding-004 model for embeddings
            self.embedding_model = genai.GenerativeModel('models/text-embedding-004')
            logger.info("Initialized Gemini embedding model")
        
        # Tokenizer for counting tokens
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        
        # Configuration
        self.max_chunk_size = 1000  # Maximum tokens per chunk
        self.chunk_overlap = 200    # Token overlap between chunks
        self.embedding_dimension = 768  # Gemini's embedding dimension
        
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text"""
        try:
            # Check cache first
            cache_key = f"embedding:{hashlib.md5(text.encode()).hexdigest()}"
            cached = await self.cache.get(cache_key)
            if cached:
                return json.loads(cached)
            
            if not self.embedding_model:
                logger.warning("Embedding model not initialized")
                return None
            
            # Generate embedding using Gemini
            result = await asyncio.to_thread(
                self.embedding_model.embed_content,
                content=text,
                task_type="retrieval_document"
            )
            
            # Extract embedding vector
            embedding = result['embedding'] if 'embedding' in result else None
            
            if embedding:
                # Cache for 24 hours
                await self.cache.set(cache_key, json.dumps(embedding), ttl=86400)
                
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return None
    
    async def generate_query_embedding(self, query: str) -> Optional[List[float]]:
        """Generate embedding for a search query"""
        try:
            if not self.embedding_model:
                logger.warning("Embedding model not initialized")
                return None
            
            # Generate embedding optimized for queries
            result = await asyncio.to_thread(
                self.embedding_model.embed_content,
                content=query,
                task_type="retrieval_query"
            )
            
            return result.get('embedding')
            
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            return None
    
    def chunk_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Split text into overlapping chunks for embedding"""
        tokens = self.tokenizer.encode(text)
        chunks = []
        
        # Calculate chunk boundaries
        start = 0
        chunk_index = 0
        
        while start < len(tokens):
            # Determine end of chunk
            end = min(start + self.max_chunk_size, len(tokens))
            
            # Extract chunk tokens and decode
            chunk_tokens = tokens[start:end]
            chunk_text = self.tokenizer.decode(chunk_tokens)
            
            # Create chunk object
            chunk = {
                'chunk_index': chunk_index,
                'content': chunk_text,
                'start_token': start,
                'end_token': end,
                'metadata': {
                    **(metadata or {}),
                    'chunk_size': len(chunk_tokens),
                    'total_chunks': 0  # Will be updated after all chunks are created
                }
            }
            
            chunks.append(chunk)
            
            # Move to next chunk with overlap
            start = end - self.chunk_overlap if end < len(tokens) else end
            chunk_index += 1
        
        # Update total chunks count
        for chunk in chunks:
            chunk['metadata']['total_chunks'] = len(chunks)
        
        return chunks
    
    async def store_document(
        self,
        document_id: str,
        title: str,
        content: str,
        connector_name: str,
        source_id: str = None,
        source_url: str = None,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Store a document with its embeddings in the database"""
        try:
            # Check if document already exists
            existing = await self.db.query(
                """
                SELECT id FROM documents 
                WHERE connector_name = $1 AND source_id = $2
                """,
                connector_name,
                source_id or document_id
            )
            
            if existing:
                logger.info(f"Document already exists: {source_id}")
                return True
            
            # Insert document
            await self.db.execute(
                """
                INSERT INTO documents (id, connector_name, source_id, source_url, title, content, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (connector_name, source_id) DO UPDATE
                SET title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                """,
                document_id,
                connector_name,
                source_id or document_id,
                source_url,
                title,
                content,
                json.dumps(metadata or {})
            )
            
            # Chunk the document
            chunks = self.chunk_text(content, metadata)
            
            # Generate and store embeddings for each chunk
            for chunk in chunks:
                embedding = await self.generate_embedding(chunk['content'])
                
                if embedding:
                    # Convert to numpy array and then to list for storage
                    embedding_array = np.array(embedding).tolist()
                    
                    await self.db.execute(
                        """
                        INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (document_id, chunk_index) DO UPDATE
                        SET content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            metadata = EXCLUDED.metadata
                        """,
                        document_id,
                        chunk['chunk_index'],
                        chunk['content'],
                        embedding_array,
                        json.dumps(chunk['metadata'])
                    )
            
            logger.info(f"Stored document {document_id} with {len(chunks)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store document: {e}")
            return False
    
    async def semantic_search(
        self,
        query: str,
        connector_filter: str = None,
        metadata_filter: Dict[str, Any] = None,
        limit: int = 10,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Perform semantic search using vector similarity"""
        try:
            # Generate query embedding
            query_embedding = await self.generate_query_embedding(query)
            
            if not query_embedding:
                logger.warning("Failed to generate query embedding")
                return []
            
            # Build the query
            query_sql = """
                WITH filtered_chunks AS (
                    SELECT 
                        dc.id as chunk_id,
                        dc.document_id,
                        dc.chunk_index,
                        dc.content,
                        dc.embedding,
                        dc.metadata as chunk_metadata,
                        d.title as doc_title,
                        d.connector_name,
                        d.source_url,
                        d.metadata as doc_metadata
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE 1=1
            """
            
            params = [query_embedding]
            param_count = 1
            
            # Add connector filter
            if connector_filter:
                param_count += 1
                query_sql += f" AND d.connector_name = ${param_count}"
                params.append(connector_filter)
            
            # Add metadata filter if provided
            if metadata_filter:
                param_count += 1
                query_sql += f" AND d.metadata @> ${param_count}::jsonb"
                params.append(json.dumps(metadata_filter))
            
            query_sql += f"""
                )
                SELECT 
                    chunk_id,
                    document_id,
                    chunk_index,
                    content,
                    1 - (embedding <=> $1::vector) as similarity,
                    chunk_metadata,
                    doc_title,
                    connector_name,
                    source_url,
                    doc_metadata
                FROM filtered_chunks
                WHERE 1 - (embedding <=> $1::vector) >= {similarity_threshold}
                ORDER BY embedding <=> $1::vector
                LIMIT {limit}
            """
            
            # Execute search
            results = await self.db.query(query_sql, *params)
            
            # Format results
            formatted_results = []
            for row in results:
                formatted_results.append({
                    'chunk_id': row['chunk_id'],
                    'document_id': row['document_id'],
                    'chunk_index': row['chunk_index'],
                    'content': row['content'],
                    'similarity': float(row['similarity']),
                    'document_title': row['doc_title'],
                    'source_url': row['source_url'],
                    'connector': row['connector_name'],
                    'metadata': {
                        **json.loads(row['doc_metadata'] or '{}'),
                        **json.loads(row['chunk_metadata'] or '{}')
                    }
                })
            
            logger.info(f"Semantic search returned {len(formatted_results)} results")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    async def hybrid_search(
        self,
        query: str,
        connector_filter: str = None,
        limit: int = 10,
        vector_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search combining vector similarity and keyword matching"""
        try:
            # Get vector search results
            vector_results = await self.semantic_search(
                query, 
                connector_filter=connector_filter,
                limit=limit * 2  # Get more results for merging
            )
            
            # Perform keyword search
            keyword_results = await self.db.query(
                """
                SELECT 
                    dc.id as chunk_id,
                    dc.document_id,
                    dc.chunk_index,
                    dc.content,
                    d.title as doc_title,
                    d.source_url,
                    d.connector_name,
                    ts_rank(to_tsvector('english', dc.content), 
                            plainto_tsquery('english', $1)) as keyword_score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
                    AND ($2::text IS NULL OR d.connector_name = $2)
                ORDER BY keyword_score DESC
                LIMIT $3
                """,
                query,
                connector_filter,
                limit * 2
            )
            
            # Merge and score results
            merged_results = {}
            
            # Add vector results
            for result in vector_results:
                key = f"{result['document_id']}_{result['chunk_index']}"
                merged_results[key] = {
                    **result,
                    'vector_score': result['similarity'],
                    'keyword_score': 0,
                    'combined_score': result['similarity'] * vector_weight
                }
            
            # Add/update with keyword results
            for row in keyword_results:
                key = f"{row['document_id']}_{row['chunk_index']}"
                keyword_score = float(row['keyword_score'])
                
                if key in merged_results:
                    merged_results[key]['keyword_score'] = keyword_score
                    merged_results[key]['combined_score'] += keyword_score * (1 - vector_weight)
                else:
                    merged_results[key] = {
                        'chunk_id': row['chunk_id'],
                        'document_id': row['document_id'],
                        'chunk_index': row['chunk_index'],
                        'content': row['content'],
                        'document_title': row['doc_title'],
                        'source_url': row['source_url'],
                        'connector': row['connector_name'],
                        'vector_score': 0,
                        'keyword_score': keyword_score,
                        'combined_score': keyword_score * (1 - vector_weight)
                    }
            
            # Sort by combined score and return top results
            final_results = sorted(
                merged_results.values(),
                key=lambda x: x['combined_score'],
                reverse=True
            )[:limit]
            
            return final_results
            
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            return []
    
    async def get_relevant_context(
        self,
        query: str,
        max_tokens: int = 2000,
        connector_filter: str = None
    ) -> str:
        """Get relevant context for a query to use in RAG"""
        try:
            # Perform hybrid search
            results = await self.hybrid_search(
                query,
                connector_filter=connector_filter,
                limit=10
            )
            
            if not results:
                return ""
            
            # Build context from results
            context_parts = []
            token_count = 0
            
            for result in results:
                # Count tokens in this chunk
                chunk_tokens = len(self.tokenizer.encode(result['content']))
                
                # Check if adding this chunk would exceed limit
                if token_count + chunk_tokens > max_tokens:
                    break
                
                # Add to context
                context_parts.append(f"""
Source: {result.get('document_title', 'Unknown')}
Content: {result['content']}
---
""")
                token_count += chunk_tokens
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Failed to get relevant context: {e}")
            return ""