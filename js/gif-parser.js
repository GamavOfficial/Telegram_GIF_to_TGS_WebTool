/*
 * Robust GIF87a/GIF89a parser.
 * - Parses global/local color tables
 * - Decodes LZW image data correctly
 * - Supports interlaced frames
 * - Applies GIF transparency
 * - Composites disposal methods 0/1/2/3
 * - Returns FULL composited RGBA frames so the WebM encoder never has to
 *   reconstruct GIF disposal state.
 */
class GifParser {
    static async parse(file) {
        if (!file || typeof file.arrayBuffer !== 'function') {
            throw new Error('Invalid GIF file.');
        }

        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (data.length < 13) throw new Error('GIF file is too small.');

        const signature = String.fromCharCode(...data.subarray(0, 6));
        if (signature !== 'GIF87a' && signature !== 'GIF89a') {
            throw new Error('Invalid GIF signature.');
        }

        let p = 6;
        const readU8 = () => {
            if (p >= data.length) throw new Error('Unexpected end of GIF.');
            return data[p++];
        };
        const readU16 = () => {
            if (p + 1 >= data.length) throw new Error('Unexpected end of GIF.');
            const value = data[p] | (data[p + 1] << 8);
            p += 2;
            return value;
        };
        const readSubBlocks = () => {
            const chunks = [];
            let total = 0;
            while (true) {
                const size = readU8();
                if (size === 0) break;
                if (p + size > data.length) throw new Error('Corrupt GIF sub-block.');
                chunks.push(data.slice(p, p + size));
                total += size;
                p += size;
            }
            const out = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
                out.set(chunk, offset);
                offset += chunk.length;
            }
            return out;
        };
        const readColorTable = (sizeBits) => {
            const count = 1 << (sizeBits + 1);
            const table = new Array(count);
            for (let i = 0; i < count; i++) {
                table[i] = [readU8(), readU8(), readU8()];
            }
            return table;
        };

        const screenWidth = readU16();
        const screenHeight = readU16();
        const packed = readU8();
        readU8(); // background color index
        readU8(); // pixel aspect ratio

        if (!screenWidth || !screenHeight) {
            throw new Error('GIF has invalid dimensions.');
        }
        if (screenWidth * screenHeight > 4096 * 4096) {
            throw new Error('GIF resolution is too large.');
        }

        let globalTable = null;
        if (packed & 0x80) {
            globalTable = readColorTable(packed & 0x07);
        }

