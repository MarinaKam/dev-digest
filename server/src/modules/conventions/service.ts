import {
  ConventionExtraction,
  type ConventionCandidate,
  type ConventionList,
  type ConventionRun,
  type ConventionSampling,
  type CreateSkillFromConventions,
  type FeatureModelChoice,
  type Provider,
  type Skill,
  type UpdateConvention,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import {
  AppError,
  ConfigError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from '../../platform/errors.js';
import {
  CONFIG_FILES,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_TIMEOUT_MS,
  PROVIDER_KEY,
  SAMPLE_FILE_COUNT,
} from './constants.js';
import {
  conventionsRegistryDefault,
  groundConventions,
  isSafeRelativePath,
  pickExtractionModel,
  toConventionDto,
  toScanDto,
  truncateForPrompt,
} from './helpers.js';
import { buildExtractionMessages } from './prompt.js';
import { ConventionsRepository } from './repository.js';
import type { SampleSet } from './types.js';

/** A repo as this module needs it. */
interface RepoRef {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  clonePath: string | null;
}

/**
 * Conventions Extractor (spec 004). Code picks the files and checks every
 * answer against them; the model is called once per run and only proposes.
 */
export class ConventionsService {
  private repo: ConventionsRepository;
  /** Runs in flight by repo id (single API instance, as the run bus assumes). */
  private static running = new Map<string, ConventionRun>();

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionList> {
    await this.requireRepo(workspaceId, repoId);
    return this.snapshot(workspaceId, repoId);
  }

  async extract(
    workspaceId: string,
    repoId: string,
    sampling: ConventionSampling = 'spread',
  ): Promise<ConventionList> {
    const repo = await this.requireRepo(workspaceId, repoId);
    if (!repo.clonePath) {
      throw new ConflictError('The repository is still being cloned. Try again in a minute.');
    }
    if (ConventionsService.running.has(repoId)) {
      // Own code: the page shows the run in flight instead of a failure.
      throw new AppError('extraction_running', 'An extraction is already running for this repository.', 409);
    }
    ConventionsService.running.set(repoId, {
      started_at: new Date().toISOString(),
      sampling,
      files_sampled: null,
      model: null,
    });
    try {
      await this.runExtraction(workspaceId, repo, sampling);
    } finally {
      ConventionsService.running.delete(repoId);
    }
    return this.snapshot(workspaceId, repoId);
  }

  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionCandidate> {
    await this.requireRepo(workspaceId, repoId);
    const row = await this.repo.update(workspaceId, repoId, id, patch);
    if (!row) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  /** Save accepted conventions as one skill; a pending or rejected id is refused. */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateSkillFromConventions,
  ): Promise<Skill> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const ids = [...new Set(input.convention_ids)];
    const rows = await this.repo.getMany(workspaceId, repoId, ids);
    const accepted = new Set(rows.filter((r) => r.status === 'accepted').map((r) => r.id));
    const refused = ids.filter((id) => !accepted.has(id));
    if (refused.length > 0) {
      throw new ValidationError('Only accepted conventions of this repository can go into a skill', {
        convention_ids: refused,
      });
    }
    const evidenceFiles = [...new Set(rows.map((r) => r.evidencePath))].sort();
    return this.container.skills.createExtracted(workspaceId, {
      name: input.name,
      description: input.description,
      body: input.body,
      enabled: input.enabled ?? true,
      evidenceFiles,
      note: `Extracted from ${repo.fullName}`,
    });
  }

  private async runExtraction(
    workspaceId: string,
    repo: RepoRef,
    sampling: ConventionSampling,
  ): Promise<void> {
    const { files, sha } = await this.sampleFiles(repo, sampling);
    if (files.length === 0) {
      throw new ConflictError('No source files were found in the repository clone.');
    }
    const choice = await this.resolveModel(workspaceId);
    this.markRunning(repo.id, { files_sampled: files.length, model: `${choice.provider}/${choice.model}` });
    const llm = await this.container.llm(choice.provider);
    let answer: Awaited<ReturnType<typeof llm.completeStructured<ConventionExtraction>>>;
    try {
      answer = await llm.completeStructured({
        model: choice.model,
        schema: ConventionExtraction,
        schemaName: 'ConventionExtraction',
        messages: buildExtractionMessages(repo.fullName, files),
        temperature: EXTRACTION_TEMPERATURE,
        maxTokens: EXTRACTION_MAX_TOKENS,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError(`The model call failed (${choice.provider}/${choice.model}): ${reason}`);
    }
    const proposed = answer.data.conventions;
    const { kept } = groundConventions(proposed, files);
    await this.repo.saveRun(workspaceId, repo.id, kept, {
      sampling,
      filesSampled: files.length,
      proposed: proposed.length,
      kept: kept.length,
      model: `${choice.provider}/${answer.model || choice.model}`,
      costUsd: answer.costUsd ?? null,
    }, sha);
  }

  /** Config files at the clone root, then source files chosen by repo-intel, and the clone's commit. */
  private async sampleFiles(repo: RepoRef, sampling: ConventionSampling): Promise<SampleSet> {
    const sources = await this.container.repoIntel.getConventionSamples(
      repo.id,
      SAMPLE_FILE_COUNT[sampling],
      { spread: sampling === 'spread' },
    );
    const paths = [...new Set([...CONFIG_FILES, ...sources])].filter(isSafeRelativePath);
    const ref = { owner: repo.owner, name: repo.name };
    const sha = await this.container.git.currentHead(ref).catch(() => null);
    const read = await Promise.all(
      paths.map(async (path) => {
        const text = await this.container.git.readFile(ref, path).catch(() => '');
        return { path, text: truncateForPrompt(text) };
      }),
    );
    return { files: read.filter((f) => f.text.trim().length > 0), sha: sha || null };
  }

  private async resolveModel(workspaceId: string): Promise<FeatureModelChoice> {
    const override = await this.container.featureModelOverride(workspaceId, 'conventions');
    const providers = Object.keys(PROVIDER_KEY) as Provider[];
    const withKey = await Promise.all(
      providers.map(async (p) => ((await this.container.secrets.get(PROVIDER_KEY[p])) ? p : null)),
    );
    const hasKey = new Set(withKey.filter((p): p is Provider => p !== null));
    const choice = pickExtractionModel(override, conventionsRegistryDefault(), hasKey);
    if (!choice) {
      throw new ConfigError(
        `No model provider is configured. Set one of ${Object.values(PROVIDER_KEY).join(', ')}.`,
      );
    }
    return choice;
  }

  /** Fill in what a run in flight reads, once it is known (a new object, not a mutation). */
  private markRunning(repoId: string, known: Pick<ConventionRun, 'files_sampled' | 'model'>): void {
    const current = ConventionsService.running.get(repoId);
    if (current) ConventionsService.running.set(repoId, { ...current, ...known });
  }

  private async snapshot(workspaceId: string, repoId: string): Promise<ConventionList> {
    const [rows, lastScan] = await Promise.all([
      this.repo.listAll(workspaceId, repoId),
      this.repo.lastScan(workspaceId, repoId),
    ]);
    return {
      candidates: rows.map(toConventionDto),
      last_scan: lastScan ? toScanDto(lastScan) : null,
      running: ConventionsService.running.get(repoId) ?? null,
    };
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<RepoRef> {
    const repo = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    return repo;
  }
}
