import type { z } from 'zod';
import type { AgentContext } from './context';

export interface ToolSpec<S extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  input: S;
  /** Returns plain JSON. Expected failures are returned as `{ error }` so the model can recover. */
  execute(input: z.output<S>, ctx: AgentContext): unknown;
}

export const defineTool = <S extends z.ZodType>(spec: ToolSpec<S>): ToolSpec => spec as unknown as ToolSpec;
