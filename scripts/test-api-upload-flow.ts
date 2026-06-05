import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// This script tests the full video upload flow using the Backend API endpoints.
// Make sure the server is running (npm run dev) before running this script.

const BASE_URL = 'http://localhost:5000/api/v1';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'strong_password_here';

async function testBackendUploadFlow() {
  console.log('🚀 Starting Backend API Video Upload Test...');

  try {
    // 1. Login to get Access Token
    console.log('🔐 Logging in as Super Admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const accessToken = loginResponse.data.data.accessToken;
    console.log('✅ Logged in successfully!');

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`
    };

    // 2. Initiate Upload
    console.log('⏳ Initiating multipart upload...');
    const initiateResponse = await axios.post(
      `${BASE_URL}/admin/movies/upload/initiate`,
      {
        fileName: 'test-api-video.mp4',
        contentType: 'video/mp4'
      },
      { headers: authHeaders }
    );

    const { uploadId, key } = initiateResponse.data.data;
    console.log(`✅ Upload initiated. ID: ${uploadId}`);

    // 3. Get Presigned URL for Part 1
    console.log('⏳ Requesting presigned URL for Part 1...');
    const presignedResponse = await axios.post(
      `${BASE_URL}/admin/movies/upload/presigned-urls`,
      {
        uploadId,
        key,
        partNumbers: [1]
      },
      { headers: authHeaders }
    );

    const { url } = presignedResponse.data.data[0];
    console.log('✅ Presigned URL received.');

    // 4. Upload Part 1 (Simulating Frontend)
    console.log('⏳ Uploading Part 1 directly to R2...');
    const dummyChunk = Buffer.from('This is a dummy video chunk for API testing.');
    const uploadResult = await axios.put(url, dummyChunk, {
      headers: { 'Content-Type': 'video/mp4' }
    });

    const etag = uploadResult.headers.etag;
    console.log(`✅ Part 1 uploaded. ETag: ${etag}`);

    // 5. Complete Upload
    console.log('⏳ Completing multipart upload via backend...');
    const completeResponse = await axios.post(
      `${BASE_URL}/admin/movies/upload/complete`,
      {
        uploadId,
        key,
        parts: [
          { ETag: etag.replace(/"/g, ''), PartNumber: 1 }
        ]
      },
      { headers: authHeaders }
    );

    const { location } = completeResponse.data.data;
    console.log('\n--- Final Result ---');
    console.log(`Final Video URL: ${location}`);
    console.log('---------------------\n');

    // 6. Test Bunny CDN Access
    const bunnyUrl = location.replace(/https:\/\/.*\.r2\.cloudflarestorage\.com\/.*?\//, 'https://uremz-video-stream.b-cdn.net/');
    console.log(`Try Bunny CDN Link: ${bunnyUrl}`);

  } catch (error: any) {
    console.error('❌ Test failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testBackendUploadFlow();
