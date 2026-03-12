const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load .env into process.env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NGROK_AUTHTOKEN=')) {
      const value = trimmed.slice('NGROK_AUTHTOKEN='.length).trim();
      process.env.NGROK_AUTHTOKEN = value.replace(/^["']|["']$/g, '');
      break;
    }
  }
}

const port = process.env.PORT || 1337;
const authtoken = process.env.NGROK_AUTHTOKEN || '3A4OnPDmPAjAMmLTrBNcf1UHQAe_7CUkNQ2MM3XZoF4cXNRrj';

if (!authtoken) {
  console.error('Missing NGROK_AUTHTOKEN. Add it to .env');
  console.error('Get your token: https://dashboard.ngrok.com/get-started/your-authtoken');
  process.exit(1);
}

// Use official ngrok CLI so we get a current agent (npm package bundles an old one that can "fail to start tunnel")
const child = spawn('ngrok', ['http', String(port)], {
  stdio: 'inherit',
  env: { ...process.env, NGROK_AUTHTOKEN: authtoken },
  shell: true,
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('');
    console.error('ngrok CLI not found. Install the official ngrok:');
    console.error('  https://ngrok.com/download');
    console.error('  or: winget install ngrok.ngrok   (Windows)');
    console.error('  or: choco install ngrok');
    console.error('');
    console.error('Then run "npm run tunnel" again.');
  } else {
    console.error('ngrok error:', err.message);
  }
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(code !== null ? code : signal ? 1 : 0);
});
