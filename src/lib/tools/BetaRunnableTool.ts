import { BetaTool, BetaToolResultContentBlockParam } from '../../resources/beta';

export type Promisable<T> = T | Promise<T>;

// this type is just an extension of BetaTool with a run and parse method
// that will be called by `toolRunner()` helpers
export interface BetaRunnableTool<Input = any> extends BetaTool {
  run: (args: Input) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
  parse: (content: unknown) => Input;
}
