CREATE TABLE `conexion_google` (
	`hogar_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`cuenta_email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`calendar_id` text NOT NULL,
	`calendar_nombre` text NOT NULL,
	`sync_token` text,
	`ultima_sync` integer,
	`ultimo_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `evento` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`tipo` text DEFAULT 'evento' NOT NULL,
	`titulo` text NOT NULL,
	`fecha` text,
	`todo_el_dia` integer DEFAULT true NOT NULL,
	`hora_inicio` text,
	`hora_fin` text,
	`inicio` integer,
	`repeticion` text DEFAULT 'ninguna' NOT NULL,
	`ubicacion` text,
	`notas` text,
	`hijo_id` text,
	`asignado_a` text,
	`completado` integer DEFAULT false NOT NULL,
	`recordatorios` text DEFAULT '' NOT NULL,
	`creado_por` text,
	`google_id` text,
	`sincronizado` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hijo_id`) REFERENCES `hijo`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asignado_a`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `evento_hogar_fecha_idx` ON `evento` (`hogar_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `evento_google_idx` ON `evento` (`hogar_id`,`google_id`);