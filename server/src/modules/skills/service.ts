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
import { CREATED_VERSION_NOTE, MAX_UPLOAD_BYTES } from './constants.js';
import { bodyChanged, toSkillDto, toSkillVersionDto } from './helpers.js';
import { buildImportPreview } from './import/preview.js';
import { type NameTaken, SkillsRepository } from './repository.js';
import type { SkillRecord } from './types.js';

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
    const usedBy = await this.repo.usedBy(workspaceId, row.id);
    return toSkillDto(row, usedBy.get(row.id));
  }

  async create(workspaceId: string, input: CreateSkill): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const row = this.orConflict(
      input.name,
      await this.repo.create(
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
    const updated = await this.repo.update(workspaceId, id, fields, bodyChanged(current, fields), note || null);
    if (!updated) throw new NotFoundError('Skill not found');
    const row = this.orConflict(patch.name ?? current.name, updated);
    const usedBy = await this.repo.usedBy(workspaceId, row.id);
    return toSkillDto(row, usedBy.get(row.id));
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const ok = await this.repo.delete(workspaceId, id);
    if (!ok) throw new NotFoundError('Skill not found');
  }

  async versions(workspaceId: string, id: string): Promise<SkillVersion[]> {
    await this.requireSkill(workspaceId, id);
    const rows = await this.repo.versions(workspaceId, id);
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

  /** A write the unique index refused (a concurrent create or rename) is a 409. */
  private orConflict(name: string, result: SkillRecord | NameTaken): SkillRecord {
    if (result === 'name_taken') throw new ConflictError(`A skill named "${name}" already exists`);
    return result;
  }

  /** Clear 409 before writing; the unique index backs it up under concurrency. */
  private async assertNameFree(workspaceId: string, name: string): Promise<void> {
    const existing = await this.repo.findByName(workspaceId, name);
    if (existing) throw new ConflictError(`A skill named "${name}" already exists`);
  }
}

