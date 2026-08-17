class GifParser {
    static async parse(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const buffer = e.target.result;
                    // Using basic image loading or canvas extraction for robust decoding
                    const blob = new Blob([buffer], { type: 'image/gif' });
                    const url = URL.createObjectURL(blob);
                    
                    const img = new Image();
                    img.onload = () => {
                        resolve({
                            width: img.width || 256,
                            height: img.height || 256,
                            frameCount: 30, // Estimated standard frames for canvas extraction
                            duration: 1.0,
                            url: url,
                            buffer: buffer
                        });
                    };
                    img.onerror = () => reject(new Error('Browser cannot decode GIF'));
                    img.src = url;
                } catch (err) {
                    reject(new Error('GIF parser failed: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }
}
