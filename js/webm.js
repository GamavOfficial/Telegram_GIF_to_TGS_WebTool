class TgsEncoder { // (இதன் பெயரினை WebmEncoder என்றும் மாற்றிக் கொள்ளலாம்)
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(20, 'Preparing video conversion pipeline...');
        await new Promise(r => setTimeout(r, 200));

        // 1. Create a canvas for rendering frames
        const canvas = document.createElement('canvas');
        canvas.width = 512;  // Telegram sticker requirement
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = gifData.url;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        onProgress(40, 'Recording video stream (WebM)...');

        // Check if browser supports MediaRecorder with WebM codec
        const mimeType = 'video/webm; codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error('Browser does not support WebM/VP9 recording.');
        }

        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerRate: 1000000 });
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = async () => {
                onProgress(95, 'Finalizing WebM file...');
                const webmBlob = new Blob(chunks, { type: 'video/webm' });
                
                if (webmBlob.size > 256 * 1024) { // Telegram video sticker limit is 256 KB
                    console.warn('Warning: WebM file is larger than 256 KB.');
                }
                
                onProgress(100, 'WEBM READY');
                resolve(webmBlob);
            };

            mediaRecorder.onerror = (err) => reject(err);

            mediaRecorder.start();

            // Draw frames to canvas in a loop to record the animation
            let frameCount = 0;
            const maxFrames = 90; // ~3 seconds animation
            const interval = setInterval(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw GIF image onto the center of 512x512 canvas maintaining aspect ratio
                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio);
                const centerShiftX = (canvas.width - img.width * ratio) / 2;
                const centerShiftY = (canvas.height - img.height * ratio) / 2;
                
                ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

                frameCount++;
                onProgress(40 + Math.floor((frameCount / maxFrames) * 50), `Processing frame ${frameCount}/${maxFrames}...`);

                if (frameCount >= maxFrames) {
                    clearInterval(interval);
                    mediaRecorder.stop();
                }
            }, 1000 / 30);
        });
    }
}

