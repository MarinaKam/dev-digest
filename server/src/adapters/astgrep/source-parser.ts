import type {
  ParsedImport,
  ParsedInvocationHead,
  ParsedReference,
  ParsedSymbol,
  SourceParser,
} from '../../modules/repo-intel/ports.js';
import { extractCrons, extractEndpoints } from '../codeindex/extract.js';
import {
  langForFile,
  parseImports,
  parseInvocationHeads,
  parseReferences,
  parseSymbols,
} from './index.js';

/**
 * The repo-intel `SourceParser` over ast-grep (symbols, references, imports,
 * invocation heads) and the regex extractor (endpoints, crons).
 */
export class AstGrepSourceParser implements SourceParser {
  supports(file: string): boolean {
    return langForFile(file) !== null;
  }

  parseSymbols(file: string, source: string): ParsedSymbol[] {
    return parseSymbols(file, source);
  }

  parseReferences(file: string, source: string): ParsedReference[] {
    return parseReferences(file, source);
  }

  parseImports(file: string, source: string): ParsedImport[] {
    return parseImports(file, source);
  }

  parseInvocationHeads(file: string, source: string): ParsedInvocationHead[] {
    return parseInvocationHeads(file, source);
  }

  extractEndpoints(source: string): string[] {
    return extractEndpoints(source);
  }

  extractCrons(source: string): string[] {
    return extractCrons(source);
  }
}
