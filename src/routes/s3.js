const { S3 } = require('@aws-sdk/client-s3');
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const router = express.Router();

// Configure AWS SDK
const s3 = new S3({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
});

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload endpoint
router.post('/upload', upload.single('audioFile'), async (req, res) => {
    const bufferStream = new PassThrough();
    bufferStream.end(req.file.buffer); // Pass the buffer to the stream
    const mp3Buffer = await convertToMp3(bufferStream); // Convert to MP3

    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${Date.now()}_recording.mp3`, // Ensure the key ends with .mp3
        Body: mp3Buffer,
        ContentType: 'audio/mpeg', // Ensure the content type is set correctly
    };

    try {
        const data = await s3.putObject(params);
        console.log('File uploaded successfully:', data);
        res.status(200).send({ url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${params.Key}` });
    } catch (err) {
        console.error('Error uploading to S3:', err);
        res.status(500).send('Error uploading file');
    }
});

// Convert to MP3
const convertToMp3 = (bufferStream) => {
    return new Promise((resolve, reject) => {
        const outputStream = new PassThrough();
        const output = [];

        ffmpeg(bufferStream)
            .toFormat('mp3')
            .audioCodec('libmp3lame')
            .pipe(outputStream); // Pipe the output to the PassThrough stream

        outputStream.on('data', (chunk) => {
            output.push(chunk);
        });

        outputStream.on('end', () => {
            console.log("MP3 conversion complete.");
            resolve(Buffer.concat(output));
        });

        outputStream.on('error', (err) => {
            console.error("Error during conversion:", err);
            reject(err);
        });
    });
};

module.exports = router;

// Upload endpoint
// router.post('/upload', upload.single('audioFile'), async (req, res) => {
//     const params = {
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: `${Date.now()}_${req.file.originalname}`, // Unique file name
//         Body: req.file.buffer,
//         ContentType: req.file.mimetype,
//     };

//     try {
//         // Upload to S3
//         const data = await s3.putObject(params);
//         console.log('File uploaded successfully:', data);
//         res.status(200).send({ url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${params.Key}` });
//     } catch (err) {
//         console.error('Error uploading to S3:', err);
//         res.status(500).send('Error uploading file');
//     }
// });
