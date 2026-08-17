document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const settingsSection = document.getElementById('settings-section');
    const buildBtn = document.getElementById('build-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const resultSection = document.getElementById('result-section');
    const downloadBtn = document.getElementById('download-btn');

    let selectedGif = null;

    // Handle drag and drop / click to upload
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-primary');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });
    }

    function handleFile(file) {
        if (!file.type.includes('gif')) {
            alert('தயவுசெய்து ஒரு சரியான GIF ஃபைலை மட்டும் தேர்ந்தெடுக்கவும்!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                selectedGif = {
                    url: e.target.result,
                    width: img.width,
                    height: img.height,
                    name: file.name
                };
                // Show settings section
                if (settingsSection) settingsSection.classList.remove('hidden');
                dropZone.innerHTML = `<p class="text-green-400 font-semibold">নির্বெடுக்கப்பட்ட ஃபைல்: ${file.name}</p>`;
            };
        };
        reader.readAsDataURL(file);
    }

    // Build Button Action
    if (buildBtn) {
        buildBtn.addEventListener('click', async () => {
            if (!selectedGif) {
                alert('முதலில் ஒரு GIF ஃபைலை அப்லோட் செய்யவும்!');
                return;
            }

            const fpsSelect = document.getElementById('fps-select');
            const settings = {
                fps: fpsSelect ? fpsSelect.value : 30
            };

            settingsSection.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                const webmBlob = await TgsEncoder.generateTgs(selectedGif, settings, (progress, message) => {
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    if (progressText) progressText.textContent = message;
                });

                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');

                // Generate download link for WebM
                const downloadUrl = URL.createObjectURL(webmBlob);
                if (downloadBtn) {
                    downloadBtn.href = downloadUrl;
                    downloadBtn.download = 'telegram-sticker.webm';
                    downloadBtn.classList.remove('hidden');
                }

            } catch (err) {
                console.error(err);
                alert('பிழை ஏற்பட்டுள்ளது: ' + err.message);
                progressSection.classList.add('hidden');
                settingsSection.classList.remove('hidden');
            }
        });
    }

    // Reset Button Action
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            selectedGif = null;
            if (fileInput) fileInput.value = '';
            if (settingsSection) settingsSection.classList.add('hidden');
            if (progressSection) progressSection.classList.add('hidden');
            if (resultSection) resultSection.classList.add('hidden');
            if (dropZone) {
                dropZone.innerHTML = `
                    <span class="text-blue-400 font-bold block mb-2">TAP TO CHOOSE GIF</span>
                    <span class="text-gray-400 text-sm">or drag & drop animated GIF here</span>
                `;
            }
        });
    }
});

