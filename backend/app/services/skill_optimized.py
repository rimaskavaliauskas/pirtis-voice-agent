"""
Skill Service - Manages Pirtis Design Skill versions

This module handles skill version CRUD operations and provides skill content
for LLM prompt injection during interviews.

IMPORTANT NOTES FOR FUTURE DEVELOPERS:
======================================

1. ASYNCPG + SQLALCHEMY GOTCHAS:
   - PostgreSQL jsonb columns return Python dicts via asyncpg, NOT strings
   - Always check: `isinstance(value, dict)` before `json.loads()`
   - Use `CAST(:param AS type)` instead of `:param::type` - SQLAlchemy's
     named params use `:` which conflicts with PostgreSQL's `::` cast syntax

2. PARAMETER BINDING:
   - For complex types (arrays, jsonb), use SQLAlchemy's text().bindparams()
     with explicit type definitions when possible
   - Alternative: Use CAST() function in SQL for type coercion

3. CACHING:
   - Simple in-memory cache for active skill (cleared on any modification)
   - For production scaling, consider Redis or similar

Example Usage:
    skill = await get_active_skill(db)
    skill_id = await create_skill_version(db, "3.2", content, approved_by="Admin")
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================
# Simple in-memory cache for the active skill version.
# This avoids repeated database queries during interview sessions.
# Cache is invalidated whenever any skill version is created or activated.

class SkillCache:
    """
    Thread-safe cache for active skill content.

    In a multi-worker environment, each worker maintains its own cache.
    This is acceptable because skill changes are infrequent and cache
    invalidation happens on the same worker that made the change.
    """
    def __init__(self):
        self._skill: Optional[Dict[str, Any]] = None
        self._version: Optional[str] = None

    def get(self) -> Optional[Dict[str, Any]]:
        """Get cached skill or None if not cached."""
        return self._skill

    def set(self, skill: Dict[str, Any]) -> None:
        """Cache the active skill."""
        self._skill = skill
        self._version = skill.get('version')

    def invalidate(self) -> None:
        """Clear the cache. Called after any skill modification."""
        self._skill = None
        self._version = None


# Global cache instance
_cache = SkillCache()


# =============================================================================
# CORE SKILL OPERATIONS
# =============================================================================

async def get_active_skill(db: AsyncSession) -> Optional[Dict[str, Any]]:
    """
    Retrieve the currently active skill version.

    Returns cached version if available, otherwise queries database.

    Args:
        db: Async database session

    Returns:
        Dict with 'id', 'version', 'content' keys, or None if no active skill

    Example:
        skill = await get_active_skill(db)
        if skill:
            print(f"Active skill v{skill['version']}")
    """
    # Check cache first
    cached = _cache.get()
    if cached:
        return cached

    # Query database for active skill
    result = await db.execute(
        text("""
            SELECT id, version, content
            FROM skill_versions
            WHERE is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
    )
    row = result.fetchone()

    if row:
        skill = {
            'id': row[0],
            'version': row[1],
            'content': row[2],
        }
        _cache.set(skill)
        return skill

    return None


async def create_skill_version(
    db: AsyncSession,
    version: str,
    content: str,
    approved_by: Optional[str] = None,
    change_summary: Optional[str] = None,
    parent_version_id: Optional[int] = None,
    activate: bool = False,
) -> int:
    """
    Create a new skill version in the database.

    IMPORTANT: This function handles the `approved_at` timestamp in Python
    rather than SQL to avoid asyncpg parameter type inference issues.

    Args:
        db: Async database session
        version: Semantic version string (e.g., "3.1", "3.2")
        content: Full skill markdown content
        approved_by: Name of the approver (sets approved_at if provided)
        change_summary: Human-readable description of changes
        parent_version_id: ID of the parent version for lineage tracking
        activate: If True, deactivates other versions and activates this one

    Returns:
        ID of the newly created skill version

    Example:
        skill_id = await create_skill_version(
            db,
            version="3.2",
            content=updated_content,
            approved_by="Admin",
            change_summary="Added outdoor shower guidelines",
            parent_version_id=previous_skill_id,
        )
    """
    # If activating, first deactivate all other versions
    if activate:
        await db.execute(
            text("UPDATE skill_versions SET is_active = FALSE WHERE is_active = TRUE")
        )

    # Calculate approved_at in Python to avoid asyncpg parameter issues
    # (Using CASE WHEN with same param twice causes AmbiguousParameterError)
    approved_at = datetime.now() if approved_by else None

    result = await db.execute(
        text("""
            INSERT INTO skill_versions
                (version, content, approved_by, approved_at, is_active,
                 parent_version_id, change_summary)
            VALUES
                (:version, :content, :approved_by, :approved_at, :is_active,
                 :parent_id, :summary)
            RETURNING id
        """),
        {
            'version': version,
            'content': content,
            'approved_by': approved_by,
            'approved_at': approved_at,
            'is_active': activate,
            'parent_id': parent_version_id,
            'summary': change_summary,
        }
    )

    skill_id = result.scalar_one()

    # Invalidate cache since skill data has changed
    _cache.invalidate()

    return skill_id


