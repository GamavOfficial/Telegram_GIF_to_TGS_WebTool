class WebmEncoder {
    static getMimeType() {
        const candidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        return candidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    }

    static async generateWebm(gifData, settings, onProgress) {
        if (!gifData || !gifData.frames?.length) throw new Error('No decoded GIF frames available.');
        const fps = Math.max(1, Math.min(60, Number(settings.fps) || 30));
        const maxFrames = Math.max(1, Math.min(180, Number(settings.maxFrames) || 90));
        const durationMs = Math.min(3000, gifData.duration);
        const frameTotal = Math.max(1, Math.min(maxFrames, Math.ceil(durationMs / 1000 * fps)));
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
        const mimeType = this.getMimeType();
        if (!mimeType) throw new Error('This browser cannot record WebM. Use current Chrome/Edge.');
        const stream = canvas.captureStream(fps);
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1500000 });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

        // Build one composited RGBA canvas frame at a time from the decoded GIF.
        const renderSource = document.createElement('canvas');
        renderSource.width = gifData.width; renderSource.height = gifData.height;
        const sourceCtx = renderSource.getContext('2d', { willReadFrequently: true });
        let gifIndex = 0, elapsed = 0;
        let previous = null;
        const drawGifFrame = (f) => sourceCtx.putImageData(new ImageData(f.rgba, f.width, f.height), f.left, f.top);

        const drawOutput = () => {
            const scale = Math.min(512 / gifData.width, 512 / gifData.height);
            const dw = gifData.width * scale, dh = gifData.height * scale;
            ctx.clearRect(0, 0, 512, 512);
            ctx.drawImage(renderSource, (512 - dw) / 2, (512 - dh) / 2, dw, dh);
        };

        return new Promise((resolve, reject) => {
            let stopped = false;
            const fail = e => { if (stopped) return; stopped = true; try { recorder.stop(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
            recorder.onerror = e => fail(new Error('WebM recorder error.'));
            recorder.onstop = () => {
                if (stopped && chunks.length === 0) return;
                const blob = new Blob(chunks, { type: 'video/webm' });
                if (!blob.size) return reject(new Error('WebM output is empty.'));
                onProgress(100, 'WEBM READY');
                resolve(blob);
            };

            try {
                recorder.start(1000);
            } catch (e) { return fail(e); }

            const start = performance.now();
            let frameNo = 0;
            const tick = () => {
                if (stopped) return;
                const target = Math.min(durationMs, frameNo * (1000 / fps));
                // Advance GIF frames to the frame that should be visible at this timestamp.
                while (gifIndex < gifData.frames.length - 1 && elapsed + gifData.frames[gifIndex].delay <= target) {
                    const f = gifData.frames[gifIndex];
                    if (f.disposal === 3) previous = sourceCtx.getImageData(0, 0, gifData.width, gifData.height);
                    drawGifFrame(f);
                    elapsed += f.delay;
                    if (f.disposal === 2) sourceCtx.clearRect(f.left, f.top, f.width, f.height);
                    else if (f.disposal === 3 && previous) sourceCtx.putImageData(previous, 0, 0);
                    gifIndex++;
                }
                if (gifIndex === 0) { drawGifFrame(gifData.frames[0]); elapsed = gifData.frames[0].delay; }
                drawOutput();
                frameNo++;
                onProgress(10 + Math.min(85, Math.round(frameNo / frameTotal * 85)), `Recording frame ${frameNo}/${frameTotal}...`);
                if (frameNo >= frameTotal) {
                    setTimeout(() => { if (!stopped) { stopped = true; try { recorder.stop(); } catch (e) { reject(e); } } }, Math.ceil(1000 / fps));
                    return;
                }
                const nextTarget = frameNo * (1000 / fps);
                const wait = Math.max(0, nextTarget - (performance.now() - start));
                setTimeout(tick, Math.max(1, wait));
            };
            // Give MediaRecorder one rendering tick before starting frame timing.
            drawGifFrame(gifData.frames[0]);
            drawOutput();
            requestAnimationFrame(tick);
        });
    }
}
