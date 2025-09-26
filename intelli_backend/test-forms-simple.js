const http = require('http');

// Función para hacer peticiones HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testEndpoints() {
  console.log('=== Probando endpoints de formularios ===\n');
  
  try {
    // 1. Probar GET schema
    console.log('1. Probando GET /api/forms/1/schema');
    const schemaResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/1/schema',
      method: 'GET'
    });
    console.log(`Status: ${schemaResponse.status}`);
    console.log('Response:', JSON.stringify(schemaResponse.data, null, 2));
    console.log('\n');
    
    // 2. Probar POST nueva ejecución
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
    console.log(`Status: ${executionResponse.status}`);
    console.log('Response:', JSON.stringify(executionResponse.data, null, 2));
    
    if (executionResponse.data && executionResponse.data.data && executionResponse.data.data.execution_uuid) {
      const uuid = executionResponse.data.data.execution_uuid;
      console.log(`UUID obtenido: ${uuid}`);
      
      // 3. Probar GET ejecución por UUID
      console.log('\n3. Probando GET /api/forms/executions/' + uuid);
      const getExecutionResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/forms/executions/' + uuid,
        method: 'GET'
      });
      console.log(`Status: ${getExecutionResponse.status}`);
      console.log('Response:', JSON.stringify(getExecutionResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('Error en las pruebas:', error);
  }
}

testEndpoints();