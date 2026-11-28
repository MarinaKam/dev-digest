import { describe, it, expect } from 'vitest';
import {
  Review,
  Finding,
  Intent,
  BlastRadius,
  Risks,
  PrHistory,
  SmartDiff,
  Conformance,
  Onboarding,
  EvalRun,
  MemoryItem,
  RunTrace,
  RunStats,
  RunSummary,
  PrMeta,
  Settings,
  Repo,
  PrDetail,
  SkillName,
  SkillSource,
  CreateSkill,
  UpdateSkill,
} from '@devdigest/shared';

/**
 * Contract tests — parse/round-trip the fixtures from data.jsx/data2.jsx
 * so feature agents can rely on the schemas matching the prototype data.
 */
describe('AI contracts parse fixtures', () => {
  it('Review + Finding (data.jsx VERDICT/FINDINGS)', () => {
    const review = Review.parse({
      verdict: 'request_changes',
      summary: 'Two blockers before merge.',
      score: 61,
      findings: [
        {
          id: 'f1',
          severity: 'CRITICAL',
          category: 'security',
          title: 'Hardcoded Stripe secret key in commit',
          file: 'src/config.ts',
          start_line: 12,
          end_line: 12,
          rationale: 'Line 12 contains a literal `sk_live_` Stripe key.',
          suggestion: 'Move to env and rotate.',
          confidence: 0.98,
          kind: 'secret_leak',
        },
      ],
    });
    expect(review.findings).toHaveLength(1);
    expect(review.score).toBe(61);
  });

  it('lethal-trifecta Finding variant', () => {
    const f = Finding.parse({
      id: 'f2',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Lethal trifecta',
      file: 'src/api/public/webhooks.ts',
      start_line: 61,
      end_line: 74,
      rationale: 'all three legs present',
      confidence: 0.79,
      kind: 'lethal_trifecta',
      trifecta_components: ['private_data_access', 'untrusted_input', 'exfil_path'],
      evidence: [{ component: 'untrusted_input', file: 'src/api/public/webhooks.ts', line: 61 }],
    });
    expect(f.trifecta_components).toContain('exfil_path');
  });

  it('Intent / BlastRadius / Risks / PrHistory', () => {
    expect(() =>
      Intent.parse({ intent: 'x', in_scope: ['a'], out_of_scope: ['b'] }),
    ).not.toThrow();
    expect(() =>
      BlastRadius.parse({
        changed_symbols: [{ name: 'rateLimit', file: 'a.ts', kind: 'function' }],
        downstream: [
          {
            symbol: 'rateLimit',
            callers: [{ name: 'publicRouter', file: 'b.ts', line: 23 }],
            endpoints_affected: ['GET /x'],
            crons_affected: ['c'],
          },
        ],
        summary: 's',
      }),
    ).not.toThrow();
    expect(() =>
      Risks.parse({
        risks: [{ kind: 'security', title: 't', explanation: 'e', severity: 'high', file_refs: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      PrHistory.parse({
        history: [
          {
            pr_number: 401,
            title: 't',
            merged_at: '2026-03-18',
            author: 'a',
            files_overlap: [],
            notes: 'n',
          },
        ],
      }),
    ).not.toThrow();
  });

  it('SmartDiff (data.jsx DIFF)', () => {
    const d = SmartDiff.parse({
      groups: [
        {
          role: 'core',
          files: [{ path: 'a.ts', additions: 84, deletions: 0, finding_lines: [28, 52] }],
        },
      ],
      split_suggestion: { too_big: false, total_lines: 285, proposed_splits: [] },
    });
    expect(d.groups[0]!.role).toBe('core');
  });

  it('Conformance / Onboarding / EvalRun / MemoryItem', () => {
    expect(() =>
      Conformance.parse({
        spec_id: 's1',
        spec_title: 'Spec',
        items: [{ requirement: 'r', status: 'implemented' }],
        completeness_pct: 80,
      }),
    ).not.toThrow();
    expect(() =>
      Onboarding.parse({
        sections: [{ kind: 'architecture', title: 'T', body: 'b', links: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      EvalRun.parse({
        recall: 0.82,
        precision: 0.91,
        citation_accuracy: 0.95,
        traces_passed: 17,
        traces_total: 20,
        duration_ms: 12000,
        cost_usd: 0.23,
        per_trace: [{ name: 't01', pass: true, expected: 'x', actual: 'x' }],
      }),
    ).not.toThrow();
    expect(() =>
      MemoryItem.parse({
        content: 'c',
        scope: 'team',
        kind: 'decision',
        confidence: 0.92,
        sources: [{ pr: 401, context: 'ctx' }],
      }),
    ).not.toThrow();
  });

  it('RunTrace (data2.jsx TRACE single-document)', () => {
    const trace = RunTrace.parse({
      config: { agent: 'Security Reviewer', version: 'v7', model: 'gpt-4.1', pr: 482, source: 'local' },
      stats: { duration_ms: 8200, tokens_in: 14820, tokens_out: 1240, findings: 3, grounding: '3/3 passed' },
      prompt_assembly: { system: 's', user: 'u' },
      tool_calls: [{ tool: 'read_file', args: "'src/config.ts'", meta: '1,240 bytes', ms: 120 }],
      raw_output: '{}',
      memory_pulled: [{ pr: 288, text: 'verified via stripe-signature' }],
      specs_read: ['specs/security-baseline.md'],
      log: [{ t: '00.00', kind: 'info', msg: 'started' }],
    });
    expect(trace.tool_calls).toHaveLength(1);
  });
});

describe('platform DTOs', () => {
  it('Settings defaults + passthrough', () => {
    const s = Settings.parse({ extra_key: 'x' });
    expect(s.theme).toBe('dark');
    expect((s as Record<string, unknown>).extra_key).toBe('x');
  });

  it('Repo + PrDetail', () => {
    expect(() =>
      Repo.parse({
        id: 'r1',
        workspace_id: 'w1',
        owner: 'acme',
        name: 'payments-api',
        full_name: 'acme/payments-api',
        default_branch: 'main',
        clone_path: null,
        last_polled_at: null,
        created_by: null,
      }),
    ).not.toThrow();
    expect(() =>
      PrDetail.parse({
        number: 482,
        title: 't',
        author: 'a',
        branch: 'b',
        base: 'main',
        head_sha: 'sha',
        additions: 1,
        deletions: 0,
        files_count: 1,
        status: 'open',
        files: [],
        commits: [],
      }),
    ).not.toThrow();
  });
});

describe('run cost contracts', () => {
  const stats = { duration_ms: 8200, tokens_in: 8200, tokens_out: 1300, findings: 2, grounding: '2/2 passed' };
  const summary = {
    run_id: 'r1',
    agent_id: 'a1',
    agent_name: 'Security Reviewer',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4-flash',
    status: 'done',
    error: null,
    duration_ms: 8200,
    tokens_in: 8200,
    tokens_out: 1300,
    findings_count: 2,
    grounding: '2/2 passed',
    ran_at: '2026-06-11T18:44:34.000Z',
    score: 61,
    blockers: 0,
  };
  const pr = {
    number: 482,
    title: 't',
    author: 'a',
    branch: 'b',
    base: 'main',
    head_sha: 'sha',
    additions: 1,
    deletions: 0,
    files_count: 1,
    status: 'needs_review',
  };

  it('RunStats keeps a cost, keeps a real zero, and keeps null apart from zero', () => {
    expect(RunStats.parse({ ...stats, cost_usd: 0.014 }).cost_usd).toBe(0.014);
    expect(RunStats.parse({ ...stats, cost_usd: 0 }).cost_usd).toBe(0);
    expect(RunStats.parse({ ...stats, cost_usd: null }).cost_usd).toBeNull();
  });

  it('RunStats still parses a trace stored before the cost field existed', () => {
    expect(RunStats.parse(stats).cost_usd ?? null).toBeNull();
  });

  it('RunSummary requires cost_usd and distinguishes null from zero', () => {
    expect(RunSummary.parse({ ...summary, cost_usd: 0.014 }).cost_usd).toBe(0.014);
    expect(RunSummary.parse({ ...summary, cost_usd: 0 }).cost_usd).toBe(0);
    expect(RunSummary.parse({ ...summary, cost_usd: null }).cost_usd).toBeNull();
    expect(() => RunSummary.parse(summary)).toThrow();
  });

  it('PrMeta carries in-flight runs and per-severity findings on the list endpoint', () => {
    const counts = { CRITICAL: 1, WARNING: 2, SUGGESTION: 0 };
    const parsed = PrMeta.parse({ ...pr, active_runs: 2, findings_by_severity: counts });
    expect(parsed.active_runs).toBe(2);
    expect(parsed.findings_by_severity).toEqual(counts);
    expect(PrMeta.parse({ ...pr, findings_by_severity: null }).findings_by_severity).toBeNull();
    // Both are optional: a PR from the detail endpoint has neither.
    expect(PrMeta.parse(pr).active_runs ?? 0).toBe(0);
    expect(() => PrMeta.parse({ ...pr, findings_by_severity: { CRITICAL: 1 } })).toThrow();
  });

  it('PrMeta carries the PR cost on the list endpoint', () => {
    expect(PrMeta.parse({ ...pr, cost_usd: 0.022 }).cost_usd).toBe(0.022);
    expect(PrMeta.parse({ ...pr, cost_usd: 0 }).cost_usd).toBe(0);
    expect(PrMeta.parse({ ...pr, cost_usd: null }).cost_usd).toBeNull();
    expect(PrMeta.parse(pr).cost_usd ?? null).toBeNull();
  });

  it('a cost must be a number', () => {
    expect(() => RunSummary.parse({ ...summary, cost_usd: '0.014' })).toThrow();
    expect(() => RunStats.parse({ ...stats, cost_usd: '0.014' })).toThrow();
    expect(() => PrMeta.parse({ ...pr, cost_usd: '0.014' })).toThrow();
  });
});

describe('skill contracts', () => {
  const valid = { name: 'edge-case-coverage', description: 'Flag it.', type: 'rubric', body: 'B' };

  it('SkillName accepts a slug and rejects anything else', () => {
    expect(SkillName.safeParse('edge-case-coverage').success).toBe(true);
    for (const bad of ['Edge', 'a--b', '-a', 'a-', 'a'.repeat(65), '']) {
      expect(SkillName.safeParse(bad).success).toBe(false);
    }
    expect(SkillName.safeParse('a'.repeat(64)).success).toBe(true);
  });

  it('CreateSkill caps description at 1024 and body at 20,000 characters', () => {
    expect(CreateSkill.safeParse({ ...valid, description: 'd'.repeat(1024) }).success).toBe(true);
    expect(CreateSkill.safeParse({ ...valid, description: 'd'.repeat(1025) }).success).toBe(false);
    expect(CreateSkill.safeParse({ ...valid, body: 'b'.repeat(20_000) }).success).toBe(true);
    expect(CreateSkill.safeParse({ ...valid, body: 'b'.repeat(20_001) }).success).toBe(false);
    expect(CreateSkill.safeParse({ ...valid, description: '' }).success).toBe(false);
  });

  it('SkillSource has imported_file and keeps extracted', () => {
    expect(SkillSource.parse('imported_file')).toBe('imported_file');
    expect(SkillSource.parse('extracted')).toBe('extracted');
  });

  it('a save may carry a version note of up to 200 characters', () => {
    expect(UpdateSkill.parse({ body: 'b', version_note: 'Tightened' })).toEqual({ body: 'b', version_note: 'Tightened' });
    expect(UpdateSkill.safeParse({ version_note: 'n'.repeat(201) }).success).toBe(false);
    expect(CreateSkill.safeParse({ ...valid, version_note: 'Imported from x.zip' }).success).toBe(true);
  });

  it('UpdateSkill takes any subset and never a source', () => {
    expect(UpdateSkill.parse({ enabled: false })).toEqual({ enabled: false });
    expect(UpdateSkill.safeParse({ source: 'manual' }).success).toBe(false);
  });
});
