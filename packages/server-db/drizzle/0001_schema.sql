CREATE TABLE "ai_model_call" (
	"id" text PRIMARY KEY NOT NULL,
	"usage_event_id" text NOT NULL,
	"phase" text NOT NULL,
	"provider" text NOT NULL,
	"requested_model" text NOT NULL,
	"resolved_model" text,
	"response_id" text,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input_tokens" integer,
	"reasoning_output_tokens" integer,
	"total_tokens" integer,
	"cost_amount_nano_usd" text,
	"cost_source" text NOT NULL,
	"pricing_snapshot_id" text,
	"upstream_attempt_count" integer NOT NULL,
	"error_code" text
);
--> statement-breakpoint
CREATE TABLE "ai_usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"provider" text NOT NULL,
	"credential_source" text,
	"result" text,
	"byok" boolean NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"call_count" integer NOT NULL,
	"successful_call_count" integer NOT NULL,
	"failed_call_count" integer NOT NULL,
	"unknown_cost_call_count" integer NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cached_input_tokens" integer NOT NULL,
	"reasoning_output_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"accounted_cost_nano_usd" text NOT NULL,
	"platform_cost_nano_usd" text NOT NULL,
	"byok_estimated_cost_nano_usd" text NOT NULL,
	"allowance_charge_nano_usd" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_model_call" ADD CONSTRAINT "ai_model_call_usage_event_id_ai_usage_event_id_fk" FOREIGN KEY ("usage_event_id") REFERENCES "public"."ai_usage_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_event" ADD CONSTRAINT "ai_usage_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_model_call_usage_event_idx" ON "ai_model_call" USING btree ("usage_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_event_user_operation_idx" ON "ai_usage_event" USING btree ("user_id","operation_id");--> statement-breakpoint
CREATE INDEX "ai_usage_event_user_occurred_idx" ON "ai_usage_event" USING btree ("user_id","occurred_at");