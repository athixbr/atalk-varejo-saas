'use strict';
const AWS  = require('aws-sdk');
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: '/home/deploy/atalk/backend/.env' });

const s3 = new AWS.S3({
  endpoint:        process.env.DO_SPACES_ENDPOINT,
  accessKeyId:     process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

const BUCKET     = process.env.DO_SPACES_BUCKET;
const PUBLIC_DIR = '/home/deploy/atalk/backend/public';
const DRY_RUN    = process.argv[2] !== '--delete';

// Agora pega arquivos de JAN/2026 em diante (sem corte superior — pega tudo)
const FROM = new Date('2026-01-01T00:00:00Z');

async function listAllKeys(prefix) {
  let keys = new Set();
  let token;
  let page = 0;
  do {
    const res = await s3.listObjectsV2({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken: token
    }).promise();
    res.Contents.forEach(o => keys.add(o.Key));
    token = res.NextContinuationToken;
    page++;
    if (page % 10 === 0) process.stderr.write(`  ... ${keys.size} keys carregados\n`);
  } while (token);
  return keys;
}

function findFiles(dir, fromDate) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        files.push(...findFiles(full, fromDate));
      } else if (e.isFile()) {
        const stat = fs.statSync(full);
        if (stat.mtime >= fromDate) {
          files.push(full);
        }
      }
    }
  } catch(e) { /* skip */ }
  return files;
}

(async () => {
  console.error('Carregando lista de arquivos DO Spaces (company2/)...');
  const doKeys = await listAllKeys('company2/');
  console.error(`DO Spaces: ${doKeys.size} arquivos`);

  console.error('\nBuscando arquivos locais a partir de 01/01/2026...');
  const localFiles = findFiles(path.join(PUBLIC_DIR, 'company2'), FROM);
  console.error(`Locais jan-jun/2026: ${localFiles.length} arquivos`);

  let inDO = 0, notInDO = 0;
  const missing = [];

  for (const f of localFiles) {
    const key = path.relative(PUBLIC_DIR, f).split(path.sep).join('/');
    if (doKeys.has(key)) {
      inDO++;
    } else {
      notInDO++;
      missing.push(key);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Arquivos locais jan-jun/2026:   ${localFiles.length}`);
  console.log(`Confirmados na DO Spaces:        ${inDO}`);
  console.log(`NÃO encontrados na DO Spaces:    ${notInDO}`);

  if (missing.length > 0) {
    console.log(`\nArquivos ausentes na DO (primeiros 20):`);
    missing.slice(0, 20).forEach(k => console.log('  FALTA:', k));
    fs.writeFileSync('/tmp/missing-in-do.txt', missing.join('\n'));
    console.log(`Lista completa salva em /tmp/missing-in-do.txt`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Para realmente deletar, rode: node check-and-delete.cjs --delete`);
  } else {
    if (notInDO > 0) {
      console.log(`\nABORTANDO: ${notInDO} arquivos não estão na DO Spaces. Verifique /tmp/missing-in-do.txt`);
      process.exit(1);
    }
    console.log(`\nDeletando ${inDO} arquivos confirmados na DO Spaces...`);
    let deleted = 0;
    for (const f of localFiles) {
      const key = path.relative(PUBLIC_DIR, f).split(path.sep).join('/');
      if (doKeys.has(key)) {
        fs.unlinkSync(f);
        deleted++;
        if (deleted % 1000 === 0) process.stderr.write(`  ... ${deleted} deletados\n`);
      }
    }
    console.log(`\nConcluído: ${deleted} arquivos deletados localmente.`);
  }
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
