/** Turns an uploaded `.md` or `.zip` into a skill draft. Writes nothing. */
import { strFromU8 } from 'fflate';
import { SKILL_BODY_MAX, type SkillImportPreview } from '@devdigest/shared';
import { ValidationError } from '../../../platform/errors.js';
import { IMPORTED_SKILL_TYPE } from '../constants.js';
import { readSkillArchive, type SkippedFile } from './archive.js';
import { parseFrontMatter } from './front-matter.js';

export function buildImportPreview(filename: string, bytes: Uint8Array): SkillImportPreview {
  const lower = filename.toLowerCase();
  let corePath = filename;
  let text: string;
  let skipped: SkippedFile[] = [];
  if (lower.endsWith('.md')) {
    text = strFromU8(bytes);
  } else if (lower.endsWith('.zip')) {
    const archive = readSkillArchive(bytes);
    corePath = archive.corePath;
    text = archive.core;
    skipped = archive.skipped;
  } else {
    throw new ValidationError('Import a .md file or a .zip archive');
  }

  const fm = parseFrontMatter(text);
  const body = fm.body.trim();
  const warnings =
    body.length > SKILL_BODY_MAX
      ? [
          `The body is ${body.length.toLocaleString('en-US')} characters; a skill holds at most ${SKILL_BODY_MAX.toLocaleString('en-US')}. Shorten it before saving.`,
        ]
      : [];
  return {
    draft: {
      name: fm.fields.name?.trim() || slugify(baseName(corePath, filename)),
      description: fm.fields.description?.trim() ?? '',
      type: IMPORTED_SKILL_TYPE,
      body,
      source: 'imported_file',
    },
    core_path: corePath,
    skipped_files: skipped,
    ignored_keys: fm.ignoredKeys,
    unreadable_keys: fm.unreadable,
    warnings,
  };
}

/** The name to fall back on: the archive's folder or file name, not "SKILL". */
function baseName(corePath: string, filename: string): string {
  const parts = corePath.split('/');
  const file = parts[parts.length - 1] ?? corePath;
  if (file.toUpperCase() === 'SKILL.MD') return parts.length > 1 ? (parts[parts.length - 2] ?? '') : stripExt(filename);
  return stripExt(file);
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** Lowercase slug, at most 64 characters (rule 1 of the spec). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
