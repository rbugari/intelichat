
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testMinifileUpload() {
  try {
    const minifileUrl = process.env.MINIFILE_API_URL || 'http://localhost:3001';
    const filePath = path.join(__dirname, 'package.json');
    const fileBuffer = fs.readFileSync(filePath);
    const tenantId = '1'; // Assuming tenantId 1 for the test
    const uuid = 'test-uuid';
    const originalName = 'package.json';
    const mimeType = 'application/json';

    console.log('Attempting to upload to minifile...');

    const response = await axios.post(`${minifileUrl}/api/storage/put`, fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'x-tenant-id': tenantId,
      },
      params: {
        filePath: `forms/${uuid}/${originalName}`,
        originalName,
        mimeType,
      },
    });

    console.log('Minifile response:', response.data);
  } catch (error) {
    console.error('Error uploading to minifile:');
    if (error.response) {
      console.error('Data:', error.response.data);
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testMinifileUpload();
