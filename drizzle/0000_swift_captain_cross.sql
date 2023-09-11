CREATE TABLE `blocks` (
	`height` integer
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
	FOREIGN KEY (`provider`) REFERENCES `providers`(`address`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`height`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `specs` (
	`id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_height_unique` ON `blocks` (`height`);--> statement-breakpoint
CREATE UNIQUE INDEX `providers_address_unique` ON `providers` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `specs_id_unique` ON `specs` (`id`);