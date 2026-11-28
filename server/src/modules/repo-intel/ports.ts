/**
 * Ports of the repo-intel module: what the indexer and the facade need from
 * outside. Interfaces and plain types only. The adapters in `src/adapters`
 * import this file and implement these; the module gets the implementations
 * from the container and never imports an adapter.
 */

// ---- source parsing --------------------------------------------------------

export interface ParsedSymbol {
  name: string;
  kind: string;
  /** 1-based line of the declaration. */
  line: number;
  /** True when the declaration is reached through an `export` form. */
  exported: boolean;
  /** Declaration head, trimmed by the parser; null for kinds without one. */
  signature: string | null;
  /** 1-based line of the closing token of the declaration body. */
  endLine: number;
}

export interface ParsedReference {
  toSymbol: string;
  line: number;
  /** Path passed in by the caller — surfaced so consumers can fan-out. */
  refFile: string;
}

export interface ParsedImport {
  name: string;
  source: string;
  isType: boolean;
}

export interface ParsedInvocationHead {
  /** The bare identifier being invoked (callee name, ctor name, or JSX tag). */
  name: string;
  /** 1-based line of the invocation. */
  line: number;
  /** Which AST shape produced this head. */
  kind: 'call' | 'new' | 'jsx';
}

/** Turns one source file into the facts the index stores. Pure: no file access. */
export interface SourceParser {
  /** Whether the parser has a grammar for this file (by extension). */
  supports(file: string): boolean;
  parseSymbols(file: string, source: string): ParsedSymbol[];
  parseReferences(file: string, source: string): ParsedReference[];
  parseImports(file: string, source: string): ParsedImport[];
  /** Bare-identifier invocation heads only (`sym(`, `new Sym(`, `<Sym>`). */
  parseInvocationHeads(file: string, source: string): ParsedInvocationHead[];
  /** HTTP endpoints declared in the source, as "METHOD /path". */
  extractEndpoints(source: string): string[];
  /** Cron expressions declared in the source. */
  extractCrons(source: string): string[];
}

// ---- token counting --------------------------------------------------------

/** Counts tokens for the repo-map budget search. Must never throw. */
export interface Tokenizer {
  count(text: string): number;
}

// ---- import graph ----------------------------------------------------------

/** `from` imports `to`; both repo-relative. */
export interface FileEdge {
  from: string;
  to: string;
}

export interface DepGraph {
  /**
   * Resolve the local import edges among `files` (repo-relative) under `root`.
   * Never throws — returns `[]` on any failure.
   */
  buildEdges(root: string, files: string[]): Promise<FileEdge[]>;
}