        const decodeLzw = (compressed, minCodeSize, expectedCount) => {
            if (minCodeSize < 2 || minCodeSize > 8) {
                throw new Error('Unsupported GIF LZW code size.');
            }

            const clearCode = 1 << minCodeSize;
            const endCode = clearCode + 1;
            const maxDictionary = 4096;
            let codeSize = minCodeSize + 1;
            let nextCode = clearCode + 2;
            let bitPos = 0;
            let oldCode = -1;
            let firstChar = 0;

            const prefix = new Int16Array(maxDictionary);
            const suffix = new Uint8Array(maxDictionary);
            const stack = new Uint8Array(maxDictionary);
            const output = new Uint8Array(expectedCount);
            let outPos = 0;

            const readCode = () => {
                if (bitPos + codeSize > compressed.length * 8) return null;
                let code = 0;
                for (let i = 0; i < codeSize; i++) {
                    const byteIndex = bitPos >> 3;
                    const bitIndex = bitPos & 7;
                    code |= ((compressed[byteIndex] >> bitIndex) & 1) << i;
                    bitPos++;
                }
                return code;
            };

            while (outPos < expectedCount) {
                let code = readCode();
                if (code === null) break;

                if (code === clearCode) {
                    codeSize = minCodeSize + 1;
                    nextCode = clearCode + 2;
                    oldCode = -1;
                    continue;
                }
                if (code === endCode) break;
                if (code < 0 || code >= maxDictionary) {
                    throw new Error('Invalid GIF LZW code.');
                }

                if (oldCode === -1) {
                    if (code >= clearCode) throw new Error('Invalid first GIF LZW code.');
                    output[outPos++] = code;
                    firstChar = code;
                    oldCode = code;
                    continue;
                }

                const inCode = code;
                let stackSize = 0;

                if (code === nextCode) {
                    stack[stackSize++] = firstChar;
                    code = oldCode;
                } else if (code > nextCode) {
                    throw new Error('Invalid GIF LZW dictionary reference.');
                }

                while (code >= clearCode) {
                    if (code >= nextCode || stackSize >= maxDictionary) {
                        throw new Error('Corrupt GIF LZW dictionary.');
                    }
                    stack[stackSize++] = suffix[code];
                    code = prefix[code];
                }

                if (code < 0 || code >= clearCode) {
                    throw new Error('Invalid GIF LZW base code.');
                }

                firstChar = code;
                stack[stackSize++] = firstChar;

                while (stackSize > 0 && outPos < expectedCount) {
                    output[outPos++] = stack[--stackSize];
                }

                if (nextCode < maxDictionary) {
                    prefix[nextCode] = oldCode;
                    suffix[nextCode] = firstChar;
                    nextCode++;
                    if (nextCode === (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                }

                oldCode = inCode;
            }

            if (outPos !== expectedCount) {
                throw new Error(`GIF frame decode failed (${outPos}/${expectedCount} pixels).`);
            }
            return output;
        };

        const deinterlace = (src, width, height) => {
            const out = new Uint8Array(src.length);
            const starts = [0, 4, 2, 1];
            const steps = [8, 8, 4, 2];
            let sourceOffset = 0;
            for (let pass = 0; pass < 4; pass++) {
                for (let y = starts[pass]; y < height; y += steps[pass]) {
                    out.set(src.subarray(sourceOffset, sourceOffset + width), y * width);
                    sourceOffset += width;
                }
            }
            return out;
        };

        const canvasSize = screenWidth * screenHeight;
        let canvas = new Uint8ClampedArray(canvasSize * 4);
        let gce = {
            delay: 100,
            transparent: false,
            transparentIndex: 0,
            disposal: 0
        };

        const frames = [];
        let loopCount = null;

        while (p < data.length) {
            const block = readU8();

            if (block === 0x3b) break; // trailer

            if (block === 0x21) {
                const label = readU8();

                if (label === 0xf9) {
                    const size = readU8();
                    if (size !== 4) throw new Error('Invalid Graphic Control Extension.');

                    const flags = readU8();
                    const delayCs = readU16();
                    const transparentIndex = readU8();
                    readU8(); // block terminator

                    gce = {
                        delay: Math.max(20, delayCs * 10 || 100),
                        transparent: !!(flags & 1),
                        transparentIndex,
                        disposal: (flags >> 2) & 7
                    };
                } else if (label === 0xff) {
                    const appSize = readU8();
                    if (p + appSize > data.length) throw new Error('Corrupt application extension.');
                    const appId = String.fromCharCode(...data.subarray(p, p + appSize));
                    p += appSize;
                    const appData = readSubBlocks();

                    // NETSCAPE2.0 / ANIMEXTS1.0 loop extension.
                    if ((appId.startsWith('NETSCAPE') || appId.startsWith('ANIMEXTS')) && appData.length >= 3 && appData[0] === 1) {
                        loopCount = appData[1] | (appData[2] << 8);
                    }
                } else {
                    readSubBlocks();
                }
                continue;
            }

            if (block !== 0x2c) {
                throw new Error(`Unsupported GIF block: 0x${block.toString(16)}`);
            }

            const left = readU16();
            const top = readU16();
            const frameWidth = readU16();
            const frameHeight = readU16();
            const imagePacked = readU8();

            if (!frameWidth || !frameHeight || left + frameWidth > screenWidth || top + frameHeight > screenHeight) {
                throw new Error('GIF frame dimensions are invalid.');
            }

            let colorTable = globalTable;
            if (imagePacked & 0x80) {
                colorTable = readColorTable(imagePacked & 0x07);
            }
            if (!colorTable) throw new Error('GIF frame has no color table.');

            const minCodeSize = readU8();
            const compressed = readSubBlocks();
            let indices = decodeLzw(compressed, minCodeSize, frameWidth * frameHeight);

            if (imagePacked & 0x40) {
                indices = deinterlace(indices, frameWidth, frameHeight);
            }

            // Disposal method 3 means restore the canvas to the state before this frame.
            const restoreCanvas = gce.disposal === 3 ? canvas.slice() : null;

            // Draw this frame onto the current composited canvas.
            for (let y = 0; y < frameHeight; y++) {
                for (let x = 0; x < frameWidth; x++) {
                    const index = indices[y * frameWidth + x];
                    if (gce.transparent && index === gce.transparentIndex) continue;

                    const color = colorTable[index];
                    if (!color) throw new Error('GIF references an invalid color index.');

                    const dst = ((top + y) * screenWidth + (left + x)) * 4;
                    canvas[dst] = color[0];
                    canvas[dst + 1] = color[1];
                    canvas[dst + 2] = color[2];
                    canvas[dst + 3] = 255;
                }
            }

            // Store a FULL composited frame. This makes WebM rendering deterministic.
            frames.push({
                left: 0,
                top: 0,
                width: screenWidth,
                height: screenHeight,
                rgba: canvas.slice(),
                delay: gce.delay,
                disposal: 1
            });

            // Apply the current frame's disposal before decoding the next frame.
            if (gce.disposal === 2) {
                for (let y = top; y < top + frameHeight; y++) {
                    const start = (y * screenWidth + left) * 4;
                    canvas.fill(0, start, start + frameWidth * 4);
                }
            } else if (gce.disposal === 3 && restoreCanvas) {
                canvas = restoreCanvas;
            }

            // Graphic Control Extension applies only to the next image.
            gce = {
                delay: 100,
                transparent: false,
                transparentIndex: 0,
                disposal: 0
            };
        }

        if (!frames.length) throw new Error('GIF contains no image frames.');

        return {
            width: screenWidth,
            height: screenHeight,
            frames,
            frameCount: frames.length,
            duration: frames.reduce((sum, frame) => sum + frame.delay, 0),
            loopCount
        };
    }
}
