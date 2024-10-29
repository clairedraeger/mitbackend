const { S3 } = require('@aws-sdk/client-s3');
const express = require('express');
const multer = require('multer');
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
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${Date.now()}_${req.file.originalname}`, // Keep original file name
        Body: req.file.buffer, // Use the original buffer
        ContentType: req.file.mimetype, // Set content type to the original mime type
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

module.exports = router;
