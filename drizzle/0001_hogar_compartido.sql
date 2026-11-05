CREATE TABLE `hogar` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`codigo_invitacion` text NOT NULL,
	`creado_por` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`creado_por`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hogar_codigo_invitacion_unique` ON `hogar` (`codigo_invitacion`);--> statement-breakpoint
CREATE TABLE `miembro_hogar` (
	`hogar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol` text DEFAULT 'miembro' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`hogar_id`, `user_id`),
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `miembro_hogar_user_id_unique` ON `miembro_hogar` (`user_id`);--> statement-breakpoint
CREATE INDEX `miembro_hogar_idx` ON `miembro_hogar` (`hogar_id`);--> statement-breakpoint
-- Cada usuario que ya existía recibe su propio hogar (como administrador)
INSERT INTO `hogar` (`id`, `nombre`, `codigo_invitacion`, `creado_por`)
SELECT lower(hex(randomblob(16))), 'Familia ' || `apellidos`, upper(hex(randomblob(4))), `id` FROM `user`;--> statement-breakpoint
INSERT INTO `miembro_hogar` (`hogar_id`, `user_id`, `rol`)
SELECT `id`, `creado_por`, 'admin' FROM `hogar` WHERE `creado_por` IS NOT NULL;--> statement-breakpoint
-- Los hijos pasan del usuario a su hogar, conservando los datos
CREATE TABLE `__new_hijo` (
	`id` text PRIMARY KEY NOT NULL,
	`hogar_id` text NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`hogar_id`) REFERENCES `hogar`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_hijo` (`id`, `hogar_id`, `nombre`, `orden`, `created_at`, `updated_at`)
SELECT h.`id`, m.`hogar_id`, h.`nombre`, h.`orden`, h.`created_at`, h.`updated_at`
FROM `hijo` h JOIN `miembro_hogar` m ON m.`user_id` = h.`user_id`;--> statement-breakpoint
DROP TABLE `hijo`;--> statement-breakpoint
ALTER TABLE `__new_hijo` RENAME TO `hijo`;--> statement-breakpoint
CREATE INDEX `hijo_hogar_idx` ON `hijo` (`hogar_id`);
