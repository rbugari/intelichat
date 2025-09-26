const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function fixValidationRules() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Obteniendo datos del formulario ID 1...');
    const [rows] = await connection.execute('SELECT validation_rules_json FROM cfg_form WHERE id = 1');
    
    if (!rows.length) {
      console.log('❌ No se encontró el formulario con ID 1');
      return;
    }

    const originalJson = rows[0].validation_rules_json;
    console.log('📄 JSON original:', originalJson);

    // El problema son los escapes dobles en el JSON almacenado
    // Vamos a parsearlo y guardarlo correctamente
    try {
      // Primero intentamos parsear directamente
      const parsed = JSON.parse(originalJson);
      console.log('✅ JSON parseado correctamente');
      console.log(JSON.stringify(parsed, null, 2));
      
      // Guardar de nuevo correctamente serializado
      const correctJson = JSON.stringify(parsed);
      await connection.execute(
        'UPDATE cfg_form SET validation_rules_json = ? WHERE id = 1',
        [correctJson]
      );
      console.log('✅ JSON corregido en la base de datos');
      
    } catch (parseError) {
      console.log('❌ Error parseando JSON:', parseError.message);
      
      // Intentar limpiar el JSON manualmente
      console.log('🛠️ Intentando limpiar el JSON manualmente...');
      
      // Remover escapes innecesarios
      let cleanedJson = originalJson
        .replace(/\\\\/g, '\\') // Reducir escapes dobles
        .replace(/\\"/g, '"')     // Remover escapes de comillas
        .replace(/\\n/g, '\\n')   // Mantener newlines escapados correctamente
        .replace(/\\r/g, '\\r')   // Mantener carriage returns escapados
        .replace(/\\t/g, '\\t');  // Mantener tabs escapados
      
      console.log('🧹 JSON limpiado:', cleanedJson);
      
      try {
        const parsed = JSON.parse(cleanedJson);
        console.log('✅ JSON limpiado parseado correctamente');
        
        // Guardar correctamente
        const correctJson = JSON.stringify(parsed);
        await connection.execute(
          'UPDATE cfg_form SET validation_rules_json = ? WHERE id = 1',
          [correctJson]
        );
        console.log('✅ JSON corregido en la base de datos');
        
      } catch (secondError) {
        console.log('❌ Error parseando JSON limpiado:', secondError.message);
        
        // Crear un JSON válido desde cero
        console.log('🆕 Creando JSON válido desde cero...');
        const validJson = {
          rules: [
            { 
              key: "email", 
              type: "regex", 
              pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", 
              message: "Email inválido" 
            },
            { 
              key: "mensaje", 
              type: "minLength", 
              min: 5, 
              message: "El mensaje es muy corto" 
            }
          ]
        };
        
        await connection.execute(
          'UPDATE cfg_form SET validation_rules_json = ? WHERE id = 1',
          [JSON.stringify(validJson)]
        );
        console.log('✅ Nuevo JSON válido guardado en la base de datos');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    await connection.end();
    console.log('🔚 Conexión cerrada');
  }
}

fixValidationRules();