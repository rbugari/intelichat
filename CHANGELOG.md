# Changelog - InteliChat

## [1.8.0] - 2024-01-XX

### ✨ Nuevas Funcionalidades
- **Servidor Unificado**: Consolidación de todas las aplicaciones en puerto 3000
- **Editor de Prompts Avanzado**: Herramienta completa para desarrollo y validación
- **Portal Principal**: Página de inicio con navegación integrada
- **API Endpoints Completos**: Gestión integral de agentes, herramientas y RAG
- **Validación Inteligente**: Sistema contextual de validación de prompts
- **Dropdowns Dinámicos**: Selección de clientes, chatbots y agentes en tiempo real

### 🔧 Mejoras Técnicas
- Arquitectura multi-agente con modelo "hub-and-spoke"
- Sistema de validación contextual por tipo de agente
- Gestión de recursos (herramientas, handoffs, cartuchos RAG)
- Configuración avanzada de parámetros LLM
- Mensajes multiidioma (español/inglés)

### 🗂️ Reorganización del Proyecto
- Eliminación de archivos obsoletos y duplicados
- Consolidación de documentación técnica
- Estructura de proyecto simplificada y organizada
- README principal actualizado con información completa

### 🐛 Correcciones
- Corrección en manejo de datos de agentes desde API
- Mejora en la carga de información de RAG cartridges
- Optimización de consultas a base de datos

### 📚 Documentación
- README principal completamente actualizado
- Guía técnica consolidada y simplificada
- PRD actualizado con especificaciones de Release 1.8
- Eliminación de documentación duplicada y obsoleta

### 🗑️ Archivos Eliminados
- Scripts de prueba obsoletos (test_*.js)
- Archivos temporales y de desarrollo
- Documentación duplicada en subdirectorios
- CLI HTTP obsoleto (intelli_cli_http_viiejo.js)

---

## Versiones Anteriores

### [1.7.x] - Desarrollo Previo
- Implementación inicial del sistema de chat
- Editor de prompts básico
- APIs fundamentales
- Integración con base de datos MySQL

### [1.0.0] - Versión Inicial
- Concepto inicial del sistema InteliChat
- Arquitectura básica de chatbot
- Primeras implementaciones de prompts