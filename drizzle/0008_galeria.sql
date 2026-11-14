CREATE TABLE `medio` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`hijo_id` text,
	`drive_id` text NOT NULL,
	`tipo` text NOT NULL,
	`mime` text NOT NULL,
	`nombre` text NOT NULL,
	`tamano` integer NOT NULL,
	`duracion_s` integer,
	`fecha` text NOT NULL,
	`descripcion` text,
	`subido_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hijo_id`) REFERENCES `hijo`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subido_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `medio_hogar_idx` ON `medio` (`hogar_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `subida` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`user_id` text,
	`uri` text NOT NULL,
	`tipo` text NOT NULL,
	`mime` text NOT NULL,
	`nombre` text NOT NULL,
	`tamano` integer NOT NULL,
	`duracion_s` integer,
	`fecha` text NOT NULL,
	`hijo_id` text,
	`descripcion` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `conexion_google` ADD `scopes` text;--> statement-breakpoint
ALTER TABLE `conexion_google` ADD `carpeta_drive_id` text;--> statement-breakpoint
ALTER TABLE `conexion_google` ADD `carpeta_drive_nombre` text;