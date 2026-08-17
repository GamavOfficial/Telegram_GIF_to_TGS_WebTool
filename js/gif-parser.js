/* Self-contained GIF87a/GIF89a parser with LZW decode + frame compositing data. */
class GifParser {
    static async parse(file) {
        const buffer = await file.arrayBuffer();
        const a = new Uint8Array(buffer);
        if (a.length < 13) throw new Error('GIF file is too small.');
        const sig = String.fromCharCode(...a.subarray(0, 6));
        if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('Invalid GIF file.');
        let p = 6;
        const u16 = (i) => a[i] | (a[i + 1] << 8);
        const width = u16(p), height = u16(p + 2), packed = a[p + 4];
        p += 7;
        let globalTable = null;
        if (packed & 0x80) {
            const n = 1 << (1 + (packed & 7));
            globalTable = [];
            for (let i = 0; i < n; i++) globalTable.push([a[p++], a[p++], a[p++]]);
        }
        const frames = [];
        let gce = { delay: 100, transparent: false, transparentIndex: 0, disposal: 0 };
        const skipBlocks = () => { while (p < a.length) { const n = a[p++]; if (!n) break; p += n; } };
        const lzw = (data, minCode, count) => {
            const clear = 1 << minCode, end = clear + 1;
            let codeSize = minCode + 1, next = clear + 2, bit = 0, old = -1, first = 0, outPos = 0;
            const out = new Uint8Array(count), prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4096);
            const readCode = () => {
                let c = 0;
                for (let i = 0; i < codeSize; i++) {
                    const k = bit >> 3; if (k >= data.length) return null;
                    c |= ((data[k] >> (bit & 7)) & 1) << i; bit++;
                }
                return c;
            };
            while (outPos < count) {
                const code = readCode(); if (code === null || code === end) break;
                if (code === clear) { codeSize = minCode + 1; next = clear + 2; old = -1; continue; }
                if (old < 0) { if (code >= clear) break; out[outPos++] = suffix[code]; first = suffix[code]; old = code; continue; }
                const inCode = code; let sp = 0;
                if (code >= next) { stack[sp++] = first; code = old; }
                while (code >= clear && sp < 4096) { stack[sp++] = suffix[code]; code = prefix[code]; }
                if (code < 0 || code >= clear) break;
                first = suffix[code]; stack[sp++] = first;
                while (sp && outPos < count) out[outPos++] = stack[--sp];
                if (next < 4096) { prefix[next] = old; suffix[next] = first; next++; if (next === (1 << codeSize) && codeSize < 12) codeSize++; }
                old = inCode;
            }
            return out;
        };
        const deinterlace = (src, w, h) => {
            const out = new Uint8Array(src.length), starts = [0, 4, 2, 1], steps = [8, 8, 4, 2]; let s = 0;
            for (let pass = 0; pass < 4; pass++) for (let y = starts[pass]; y < h; y += steps[pass]) { out.set(src.subarray(s, s + w), y * w); s += w; }
            return out;
        };
        while (p < a.length) {
            const block = a[p++];
            if (block === 0x3b) break;
            if (block === 0x21) {
                const label = a[p++];
                if (label === 0xf9) {
                    const size = a[p++], start = p, flags = a[p++], delay = u16(p) * 10; p += 2;
                    const transparentIndex = a[p++]; p++;
                    gce = { delay: Math.max(20, delay || 100), transparent: !!(flags & 1), transparentIndex, disposal: (flags >> 2) & 7 };
                    p = start + size + 1;
                } else skipBlocks();
                continue;
            }
            if (block !== 0x2c) throw new Error('Unsupported GIF block.');
            const left = u16(p), top = u16(p + 2), fw = u16(p + 4), fh = u16(p + 6); p += 8;
            const ip = a[p++], local = !!(ip & 0x80), interlace = !!(ip & 0x40);
            let table = globalTable;
            if (local) { const n = 1 << (1 + (ip & 7)); table = []; for (let i = 0; i < n; i++) table.push([a[p++], a[p++], a[p++]]); }
            if (!table) throw new Error('GIF frame has no color table.');
            const minCode = a[p++], parts = []; let total = 0;
            while (p < a.length) { const n = a[p++]; if (!n) break; parts.push(a.slice(p, p + n)); total += n; p += n; }
            const compressed = new Uint8Array(total); let q = 0; for (const part of parts) { compressed.set(part, q); q += part.length; }
            let indices = lzw(compressed, minCode, fw * fh); if (interlace) indices = deinterlace(indices, fw, fh);
            const rgba = new Uint8ClampedArray(fw * fh * 4);
            for (let i = 0; i < fw * fh; i++) { const c = table[indices[i]] || [0, 0, 0]; const alpha = gce.transparent && indices[i] === gce.transparentIndex ? 0 : 255; rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = alpha; }
            frames.push({ left, top, width: fw, height: fh, rgba, delay: gce.delay, disposal: gce.disposal });
        }
        if (!frames.length) throw new Error('GIF contains no frames.');
        return { width, height, frames, frameCount: frames.length, duration: frames.reduce((s, f) => s + f.delay, 0) };
    }
}
