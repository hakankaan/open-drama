# Assistant token

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Glossary · **Context:** [configuration](index.md)

## Summary

The bearer token /mcp requires. From OPEN_DRAMA_ASSISTANT_TOKEN (at least 32 characters) when set, else generated at first boot (32 random bytes, base64url) into app_settings and printed once to stdout. Read through GET /settings/assistant, rotated through POST /settings/assistant/rotate, compared in constant time; never logged.

## Meaning

The bearer token /mcp requires. From OPEN_DRAMA_ASSISTANT_TOKEN (at least 32 characters) when set, else generated at first boot (32 random bytes, base64url) into app_settings and printed once to stdout. Read through GET /settings/assistant, rotated through POST /settings/assistant/rotate, compared in constant time; never logged.




## Relationships

_No relationships._

## Linked ADRs

_No linked ADRs._
