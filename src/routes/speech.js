const express = require('express');
const axios = require('axios');
const multer = require('multer');
const router = express.Router();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST route for transcription
router.post('/transcribe', upload.single('audioFile'), async (req, res) => {
    try {
        // Use the original buffer directly from the uploaded file
        const audioBuffer = req.file.buffer;

        // Upload the audio file to AssemblyAI
        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', 
            audioBuffer, 
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

            await new Promise(resolve => setTimeout(resolve, 10000)); 
        }
        
        const transcriptionText = transcriptionResult.text || "Transcription text not available";
        console.log("Transcribed:", transcriptionText);
        res.status(200).json(transcriptionResult);
    } catch (error) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});


module.exports = router;
