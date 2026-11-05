CREATE TABLE `ingrediente_receta` (
	`id` text PRIMARY KEY NOT NULL,
	`receta_id` text NOT NULL,
	`categoria` text DEFAULT 'otro' NOT NULL,
	`producto` text NOT NULL,
	`cantidad` text,
	`orden` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`receta_id`) REFERENCES `receta`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingrediente_receta_idx` ON `ingrediente_receta` (`receta_id`);--> statement-breakpoint
CREATE TABLE `memoria` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`texto` text NOT NULL,
	`creado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memoria_hogar_idx` ON `memoria` (`hogar_id`);--> statement-breakpoint
CREATE TABLE `mensaje_chat` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol` text NOT NULL,
	`partes` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mensaje_chat_user_idx` ON `mensaje_chat` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `mensaje_chat_hogar_idx` ON `mensaje_chat` (`hogar_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `receta` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`titulo` text NOT NULL,
	`clave` text NOT NULL,
	`descripcion` text,
	`edad_meses` integer,
	`minutos` integer,
	`raciones` text,
	`pasos` text DEFAULT '' NOT NULL,
	`notas` text,
	`origen` text DEFAULT 'familia' NOT NULL,
	`creado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receta_hogar_clave_idx` ON `receta` (`hogar_id`,`clave`);