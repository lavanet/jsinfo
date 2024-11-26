CREATE TABLE IF NOT EXISTS "apr_per_provider" (
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apr_per_provider_provider_type_pk" PRIMARY KEY("provider","type")
);
