const http = require('http');

// Función para hacer peticiones HTTP
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testEndpoints() {
  console.log('=== Probando endpoints de formularios ===\n');
  
  try {
    // 1. Probar obtener schema de formulario
    console.log('1. Probando GET /api/forms/1/schema');
    const schemaResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/1/schema',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${schemaResponse.statusCode}`);
    if (schemaResponse.statusCode === 200) {
      const schema = JSON.parse(schemaResponse.body);
      console.log(`   Schema obtenido: ${schema.form_name || 'N/A'}`);
      console.log(`   Campos: ${Object.keys(schema.schema?.properties || {}).join(', ')}`);
    } else {
      console.log(`   Error: ${schemaResponse.body}`);
    }
    
    console.log('');
    
    // 2. Probar crear nueva ejecución
    console.log('2. Probando POST /api/forms/1/executions');
    const executionResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/1/executions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${executionResponse.statusCode}`);
    if (executionResponse.statusCode === 201) {
      const execution = JSON.parse(executionResponse.body);
      console.log(`   UUID generado: ${execution.uuid}`);
      
      // 3. Probar consultar ejecución por UUID
      console.log('\n3. Probando GET /api/forms/executions/' + execution.uuid);
      const getExecutionResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/forms/executions/' + execution.uuid,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${getExecutionResponse.statusCode}`);
      if (getExecutionResponse.statusCode === 200) {
        const execData = JSON.parse(getExecutionResponse.body);
        console.log(`   Ejecución encontrada: ${execData.uuid}`);
        console.log(`   Estado: ${execData.status}`);
      } else {
        console.log(`   Error: ${getExecutionResponse.body}`);
      }
      
    } else {
      console.log(`   Error: ${executionResponse.body}`);
    }
    
    console.log('');
    
    // 4. Probar catálogos
    console.log('4. Probando GET /api/forms/catalogs/countries');
    const countriesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/catalogs/countries',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${countriesResponse.statusCode}`);
    if (countriesResponse.statusCode === 200) {
      const countries = JSON.parse(countriesResponse.body);
      console.log(`   Países disponibles: ${countries.length}`);
    } else {
      console.log(`   Error: ${countriesResponse.body}`);
    }
    
    console.log('\n=== Pruebas completadas ===');
    
  } catch (error) {
    console.error('Error durante las pruebas:', error.message);
  }
}

testEndpoints();