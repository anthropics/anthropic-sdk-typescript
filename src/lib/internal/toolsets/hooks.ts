/**
 * The types of the toolset constructor hooks. `BetaToolsetCallContext`, `MemberConfirmContext` and `BetaToolConfigs` serve
 * every family, `BetaComputerConfirmContext` and `BetaComputerConfirmCallable` serve the computer toolset, and the rest
 * serve the browser toolset.
 *
 * @internal
 */
import type { BetaToolUse, Promisable } from '../../tools/BetaRunnableTool';
import type { BetaComputerMemberInput, BetaComputerMemberName } from './computer-members';
import type { BetaBrowserMemberName } from './inputs';
import type { BetaBrowserState } from './results';
import type { BetaBrowserMemberInput, BetaCacheControlEphemeral } from '../../../resources/beta';

/**
 * What a member receives alongside its input, and what `confirm` (and the browser toolset's `browserState`) receive
 * about the call: the model call being served (`toolUse`, absent only when your own code calls `run()` without one)
 * and the run's abort signal. The tool runner's `BetaToolRunContext` is one.
 */
export interface BetaToolsetCallContext {
  toolUse?: BetaToolUse | undefined;
  /** Aborted when the run is. The runner still waits for the member to return, so check it in long-running work. */
  signal?: AbortSignal | null | undefined;
}

/**
 * What a hook receives about the call it serves: the first argument of `urlPolicy(context, url)` and of the file
 * policy's `resolveUploadPaths(context, paths)` / `resolveUploadDocuments(context, documentIds)`.
 */
export interface BetaURLContext {
  /** The member being called: `navigate` for the URL policy, `file_upload` for the file policy. */
  member?: BetaBrowserMemberName | undefined;
  /** The tab the call named, if any, as the model sent it and not checked. */
  tabId?: string | undefined;
  /** The model call being served. Absent when a hook is invoked outside one. */
  toolUseId?: string | undefined;
}

/**
 * `(context, url)`, called once for each `navigate` with `url` exactly as the model wrote it, before the driver
 * receives it. Return (or resolve) nothing to allow, throw `ToolError` to refuse. May be async.
 */
export type BetaURLPolicy = (context: BetaURLContext, url: string) => void | Promise<void>;

/**
 * Decides which upload paths and document ids a `file_upload` may use and which download paths the model may see.
 * With no file policy configured, an upload input that contains a path or a document id is refused and download
 * paths are never shown to the model.
 */
export interface BetaFilePolicy {
  /**
   * Resolve each path the model asked to upload, or throw `ToolError` to refuse. The driver receives the returned paths
   * in `input.paths`.
   */
  resolveUploadPaths(ctx: BetaURLContext, paths: string[]): Promisable<string[]>;
  /**
   * Vet each document id (a file staged with the Files API) the model asked to upload, or throw `ToolError` to refuse.
   * The driver receives the returned ids in `input.document_ids`.
   */
  resolveUploadDocuments(ctx: BetaURLContext, documentIds: string[]): Promisable<string[]>;
  /** Whether a `download_completed` path may reach the model. `false` forwards the event without it. May be async. */
  isPathVisible(path: string): Promisable<boolean>;
}

/** What every family's `confirm` callable receives about the call awaiting approval: the member and its input. */
export interface MemberConfirmContext<Name extends string, Input> extends BetaToolsetCallContext {
  readonly member: Name;
  readonly input: Input;
}

/**
 * Passed to the browser toolset's `confirm` for each call awaiting approval. `tabId` and `tabURL` describe the tab
 * the call targets (else the active tab) in the last report the SDK collected, which the model saw unless that call
 * failed or was refused; the page may have changed since. When that report has no such tab (anything before the
 * first), `tabURL` is undefined and `tabId` is the model's `tab_id` as sent, not checked.
 */
export interface BetaConfirmContext
  extends MemberConfirmContext<BetaBrowserMemberName, BetaBrowserMemberInput> {
  /** The driver's URL string, folded to one line. One longer than 4,096 characters is cut and begins with `…`. */
  readonly tabURL?: string | undefined;
  readonly tabId?: string | undefined;
}

/** Fields set on the toolset's `tools[]` entry itself rather than on a member. `toJSON()` copies them onto it. */
export interface BetaToolConfigs {
  cache_control?: BetaCacheControlEphemeral | null;
}

/** true runs the call, false declines it. The context contains the member and its input. */
export type BetaConfirmCallable = (ctx: BetaConfirmContext) => Promisable<boolean>;

/** What the computer toolset's `confirm` callable is told about the call awaiting approval: the member and its input. */
export type BetaComputerConfirmContext = MemberConfirmContext<
  BetaComputerMemberName,
  BetaComputerMemberInput
>;

/** true runs the call, false declines it; the context carries the member and its input. */
export type BetaComputerConfirmCallable = (ctx: BetaComputerConfirmContext) => Promisable<boolean>;

export type BetaBrowserStateCallable = (ctx: BetaToolsetCallContext) => Promisable<BetaBrowserState>;
