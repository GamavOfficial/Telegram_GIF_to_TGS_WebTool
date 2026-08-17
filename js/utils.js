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
            const compressedBlob = await new Response(stream).blob();
            
            // FIX: Force binary octet-stream so Android Chrome doesn't append .txt
            return new Blob([compressedBlob], { type: 'application/octet-stream' });
        } else {
            throw new Error('Browser does not support CompressionStream');
        }
    }
}
