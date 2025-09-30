# InteliChat Release 1.7 🧠
> **Arquitectura Basada en Intenciones**: Un sistema de chatbot conversacional más robusto, predecible y fácil de mantener.

## 🎯 Estado del Sistema

Con la **Release 1.7**, el sistema ha sido refactorizado para mejorar su fiabilidad y separar las responsabilidades entre la lógica de conversación y la de ejecución.

- ✅ **Arquitectura Basada en Intenciones**: El flujo de control ahora es gestionado por el código, no por el LLM, eliminando comportamientos erráticos.
- ✅ **Flujo de Agentes Fiable**: El modelo "hub-and-spoke" (con `INFO` como coordinador) ahora funciona de manera predecible.
- ✅ **Prompts Simplificados**: La creación de prompts es más sencilla y se centra en el diálogo, no en la generación de JSON complejo.
- ✅ **Sistema Completamente Funcional**: Todas las funcionalidades anteriores (multi-agente, multi-proveedor, herramientas dinámicas) se conservan.
- ✅ **Validación Inteligente y Contextual**: Sistema de validación que clasifica automáticamente los agentes y aplica reglas diferenciadas según su complejidad.

## 🚀 Acceso Local

```
- **💬 Chat App**: http://localhost:5001 (HTML + JavaScript vanilla)
- **📝 Editor de Prompts**: http://localhost:5003 (Herramienta recomendada para desarrollo de prompts)
- **🔧 Backend**: http://localhost:3000 (Express + MariaDB)
- **💚 Health Check**: http://localhost:3000/api/health
```

## ✨ Características Clave de la Release 1.7

### 🧠 Arquitectura "El Código es el Director"
Esta release introduce un cambio fundamental en la filosofía del sistema para garantizar su robustez:
- **El Prompt solo Conversa**: La responsabilidad del LLM es entender al usuario y declarar su **intención** (ej: "quiero usar una herramienta", "he terminado mi tarea").
- **El Código Ejecuta**: El backend (`bot_logic.js`) recibe esta intención y actúa como un director de orquesta, ejecutando las acciones correspondientes (llamar a herramientas, hacer handoffs) de forma 100% determinista.
- **Resultado**: Se eliminan los errores de "eco", los bucles inesperados y los fallos por JSON mal formado. El sistema es ahora mucho más fiable.

### 🎯 Sistema Multi-Agente Predecible
- **INFO (Coordinador)**: Su rol como agente central está ahora reforzado por el código.
- **ONBOARDING / CLIENTES (Especialistas)**: Siguen un ciclo de vida claro (reciben control, ejecutan su tarea, y devuelven el control a `INFO`), que es forzado por el backend.

### 🔍 Validación Inteligente y Contextual
- **Clasificación Automática**: El sistema clasifica automáticamente los agentes como SIMPLE o COMPLEJO según sus características.
- **Reglas Diferenciadas**: Los agentes simples reciben validación relajada con sugerencias, mientras que los complejos reciben validación estricta con errores críticos.
- **Reportes Contextuales**: Los reportes de validación se adaptan al tipo de agente, proporcionando información relevante y accionable.
- **Flexibilidad Inteligente**: Permite mayor libertad creativa para agentes simples sin comprometer la calidad de los complejos.

## 🏗️ Arquitectura Release 1.7

```mermaid
graph TD
    A[Frontend] -->|1. Envía msg| B(Backend: /api/chat);
    B -->|2. Carga estado| C[DB: ejec_chat];
    B -->|3. Llama a bot_logic| D(bot_logic.js);
    D -->|4. Consulta al LLM| E[llm.js];
    E -->|5. API Externa LLM| F[Groq/OpenAI];
    F -->|6. Respuesta LLM con INTENCIÓN| E;
    E -->|7. Devuelve Intención simple| D;
    
    subgraph "bot_logic.js (Director de Orquesta)"
        direction LR
        D -->|8. Lee Intención| G{Switch (action.type)};
        G -->|call_tool| H[Llama a dynamicToolsService];
        G -->|handoff| I[Cambia de Agente Activo];
        G -->|finish_turn| J[Fuerza Handoff a INFO];
        G -->|say| K[Solo hablar];
    end

    H --> L[DB: cfg_herramienta];
    I --> D;
    J --> D;
    
    D -->|10. Respuesta Final| B;
    B -->|11. Persiste estado| C;
    B -->|12. Envía msg al Frontend| A;
```

## 📚 Documentación Clave

Para entender el proyecto en profundidad, consulta los siguientes documentos:

- **Documentos de Producto (PRD):**
    - [`PRD General del Proyecto`](./PRD.md): Visión general, arquitectura y roadmap.
    - [`PRD de la Aplicación de Chat`](./chat-vanilla/PRD_chat_app.md): Detalles de la aplicación de chat vanilla.
    - [`PRD del Editor de Agentes`](./prompt-editor/prompt_editor_prd.md): Detalles de la herramienta de desarrollo de prompts.

- **Guías Técnicas y de Desarrollo:**
    - [`Guía Técnica para Desarrolladores`](./docs/GUIA_TECNICA_DESARROLLADOR.md): Explicación detallada de la interacción entre componentes.
    - [`Guía Técnica del Backend`](./intelli_backend/GUIA_TECNICA_BACKEND.md): Foco exclusivo en la arquitectura y APIs del backend.
    - [`Guía para la Creación de Prompts`](./docs/GUIA_GENERACION_PROMPTS.md): La biblia para crear prompts efectivos bajo la nueva arquitectura.
    - [`Guía del Editor de Agentes`](./prompt-editor/readme_prompt_editor.md): Cómo usar la herramienta de desarrollo de prompts.

## 🚀 Guía de Inicio Rápido

*(Sin cambios respecto a la versión anterior)*

### 1. Prerrequisitos
- Node.js 18+
- MariaDB 10.6+
- Git

### 2. Configuración Inicial
```bash
# Clonar repositorio y entrar al directorio
git clone <repository-url> && cd intelichat

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de BD y API Keys
```

### 3. Base de Datos
```bash
# Importar esquema completo
mariadb -u root -p < db.sql
```

### 4. Ejecutar Sistema
```bash
# Terminal 1: Backend (Puerto 3000)
cd intelli_backend
npm start

# Terminal 2: Frontend (Puerto 5001)  
cd chat-vanilla
node server-chat.js
```

## 📋 Variables de Entorno

*(Sin cambios respecto a la versión anterior. Asegúrate de que tu `.env` esté configurado)*.
