const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Hardcoded configuration (as requested for development)
const TELEGRAM_BOT_TOKEN = '7836216417:AAH1RPnj8sgac2O4EYHSc67tmADBfcG2MwI';
const CHANNEL_USERNAME = '@hellocribble'; // Replace with actual channel username
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

class TelegramAudioStreamer {
    constructor() {
        // Ensure uploads directory exists
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR);
        }

        // Initialize Telegram bot
        this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);
        
        // Setup error handling
        this.bot.catch((err) => {
            console.error('Telegraf error', err);
        });
    }

    streamAudio(audioFilePath) {
        console.log(`Streaming audio file: ${audioFilePath}`);
        
        // FFmpeg streaming process
        const ffmpegProcess = spawn('ffmpeg', [
            '-re',           // Read input at native frame rate
            '-i', audioFilePath,  // Input audio file
            '-c:a', 'aac',   // Audio codec
            '-b:a', '128k',  // Audio bitrate
            '-f', 'flv',     // Output format
            'rtmps://dc5-1.rtmp.t.me/s/2440597199:MmadkivdLJONnb79M_OCqw'
        ]);

        // Log FFmpeg output
        ffmpegProcess.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            
            // Optional: Clean up the uploaded file
            fs.unlink(audioFilePath, (err) => {
                if (err) console.error('Failed to delete uploaded file:', err);
            });

            // Optional: Restart streaming or handle completion
            if (code !== 0) {
                console.error('Streaming encountered an error.');
            }
        });
    }

    setupCommands() {
        // Start command to initiate audio upload
        this.bot.command('start', (ctx) => {
            ctx.reply('Please send me an audio file to stream. I support MP3, WAV, and other common audio formats.');
        });

        // Handle audio file upload
        this.bot.on('audio', async (ctx) => {
            try {
                // Download the audio file
                const audioFile = await ctx.telegram.getFile(ctx.message.audio.file_id);
                const filePath = path.join(UPLOADS_DIR, `${Date.now()}_${ctx.message.audio.file_name}`);

                // Download and save the file
                const fileStream = fs.createWriteStream(filePath);
                const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${audioFile.file_path}`;
                
                const https = require('https');
                https.get(fileUrl, (response) => {
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        ctx.reply('Audio file received. Starting stream...');
                        
                        // Stream the audio
                        this.streamAudio(filePath);
                    });
                });
            } catch (error) {
                console.error('Error handling audio file:', error);
                ctx.reply('Sorry, there was an error processing your audio file.');
            }
        });

        // Fallback for other file types
        this.bot.on('document', (ctx) => {
            // Check if the document is an audio file
            const doc = ctx.message.document;
            const audioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
            
            if (audioMimeTypes.includes(doc.mime_type)) {
                ctx.reply('Looks like you sent an audio file. Please use the audio upload feature.');
            } else {
                ctx.reply('Please send an audio file. Other file types are not supported.');
            }
        });
    }

    launch() {
        this.setupCommands();
        
        // Start the bot
        this.bot.launch()
            .then(() => {
                console.log('Telegram bot is running');
            })
            .catch((err) => {
                console.error('Failed to launch bot:', err);
            });

        // Graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}

// Instantiate and launch the bot
const audioStreamer = new TelegramAudioStreamer();
audioStreamer.launch();