import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import type { ContentLanguage } from '@open-drama/contracts';
import { z } from 'zod';
import { listAssistantSkills, renderSkill } from '../modules/agents/workspace/assistant';

/**
 * The assistant skills as MCP prompts (adr-0016): one per directory under workspace/assistant/, its arguments from the
 * frontmatter, its body with `{{argument}}` filled in as the prompt's message. The directory is scanned on every
 * server instance (one per request), so an edited or added skill needs no restart.
 */
export function registerPrompts(server: McpServer, lang: ContentLanguage) {
  for (const skill of listAssistantSkills(lang).skills) {
    const argsSchema: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {};
    for (const arg of skill.arguments) {
      const s = z.string().describe(arg.description);
      argsSchema[arg.name] = arg.required ? s : s.optional();
    }
    server.registerPrompt(skill.name, { title: skill.title, description: skill.description, argsSchema }, (args): GetPromptResult => ({
      description: skill.description,
      messages: [{ role: 'user', content: { type: 'text', text: renderSkill(skill, args as Record<string, string | undefined>) } }],
    }));
  }
}
