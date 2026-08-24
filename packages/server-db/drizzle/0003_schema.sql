CREATE TABLE "account_transition" (
	"source_user_id" text PRIMARY KEY NOT NULL,
	"target_user_id" text NOT NULL,
	"method" text NOT NULL,
	"state" text NOT NULL,
	"failure_code" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
DO $$
DECLARE
	unsupported_providers text;
BEGIN
	SELECT string_agg(DISTINCT provider_id, ', ' ORDER BY provider_id)
	INTO unsupported_providers
	FROM "account"
	WHERE provider_id NOT IN ('credential', 'google');

	IF unsupported_providers IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot backfill Better Auth account issuer for provider(s): %', unsupported_providers;
	END IF;
END $$;--> statement-breakpoint
UPDATE "account"
SET "issuer" = 'local:credential', "account_id" = "user_id"
WHERE "provider_id" = 'credential';--> statement-breakpoint
UPDATE "account"
SET "issuer" = 'https://accounts.google.com'
WHERE "provider_id" = 'google';--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "account" WHERE "issuer" IS NULL) THEN
		RAISE EXCEPTION 'Better Auth account issuer backfill left null rows';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "account"
		GROUP BY "issuer", "account_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Better Auth account issuer backfill produced duplicate identities';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "account_transition_target_state_idx" ON "account_transition" USING btree ("target_user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");
