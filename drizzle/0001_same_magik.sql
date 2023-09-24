ALTER TABLE "provider_stakes" ALTER COLUMN "stake" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "relay_payments" ALTER COLUMN "relays" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "relay_payments" ALTER COLUMN "cu" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "relay_payments" ALTER COLUMN "pay" SET DATA TYPE bigint;