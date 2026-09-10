'use strict';
const AWS  = require('aws-sdk');
const path = require('path');
require('dotenv').config({ path: '/home/deploy/atalk/backend/.env' });

const s3 = new AWS.S3({
  endpoint:        process.env.DO_SPACES_ENDPOINT,
  accessKeyId:     process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

const BUCKET = process.env.DO_SPACES_BUCKET;

async function listAll(prefix) {
  let keys = [];
  let token;
  do {
    const res = await s3.listObjectsV2({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token
    }).promise();
    keys = keys.concat(res.Contents.map(o => o.Key));
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

(async () => {
  console.log('Listando arquivos no DO Spaces (company2/)...');
  const keys = await listAll('company2/');
  console.log(`Total de arquivos no DO Spaces (company2/): ${keys.length}`);
  
  // Separar por "ano" baseado na data de modificação que seria no key
  // Os keys são apenas nomes de arquivo, não têm data — vamos contar total
  console.log('\nPrimeiros 5 arquivos:');
  keys.slice(0, 5).forEach(k => console.log(' ', k));
  console.log('\nÚltimos 5 arquivos:');
  keys.slice(-5).forEach(k => console.log(' ', k));
})().catch(e => { console.error(e.message); process.exit(1); });
