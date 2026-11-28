import type {
  CreateSkill,
  Skill,
  SkillImportPreview,
  SkillImportRequest,
  SkillVersion,
  UpdateSkill,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { ConflictError, NotFoundError, PayloadTooLargeError } from '../../platform/errors.js';
import { CREATED_VERSION_NOTE, MAX_UPLOAD_BYTES, UNIQUE_VIOLATION } from './constants.js';
import { bodyChanged, toSkillDto, toSkillVersionDto } from './helpers.js';
import { buildImportPreview } from './import/preview.js';
import { SkillsRepository } from './repository.js';

/**
 * Skills: reusable, text-only review rules that agents link in order. A skill
 * never runs anything; the import reads text out of an upload and saves only
 * what the user confirms through `create`.
 */
export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const [rows, usedBy] = await Promise.all([
      this.repo.list(workspaceId),
      this.repo.usedBy(workspaceId),
    ]);
    return rows.map((r) => toSkillDto(r, usedBy.get(r.id)));
  }

  async get(workspaceId: string, id: string): Promise<Skill> {
    const row = await this.requireSkill(workspaceId, id);
    const usedBy = await this.repo.usedBy(workspaceId);
    return toSkillDto(row, usedBy.get(row.id));
  }

  async create(workspaceId: string, input: CreateSkill): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const row = await this.withNameConflict(input.name, () =>
      this.repo.create(
        workspaceId,
        {
          name: input.name,
          description: input.description,
          type: input.type,
          source: input.source ?? 'manual',
          body: input.body,
          enabled: input.enabled ?? true,
        },
        input.version_note || CREATED_VERSION_NOTE,
      ),
    );
    return toSkillDto(row);
  }

  async update(workspaceId: string, id: string, patch: UpdateSkill): Promise<Skill> {
    const current = await this.requireSkill(workspaceId, id);
    if (patch.name !== undefined && patch.name !== current.name) {
      await this.assertNameFree(workspaceId, patch.name);
    }
    const { version_note: note, ...fields } = patch;
    const row = await this.withNameConflict(patch.name ?? current.name, () =>
      this.repo.update(workspaceId, id, fields, bodyChanged(current, fields), note || null),
    );
    if (!row) throw new NotFoundError('Skill not found');
    const usedBy = await this.repo.usedBy(workspaceId);
    return toSkillDto(row, usedBy.get(row.id));
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const ok = await this.repo.delete(workspaceId, id);
    if (!ok) throw new NotFoundError('Skill not found');
  }

  async versions(workspaceId: string, id: string): Promise<SkillVersion[]> {
    await this.requireSkill(workspaceId, id);
    const rows = await this.repo.versions(id);
    return rows.map(toSkillVersionDto);
  }

  /** Parse an upload into a draft. Writes nothing. */
  previewImport(request: SkillImportRequest): SkillImportPreview {
    const bytes = Buffer.from(request.content_base64, 'base64');
    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeError(`The file is larger than ${MAX_UPLOAD_BYTES} bytes`);
    }
    return buildImportPreview(request.filename, new Uint8Array(bytes));
  }

  private async requireSkill(workspaceId: string, id: string) {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) throw new NotFoundError('Skill not found');
    return row;
  }

  /**
   * A concurrent write can pass `assertNameFree`; the unique index on
   * (workspace_id, name) then rejects it, and that is a 409 too.
   */
  private async withNameConflict<T>(name: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(`A skill named "${name}" already exists`);
      throw err;
    }
  }

  /** Clear 409 before writing; the unique index backs it up under concurrency. */
  private async assertNameFree(workspaceId: string, name: string): Promise<void> {
    const existing = await this.repo.findByName(workspaceId, name);
    if (existing) throw new ConflictError(`A skill named "${name}" already exists`);
  }
}

/** postgres-js puts the SQLSTATE on the error; Drizzle may wrap it in `cause`. */
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return code(err) === UNIQUE_VIOLATION || code((err as { cause?: unknown } | null)?.cause) === UNIQUE_VIOLATION;
}
