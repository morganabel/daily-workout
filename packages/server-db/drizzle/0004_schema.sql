CREATE TABLE "billing_account_identity" (
	"account_id" text PRIMARY KEY NOT NULL,
	"external_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_account_identity_external_customer_id_unique" UNIQUE("external_customer_id")
);
--> statement-breakpoint
ALTER TABLE "billing_account_identity" ADD CONSTRAINT "billing_account_identity_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;