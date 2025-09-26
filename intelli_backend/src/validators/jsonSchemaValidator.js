const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Validador JSON Schema para cfg_herramienta_ruta
 * Implementa validación robusta de parámetros de herramientas usando JSON Schema
 */
class JsonSchemaValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      removeAdditional: false,
      useDefaults: true,
      coerceTypes: true
    });
    
    // Agregar formatos estándar (email, date, uri, etc.)
    addFormats(this.ajv);
    
    // Agregar formatos personalizados si es necesario
    this.addCustomFormats();
  }

  /**
   * Valida datos contra un esquema JSON Schema
   * @param {string} schemaJson - JSON Schema como string
   * @param {object} data - Datos a validar
   * @returns {object} Resultado de validación { valid, errors, data }
   */
  validate(schemaJson, data) {
    try {
      // Parsear el esquema JSON
      const schema = JSON.parse(schemaJson);
      
      // Compilar el esquema
      const validate = this.ajv.compile(schema);
      
      // Validar los datos
      const valid = validate(data);
      
      return {
        valid,
        errors: validate.errors || [],
        data: data // Datos potencialmente modificados por coerción/defaults
      };
    } catch (parseError) {
      return {
        valid: false,
        errors: [{
          instancePath: '',
          schemaPath: '',
          keyword: 'parse',
          message: `Error parsing JSON Schema: ${parseError.message}`
        }],
        data: null
      };
    }
  }

  /**
   * Valida y separa parámetros por ubicación (query, path, header, body)
   * @param {string} schemaJson - JSON Schema como string
   * @param {object} requestData - Datos de la request { query, params, headers, body }
   * @returns {object} Resultado de validación con parámetros organizados
   */
  validateByLocation(schemaJson, requestData) {
    try {
      const schema = JSON.parse(schemaJson);
      const { properties = {} } = schema;
      
      // Organizar parámetros por ubicación
      const organizedData = {};
      const locationMap = {
        query: requestData.query || {},
        path: requestData.params || {},
        header: requestData.headers || {},
        body: requestData.body || {}
      };

      // Extraer parámetros según su ubicación definida en el schema
      Object.keys(properties).forEach(paramName => {
        const paramSchema = properties[paramName];
        const location = paramSchema.location || 'body'; // Default a body
        
        if (locationMap[location] && locationMap[location][paramName] !== undefined) {
          organizedData[paramName] = locationMap[location][paramName];
        }
      });

      // Validar los datos organizados
      const result = this.validate(schemaJson, organizedData);
      
      return {
        ...result,
        organizedData,
        locationMap: this.getLocationMap(schema)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          instancePath: '',
          schemaPath: '',
          keyword: 'organization',
          message: `Error organizing parameters: ${error.message}`
        }],
        data: null
      };
    }
  }

  /**
   * Obtiene un mapa de parámetros por ubicación
   * @param {object} schema - JSON Schema parseado
   * @returns {object} Mapa de ubicaciones
   */
  getLocationMap(schema) {
    const { properties = {} } = schema;
    const locationMap = {
      query: [],
      path: [],
      header: [],
      body: []
    };

    Object.keys(properties).forEach(paramName => {
      const paramSchema = properties[paramName];
      const location = paramSchema.location || 'body';
      
      if (locationMap[location]) {
        locationMap[location].push(paramName);
      }
    });

    return locationMap;
  }

  /**
   * Formatea errores de validación para respuesta de API
   * @param {array} errors - Array de errores de AJV
   * @returns {array} Errores formateados
   */
  formatErrors(errors) {
    return errors.map(error => ({
      field: error.instancePath.replace('/', '') || error.params?.missingProperty || 'root',
      message: error.message,
      value: error.data,
      constraint: error.keyword
    }));
  }

  /**
   * Agrega formatos personalizados al validador
   */
  addCustomFormats() {
    // Formato para DOT numbers (ejemplo específico del dominio)
    this.ajv.addFormat('dot-number', {
      type: 'string',
      validate: (data) => /^\d{1,7}$/.test(data)
    });

    // Formato para códigos de estado HTTP
    this.ajv.addFormat('http-status', {
      type: 'number',
      validate: (data) => data >= 100 && data <= 599
    });
  }

  /**
   * Valida si un string es un JSON Schema válido
   * @param {string} schemaJson - JSON Schema como string
   * @returns {object} Resultado de validación del schema
   */
  validateSchema(schemaJson) {
    try {
      const schema = JSON.parse(schemaJson);
      
      // Validar que tenga la estructura básica de JSON Schema
      if (!schema.type && !schema.properties && !schema.$ref) {
        return {
          valid: false,
          error: 'Schema must have type, properties, or $ref'
        };
      }

      // Intentar compilar el schema
      this.ajv.compile(schema);
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = JsonSchemaValidator;