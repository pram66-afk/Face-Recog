
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const models = [
    "ssd_mobilenet_v1_model-weights_manifest.json",
    "ssd_mobilenet_v1_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1"
];

const baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
const outputDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

models.forEach(file => {
    const url = `${baseUrl}/${file}`;
    const filePath = path.join(outputDir, file);

    console.log(`Downloading ${file}...`);

    const fileStream = fs.createWriteStream(filePath);
    https.get(url, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Completed ${file}`);
        });
    }).on('error', (err) => {
        fs.unlink(filePath, () => { }); // delete partially downloaded file
        console.error(`Error downloading ${file}: ${err.message}`);
    });
});
