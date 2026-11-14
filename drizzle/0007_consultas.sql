CREATE TABLE `consulta` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`hijo_id` text NOT NULL,
	`evento_id` text,
	`fecha` text NOT NULL,
	`especialidad` text,
	`centro` text,
	`profesional` text,
	`motivo` text,
	`peso_gramos` integer,
	`talla_mm` integer,
	`perimetro_mm` integer,
	`notas` text,
	`indicaciones` text,
	`creado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hijo_id`) REFERENCES `hijo`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evento_id`) REFERENCES `evento`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `consulta_hijo_idx` ON `consulta` (`hijo_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `consulta_hogar_idx` ON `consulta` (`hogar_id`);--> statement-breakpoint
ALTER TABLE `hijo` ADD `fecha_nacimiento` text;