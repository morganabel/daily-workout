CREATE TABLE "billing_customer_mapping" (
	"source" text NOT NULL,
	"external_customer_id" text NOT NULL,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customer_mapping_source_external_customer_id_pk" PRIMARY KEY("source","external_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_entitlement_projection" (
	"account_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"entitlement_id" text,
	"product_id" text,
	"status" text NOT NULL,
	"will_renew" boolean NOT NULL,
	"paid_through" timestamp with time zone,
	"grace_through" timestamp with time zone,
	"last_event_timestamp" timestamp with time zone NOT NULL,
	"last_event_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"normalized_hash" text NOT NULL,
	"event_timestamp" timestamp with time zone NOT NULL,
	"original_event_type" text NOT NULL,
	"lifecycle_kind" text NOT NULL,
	"app_id" text NOT NULL,
	"environment" text NOT NULL,
	"customer_ids" jsonb NOT NULL,
	"entitlement_ids" jsonb NOT NULL,
	"product_id" text,
	"purchased_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"grace_expires_at" timestamp with time zone,
	"will_renew" boolean,
	"outcome" text NOT NULL,
	"failure_code" text,
	"account_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "billing_webhook_event_source_event_id_pk" PRIMARY KEY("source","event_id")
);
--> statement-breakpoint
CREATE TABLE "included_generation_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"operation_key" text NOT NULL,
	"window_id" text NOT NULL,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "included_generation_window" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"committed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "ai_usage_event_user_operation_idx";--> statement-breakpoint
ALTER TABLE "ai_usage_event" ADD COLUMN "event_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customer_mapping" ADD CONSTRAINT "billing_customer_mapping_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlement_projection" ADD CONSTRAINT "billing_entitlement_projection_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_webhook_event" ADD CONSTRAINT "billing_webhook_event_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "included_generation_reservation" ADD CONSTRAINT "included_generation_reservation_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "included_generation_reservation" ADD CONSTRAINT "included_generation_reservation_window_id_included_generation_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."included_generation_window"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "included_generation_window" ADD CONSTRAINT "included_generation_window_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_customer_mapping_account_idx" ON "billing_customer_mapping" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "billing_entitlement_status_idx" ON "billing_entitlement_projection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_webhook_event_outcome_idx" ON "billing_webhook_event" USING btree ("outcome","received_at");--> statement-breakpoint
CREATE INDEX "billing_webhook_event_account_idx" ON "billing_webhook_event" USING btree ("account_id","event_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "included_generation_reservation_account_operation_active_idx" ON "included_generation_reservation" USING btree ("account_id","operation_key") WHERE "included_generation_reservation"."status" in ('pending', 'committed');--> statement-breakpoint
CREATE INDEX "included_generation_reservation_active_idx" ON "included_generation_reservation" USING btree ("account_id","window_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "included_generation_window_account_start_idx" ON "included_generation_window" USING btree ("account_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_event_user_operation_event_idx" ON "ai_usage_event" USING btree ("user_id","operation_id","event_id");--> statement-breakpoint
CREATE INDEX "ai_usage_event_occurred_idx" ON "ai_usage_event" USING btree ("occurred_at");