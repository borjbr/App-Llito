CREATE TABLE `jornada_limpieza` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`fecha` text NOT NULL,
	`minutos` integer NOT NULL,
	`tarifa_centimos` integer DEFAULT 1000 NOT NULL,
	`notas` text,
	`pagado` integer DEFAULT false NOT NULL,
	`creado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `jornada_limpieza_hogar_idx` ON `jornada_limpieza` (`hogar_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `producto_compra` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`nombre` text NOT NULL,
	`cantidad` text,
	`creado_por` text,
	`comprado_en` integer,
	`comprado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`comprado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `producto_compra_hogar_idx` ON `producto_compra` (`hogar_id`,`comprado_en`);--> statement-breakpoint
CREATE TABLE `titulo` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text DEFAULT 'pelicula' NOT NULL,
	`plataforma` text,
	`notas` text,
	`creado_por` text,
	`vista_en` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `titulo_hogar_idx` ON `titulo` (`hogar_id`,`vista_en`);