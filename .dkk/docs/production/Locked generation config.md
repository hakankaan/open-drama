# Locked generation config

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Glossary · **Context:** [production](index.md)

## Summary

The image and video model service ids pinned onto an episode so later provider changes do not silently alter an in-progress episode. Each lock is taken at creation when its type has a usable service, else at the first generation of that type (adr-0016), from the highest-priority usable service. Falls back to the active service if the locked one is disabled.

## Meaning

The image and video model service ids pinned onto an episode so later provider changes do not silently alter an in-progress episode. Each lock is taken at creation when its type has a usable service, else at the first generation of that type (adr-0016), from the highest-priority usable service. Falls back to the active service if the locked one is disabled.




## Relationships

_No relationships._

## Linked ADRs

_No linked ADRs._
