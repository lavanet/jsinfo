ALTER TABLE "provider_stakes" ADD COLUMN "delegate_limit" bigint;--> statement-breakpoint
ALTER TABLE "provider_stakes" ADD COLUMN "delegate_total" bigint;--> statement-breakpoint
ALTER TABLE "provider_stakes" ADD COLUMN "delegate_commission" bigint;