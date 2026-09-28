# media

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Local media storage under the data directory. Uploads and persisted generation results are stored as immutable uuid-named files, served statically with long cache lifetimes, with derived thumbnails for images and poster frames for videos.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Media file** | A file under the static storage root, addressed by a relative path such as static/images/<uuid>.png. Immutable once written. | — |
| **Rendition** | A derived file next to the original — a 400px WebP thumbnail for images, a 640px JPEG poster frame for videos — addressed by naming convention. | — |
| **Public base URL** | The externally reachable origin of the API, needed when a provider must fetch a local reference video or audio file. | — |
| **Data directory** | The root holding the database, static media and the writable agent workspace; overridable by environment. | — |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [MediaStored](MediaStored.md) | A generation result (downloaded or decoded) or a rendered film was written to local storage. | `MediaFile` | path (string), kind (string) |
| [MediaUploaded](MediaUploaded.md) | A creator upload was stored and is addressable by path. | `MediaFile` | path (string), kind (string), mimeType (string), sizeBytes (number) |
| [RenditionsDerived](RenditionsDerived.md) | A thumbnail or poster frame now exists next to the stored file. | `MediaFile` | path (string), renditionPath (string) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [DeriveRenditions](DeriveRenditions.md) | Produce the thumbnail (images) or poster frame (videos, films) for a stored file next to it. Skipped silently when FFmpeg is unavailable for videos. | `GenerationWorker` | `MediaFile` | path (string), kind (string) |
| [StoreInlineImage](StoreInlineImage.md) | Decode a base64 image returned inline by a provider (for example Gemini) and store it with the extension matching its MIME type. | `GenerationWorker` | `MediaFile` | base64Data (string), mimeType (string) |
| [StoreRemoteFile](StoreRemoteFile.md) | Download a provider result URL into the images or videos directory and return the relative path. | `GenerationWorker` | `MediaFile` | url (string), kind (string) |
| [UploadMedia](UploadMedia.md) | Accept a creator upload (image, video or audio) into the uploads directory after validating type and size, and return its path. | `Creator` | `MediaFile` | kind (string), file (File) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [DeriveRenditionsOnStore](DeriveRenditionsOnStore.md) | Whenever an image or video is stored or uploaded, derive its thumbnail or poster frame so list views never load originals. | MediaStored, MediaUploaded | DeriveRenditions |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [MediaFile](MediaFile.md) | A stored file with its relative path, kind (image, video, audio, film), MIME type, size and derived renditions. | UploadMedia, StoreRemoteFile, StoreInlineImage, DeriveRenditions | MediaUploaded, MediaStored, RenditionsDerived |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [StorageUsage](StorageUsage.md) | The storage card in settings — data directory paths, deployment mode, disk usage broken down by bucket (database, images, videos, merged, uploads, temp, other), free space and when it was computed (cached with stale-while-revalidate). | MediaUploaded, MediaStored | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | accepted |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | accepted |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
| [adr-0010](../../adr/adr-0010.md) | Next.js serves the UI as its own process and proxies the API | accepted |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
