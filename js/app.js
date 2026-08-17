document.addEventListener('DOMContentLoaded', () => {
    const gifFileInput = document.getElementById('gifFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInfo = document.getElementById('fileInfo');
    const infoName = document.getElementById('infoName');
    const infoSize = document.getElementById('infoSize');
    const infoRes = document.getElementById('infoRes');
    const infoFrames = document.getElementById('infoFrames');
    const infoDuration = document.getElementById('infoDuration');
    const gifPreviewImg = document.getElementById('gifPreviewImg');
    const placeholderText = document.querySelector('.placeholder-text');
    const buildBtn = document.getElementById('buildBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusText = document.getElementById('statusText');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const validationResult = document.getElementById('validationResult');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentFile = null;
    let parsedGifData = null;

    selectFileBtn.addEventListener('click', () => {
        gifFileInput.click();
    });

    gifFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'image/gif' && !file.name.endsWith('.gif')) {
            alert('Please select a valid animated GIF file.');
            return;
        }

        currentFile = file;
        statusText.textContent = 'Reading GIF...';

        try {
            parsedGifData = await GifParser.parse(file);
            
            // Display File Info
            infoName.textContent = file.name;
            infoSize.textContent = Utils.formatBytes(file.size);
            infoRes.textContent = `${parsedGifData.width} × ${parsedGifData.height}`;
            infoFrames.textContent = parsedGifData.frameCount;
            infoDuration.textContent = `${parsedGifData.duration} seconds`;
            fileInfo.classList.remove('hidden');

            // Display Preview
            gifPreviewImg.src = parsedGifData.url;
            gifPreviewImg.classList.remove('hidden');
            placeholderText.classList.add('hidden');

            buildBtn.removeAttribute('disabled');
            statusText.textContent = 'GIF loaded successfully. Ready to build TGS.';
            validationResult.textContent = 'Validation: Pending';
            validationResult.className = 'validation-box';
            downloadBtn.classList.add('hidden');
        } catch (err) {
            statusText.textContent = 'Error: ' + err.message;
            alert(err.message);
        }
    });

    buildBtn.addEventListener('click', async () => {
        if (!currentFile || !parsedGifData) return;

        buildBtn.setAttribute('disabled', 'true');
        progressBarContainer.classList.remove('hidden');
        progressBar.style.width = '10%';

        const updateProgress = (pct, msg) => {
            progressBar.style.width = pct + '%';
            statusText.textContent = msg;
        };

        try {
            updateProgress(20, 'Initializing conversion pipeline...');
            const settings = {
                detail: document.getElementById('detailSelect').value,
                fps: document.getElementById('fpsSelect').value,
                maxFrames: document.getElementById('maxFramesSelect').value
            };

            const tgsBlob = await TgsEncoder.generateTgs(parsedGifData, settings, updateProgress);
            
            updateProgress(95, 'Validating TGS...');
            const validation = await TgsValidator.validate(tgsBlob);

            if (!validation.valid) {
                throw new Error(validation.message);
            }

            updateProgress(100, 'TGS READY');
            validationResult.textContent = `Validation: ${validation.message} (${Utils.formatBytes(tgsBlob.size)})`;
            validationResult.className = 'validation-box passed';

            const downloadUrl = URL.createObjectURL(tgsBlob);
            downloadBtn.href = downloadUrl;
            downloadBtn.classList.remove('hidden');

        } catch (err) {
            statusText.textContent = 'Failed: ' + err.message;
            validationResult.textContent = `Validation: FAILED (${err.message})`;
            validationResult.className = 'validation-box failed';
            buildBtn.removeAttribute('disabled');
            progressBarContainer.classList.add('hidden');
        }
    });

    resetBtn.addEventListener('click', () => {
        currentFile = null;
        parsedGifData = null;
        gifFileInput.value = '';
        fileInfo.classList.add('hidden');
        gifPreviewImg.src = '';
        gifPreviewImg.classList.add('hidden');
        placeholderText.classList.remove('hidden');
        buildBtn.setAttribute('disabled', 'true');
        statusText.textContent = 'Ready for input.';
        progressBarContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        validationResult.textContent = 'Validation: Pending';
        validationResult.className = 'validation-box';
        downloadBtn.classList.add('hidden');
    });
});
