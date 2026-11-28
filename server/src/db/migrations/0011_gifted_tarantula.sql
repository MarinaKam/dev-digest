ALTER TABLE "skill_versions" ADD COLUMN "note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_workspace_id_name_idx" ON "skills" USING btree ("workspace_id","name");