class WebmEncoder {
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(20, 'Preparing video conversion pipeline...');
        await new Promise(r => setTimeout(r, 200));

        // 1. Create a canvas for rendering frames (Telegram 512x512 standard)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
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
        const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1000000 });
        
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

            // Draw frames smoothly using requestAnimationFrame to prevent freezing
            let frameCount = 0;
            const maxFrames = 90; // ~3 seconds animation at 30fps

            const renderFrame = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw GIF image onto the center maintaining aspect ratio
                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio);
                const centerShiftX = (canvas.width - img.width * ratio) / 2;
                const centerShiftY = (canvas.height - img.height * ratio) / 2;
                
                ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

                frameCount++;
                onProgress(40 + Math.floor((frameCount / maxFrames) * 50), `Processing frame ${frameCount}/${maxFrames}...`);

                if (frameCount < maxFrames) {
                    requestAnimationFrame(renderFrame);
                } else {
                    setTimeout(() => {
                        mediaRecorder.stop();
                    }, 100);
                }
            };

            requestAnimationFrame(renderFrame);
        });
    }
}
