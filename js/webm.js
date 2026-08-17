class WebmEncoder {
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(20, 'Preparing video recording pipeline...');
        await new Promise(r => setTimeout(r, 300));

        // 1. Create a canvas for rendering frames (Telegram 512x512 standard)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 2. Use the preview image from DOM so the GIF animation actually plays
        const img = document.getElementById('gifPreviewImg');
        if (!img || !img.src) {
            throw new Error('Preview image not found. Please re-upload the GIF.');
        }

        onProgress(40, 'Recording WebM video stream...');

        // Check browser support for WebM/VP9 codec
        const mimeType = 'video/webm; codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error('Browser does not support WebM/VP9 recording.');
        }

        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1500000 });
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = async () => {
                onProgress(95, 'Finalizing WebM file...');
                const webmBlob = new Blob(chunks, { type: 'video/webm' });
                
                if (webmBlob.size > 256 * 1024) {
                    console.warn('Warning: WebM file is larger than 256 KB.');
                }
                
                onProgress(100, 'WEBM READY');
                resolve(webmBlob);
            };

            mediaRecorder.onerror = (err) => reject(err);

            mediaRecorder.start();

            // 3. Smooth frame rendering loop using requestAnimationFrame
            let frameCount = 0;
            const maxFrames = 120; // ~4 seconds animation recording at 30fps

            const renderFrame = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw GIF image onto the center maintaining correct aspect ratio
                const imgWidth = img.naturalWidth || 512;
                const imgHeight = img.naturalHeight || 512;
                
                const hRatio = canvas.width / imgWidth;
                const vRatio = canvas.height / imgHeight;
                const ratio = Math.min(hRatio, vRatio);
                const centerShiftX = (canvas.width - imgWidth * ratio) / 2;
                const centerShiftY = (canvas.height - imgHeight * ratio) / 2;
                
                ctx.drawImage(img, 0, 0, imgWidth, imgHeight, centerShiftX, centerShiftY, imgWidth * ratio, imgHeight * ratio);

                frameCount++;
                onProgress(40 + Math.floor((frameCount / maxFrames) * 50), `Recording frame ${frameCount}/${maxFrames}...`);

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
