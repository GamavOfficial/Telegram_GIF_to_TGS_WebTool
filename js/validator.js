class WebmValidator {
    static validate(blob, maxDurationMs = 3000, maxBytes = 256 * 1024) {
        return new Promise(resolve => {
            if (!blob || blob.size === 0) {
                resolve({ valid: false, message: 'Generated WebM is empty.' });
                return;
            }
            if (blob.size > maxBytes) {
                resolve({ valid: false, message: `WebM is ${(blob.size / 1024).toFixed(1)} KB; Telegram limit is 256 KB.` });
                return;
            }

            const url = URL.createObjectURL(blob);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const finish = result => {
                URL.revokeObjectURL(url);
                video.removeAttribute('src');
                video.load();
                resolve(result);
            };

            video.onloadedmetadata = () => {
                const duration = Number(video.duration);
                if (!Number.isFinite(duration) || duration <= 0) {
                    finish({ valid: false, message: 'Could not read WebM duration.' });
                    return;
                }
                if (duration > (maxDurationMs / 1000) + 0.08) {
                    finish({ valid: false, message: `WebM duration is ${duration.toFixed(2)}s; maximum is 3.00s.` });
                    return;
                }
                finish({ valid: true, duration });
            };
            video.onerror = () => finish({ valid: false, message: 'Generated WebM cannot be decoded by this browser.' });
            video.src = url;
        });
    }
}
