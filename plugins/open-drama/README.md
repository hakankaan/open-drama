# Open Drama for Claude Code

Generated from `workspace/assistant/` by `node scripts/build-plugin.mjs`; edit the skills there, not here.

Install from this repository's marketplace, then give the plugin your server address and the assistant token from
Settings › Assistant:

```
/plugin marketplace add <path or git url of this repository>
/plugin install open-drama
```

The skills (`/open-drama:adapt-source`, `/open-drama:create-story`, `/open-drama:review-story`, `/open-drama:set-up`, `/open-drama:write-episodes`) call the server's MCP tools; nothing runs locally.
