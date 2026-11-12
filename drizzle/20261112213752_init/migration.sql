CREATE TYPE "project_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "assets" (
	"sha256" text PRIMARY KEY,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followers" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"actor_uri" text NOT NULL,
	"inbox_uri" text NOT NULL,
	"shared_inbox_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" "project_visibility" DEFAULT 'private'::"project_visibility" NOT NULL,
	"remix_of_id" bigint,
	"scratch_project_id" bigint,
	"project_json" bytea NOT NULL,
	"project_json_sha256" text NOT NULL,
	"project_json_size" integer NOT NULL,
	"asset_manifest" jsonb DEFAULT '{}' NOT NULL,
	"head_commit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"bio" text DEFAULT '' NOT NULL,
	"scratch_username" text,
	"scratch_linked_at" timestamp with time zone,
	"key_pairs" jsonb DEFAULT '[]' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "followers_user_actor_idx" ON "followers" ("user_id","actor_uri");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "projects_shared_idx" ON "projects" ("shared_at") WHERE "visibility" = 'public';--> statement-breakpoint
CREATE INDEX "projects_scratch_idx" ON "projects" ("scratch_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_scratch_username_lower_idx" ON "users" (lower("scratch_username"));--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_remix_of_id_projects_id_fkey" FOREIGN KEY ("remix_of_id") REFERENCES "projects"("id") ON DELETE SET NULL;