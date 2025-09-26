const http = require('http');

// Función para hacer peticiones HTTP
function makeRequest(options) {
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
    req.end();
  });
}

async function testCatalogs() {
  console.log('=== Probando endpoints de catálogos ===\n');
  
  try {
    // 1. Probar GET países
    console.log('1. Probando GET /api/forms/catalogs/countries');
    const countriesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/catalogs/countries',
      method: 'GET'
    });
    console.log(`Status: ${countriesResponse.status}`);
    console.log('Response:', JSON.stringify(countriesResponse.data, null, 2));
    console.log('\n');
    
    // 2. Probar GET ciudades por país (México = ID 1)
    console.log('2. Probando GET /api/forms/catalogs/cities/1');
    const citiesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/catalogs/cities/1',
      method: 'GET'
    });
    console.log(`Status: ${citiesResponse.status}`);
    console.log('Response:', JSON.stringify(citiesResponse.data, null, 2));
    console.log('\n');
    
    // 3. Probar GET ciudades por país inexistente
    console.log('3. Probando GET /api/forms/catalogs/cities/999');
    const citiesNotFoundResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/forms/catalogs/cities/999',
      method: 'GET'
    });
    console.log(`Status: ${citiesNotFoundResponse.status}`);
    console.log('Response:', JSON.stringify(citiesNotFoundResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error en las pruebas:', error);
  }
}