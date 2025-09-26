-- --------------------------------------------------------
-- Host:                         kinocs.myscriptcase.com
-- Versión del servidor:         10.3.39-MariaDB - MariaDB Server
-- SO del servidor:              Linux
-- HeidiSQL Versión:             12.10.0.7000
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Volcando estructura para tabla kinocsmy_intelichat.adm_groups
CREATE TABLE IF NOT EXISTS `adm_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `external_id` varchar(128) DEFAULT NULL,
  `name` varchar(256) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_group` (`cliente_id`,`name`),
  CONSTRAINT `fk_adm_groups_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.adm_group_members
CREATE TABLE IF NOT EXISTS `adm_group_members` (
  `group_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`group_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `adm_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `adm_groups` (`id`),
  CONSTRAINT `adm_group_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `adm_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.adm_login_tokens
CREATE TABLE IF NOT EXISTS `adm_login_tokens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `email` varchar(320) NOT NULL,
  `code` char(6) NOT NULL,
  `purpose` varchar(20) NOT NULL DEFAULT 'login',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_activo` (`cliente_id`,`email`,`code`,`purpose`),
  CONSTRAINT `fk_adm_tokens_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.adm_users
CREATE TABLE IF NOT EXISTS `adm_users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `external_id` varchar(128) DEFAULT NULL,
  `email` varchar(320) NOT NULL,
  `display_name` varchar(200) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_email` (`cliente_id`,`email`),
  CONSTRAINT `fk_adm_users_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_agente
CREATE TABLE IF NOT EXISTS `cfg_agente` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `chatbot_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `orden` int(11) NOT NULL DEFAULT 1,
  `llm_modelo_id` bigint(20) NOT NULL,
  `system_prompt_es` longtext DEFAULT NULL COMMENT 'Markdown ES',
  `system_prompt_en` longtext DEFAULT NULL COMMENT 'Markdown EN',
  `mensaje_bienvenida_es` text DEFAULT NULL,
  `mensaje_bienvenida_en` text DEFAULT NULL,
  `mensaje_retorno_es` text DEFAULT NULL,
  `mensaje_retorno_en` text DEFAULT NULL,
  `mensaje_despedida_es` text DEFAULT NULL,
  `mensaje_despedida_en` text DEFAULT NULL,
  `mensaje_handoff_confirmacion_es` text DEFAULT NULL,
  `mensaje_handoff_confirmacion_en` text DEFAULT NULL,
  `mensaje_final_tarea_es` text DEFAULT NULL,
  `mensaje_final_tarea_en` text DEFAULT NULL,
  `temperatura` decimal(4,2) NOT NULL DEFAULT 0.70,
  `top_p` decimal(4,2) NOT NULL DEFAULT 1.00,
  `max_tokens` int(11) NOT NULL DEFAULT 2048,
  `color` char(7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_agente_chatbot_nombre` (`chatbot_id`,`nombre`),
  KEY `idx_agente_chatbot` (`chatbot_id`),
  KEY `idx_agente_modelo` (`llm_modelo_id`),
  CONSTRAINT `fk_agente_chatbot` FOREIGN KEY (`chatbot_id`) REFERENCES `cfg_chatbot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agente_llm` FOREIGN KEY (`llm_modelo_id`) REFERENCES `cfg_llm_modelo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_agente_handoff
CREATE TABLE IF NOT EXISTS `cfg_agente_handoff` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `from_agente_id` bigint(20) NOT NULL,
  `trigger_codigo` varchar(120) NOT NULL,
  `to_agente_id` bigint(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_handoff` (`from_agente_id`,`trigger_codigo`),
  KEY `idx_handoff_to` (`to_agente_id`),
  CONSTRAINT `fk_handoff_from` FOREIGN KEY (`from_agente_id`) REFERENCES `cfg_agente` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_handoff_to` FOREIGN KEY (`to_agente_id`) REFERENCES `cfg_agente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=506 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_agente_prompt
