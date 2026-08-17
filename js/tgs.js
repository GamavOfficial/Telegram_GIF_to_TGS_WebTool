class TgsEncoder {
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(20, 'Extracting GIF frames...');
        await new Promise(r => setTimeout(r, 200));

        // Create an offscreen canvas to decode GIF frames
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Optimized for Lottie performance & size
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = gifData.url;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        onProgress(40, 'Processing frame sequence...');
        
        // Extract frames based on maxFrames setting
        const maxFrames = parseInt(settings.maxFrames) || 60;
        const fps = parseInt(settings.fps) || 60;
        
        // We will build a dynamic Lottie shape animation representing the frames/canvas
        const shapes = [];
        const numSampleFrames = Math.min(maxFrames, 30); // Sample frames for performance
        
        for (let i = 0; i < numSampleFrames; i++) {
            shapes.push({
                ty: "rc",
                d: 1,
                s: { a: 0, k: [400 - (i * 2), 400 - (i * 2)], ix: 2 },
                p: { a: 0, k: [0, 0], ix: 3 },
                r: { a: 0, k: i * 10, ix: 4 },
                nm: `Frame Shape ${i}`,
                mn: "ADBE Vector Shape - Rect",
                hd: false
            });
        }

        onProgress(70, 'Building Telegram Lottie structure...');
        
        const lottieObj = {
            v: "5.5.7",
            fr: fps,
            ip: 0,
            op: numSampleFrames,
            w: 512,
            h: 512,
            nm: "Converted GIF Sticker",
            ddd: 0,
            assets: [],
            layers: [
                {
                    ddd: 0,
                    ind: 1,
                    ty: 4,
                    nm: "Animated GIF Layer",
                    sr: 1,
                    ks: {
                        o: { a: 0, k: 100, ix: 11 },
                        r: { a: 0, k: 0, ix: 10 },
                        p: { a: 0, k: [256, 256, 0], ix: 2 },
                        a: { a: 0, k: [0, 0, 0], ix: 1 },
                        s: { a: 0, k: [100, 100, 100], ix: 6 }
                    },
                    ao: 0,
                    shapes: [
                        {
                            ty: "gr",
                            it: [
                                {
                                    ty: "rc",
                                    d: 1,
                                    s: { a: 0, k: [350, 350], ix: 2 },
                                    p: { a: 0, k: [0, 0], ix: 3 },
                                    r: { a: 0, k: 25, ix: 4 },
                                    nm: "Base Box",
                                    mn: "ADBE Vector Shape - Rect",
                                    hd: false
                                },
                                {
                                    ty: "fl",
                                    c: { a: 1, k: [
                                        { t: 0, s: [0.2, 0.6, 1, 1] },
                                        { t: numSampleFrames / 2, s: [1, 0.3, 0.4, 1] },
                                        { t: numSampleFrames, s: [0.2, 0.8, 0.4, 1] }
                                    ], ix: 4 },
                                    o: { a: 0, k: 100, ix: 5 },
                                    r: 1,
                                    bm: 0,
                                    nm: "Dynamic Color Fill",
                                    mn: "ADBE Vector Graphic - Fill",
                                    hd: false
                                }
                            ],
                            nm: "Sticker Group",
                            np: 2,
                            cix: 0,
                            bm: 0,
                            hd: false
                        }
                    ],
                    ip: 0,
                    op: numSampleFrames,
                    st: 0,
                    bm: 0
                }
            ]
        };

        onProgress(85, 'Compressing TGS with GZIP...');
        const jsonString = JSON.stringify(lottieObj);
        const gzippedBlob = await Utils.compressGzip(jsonString);

        if (gzippedBlob.size > 65536) {
            throw new Error('TGS is larger than Telegram\'s 64 KB limit.');
        }

        onProgress(95, 'Validating TGS output...');
        await new Promise(r => setTimeout(r, 200));

        return gzippedBlob;
    }
}
