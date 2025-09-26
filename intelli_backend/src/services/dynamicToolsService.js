console.log('### dynamicToolsService.js - VERSIÓN ACTUALIZADA CARGADA ###');
const Database = require('../database');
const axios = require('axios');
const JsonSchemaValidator = require('../validators/jsonSchemaValidator');

class DynamicToolsService {
  constructor() {
    this.toolsCache = new Map();
    this.tokenCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
  }

  async _getAuthToken(authId) {
    if (this.tokenCache.has(authId)) {
      return this.tokenCache.get(authId);
    }
    const authConfigRows = await Database.query('SELECT config_json FROM cfg_herramienta_auth WHERE id = ?', [authId]);
    if (!authConfigRows.length) throw new Error(`Configuración de autenticación con ID ${authId} no encontrada.`);
    const loginDetails = JSON.parse(authConfigRows[0].config_json);
    const tokenResponse = await axios({ method: loginDetails.method || 'POST', url: loginDetails.token_url, headers: loginDetails.headers || { 'Content-Type': 'application/json' }, data: loginDetails.body });
    const token = tokenResponse.data[loginDetails.token_path];
    if (!token) throw new Error(`Token no encontrado en la respuesta del login.`);
    this.tokenCache.set(authId, token);
    return token;
  }

  async getToolType(toolName) {
    const query = `SELECT tipo FROM cfg_herramienta WHERE nombre = ? AND is_active = 1 LIMIT 1`;
    const results = await Database.query(query, [toolName]);
    if (!results.length) throw new Error(`Herramienta '${toolName}' no encontrada o inactiva en la BD`);
    return results[0].tipo;
  }

  async getRouteConfig(routeName) {
    const cacheKey = `route_${routeName}`;
    const cached = this.toolsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) return cached.data;

    const query = `
        SELECT 
          h.base_url, h.herramienta_auth_id, auth.tipo as auth_type,
          r.path, r.metodo, r.request_body_schema_json
        FROM cfg_herramienta_ruta r
        JOIN cfg_herramienta h ON r.herramienta_id = h.id
        LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
        WHERE r.nombre = ? AND h.is_active = 1 AND r.is_active = 1 LIMIT 1`;
    const results = await Database.query(query, [routeName]);
    if (!results.length) throw new Error(`Ruta de herramienta '${routeName}' no encontrada o inactiva en la BD`);

    const config = results[0];
    if (config.request_body_schema_json) {
        config.request_body_schema = JSON.parse(config.request_body_schema_json);
    }
    
    this.toolsCache.set(cacheKey, { data: config, timestamp: Date.now() });
    return config;
  }

  async makeApiCall(routeName, args) {
    const config = await this.getRouteConfig(routeName);
    let url = `${config.base_url}${config.path}`;
    const method = (config.metodo || 'POST').toUpperCase();

    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const axiosOptions = { method, url, headers, timeout: 30000 };

    // --- AÑADE ESTOS CONSOLE.LOGS ---
    console.log(`[DEBUG dynamicToolsService] Tool Name: ${routeName}`);
    console.log(`[DEBUG dynamicToolsService] Base URL: ${config.base_url}`);
    console.log(`[DEBUG dynamicToolsService] Route Path: ${config.path}`);
    console.log(`[DEBUG dynamicToolsService] Initial Full URL: ${url}`);
    console.log(`[DEBUG dynamicToolsService] Method: ${method}`);
    console.log(`[DEBUG dynamicToolsService] Args received:`, args);
    // --- FIN DE CONSOLE.LOGS ---

    // Clonar args para no modificar el original si es necesario y para manejar los que se usan en el path
    let processedArgs = { ...args };

    // Reemplazar placeholders en la URL si existen (ej. {city})
    for (const key in processedArgs) {
        if (url.includes(`{${key}}`)) {
            url = url.replace(`{${key}}`, processedArgs[key]);
            delete processedArgs[key]; // Eliminar de processedArgs si ya se usó en el path
        }
    }
    axiosOptions.url = url; // Actualizar la URL en axiosOptions

    if (config.herramienta_auth_id) {
        const authConfigRows = await Database.query('SELECT tipo, config_json FROM cfg_herramienta_auth WHERE id = ?', [config.herramienta_auth_id]);
        if (authConfigRows.length > 0) {
            const authConfig = authConfigRows[0];
            if (authConfig.tipo === 'bearer') {
                headers['Authorization'] = `Bearer ${await this._getAuthToken(config.herramienta_auth_id)}`;
            } else if (authConfig.tipo === 'api-key') {
                const apiKeyDetails = JSON.parse(authConfig.config_json);
                if (apiKeyDetails.in === 'query') {
                    axiosOptions.params = { ...axiosOptions.params, [apiKeyDetails.key_name]: apiKeyDetails.key_value };
                } else if (apiKeyDetails.in === 'header') {
                    headers[apiKeyDetails.key_name] = apiKeyDetails.key_value;
                }
            }
        }
    }

    if (method === 'GET') {
        // Para GET, los argumentos restantes van como query params
        axiosOptions.params = processedArgs; // Usar processedArgs aquí
    } else {
        // Para otros métodos, los argumentos van en el body
        if (config.request_body_schema && processedArgs) { // Usar processedArgs aquí
            const validator = new JsonSchemaValidator();
            const validationResult = validator.validate(JSON.stringify(config.request_body_schema), processedArgs); // Usar processedArgs aquí
            if (!validationResult.valid) {
                const errorMessage = `Validación de request body para '${routeName}' falló: ${JSON.stringify(validationResult.errors)}`;
                console.error(`❌ ERROR DE VALIDACIÓN:`, { args: processedArgs, schema: config.request_body_schema, errors: validationResult.errors }); // Usar processedArgs aquí
                return { error: errorMessage, validation_errors: validationResult.errors };
            }
        }
        axiosOptions.data = processedArgs; // Usar processedArgs aquí
    }

    try {
        console.log(`[DEBUG dynamicToolsService] Final URL before axios: ${axiosOptions.url}`);
        console.log(`[DEBUG dynamicToolsService] Request Body/Params before axios:`, axiosOptions.data || axiosOptions.params);
        console.log(`[DEBUG dynamicToolsService] Axios config:`, axiosOptions);
        const response = await axios(axiosOptions);
        console.log(`[DEBUG dynamicToolsService] Axios response status: ${response.status}`);
        console.log(`[DEBUG dynamicToolsService] Axios response data:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`[ERROR dynamicToolsService] Error calling tool ${routeName}:`, error.message);
        if (error.response) {
            console.error(`[ERROR dynamicToolsService] Response status: ${error.response.status}`);
            console.error(`[ERROR dynamicToolsService] Response data:`, error.response.data);
        } else if (error.request) {
            console.error(`[ERROR dynamicToolsService] No response received:`, error.request);
        }
        return { error: error.message };
    }
  }

  async execute(routeNameFromLLM, args) {
    console.log(`[DynamicToolsService] Executing route '${routeNameFromLLM}' with args:`, args);

    // Obtener la configuración completa de la ruta usando el nombre proporcionado por el LLM
    // getRouteConfig ya se encarga de buscar en cfg_herramienta_ruta por nombre y unir con cfg_herramienta
    const config = await this.getRouteConfig(routeNameFromLLM);

    // Ahora, makeApiCall puede ser llamado directamente con la configuración y los argumentos
    return this.makeApiCall(routeNameFromLLM, args);
  }
}

const dynamicToolsService = new DynamicToolsService();

module.exports = { dynamicToolsService };