CREATE TABLE IF NOT EXISTS `cfg_agente_prompt` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `agente_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `contenido` longtext NOT NULL,
  `orden` int(11) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_agprompt_agente` (`agente_id`),
  CONSTRAINT `fk_agprompt_agente` FOREIGN KEY (`agente_id`) REFERENCES `cfg_agente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=118 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_chatbot
CREATE TABLE IF NOT EXISTS `cfg_chatbot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `default_lang` char(5) NOT NULL DEFAULT 'es',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chatbot_cliente_nombre` (`cliente_id`,`nombre`),
  KEY `idx_chatbot_cliente` (`cliente_id`),
  CONSTRAINT `fk_chatbot_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_chatbot_theme
CREATE TABLE IF NOT EXISTS `cfg_chatbot_theme` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `chatbot_id` bigint(20) NOT NULL,
  `font_family` varchar(120) NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
  `header_bg` char(7) NOT NULL DEFAULT '#111827',
  `header_fg` char(7) NOT NULL DEFAULT '#FFFFFF',
  `accent_color` char(7) NOT NULL DEFAULT '#3B82F6',
  `bubble_radius_px` int(11) NOT NULL DEFAULT 14,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_theme_chatbot` (`chatbot_id`),
  CONSTRAINT `fk_theme_chatbot` FOREIGN KEY (`chatbot_id`) REFERENCES `cfg_chatbot` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_cliente
CREATE TABLE IF NOT EXISTS `cfg_cliente` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_form
CREATE TABLE IF NOT EXISTS `cfg_form` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `codigo` varchar(120) NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` enum('draft','active','archived') NOT NULL DEFAULT 'active',
  `visibilidad` enum('private','public') NOT NULL DEFAULT 'private',
  `requiere_auth` tinyint(1) NOT NULL DEFAULT 0,
  `schema_json` longtext DEFAULT NULL,
  `ui_schema_json` longtext DEFAULT NULL,
  `css_text` longtext DEFAULT NULL,
  `logic_json` longtext DEFAULT NULL,
  `validation_rules_json` longtext DEFAULT NULL,
  `submit_webhook_url` varchar(255) DEFAULT NULL,
  `submit_method` varchar(10) NOT NULL DEFAULT 'post',
  `version_actual_id` bigint(20) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_cliente_codigo` (`cliente_id`,`codigo`),
  KEY `idx_form_cliente` (`cliente_id`),
  CONSTRAINT `fk_form_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_form_version
CREATE TABLE IF NOT EXISTS `cfg_form_version` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `form_id` bigint(20) NOT NULL,
  `version` int(11) NOT NULL,
  `schema_json` longtext NOT NULL,
  `ui_schema_json` longtext DEFAULT NULL,
  `logic_json` longtext DEFAULT NULL,
  `validation_rules_json` longtext DEFAULT NULL,
  `submit_webhook_url` varchar(255) DEFAULT NULL,
  `submit_method` varchar(10) NOT NULL DEFAULT 'post',
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `published_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_version` (`form_id`,`version`),
  KEY `idx_formv_form` (`form_id`),
  CONSTRAINT `fk_formv_form` FOREIGN KEY (`form_id`) REFERENCES `cfg_form` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_herramienta
CREATE TABLE IF NOT EXISTS `cfg_herramienta` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `agente_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `base_url` varchar(255) DEFAULT NULL,
  `herramienta_auth_id` bigint(20) DEFAULT NULL,
  `tipo` enum('api','mcp','form') NOT NULL DEFAULT 'api',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tool_agente_nombre` (`agente_id`,`nombre`),
  KEY `idx_tool_agente` (`agente_id`),
  KEY `idx_tool_auth` (`herramienta_auth_id`),
  CONSTRAINT `fk_tool_agente` FOREIGN KEY (`agente_id`) REFERENCES `cfg_agente` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tool_auth` FOREIGN KEY (`herramienta_auth_id`) REFERENCES `cfg_herramienta_auth` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=210 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_herramienta_auth
CREATE TABLE IF NOT EXISTS `cfg_herramienta_auth` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `tipo` enum('none','bearer','api-key','basic','custom') NOT NULL DEFAULT 'none',
  `config_json` longtext DEFAULT NULL CHECK (json_valid(`config_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_herramienta_mcp
