const express = require('express');
const axios = require('axios');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const multer = require('multer');
const router = express.Router();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

let lastConvertedMp3Buffer = null; // Store the last converted MP3

// MP3 conversion function
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

// POST route for transcription
router.post('/transcribe', upload.single('audioFile'), async (req, res) => {
    try {
        // Convert WEBM buffer stream to MP3
        const bufferStream = new PassThrough();
        bufferStream.end(req.file.buffer); 
        const mp3Buffer = await convertToMp3(bufferStream);

        // Store MP3 buffer for later listening
        lastConvertedMp3Buffer = mp3Buffer;

        // Upload MP3 file to AssemblyAI
        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', 
            mp3Buffer, 
            { headers: { Authorization: ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' } }
        );

        const uploadUrl = uploadResponse.data.upload_url;

        // Request transcription
        const transcriptionResponse = await axios.post('https://api.assemblyai.com/v2/transcript', 
            { 
                audio_url: uploadUrl,
                punctuate: true,
                format_text: true,
                language_code: 'en_us'
            },
            { headers: { Authorization: ASSEMBLYAI_API_KEY } }
        );

        const transcriptionId = transcriptionResponse.data.id;

        // Poll for transcription result
        let transcriptionResult;
        console.log("Starting polling loop for transcription ID:", transcriptionId);
        while (true) {
            const resultResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptionId}`, 
                { headers: { Authorization: ASSEMBLYAI_API_KEY } }
            );
    
            transcriptionResult = resultResponse.data;
            console.log("Polling attempt - Status:", transcriptionResult.status);

            if (transcriptionResult.status !== 'processing' && transcriptionResult.status !== 'queued') {
                console.log("Exiting loop. Final status:", transcriptionResult.status);
                break;
            }

            const transcriptionText = transcriptionResult.text || "Transcription text not available";
            console.log("Transcribed:", transcriptionText);
            await new Promise(resolve => setTimeout(resolve, 10000)); 
        }

        res.status(200).json(transcriptionResult);
    } catch (error) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

// Route to stream the converted MP3 file
router.get('/listen', (req, res) => {
    if (lastConvertedMp3Buffer) {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': lastConvertedMp3Buffer.length,
        });
        res.end(lastConvertedMp3Buffer);
    } else {
        res.status(404).json({ error: 'No audio available for playback' });
    }
});

module.exports = router;
