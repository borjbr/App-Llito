CREATE TABLE `restaurante` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`nombre` text NOT NULL,
	`direccion` text,
	`tipo_comida` text,
	`notas` text,
	`creado_por` text,
	`visitado_en` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `restaurante_hogar_idx` ON `restaurante` (`hogar_id`,`visitado_en`);