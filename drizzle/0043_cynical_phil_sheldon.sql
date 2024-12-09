CREATE TABLE IF NOT EXISTS "apr_full_info" (
	"address" text NOT NULL,
	"value" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "apr_full_info_address_type_pk" PRIMARY KEY("address","type")
);
