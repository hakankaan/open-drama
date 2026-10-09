# StoreRemoteFile

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Download a provider result URL into the images or videos directory and return the relative path. The URL comes from the provider's response, so the download goes through the same guarded fetch as remote reference images: loopback, link-local and cloud-metadata addresses are refused on every hop, except the service's own configured host (a local relay), and the file is capped at 200 MB. The body is streamed to a temporary file; a timeout, a dropped connection or an HTTP 5xx, 429 or 408 is retried after 5 and 20 seconds. An image's format is read from its bytes and names its extension; SVG and unknown formats are refused, so nothing served from /static can run script.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `url` | `string` | — |
| `kind` | `string` | image | video |
| `serviceBaseUrl` | `string` | The base URL of the service that produced the result; its host is reached without the address check. |

## Rules & Invariants

- Download failed (HTTP error or timeout)
- The URL, or a redirect, points at a loopback, link-local or cloud-metadata address
- The result is larger than 200 MB
- An image result is not PNG, JPEG, WebP, GIF or AVIF


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `MediaFile` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