async def activate_skill_version(db: AsyncSession, version_id: int) -> bool:
    """
    Make a specific skill version the active one.

    Deactivates all other versions and activates the specified one.

    Args:
        db: Async database session
        version_id: ID of the skill version to activate

    Returns:
        True on success
    """
    # Deactivate all versions
    await db.execute(
        text("UPDATE skill_versions SET is_active = FALSE WHERE is_active = TRUE")
    )

    # Activate specified version
    await db.execute(
        text("UPDATE skill_versions SET is_active = TRUE WHERE id = :id"),
        {'id': version_id}
    )

    # Invalidate cache
    _cache.invalidate()

    return True


async def list_skill_versions(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    List all skill versions with metadata (excludes full content for efficiency).

    Returns:
        List of dicts with version metadata, ordered by creation date (newest first)
    """
    result = await db.execute(
        text("""
            SELECT id, version, is_active, created_at, approved_by,
                   approved_at, change_summary, LENGTH(content) as content_length
            FROM skill_versions
            ORDER BY created_at DESC
        """)
    )

    versions = []
    for row in result.fetchall():
        versions.append({
            'id': row[0],
            'version': row[1],
            'is_active': row[2],
            'created_at': row[3].isoformat() if row[3] else None,
            'approved_by': row[4],
            'approved_at': row[5].isoformat() if row[5] else None,
            'change_summary': row[6],
            'content_length': row[7],
        })

    return versions


# =============================================================================
# SKILL CONTENT PARSING
# =============================================================================

async def get_skill_for_prompts(db: AsyncSession) -> Dict[str, str]:
    """
    Get skill content parsed into sections for LLM prompt injection.

    This provides structured access to different parts of the skill
    for use in various interview prompts.

    Returns:
        Dict with parsed sections and full content
    """
    skill = await get_active_skill(db)

    if not skill:
        return {
            'methodology': '',
            'critical_parameters': '',
            'steam_room_rules': '',
            'rest_room_rules': '',
            'external_infrastructure': '',
            'documentation_template': '',
            'what_not_to_do': '',
            'checklists': '',
            'dialogue_examples': '',
            'full_content': '',
            'version': '',
        }

    content = skill['content']
    sections = _parse_skill_sections(content)

    return {
        'methodology': sections.get('methodology', ''),
        'critical_parameters': sections.get('critical_parameters', ''),
        'steam_room_rules': sections.get('steam_room', ''),
        'rest_room_rules': sections.get('rest_room', ''),
        'external_infrastructure': sections.get('external_infrastructure', ''),
        'documentation_template': sections.get('documentation', ''),
        'what_not_to_do': sections.get('what_not_to_do', ''),
        'checklists': sections.get('checklists', ''),
        'dialogue_examples': sections.get('dialogues', ''),
        'full_content': content,
        'version': skill['version'],
    }


def _parse_skill_sections(content: str) -> Dict[str, str]:
    """
    Parse skill markdown content into named sections.

    The skill file uses numbered headers (## 1. SECTION, ## 2. SECTION, etc.)
    This function extracts each section's content for targeted prompt injection.
    """
    sections = {}
    current_section = None
    current_content = []

    # Map Lithuanian section headers to internal keys
    section_mapping = {
        '## 1. SKILL APŽVALGA': 'overview',
        '## 2. INFORMACIJOS SURINKIMO SCHEMA': 'methodology',
        '## 3. GARINĖS PROJEKTAVIMAS': 'steam_room',
        '## 4. POILSIO PATALPOS PROJEKTAVIMAS': 'rest_room',
        '## 5. TERASOS': 'terraces',
        '## 6. IŠORINĖ PIRTIES INFRASTRUKTŪRA': 'external_infrastructure',
        '## 7. DOKUMENTACIJOS STRUKTŪRA': 'documentation',
        '## 8. PROJEKTAVIMO DARBŲ EIGA': 'workflow',
        '## 9. KĄ NEDARYTI': 'what_not_to_do',
        '## 10. PIRTIES SPECIFIKOS ŽINYNAS': 'reference',
        '## 11. KONTROLINIAI SĄRAŠAI': 'checklists',
        '## 12. DIALOGŲ PAVYZDŽIAI': 'dialogues',
    }

    for line in content.split('\n'):
        # Check if this line is a section header
        matched_section = None
        for header, key in section_mapping.items():
            if header in line:
                matched_section = key
                break

        if matched_section:
            # Save previous section before starting new one
            if current_section:
                sections[current_section] = '\n'.join(current_content)
            current_section = matched_section
            current_content = [line]
        elif current_section:
            current_content.append(line)

    # Don't forget the last section
    if current_section:
        sections[current_section] = '\n'.join(current_content)

    # Extract critical parameters table from methodology
    if 'methodology' in sections:
        sections['critical_parameters'] = _extract_critical_parameters(sections['methodology'])

    return sections


def _extract_critical_parameters(methodology_content: str) -> str:
    """Extract the critical parameters table from the methodology section."""
    lines = methodology_content.split('\n')
    in_table = False
    table_lines = []

    for line in lines:
        # Look for table header indicators
        if '| Klausimas' in line or '| Ploto limitas' in line:
            in_table = True
        if in_table:
            table_lines.append(line)
            # End table on empty line after collecting rows
            if line.strip() == '' and len(table_lines) > 3:
                break

    return '\n'.join(table_lines) if table_lines else ''
