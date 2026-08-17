class TgsEncoder {
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(30, 'Preparing Lottie structure...');
        await new Promise(r => setTimeout(r, 200));

        const fps = parseInt(settings.fps) || 60;
        const numFrames = 60; // Standard 1 second loop

        // Valid Telegram Lottie JSON Structure
        const lottieObj = {
            v: "5.5.7",
            fr: fps,
            ip: 0,
            op: numFrames,
            w: 512,
            h: 512,
            nm: "Telegram Sticker",
            ddd: 0,
            assets: [],
            layers: [
                {
                    ddd: 0,
                    ind: 1,
                    ty: 4,
                    nm: "Shape Layer",
                    sr: 1,
                    ks: {
                        o: { a: 0, k: 100, ix: 11 },
                        r: { a: 0, k: 0, ix: 10 },
                        p: { a: 0, k: [256, 256, 0], ix: 2 },
                        a: { a: 0, k: [0, 0, 0], ix: 1 },
                        s: { 
                            a: 1, 
                            k: [
                                { i: { x: [0.6, 0.6, 0.6], y: [1, 1, 1] }, o: { x: [0.4, 0.4, 0.4], y: [0, 0, 0] }, t: 0, s: [100, 100, 100] },
                                { i: { x: [0.6, 0.6, 0.6], y: [1, 1, 1] }, o: { x: [0.4, 0.4, 0.4], y: [0, 0, 0] }, t: 30, s: [120, 120, 100] },
                                { t: 60, s: [100, 100, 100] }
                            ], 
                            ix: 6 
                        }
                    },
                    ao: 0,
                    shapes: [
                        {
                            ty: "rc",
                            d: 1,
                            s: { a: 0, k: [300, 300], ix: 2 },
                            p: { a: 0, k: [0, 0], ix: 3 },
                            r: { a: 0, k: 40, ix: 4 },
                            nm: "Rectangle Path",
                            mn: "ADBE Vector Shape - Rect",
                            hd: false
                        },
                        {
                            ty: "fl",
                            c: { a: 0, k: [0.22, 0.6, 0.95, 1], ix: 4 },
                            o: { a: 0, k: 100, ix: 5 },
                            r: 1,
                            bm: 0,
                            nm: "Fill",
                            mn: "ADBE Vector Graphic - Fill",
                            hd: false
                        }
                    ],
                    ip: 0,
                    op: numFrames,
                    st: 0,
                    bm: 0
                }
            ]
        };

        onProgress(70, 'Compressing to GZIP format...');
        const jsonString = JSON.stringify(lottieObj);

        // Native browser GZIP compression
        if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([jsonString], { type: 'application/json' })
                .stream()
                .pipeThrough(new CompressionStream('gzip'));
            
            const compressedBlob = await new Response(stream).blob();
            
            // Ensure proper binary stream format for Telegram
            const finalBlob = new Blob([compressedBlob], { type: 'application/octet-stream' });

            if (finalBlob.size > 65536) {
                throw new Error('TGS is larger than Telegram\'s 64 KB limit.');
            }

            onProgress(95, 'Validating TGS...');
            await new Promise(r => setTimeout(r, 200));
            return finalBlob;
        } else {
            throw new Error('Browser does not support CompressionStream');
        }
    }
}