CREATE TABLE IF NOT EXISTS `cfg_herramienta_mcp` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `herramienta_id` bigint(20) NOT NULL,
  `server_url` varchar(255) NOT NULL,
  `protocol_version` varchar(20) NOT NULL DEFAULT '1.0',
  `default_namespace` varchar(100) DEFAULT NULL,
  `capabilities_json` longtext DEFAULT NULL CHECK (json_valid(`capabilities_json`)),
  `herramienta_auth_id` bigint(20) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_tool` (`herramienta_id`),
  KEY `fk_mcp_auth` (`herramienta_auth_id`),
  CONSTRAINT `fk_mcp_auth` FOREIGN KEY (`herramienta_auth_id`) REFERENCES `cfg_herramienta_auth` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mcp_tool` FOREIGN KEY (`herramienta_id`) REFERENCES `cfg_herramienta` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_herramienta_param
CREATE TABLE IF NOT EXISTS `cfg_herramienta_param` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ruta_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `en` enum('path','query','header','body') NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `requerido` tinyint(1) NOT NULL DEFAULT 0,
  `valor_por_defecto` varchar(255) DEFAULT NULL,
  `ejemplo` varchar(255) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_param_route` (`ruta_id`),
  CONSTRAINT `fk_param_route` FOREIGN KEY (`ruta_id`) REFERENCES `cfg_herramienta_ruta` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_herramienta_ruta
CREATE TABLE IF NOT EXISTS `cfg_herramienta_ruta` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `herramienta_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `path` varchar(255) NOT NULL,
  `metodo` enum('get','post','put','delete','patch') NOT NULL DEFAULT 'get',
  `timeout_ms` int(11) NOT NULL DEFAULT 8000,
  `request_body_schema_json` longtext DEFAULT NULL CHECK (json_valid(`request_body_schema_json`)),
  `response_schema_json` longtext DEFAULT NULL CHECK (json_valid(`response_schema_json`)),
  `notas` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ruta` (`herramienta_id`,`metodo`,`path`),
  KEY `idx_ruta_tool` (`herramienta_id`),
  CONSTRAINT `fk_ruta_tool` FOREIGN KEY (`herramienta_id`) REFERENCES `cfg_herramienta` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=309 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_llm_modelo
CREATE TABLE IF NOT EXISTS `cfg_llm_modelo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `proveedor_id` bigint(20) NOT NULL,
  `nombre_modelo` varchar(160) NOT NULL,
  `context_window` int(11) NOT NULL DEFAULT 8192,
  `max_tokens` int(11) NOT NULL DEFAULT 8192,
  `propiedades_json` longtext DEFAULT NULL CHECK (json_valid(`propiedades_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_modelo_proveedor` (`proveedor_id`,`nombre_modelo`),
  KEY `idx_llmmod_proveedor` (`proveedor_id`),
  CONSTRAINT `fk_llmmod_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `cfg_llm_proveedor` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_llm_proveedor
CREATE TABLE IF NOT EXISTS `cfg_llm_proveedor` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `base_url` varchar(255) NOT NULL,
  `api_key` varchar(255) DEFAULT NULL,
  `notas` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proveedor_cliente_nombre` (`cliente_id`,`nombre`),
  KEY `idx_llmprov_cliente` (`cliente_id`),
  CONSTRAINT `fk_llmprov_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_storage_provider
CREATE TABLE IF NOT EXISTS `cfg_storage_provider` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `display_name` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provider_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_tenant_features
CREATE TABLE IF NOT EXISTS `cfg_tenant_features` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) NOT NULL,
  `feature_code` varchar(64) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_feature` (`tenant_id`,`feature_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.cfg_tenant_storage
CREATE TABLE IF NOT EXISTS `cfg_tenant_storage` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) NOT NULL,
  `provider_code` varchar(32) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `display_name` varchar(80) DEFAULT NULL,
  `bucket_or_drive_id` varchar(255) DEFAULT NULL,
  `base_path` varchar(255) DEFAULT '',
  `region` varchar(60) DEFAULT NULL,
  `account_type` enum('onedrive_personal','sharepoint_site') DEFAULT NULL,
  `credentials_plain` text NOT NULL,
  `policy` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `quota_bytes` bigint(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `default_tenant` bigint(20) GENERATED ALWAYS AS (if(`is_default` = 1,`tenant_id`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_single_default` (`default_tenant`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_provider` (`provider_code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.chat_sesion
CREATE TABLE IF NOT EXISTS `chat_sesion` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `chatbot_id` bigint(20) NOT NULL,
  `usuario_ref` varchar(120) DEFAULT NULL,
  `canal` enum('web','cli','api') NOT NULL DEFAULT 'web',
  `started_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_activity` datetime NOT NULL DEFAULT current_timestamp(),
  `extra_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sesion_cliente` (`cliente_id`),
  KEY `idx_sesion_chatbot` (`chatbot_id`),
  CONSTRAINT `fk_sesion_chatbot` FOREIGN KEY (`chatbot_id`) REFERENCES `cfg_chatbot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sesion_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.chat_turno
CREATE TABLE IF NOT EXISTS `chat_turno` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `sesion_id` bigint(20) NOT NULL,
  `agente_id` bigint(20) DEFAULT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` longtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `extra_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_turno_sesion` (`sesion_id`),
  KEY `agente_id` (`agente_id`),
  CONSTRAINT `chat_turno_ibfk_1` FOREIGN KEY (`agente_id`) REFERENCES `cfg_agente` (`id`),
  CONSTRAINT `fk_turno_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `chat_sesion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=835 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_chat
CREATE TABLE IF NOT EXISTS `ejec_chat` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) NOT NULL,
  `chatbot_id` bigint(20) NOT NULL,
  `titulo` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `extra_json` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ejec_chat_chatbot` (`chatbot_id`),
  KEY `fk_ejec_chat_cliente` (`cliente_id`),
  CONSTRAINT `fk_ejec_chat_chatbot` FOREIGN KEY (`chatbot_id`) REFERENCES `cfg_chatbot` (`id`),
  CONSTRAINT `fk_ejec_chat_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=382 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_form
CREATE TABLE IF NOT EXISTS `ejec_form` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `cliente_id` bigint(20) NOT NULL,
  `form_id` bigint(20) NOT NULL,
  `form_version_id` bigint(20) NOT NULL,
  `chat_id` bigint(20) DEFAULT NULL,
  `started_at` datetime NOT NULL DEFAULT current_timestamp(),
  `submitted_at` datetime DEFAULT NULL,
  `estado` enum('started','in_progress','submitted','cancelled','error') NOT NULL DEFAULT 'started',
  `submitted_by_id` bigint(20) DEFAULT NULL,
  `submitted_email` varchar(190) DEFAULT NULL,
  `data_json` longtext DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ejec_uuid` (`uuid`),
  KEY `idx_ejec_cliente` (`cliente_id`),
  KEY `idx_ejec_form` (`form_id`,`form_version_id`),
  KEY `idx_ejec_sesion` (`chat_id`),
  KEY `idx_ejec_submitted_at` (`submitted_at`),
  KEY `idx_ejec_email` (`submitted_email`),
  KEY `fk_ejec_formver` (`form_version_id`),
  CONSTRAINT `fk_ejec_chat` FOREIGN KEY (`chat_id`) REFERENCES `ejec_chat` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ejec_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `cfg_cliente` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ejec_form` FOREIGN KEY (`form_id`) REFERENCES `cfg_form` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ejec_formver` FOREIGN KEY (`form_version_id`) REFERENCES `cfg_form_version` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_form_event
CREATE TABLE IF NOT EXISTS `ejec_form_event` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ejec_form_id` bigint(20) NOT NULL,
  `event_code` varchar(60) NOT NULL,
  `detail_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ejecevent_form` (`ejec_form_id`,`event_code`),
  CONSTRAINT `fk_ejecevent_form` FOREIGN KEY (`ejec_form_id`) REFERENCES `ejec_form` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_form_file
CREATE TABLE IF NOT EXISTS `ejec_form_file` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ejec_form_id` bigint(20) NOT NULL,
  `campo` varchar(120) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size_bytes` int(11) DEFAULT NULL,
  `storage_url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ejecfile_form` (`ejec_form_id`),
  CONSTRAINT `fk_ejecfile_form` FOREIGN KEY (`ejec_form_id`) REFERENCES `ejec_form` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_mensaje
CREATE TABLE IF NOT EXISTS `ejec_mensaje` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `chat_id` bigint(20) NOT NULL,
  `rol` enum('user','assistant','system') NOT NULL,
  `contenido` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ix_ejec_msg_chat_created` (`chat_id`,`created_at`),
  CONSTRAINT `fk_ejec_msg_chat` FOREIGN KEY (`chat_id`) REFERENCES `ejec_chat` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2593 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_storage_events
CREATE TABLE IF NOT EXISTS `ejec_storage_events` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tenant_id` bigint(20) NOT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `action` enum('PUT','GET','DELETE','SIGN_UPLOAD','SIGN_DOWNLOAD','LIST','EXISTS','MOVE','COPY') NOT NULL,
  `provider_code` varchar(32) NOT NULL,
  `path` varchar(512) NOT NULL,
  `bytes` bigint(20) DEFAULT NULL,
  `req_id` varchar(64) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `status_code` int(11) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_time` (`tenant_id`,`created_at`),
  KEY `idx_action` (`action`),
  KEY `idx_provider` (`provider_code`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_storage_objects
CREATE TABLE IF NOT EXISTS `ejec_storage_objects` (
  `id` char(36) NOT NULL,
  `tenant_id` bigint(20) NOT NULL,
  `provider_code` varchar(32) NOT NULL,
  `path` varchar(512) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `bytes` bigint(20) DEFAULT NULL,
  `hash_sha256` char(64) DEFAULT NULL,
  `status` enum('active','deleted') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_path` (`tenant_id`,`path`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_provider` (`provider_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla kinocsmy_intelichat.ejec_storage_quota
CREATE TABLE IF NOT EXISTS `ejec_storage_quota` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) NOT NULL,
  `period_start` date NOT NULL,
  `bytes_written` bigint(20) NOT NULL DEFAULT 0,
  `bytes_read` bigint(20) NOT NULL DEFAULT 0,
  `objects_written` bigint(20) NOT NULL DEFAULT 0,
  `objects_deleted` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_period` (`tenant_id`,`period_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para procedimiento kinocsmy_intelichat.sp_form_new_version
DELIMITER //
CREATE DEFINER=`kinocsmy_admin`@`51.79.77.76` PROCEDURE `sp_form_new_version`(
  IN  p_form_id BIGINT,
  IN  p_schema_json LONGTEXT,
  IN  p_ui_schema_json LONGTEXT,
  IN  p_logic_json LONGTEXT,
  IN  p_validation_rules_json LONGTEXT,
  IN  p_submit_webhook_url VARCHAR(255),
  IN  p_submit_method ENUM('get','post','put','patch','delete'),
  IN  p_publish_now TINYINT
)
BEGIN
  DECLARE v_next_version INT;
  DECLARE v_new_version_id BIGINT;

  -- Bloqueamos las versiones de este form para evitar carreras
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM cfg_form_version
   WHERE form_id = p_form_id
   FOR UPDATE;

  INSERT INTO cfg_form_version (
    form_id, version, schema_json, ui_schema_json, logic_json,
    validation_rules_json, submit_webhook_url, submit_method,
    is_published, created_at, published_at
  )
  VALUES (
    p_form_id, v_next_version,
    p_schema_json, p_ui_schema_json, p_logic_json,
    p_validation_rules_json, p_submit_webhook_url, COALESCE(p_submit_method,'post'),
    CASE WHEN p_publish_now=1 THEN 1 ELSE 0 END,
    NOW(),
    CASE WHEN p_publish_now=1 THEN NOW() ELSE NULL END
  );

  SET v_new_version_id = LAST_INSERT_ID();

  IF p_publish_now = 1 THEN
    UPDATE cfg_form
       SET version_actual_id = v_new_version_id
     WHERE id = p_form_id;
  END IF;

  -- Devolvemos el id (para clientes SQL que lean SELECT)
  SELECT v_new_version_id AS new_version_id, v_next_version AS version_num;
END//
DELIMITER ;

-- Volcando estructura para vista kinocsmy_intelichat.vw_form_publicado
-- Creando tabla temporal para superar errores de dependencia de VIEW
CREATE TABLE `vw_form_publicado` (
	`form_id` BIGINT(20) NOT NULL,
	`cliente_id` BIGINT(20) NOT NULL,
	`codigo` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_general_ci',
	`titulo` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_general_ci',
	`estado` ENUM('draft','active','archived') NOT NULL COLLATE 'utf8mb4_general_ci',
	`visibilidad` ENUM('private','public') NOT NULL COLLATE 'utf8mb4_general_ci',
	`form_version_id` BIGINT(20) NOT NULL,
	`version` INT(11) NOT NULL,
	`is_published` TINYINT(1) NOT NULL,
	`schema_json` LONGTEXT NOT NULL COLLATE 'utf8mb4_general_ci',
	`ui_schema_json` LONGTEXT NULL COLLATE 'utf8mb4_general_ci',
	`logic_json` LONGTEXT NULL COLLATE 'utf8mb4_general_ci',
	`validation_rules_json` LONGTEXT NULL COLLATE 'utf8mb4_general_ci',
	`submit_webhook_url` VARCHAR(1) NULL COLLATE 'utf8mb4_general_ci',
	`submit_method` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_general_ci'
) ENGINE=MyISAM;

-- Volcando estructura para disparador kinocsmy_intelichat.bi_ejec_form_uuid
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE DEFINER=`kinocsmy_admin`@`51.79.77.76` TRIGGER bi_ejec_form_uuid
BEFORE INSERT ON ejec_form
FOR EACH ROW
BEGIN
  IF NEW.uuid IS NULL OR NEW.uuid = '' THEN
    SET NEW.uuid = UUID();
  END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador kinocsmy_intelichat.bu_cfg_form_snapshot
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE DEFINER=`kinocsmy_admin`@`51.79.77.76` TRIGGER bu_cfg_form_snapshot
BEFORE UPDATE ON cfg_form
FOR EACH ROW
BEGIN
  DECLARE v_next_version INT;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM cfg_form_version
   WHERE form_id = OLD.id;

  INSERT INTO cfg_form_version (
    form_id, version,
    schema_json, ui_schema_json, logic_json, validation_rules_json,
    submit_webhook_url, submit_method,
    is_published, created_at, published_at
  )
  VALUES (
    OLD.id, v_next_version,
    COALESCE(OLD.schema_json, '{"title":"(vacío)","components":[]}'),
    OLD.ui_schema_json,
    OLD.logic_json,
    OLD.validation_rules_json,
    OLD.submit_webhook_url,
    COALESCE(OLD.submit_method, 'post'),
    1, NOW(), NOW()
  );
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador kinocsmy_intelichat.trg_cfg_agente_prompt_es_update
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE DEFINER=`kinocsmy_admin`@`51.79.77.76` TRIGGER trg_cfg_agente_prompt_es_update
AFTER UPDATE ON cfg_agente
FOR EACH ROW
BEGIN
  -- Solo actúa si cambió el prompt en español
  IF NOT (OLD.system_prompt_es <=> NEW.system_prompt_es) THEN
    INSERT INTO cfg_agente_prompt (
      agente_id,
      nombre,
      contenido,
      orden,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      CONCAT('auto_es_', DATE_FORMAT(NOW(), '%Y%m%d_%H%i%s')),
      NEW.system_prompt_es,
      1,
      0,  -- lo dejamos inactivo (solo histórico)
      NOW(),
      NOW()
    );
  END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Eliminando tabla temporal y crear estructura final de VIEW
DROP TABLE IF EXISTS `vw_form_publicado`;
CREATE ALGORITHM=UNDEFINED DEFINER=`kinocsmy_admin`@`51.79.77.76` SQL SECURITY DEFINER VIEW `vw_form_publicado` AS select `f`.`id` AS `form_id`,`f`.`cliente_id` AS `cliente_id`,`f`.`codigo` AS `codigo`,`f`.`titulo` AS `titulo`,`f`.`estado` AS `estado`,`f`.`visibilidad` AS `visibilidad`,`v`.`id` AS `form_version_id`,`v`.`version` AS `version`,`v`.`is_published` AS `is_published`,`v`.`schema_json` AS `schema_json`,`v`.`ui_schema_json` AS `ui_schema_json`,`v`.`logic_json` AS `logic_json`,`v`.`validation_rules_json` AS `validation_rules_json`,`v`.`submit_webhook_url` AS `submit_webhook_url`,`v`.`submit_method` AS `submit_method` from (`cfg_form` `f` join `cfg_form_version` `v` on(`v`.`id` = `f`.`version_actual_id` and `v`.`is_published` = 1))
;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
