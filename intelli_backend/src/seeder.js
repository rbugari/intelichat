const Database = require('./database');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

/**
 * Database seeder for initial data population
 */
class Seeder {
  constructor() {
    this.db = Database;
  }

  /**
   * Run all seeders
   */
  async run() {
    try {
      console.log('🌱 Starting database seeding...');
      
      await this.seedLLMProviders();
      await this.seedTools();
      await this.seedAgents();
      await this.seedPrompts();
      await this.seedChats();
      await this.seedAdminUser();
      await this.seedSystemConfig();
      
      console.log('🎉 Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      throw error;
    }
  }

  /**
   * Seed LLM providers
   */
  async seedLLMProviders() {
    console.log('Seeding LLM providers...');
    
    const providers = [
      {
        name: 'groq',
        display_name: 'Groq',
        description: 'Groq LLM provider with fast inference',
        base_url: 'https://api.groq.com/openai/v1',
        is_active: true
      },
      {
        name: 'openai',
        display_name: 'OpenAI',
        description: 'OpenAI GPT models provider',
        base_url: 'https://api.openai.com/v1',
        is_active: true
      },
      {
        name: 'openrouter',
        display_name: 'OpenRouter',
        description: 'OpenRouter unified API for multiple LLM providers',
        base_url: 'https://openrouter.ai/api/v1',
        is_active: true
      },
      {
        name: 'anthropic',
        display_name: 'Anthropic',
        description: 'Anthropic Claude models provider',
        base_url: 'https://api.anthropic.com/v1',
        is_active: false
      }
    ];

    for (const provider of providers) {
      await this.db.query(`
        INSERT IGNORE INTO llm_providers (name, display_name, description, base_url, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [provider.name, provider.display_name, provider.description, provider.base_url, provider.is_active]);
    }
  }

  /**
   * Seed tools
   */
  async seedTools() {
    console.log('Seeding tools...');
    
    const tools = [
      {
        name: 'findByDotEmail',
        description: 'Buscar carrier por número DOT y email',
        function_schema: JSON.stringify({
          name: 'findByDotEmail',
          description: 'Busca información de un carrier usando número DOT y email',
          parameters: {
            type: 'object',
            properties: {
              dot_number: { type: 'string', description: 'Número DOT del carrier' },
              email: { type: 'string', description: 'Email del carrier' }
            },
            required: ['dot_number', 'email']
          }
        }),
        config: JSON.stringify({
          base_url: 'https://kargho-backend.melpomenia.theworkpc.com',
          endpoint: '/api/fmcsa/find-by-dot-email',
          method: 'POST',
          headers: {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          auth_required: true
        }),
        active: true
      },
      {
        name: 'registerCarrier',
        description: 'Registrar un nuevo carrier en el sistema',
        function_schema: JSON.stringify({
          name: 'registerCarrier',
          description: 'Registra un nuevo carrier con DOT y email',
          parameters: {
            type: 'object',
            properties: {
              dot_number: { type: 'string', description: 'Número DOT del carrier' },
              email: { type: 'string', description: 'Email del carrier' },
              language: { type: 'string', enum: ['es', 'en'], default: 'es', description: 'Idioma preferido' }
            },
            required: ['dot_number', 'email']
          }
        }),
        config: JSON.stringify({
          base_url: 'https://kargho-backend.melpomenia.theworkpc.com',
          endpoint: '/api/fmcsa/register-carrier',
          method: 'POST',
          headers: {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          auth_required: true
        }),
        active: true
      },
      {
        name: 'pendingDocuments',
        description: 'Obtener documentos pendientes de un carrier',
        function_schema: JSON.stringify({
          name: 'pendingDocuments',
          description: 'Obtiene la lista de documentos pendientes para un carrier',
          parameters: {
            type: 'object',
            properties: {
              dot_number: { type: 'string', description: 'Número DOT del carrier' },
              language: { type: 'string', enum: ['es', 'en'], default: 'es', description: 'Idioma preferido' }
            },
            required: ['dot_number']
          }
        }),
        config: JSON.stringify({
          base_url: 'https://kargho-backend.melpomenia.theworkpc.com',
          endpoint: '/api/fmcsa/pending-documents',
          method: 'POST',
          headers: {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          auth_required: true
        }),
        active: true
      },
      {
        name: 'sendPendingDocumentsEmail',
        description: 'Enviar email con documentos pendientes',
        function_schema: JSON.stringify({
          name: 'sendPendingDocumentsEmail',
          description: 'Envía un email al carrier con la lista de documentos pendientes',
          parameters: {
            type: 'object',
            properties: {
              dot_number: { type: 'string', description: 'Número DOT del carrier' },
              language: { type: 'string', enum: ['es', 'en'], default: 'es', description: 'Idioma preferido' }
            },
            required: ['dot_number']
          }
        }),
        config: JSON.stringify({
          base_url: 'https://kargho-backend.melpomenia.theworkpc.com',
          endpoint: '/api/fmcsa/send-pending-documents-email',
          method: 'POST',
          headers: {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          auth_required: true
        }),
        active: true
      }
    ];

    for (const tool of tools) {
      await this.db.query(`
        INSERT IGNORE INTO tools (name, display_name, description, function_definition, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [tool.name, tool.name, tool.description, tool.function_schema, tool.active]);
    }
  }

  /**
   * Seed agents
   */
  async seedAgents() {
    console.log('Seeding agents...');
    
    const agents = [
      {
        name: 'info',
        display_name: 'Agente Info',
        description: 'Agente de información inicial sobre Kargho',
        color_hex: '#3B82F6',
        is_active: true
      },
      {
        name: 'onboarding',
        display_name: 'Agente Onboarding',
        description: 'Agente de onboarding para nuevos carriers',
        color_hex: '#10B981',
        is_active: true
      },
      {
        name: 'clientes',
        display_name: 'Agente Clientes',
        description: 'Agente de atención a clientes existentes',
        color_hex: '#F59E0B',
        is_active: true
      }
    ];

    // First, we need to create a default chat for agents
    await this.db.query(`
      INSERT IGNORE INTO ejec_chat (titulo, chatbot_id, cliente_id, is_active, created_at, updated_at)
      VALUES ('Default Chat', 1, 1, TRUE, NOW(), NOW())
    `);
    
    // Get the chat ID (either newly created or existing)
    const chatRows = await this.db.query(`
      SELECT id FROM ejec_chat WHERE titulo = 'Default Chat' LIMIT 1
    `);
    const chatId = chatRows[0].id;

    for (const agent of agents) {
      const result = await this.db.query(`
        INSERT IGNORE INTO agents (chat_id, name, display_name, description, color_hex, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [chatId, agent.name, agent.display_name, agent.description, agent.color_hex, agent.is_active]);
      
      if (result.insertId) {
        // Assign tools to agents
        const toolIds = await this.db.query('SELECT id FROM tools WHERE is_active = 1');
        for (const tool of toolIds) {
          await this.db.query(`
            INSERT IGNORE INTO agent_tools (agent_id, tool_id, is_active)
            VALUES (?, ?, 1)
          `, [result.insertId, tool.id]);
        }
      }
    }
  }

  /**
   * Seed prompts with Kargho-specific content
   */
  async seedPrompts() {
    console.log('Seeding prompts...');
    
    const prompts = [
      {
        type: 'common',
        language: 'es',
        content: `Eres un agente que devuelve EXCLUSIVAMENTE un objeto JSON válido con las claves:
- say (string)
- control (objeto con handoff_to y set)
- call_tool (objeto con name y args)

No generes texto fuera del JSON. Responde en español y conciso.
Si necesitas datos faltantes (DOT/email), pídelos en 'say' y guarda lo detectado en control.set.
Si necesitas usar una API, coloca call_tool.name y call_tool.args.
Si debes cambiar de agente, establece control.handoff_to con uno de: info|onboarding|clientes.
Nunca inventes datos. Si un paso falla, dilo en 'say' y mantén el agente salvo que corresponda el handoff.`
      },
      {
        type: 'info',
        language: 'es',
        content: `¡Hola! Soy tu asistente de Kargho 👋 Estoy aquí para ayudarte con todo lo que necesites saber sobre nuestra plataforma.

**Mi forma de conversar:**
- Soy amigable, directo y conversacional
- Detecto tus intenciones y necesidades reales
- Te hablo como una persona real, no como un robot
- Adapto mi respuesta a lo que realmente buscas

**¿Qué puedo hacer por ti?**
1. **Al comenzar**, te saludo y pregunto en qué idioma prefieres que hablemos (español o inglés)
2. **Respondo tus dudas** sobre Kargho de manera clara y práctica
3. **Si veo que te interesa trabajar con nosotros**, te pregunto: "¿Tienes número DOT para operar?"
4. **Si confirmas que tienes DOT**, te conecto con nuestro especialista en registro

**Lo que debes saber sobre Kargho:**
🚛 **Loadboard privado** - Solo cargas reales, 100% de visibilidad
🤖 **Tecnología inteligente** - AI + IoT + ELD para optimizar tus rutas
📋 **Autoridad FMCSA** - Broker registrado DOT, todo legal
💰 **Para transportistas serios** - Plataforma diseñada por y para el transporte

**Detecto cuando quieres:**
- Saber si Kargho te conviene
- Buscar más cargas o mejores tarifas
- Entender cómo funciona
- Empezar a trabajar con nosotros

¡Pregúntame lo que necesites! 😊`
      },
      {
        type: 'onboarding',
        language: 'es',
        content: `¡Perfecto! Soy el especialista en registro de Kargho 🎯 

Veo que estás interesado en trabajar con nosotros. Me da mucho gusto poder ayudarte a dar este paso.

**Mi estilo:**
- Directo pero amigable
- Entiendo que tu tiempo es valioso
- Te explico cada paso claramente
- No te presiono, pero sí te guío eficientemente

**Cómo trabajo contigo:**

1. **Si ya sé que tienes DOT** (porque hablaste con mi compañero):
   - Vamos directo al grano
   - Te pido tu número DOT y email para verificar

2. **Si es la primera vez que hablamos:**
   - Me presento como tu especialista en registro
   - Te explico que necesito validar tu información

3. **Una vez que tengo tu DOT y email:**
   - Verifico inmediatamente tu estatus
   - Te digo exactamente qué encontré

4. **Según lo que encuentre:**
   - **Si ya eres cliente**: "¡Genial! Ya estás registrado. Te conecto con soporte"
   - **Si no estás registrado**: "Perfecto, puedes sumarte a Kargho. ¿Quieres que te registre ahora?"
   - **Si hay problema**: Te explico qué pasó y cómo lo solucionamos

5. **SÚPER IMPORTANTE**: 
   - Solo te registro si me dices claramente "SÍ"
   - NO registro automáticamente, siempre pregunto primero
   - Respeto tu decisión si necesitas pensarlo

6. **Cuando te registro exitosamente:**
   - Te felicito y explico los próximos pasos
   - Te doy la bienvenida oficial a Kargho

¡Vamos a hacer esto rápido y sin complicaciones! 🚀`
      },
      {
        type: 'clientes',
        language: 'es',
        content: `¡Hola! Soy tu especialista de soporte en Kargho 🚀

Mi trabajo es asegurarme de que tengas todo listo para empezar a generar ingresos con nosotros.

**Mi personalidad:**
- Soy tu aliado, estoy de tu lado
- Hablo claro y sin rodeos
- Me enfoco en soluciones, no en problemas
- Celebro tus logros y te apoyo en los retos

**Lo que hago por ti:**

1. **Al conectarme contigo:**
   - Te saludo como el cliente valioso que eres
   - Te explico que voy a revisar tu estatus

2. **Inmediatamente reviso tu situación:**
   - Verifico qué documentos necesitas
   - Checo si ya estás listo para operar

3. **Te doy noticias claras:**
   - **Si te faltan documentos**: "Necesitas subir estos documentos en la app para estar 100% listo"
   - **Si ya estás completo**: "¡Excelente! Ya estás listo para operar y generar ingresos"
   - **Si hay algún problema**: Te explico exactamente qué pasa y cómo lo arreglamos

**Mi objetivo:**
Que pases de "casi listo" a "Ready to Operate" lo más rápido posible.

**Detecto cuando:**
- Necesitas ayuda con documentos
- Tienes dudas sobre el proceso
- Estás listo para empezar a trabajar
- Hay algo que te está frenando

¡Vamos a ponerte a generar dinero! 💪`
      },
      {
        type: 'common',
        language: 'en',
        content: `You are an agent that returns EXCLUSIVELY a valid JSON object with the keys:
- say (string)
- control (object with handoff_to and set)
- call_tool (object with name and args)

Do not generate text outside the JSON. Respond in English and be concise.
If you need missing data (DOT/email), ask for it in 'say' and save detected data in control.set.
If you need to use an API, set call_tool.name and call_tool.args.
If you need to change agents, set control.handoff_to with one of: info|onboarding|clientes.
Never invent data. If a step fails, say it in 'say' and maintain the agent unless handoff is appropriate.`
      },
      {
        type: 'info',
        language: 'en',
        content: `Hi there! I'm your Kargho assistant 👋 I'm here to help you with everything you need to know about our platform.

**How I communicate:**
- I'm friendly, direct, and conversational
- I detect your real intentions and needs
- I talk to you like a real person, not a robot
- I adapt my response to what you're actually looking for

**What I can do for you:**
1. **When we start**, I greet you and ask what language you prefer (Spanish or English)
2. **Answer your questions** about Kargho clearly and practically
3. **If I see you're interested in working with us**, I ask: "Do you have a DOT number to operate?"
4. **If you confirm you have DOT**, I connect you with our registration specialist

**What you should know about Kargho:**
🚛 **Private loadboard** - Only real loads, 100% visibility
🤖 **Smart technology** - AI + IoT + ELD to optimize your routes
📋 **FMCSA Authority** - Registered DOT broker, all legal
💰 **For serious carriers** - Platform designed by and for truckers

**I detect when you want to:**
- Know if Kargho is right for you
- Find more loads or better rates
- Understand how it works
- Start working with us

Ask me anything you need! 😊`
      }
    ];
    
    const agents = await this.db.query('SELECT id, name FROM agents');
    
    for (const prompt of prompts) {
      for (const agent of agents) {
        await this.db.query(`
          INSERT IGNORE INTO prompts (agent_id, language, content, is_active)
          VALUES (?, ?, ?, 1)
        `, [agent.id, prompt.language, prompt.content]);
      }
      
      console.log(`  ✓ Loaded ${prompt.language}/${prompt.type} prompt`);
    }
  }

  /**
   * Seed default chats
   */
  async seedChats() {
    console.log('Seeding default chats...');
    
    // The default chat is already created in seedAgents, so we can skip this
    // or add additional chats if needed
    console.log('  ✓ Default chat already exists');
  }

  /**
   * Seed admin user
   */
  async seedAdminUser() {
    console.log('Seeding admin user...');
    
    const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@kargho.com';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await this.db.query(`
      INSERT IGNORE INTO admin_users (email, password_hash, role, is_active)
      VALUES (?, ?, 'super_admin', 1)
    `, [email, hashedPassword]);
    
    console.log(`Admin user created: ${email}`);
  }

  /**
   * Seed system configuration
   */
  async seedSystemConfig() {
    console.log('Seeding system configuration...');
    
    const configs = [
      { key: 'app_name', value: 'Kargho Chat', description: 'Application name' },
      { key: 'app_version', value: '2.0.0', description: 'Application version' },
      { key: 'max_concurrent_chats', value: '10', description: 'Maximum concurrent chats per user' },
      { key: 'default_language', value: 'es', description: 'Default system language' },
      { key: 'session_timeout', value: '1800', description: 'Session timeout in seconds' },
      { key: 'max_message_length', value: '4000', description: 'Maximum message length' },
      { key: 'rate_limit_requests', value: '100', description: 'Rate limit requests per window' },
      { key: 'rate_limit_window', value: '900', description: 'Rate limit window in seconds' }
    ];

    for (const config of configs) {
      await this.db.query(`
        INSERT IGNORE INTO system_config (config_key, config_value, description)
        VALUES (?, ?, ?)
      `, [config.key, config.value, config.description]);
    }
  }

  /**
   * Clear all data (for testing)
   */
  async clear() {
    console.log('🧹 Clearing all seeded data...');
    
    const tables = [
      'conversation_history',
      'chat_sessions', 
      'admin_sessions',
      'tool_logs',
      'tool_usage_stats',
      'tool_cache',
      'system_config',
      'admin_users',
      'prompts',
      'agent_tools',
      'llms_agents',
      'ejec_chat',
      'agents',
      'tools',
      'tool_endpoints',
      'tool_apis',
      'llm_providers'
    ];

    for (const table of tables) {
      await this.db.query(`DELETE FROM ${table}`);
    }
    
    console.log('✅ All data cleared');
  }
}

module.exports = Seeder;