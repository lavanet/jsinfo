CREATE TABLE `blocks` (
	`height` integer,
	`datetime` integer
);
--> statement-breakpoint
CREATE TABLE `conflict_responses` (
	`id` integer PRIMARY KEY NOT NULL,
	`block_id` integer,
	`consumer` text,
	`spec_id` text,
	`vote_id` text,
	`request_block` integer,
	`vote_deadline` integer,
	`api_interface` text,
	`api_URL` text,
	`connection_type` text,
	`request_data` text,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumer`) REFERENCES `consumers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `conflict_votes` (
	`id` integer PRIMARY KEY NOT NULL,
	`vote_id` text,
	`block_id` integer,
	`provider` text,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider`) REFERENCES `providers`(`address`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `consumers` (
	`address` text
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`event_type` integer,
	`provider` text,
	`block_id` integer,
	FOREIGN KEY (`provider`) REFERENCES `providers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text,
	`desc` text,
	`pay` integer
);
--> statement-breakpoint
CREATE TABLE `provider_stakes` (
	`id` integer PRIMARY KEY NOT NULL,
	`applied_height` integer,
	`provider` text,
	`spec_id` text,
	`block_id` integer,
	FOREIGN KEY (`provider`) REFERENCES `providers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`address` text,
	`moniker` text
);
--> statement-breakpoint
CREATE TABLE `relay_payments` (
	`id` integer PRIMARY KEY NOT NULL,
	`relays` integer,
	`cu` integer,
	`pay` integer,
	`qos_sync` real,
	`qos_availability` real,
	`qos_latency` real,
	`provider` text,
	`spec_id` text,
	`block_id` integer,
	`consumer` text,
	FOREIGN KEY (`provider`) REFERENCES `providers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumer`) REFERENCES `consumers`(`address`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `specs` (
	`id` text
);
--> statement-breakpoint
CREATE TABLE `subscription_buys` (
	`block_id` integer,
	`consumer` text,
	`number` integer,
	`plan` text,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumer`) REFERENCES `consumers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_height_unique` ON `blocks` (`height`);--> statement-breakpoint
CREATE UNIQUE INDEX `consumers_address_unique` ON `consumers` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `plans_id_unique` ON `plans` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `providers_address_unique` ON `providers` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `specs_id_unique` ON `specs` (`id`);