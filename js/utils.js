class Utils {
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    static async compressGzip(stringData) {
        if (typeof CompressionStream !== 'undefined') {
            const blob = new Blob([stringData], { type: 'application/json' });
            const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
            return new Response(stream).blob();
        } else {
            // Fallback or simple array buffer mechanism if needed, 
            // modern browsers support CompressionStream natively.
            throw new Error('Browser does not support CompressionStream');
        }
    }
}

