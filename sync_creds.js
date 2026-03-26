import fs from 'fs';
import path from 'path';

const credsPath = 'd:/SMART-main/credentials.json';
const envPath = 'd:/SMART-main/.env';

if (fs.existsSync(credsPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    let env = fs.readFileSync(envPath, 'utf8');
    
    // Escape newlines for .env
    const escapedKey = creds.private_key.replace(/\n/g, '\\n');
    
    // Replace the line
    const lines = env.split('\n');
    const newLines = lines.map(line => {
        if (line.startsWith('GOOGLE_PRIVATE_KEY=')) {
            return `GOOGLE_PRIVATE_KEY="${escapedKey}"`;
        }
        return line;
    });
    
    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('Successfully updated .env with private key from credentials.json');
} else {
    console.error('credentials.json not found');
}
