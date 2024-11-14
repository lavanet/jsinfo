CREATE TABLE IF NOT EXISTS "spec_tracked_info" (
	"provider" text NOT NULL,
	"chain_id" text NOT NULL,
	"iprpc_cu" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spec_tracked_info_provider_chain_id_pk" PRIMARY KEY("provider","chain_id")
);
