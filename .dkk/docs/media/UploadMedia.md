# UploadMedia

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Accept a creator upload (image, video or audio) into the uploads directory after validating type and size, and return its path.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `kind` | `string` | image | video | audio |
| `file` | `File` | — |

## Rules & Invariants

- Unsupported file type
- File exceeds the size limit for its kind


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `MediaFile` |

## Linked ADRs

_No linked ADRs._
