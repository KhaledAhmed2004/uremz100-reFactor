import { s3 } from '../src/app/middlewares/fileHandler';
import config from '../src/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly for the test script
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testR2() {
  console.log('Testing R2 Upload...');
  const bucket = config.r2.bucketName || process.env.AWS_S3_BUCKET;
  console.log('Using Bucket:', bucket);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: 'test-folder/hello.txt',
    Body: 'Hello from uremz100-reFactor!',
    ContentType: 'text/plain',
  });

  try {
    const res = await s3.send(command);
    console.log('Upload Success! ETag:', res.ETag);
    console.log('✅ File uploaded successfully to R2!');
  } catch (error) {
    console.error('❌ Upload Failed:', error);
  }
}

testR2();
