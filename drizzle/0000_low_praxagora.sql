CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_provider_user` ON `members` (`auth_provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer NOT NULL,
	`image_url` text NOT NULL,
	`colors` text DEFAULT '[]' NOT NULL,
	`badge` text DEFAULT '소미 셀렉트' NOT NULL,
	`today_dispatch` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_name_brand` ON `products` (`name`,`brand`);--> statement-breakpoint
PRAGMA optimize;
