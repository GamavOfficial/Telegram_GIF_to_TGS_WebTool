/* Telegram Video Sticker WebM encoder
 * - VP9 first, VP8 fallback only when VP9 is unavailable
 * - <= 3 seconds
 * - <= 30 FPS
 * - adaptive bitrate to stay <= 256 KiB
 * - preserves the GIF's timeline instead of using maxFrames as a duration limiter
 */
class WebmEncoder {
    static getMimeType() {
        const candidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs="vp9"'
        ];
        if (!window.MediaRecorder) return '';
        return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
    }

    static getBitratePlan(detail) {
        if (detail === 'low') return [360000, 300000, 260000, 220000, 180000, 140000, 110000, 90000];
        if (detail === 'high') return [650000, 550000, 480000, 400000, 320000, 260000, 220000, 180000, 140000, 110000, 90000];
        return [560000, 480000, 420000, 360000, 300000, 250000, 210000, 170000, 130000, 100000];
    }

    static async generateWebm(gifData, settings, onProgress) {
        if (!gifData || !gifData.frames?.length) {
            throw new Error('No decoded GIF frames available.');
        }

        const fpsRequested = Math.max(1, Math.min(30, Number(settings.fps) || 30));
        const originalDuration = Math.max(1, Number(gifData.duration) || 1);
        const durationMs = Math.min(3000, originalDuration);
        const maxFramesSetting = Math.max(1, Math.min(90, Number(settings.maxFrames) || 90));

        // Never let the frame limit shorten the video. If fewer frames are requested,
        // lower the actual FPS while keeping the complete timeline.
        const idealFrames = Math.max(1, Math.round(durationMs / 1000 * fpsRequested));
        const frameTotal = Math.min(90, idealFrames, maxFramesSetting);
        const actualFps = Math.max(1, Math.min(30, frameTotal / (durationMs / 1000)));

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) throw new Error('Canvas is not available.');

        const source = document.createElement('canvas');
        source.width = gifData.width;
        source.height = gifData.height;
        const sourceCtx = source.getContext('2d', { alpha: true });
        if (!sourceCtx) throw new Error('Source canvas is not available.');

        const mimeType = this.getMimeType();
        if (!mimeType) throw new Error('Your browser cannot encode WebM. Use current Chrome/Edge.');

        const renderFrame = (frame) => {
            sourceCtx.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0);
            ctx.clearRect(0, 0, 512, 512);
            const scale = Math.min(512 / gifData.width, 512 / gifData.height);
            const dw = Math.max(1, Math.round(gifData.width * scale));
            const dh = Math.max(1, Math.round(gifData.height * scale));
            ctx.drawImage(source, Math.round((512 - dw) / 2), Math.round((512 - dh) / 2), dw, dh);
        };

        // Convert the already-composited GIF frames to a fixed output timeline.
        const frameIndexes = [];
        let timeline = 0;
        let gifIndex = 0;
        for (let i = 0; i < frameTotal; i++) {
            const target = durationMs * (i / frameTotal);
            while (gifIndex < gifData.frames.length - 1 && timeline + gifData.frames[gifIndex].delay <= target) {
                timeline += gifData.frames[gifIndex].delay;
                gifIndex++;
            }
            frameIndexes.push(gifIndex);
        }

        const recordOnce = (bitrate, attemptIndex, totalAttempts) => new Promise((resolve, reject) => {
            const stream = canvas.captureStream(actualFps);
            let recorder;
            try {
                recorder = new MediaRecorder(stream, {
                    mimeType,
                    videoBitsPerSecond: bitrate
                });
            } catch (error) {
                stream.getTracks().forEach(track => track.stop());
                reject(error);
                return;
            }

            const chunks = [];
            let stopped = false;
            let frameNo = 0;
            const start = performance.now();

            const cleanup = () => stream.getTracks().forEach(track => track.stop());
            const fail = error => {
                if (stopped) return;
                stopped = true;
                cleanup();
                try { recorder.stop(); } catch (_) {}
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            recorder.ondataavailable = event => {
                if (event.data && event.data.size) chunks.push(event.data);
            };
            recorder.onerror = () => fail(new Error('WebM recorder error.'));
            recorder.onstop = () => {
                if (stopped) return;
                stopped = true;
                cleanup();
                const blob = new Blob(chunks, { type: 'video/webm' });
                if (!blob.size) {
                    reject(new Error('WebM output is empty.'));
                    return;
                }
                resolve(blob);
            };

            const stopAtEnd = () => {
                if (stopped) return;
                try { recorder.stop(); } catch (error) { fail(error); }
            };

            const tick = () => {
                if (stopped) return;
                if (frameNo < frameTotal) {
                    renderFrame(gifData.frames[frameIndexes[frameNo]]);
                    frameNo++;
                    const progress = 5 + Math.round((frameNo / frameTotal) * 90);
                    onProgress?.(progress, `Encoding ${attemptIndex}/${totalAttempts} • frame ${frameNo}/${frameTotal}`);
                    const nextTime = (frameNo / actualFps) * 1000;
                    const elapsed = performance.now() - start;
                    setTimeout(tick, Math.max(0, nextTime - elapsed));
                } else {
                    // Keep the final frame until the exact requested duration.
                    const elapsed = performance.now() - start;
                    const remaining = Math.max(0, durationMs - elapsed);
                    setTimeout(stopAtEnd, remaining + 10);
                }
            };

            try {
                recorder.start();
                renderFrame(gifData.frames[frameIndexes[0]]);
                requestAnimationFrame(tick);
            } catch (error) {
                fail(error);
            }
        });

        const bitrates = this.getBitratePlan(settings.detail);
        let lastBlob = null;
        for (let i = 0; i < bitrates.length; i++) {
            const bitrate = bitrates[i];
            onProgress?.(5, `Trying Telegram-safe bitrate ${Math.round(bitrate / 1000)} kbps...`);
            const blob = await recordOnce(bitrate, i + 1, bitrates.length);
            lastBlob = blob;

            if (blob.size <= 256 * 1024) {
                onProgress?.(100, `WEBM READY • ${(blob.size / 1024).toFixed(1)} KB • ${Math.min(3, durationMs / 1000).toFixed(2)}s`);
                return blob;
            }
        }

        throw new Error(`Could not reach Telegram's 256 KB limit. Best output: ${(lastBlob.size / 1024).toFixed(1)} KB. Try Low detail.`);
    }
}
