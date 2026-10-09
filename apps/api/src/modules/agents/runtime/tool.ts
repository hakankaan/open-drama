import type { z } from 'zod';
import type { AgentContext, AgentScope, DramaAgentContext } from './context';

export interface ToolSpec<S extends z.ZodType = z.ZodType, C extends DramaAgentContext = DramaAgentContext> {
  id: string;
  description: string;
  input: S;
  /** An episode tool needs the episode context; a drama-scoped agent may only carry drama tools (checked at boot). */
  scope: AgentScope;
  /** Returns plain JSON. Expected failures are returned as `{ error }` so the model can recover. */
  execute(input: z.output<S>, ctx: C): unknown;
}

type Spec<S extends z.ZodType, C extends DramaAgentContext> = Omit<ToolSpec<S, C>, 'scope'>;

/** An episode-scoped tool: its context carries the episode. */
export const defineTool = <S extends z.ZodType>(spec: Spec<S, AgentContext>): ToolSpec =>
  ({ ...spec, scope: 'episode' }) as unknown as ToolSpec;

/** A drama-scoped tool: no episode in its context, so a drama-scoped agent may carry it. */
export const defineDramaTool = <S extends z.ZodType>(spec: Spec<S, DramaAgentContext>): ToolSpec =>
  ({ ...spec, scope: 'drama' }) as unknown as ToolSpec;
