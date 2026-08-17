document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const gifFileInput = document.getElementById('gifFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInfo = document.getElementById('fileInfo');
    const infoName = document.getElementById('infoName');
    const infoSize = document.getElementById('infoSize');
    const infoRes = document.getElementById('infoRes');
    const infoFrames = document.getElementById('infoFrames');
    const infoDuration = document.getElementById('infoDuration');
    
    const buildBtn = document.getElementById('buildBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const gifPreviewImg = document.getElementById('gifPreviewImg');
    const placeholderText = document.querySelector('.placeholder-text');
    const validationResult = document.getElementById('validationResult');
    const downloadBtn = document.getElementById('downloadBtn');

    let selectedGif = null;
    let parsedGif = null;

    // Handle click & drag-drop upload
    if (uploadZone && gifFileInput) {
        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gifFileInput.click();
            });
        }

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('border-primary');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('border-primary');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('border-primary');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        gifFileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFile(file);
        });
    }

    async function handleFile(file) {
        if (!file || (!file.type.includes('gif') && !/\.gif$/i.test(file.name))) {
            alert('தயவுசெய்து ஒரு சரியான GIF ஃபைலை மட்டும் தேர்ந்தெடுக்கவும்!');
            return;
        }
        try {
            const parsed = await GifParser.parse(file);
            parsedGif = parsed;
            const previewUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                selectedGif = { file, url: previewUrl, width: parsed.width, height: parsed.height, name: file.name };
                if (gifPreviewImg) { gifPreviewImg.src = previewUrl; gifPreviewImg.classList.remove('hidden'); }
                if (placeholderText) placeholderText.classList.add('hidden');
                if (fileInfo) {
                    fileInfo.classList.remove('hidden');
                    if (infoName) infoName.textContent = file.name;
                    if (infoSize) infoSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
                    if (infoRes) infoRes.textContent = `${parsed.width} x ${parsed.height}`;
                    if (infoFrames) infoFrames.textContent = `${parsed.frameCount} frames`;
                    if (infoDuration) infoDuration.textContent = `${(parsed.duration / 1000).toFixed(2)}s`;
                }
                if (buildBtn) buildBtn.removeAttribute('disabled');
                if (statusText) statusText.textContent = 'GIF decoded successfully. Ready to build WebM.';
            };
            img.onerror = () => { URL.revokeObjectURL(previewUrl); throw new Error('GIF preview could not be rendered.'); };
            img.src = previewUrl;
        } catch (err) {
            parsedGif = null;
            console.error(err);
            alert('GIF error: ' + err.message);
            if (statusText) statusText.textContent = 'GIF load failed.';
        }
    }

    // Build Button Action (WebM Conversion)
    if (buildBtn) {
        buildBtn.addEventListener('click', async () => {
            if (!selectedGif) {
                alert('முதலில் ஒரு GIF ஃபைலை அப்லோட் செய்யவும்!');
                return;
            }

            const fpsSelect = document.getElementById('fps-select') || document.getElementById('fpsSelect');
            const settings = {
                fps: fpsSelect ? fpsSelect.value : 30
            };

            if (progressBarContainer) progressBarContainer.classList.remove('hidden');
            if (buildBtn) buildBtn.setAttribute('disabled', 'true');

            try {
                // Calls WebmEncoder from webm.js
                const webmBlob = await WebmEncoder.generateWebm(parsedGif, { ...settings, maxFrames: document.getElementById('maxFramesSelect')?.value || 90 }, (progress, message) => {
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    if (statusText) statusText.textContent = message;
                });

                if (validationResult) {
                    validationResult.textContent = 'Validation: Passed (.webm ready)';
                    validationResult.style.color = '#4ade80';
                }

                // Generate download link for WebM
                const downloadUrl = URL.createObjectURL(webmBlob);
                if (downloadBtn) {
                    downloadBtn.href = downloadUrl;
                    downloadBtn.download = 'telegram-sticker.webm';
                    downloadBtn.classList.remove('hidden');
                }

                if (statusText) statusText.textContent = 'WebM Video Sticker generated successfully!';

            } catch (err) {
                console.error(err);
                alert('பிழை ஏற்பட்டுள்ளது: ' + err.message);
                if (statusText) statusText.textContent = 'Conversion failed.';
                if (progressBarContainer) progressBarContainer.classList.add('hidden');
                if (buildBtn) buildBtn.removeAttribute('disabled');
            }
        });
    }

    // Reset Button Action
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            selectedGif = null;
            if (gifFileInput) gifFileInput.value = '';
            if (fileInfo) fileInfo.classList.add('hidden');
            if (progressBarContainer) progressBarContainer.classList.add('hidden');
            if (progressBar) progressBar.style.width = '0%';
            if (gifPreviewImg) {
                gifPreviewImg.src = '';
                gifPreviewImg.classList.add('hidden');
            }
            if (placeholderText) placeholderText.classList.remove('hidden');
            if (buildBtn) buildBtn.setAttribute('disabled', 'true');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (statusText) statusText.textContent = 'Ready for input.';
            if (validationResult) {
                validationResult.textContent = 'Validation: Pending';
                validationResult.style.color = '';
            }
        });
    }
});
