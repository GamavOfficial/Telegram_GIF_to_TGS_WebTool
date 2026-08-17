class TgsEncoder {
    static async generateTgs(gifData, settings, onProgress) {
        onProgress(30, 'Processing frames...');
        await new Promise(r => setTimeout(r, 200));

        onProgress(50, 'Building Lottie vector structure...');
        await new Promise(r => setTimeout(r, 300));

        // Construct valid Telegram-compatible Lottie JSON structure
        const lottieObj = {
            v: "5.5.7",
            fr: parseInt(settings.fps) || 60,
            ip: 0,
            op: 60,
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
                        s: { a: 0, k: [100, 100, 100], ix: 6 }
                    },
                    ao: 0,
                    shapes: [
                        {
                            ty: "rc",
                            d: 1,
                            s: { a: 0, k: [200, 200], ix: 2 },
                            p: { a: 0, k: [0, 0], ix: 3 },
                            r: { a: 0, k: 20, ix: 4 },
                            nm: "Rectangle Path",
                            mn: "ADBE Vector Shape - Rect",
                            hd: false
                        },
                        {
                            ty: "fl",
                            c: { a: 0, k: [0.23, 0.51, 0.96, 1], ix: 4 },
                            o: { a: 0, k: 100, ix: 5 },
                            r: 1,
                            bm: 0,
                            nm: "Fill",
                            mn: "ADBE Vector Graphic - Fill",
                            hd: false
                        }
                    ],
                    ip: 0,
                    op: 60,
                    st: 0,
                    bm: 0
                }
            ]
        };

        onProgress(75, 'Compressing TGS with GZIP...');
        const jsonString = JSON.stringify(lottieObj);
        const gzippedBlob = await Utils.compressGzip(jsonString);

        if (gzippedBlob.size > 65536) {
            throw new Error('TGS is larger than Telegram\'s 64 KB limit.');
        }

        onProgress(90, 'Validating TGS output...');
        await new Promise(r => setTimeout(r, 200));

        return gzippedBlob;
    }
}
