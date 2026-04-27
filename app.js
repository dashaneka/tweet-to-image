document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM REFS ----
    const $ = (id) => document.getElementById(id);

    const form          = $('tweet-form');
    const urlInput      = $('tweet-url');
    const resultDiv     = $('result');
    const resultImage   = $('result-image');
    const downloadBtn   = $('download-btn');
    const downloadText  = $('download-btn-text');
    const generateBtn   = $('generate-btn');
    const btnText       = $('btn-text');
    const iconBolt      = $('icon-bolt');
    const iconSpinner   = $('icon-spinner');
    const skeleton      = $('skeleton');
    const copyBtn       = $('copy-btn');
    const copyIcon      = $('copy-icon');
    const checkIcon     = $('check-icon');
    const copyBtnText   = $('copy-btn-text');

    // Canvas source elements
    const canvasSource  = $('tweet-canvas-source');
    const tcAvatar      = $('tc-avatar');
    const tcName        = $('tc-name');
    const tcHandle      = $('tc-handle');
    const tcBody        = $('tc-body');
    const tcSingleMedia = $('tc-single-media');
    const tcMediaGallery = $('tc-media-gallery');
    const tcQuote       = $('tc-quote');
    const tcQuoteAvatar = $('tc-quote-avatar');
    const tcQuoteName   = $('tc-quote-name');
    const tcQuoteHandle = $('tc-quote-handle');
    const tcQuoteBody   = $('tc-quote-body');
    const tcQuoteMedia  = $('tc-quote-media');
    const tcReplies     = $('tc-replies');
    const tcReposts     = $('tc-reposts');
    const tcLikes       = $('tc-likes');
    const tcTimestamp   = $('tc-timestamp');

    const formatPills   = document.querySelectorAll('[data-format]');
    const qualityCtrl   = $('quality-control');
    const qualitySlider = $('quality-slider');
    const qualityValue  = $('quality-value');

    // ---- STATE ----
    let selectedFormat = 'png';
    let selectedQuality = 0.92;
    let lastCanvas = null;
    const avatarFallback = createFallbackAvatar();

    // ---- CORS PROXIES ----
    const CORS_PROXIES = [
        (u) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&default=1`,
        (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];


    /* ================================================
       EVENTS
       ================================================ */

    // Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        const id = getTweetId(url);

        if (!id) {
            toast('Invalid URL — please paste a valid Twitter/X link.', 'error');
            return;
        }

        setLoading(true);
        resultDiv.classList.add('hidden');
        skeleton.classList.remove('hidden');

        try {
            const res = await fetch(`https://api.fxtwitter.com/status/${id}`);
            if (!res.ok) throw new Error(`API returned ${res.status}`);
            const data = await res.json();
            if (!data.tweet) throw new Error('No tweet data returned');
            await renderTweet(data.tweet);
        } catch (err) {
            console.error('Fetch error:', err);
            toast('Could not fetch tweet — it may be private, deleted, or the service is down.', 'error');
            skeleton.classList.add('hidden');
            setLoading(false);
        }
    });

    // Format pills
    formatPills.forEach(pill => {
        pill.addEventListener('click', () => {
            formatPills.forEach(p => { p.classList.remove('active'); });
            pill.classList.add('active');
            selectedFormat = pill.dataset.format;
            qualityCtrl.classList.toggle('hidden', selectedFormat === 'png');
            reExport();
        });
    });

    // Quality slider
    qualitySlider.addEventListener('input', (e) => {
        selectedQuality = parseInt(e.target.value) / 100;
        qualityValue.textContent = `${e.target.value}%`;
        reExport();
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', async () => {
        if (!lastCanvas) return;
        try {
            const blob = await new Promise(resolve => lastCanvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            copyBtn.classList.add('copied');
            copyIcon.classList.add('hidden');
            checkIcon.classList.remove('hidden');
            copyBtnText.textContent = 'Copied!';
            toast('Image copied to clipboard!', 'success');
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyIcon.classList.remove('hidden');
                checkIcon.classList.add('hidden');
                copyBtnText.textContent = 'Copy to clipboard';
            }, 2500);
        } catch (err) {
            toast('Could not copy — your browser may not support this.', 'error');
        }
    });


    /* ================================================
       UI HELPERS
       ================================================ */

    function setLoading(on) {
        generateBtn.disabled = on;
        btnText.textContent = on ? 'Generating...' : 'Generate';
        iconBolt.classList.toggle('hidden', on);
        iconSpinner.classList.toggle('hidden', !on);
    }

    function getTweetId(url) {
        try {
            const u = new URL(url);
            if (!['twitter.com','www.twitter.com','x.com','www.x.com'].includes(u.hostname.toLowerCase())) return null;
            const parts = u.pathname.split('/');
            const idx = parts.indexOf('status');
            if (idx === -1) return null;
            const id = parts[idx + 1] || '';
            return /^\d+$/.test(id) ? id : null;
        } catch { return null; }
    }

    function formatNumber(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    function linkifyText(text) {
        const frag = document.createDocumentFragment();
        const t = typeof text === 'string' ? text : '';
        const re = /https?:\/\/[^\s]+/g;
        let last = 0;
        t.replace(re, (m, off) => {
            if (off > last) frag.appendChild(document.createTextNode(t.slice(last, off)));
            const a = document.createElement('a');
            a.href = m; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = m;
            frag.appendChild(a);
            last = off + m.length;
            return m;
        });
        if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
        return frag;
    }

    function createFallbackAvatar() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#111827"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#f0f2f5" font-size="40" font-family="Inter,sans-serif">@</text></svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }


    /* ================================================
       IMAGE LOADING (CORS proxy chain)
       ================================================ */

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    }

    async function fetchImageData(url) {
        if (!url) return '';
        for (const proxy of CORS_PROXIES) {
            try {
                const res = await fetch(proxy(url), { mode: 'cors' });
                if (!res.ok) continue;
                const blob = await res.blob();
                if (blob.size === 0) continue;
                return await blobToDataUrl(blob);
            } catch (e) { console.warn('Proxy failed:', e.message); }
        }
        throw new Error('All proxies failed for: ' + url);
    }

    function loadImage(img, src, fallback = '') {
        return new Promise(resolve => {
            const cleanup = () => { img.onload = null; img.onerror = null; };
            img.onload = () => { cleanup(); resolve(true); };
            img.onerror = () => {
                cleanup();
                if (fallback && img.src !== fallback) { loadImage(img, fallback).then(resolve); return; }
                resolve(false);
            };
            if (!src) { img.onerror(); return; }
            img.src = src;
            if (img.complete && img.naturalWidth > 0) { cleanup(); resolve(true); }
        });
    }

    async function hydrateImg(img, url, fallback = '') {
        try {
            const data = await fetchImageData(url);
            return loadImage(img, data, fallback);
        } catch {
            if (fallback) return loadImage(img, fallback);
            return false;
        }
    }

    function nextPaint() {
        return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }


    /* ================================================
       TOAST NOTIFICATIONS
       ================================================ */

    function toast(message, type = 'error') {
        const container = $('toast-container');
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `
            <div class="toast__icon">
                ${type === 'error'
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
                }
            </div>
            <span>${message}</span>
            <button class="toast__close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        `;
        container.appendChild(el);
        const closeBtn = el.querySelector('.toast__close');
        const dismiss = () => {
            el.style.animation = 'toastOut 0.25s ease forwards';
            setTimeout(() => el.remove(), 260);
        };
        closeBtn.addEventListener('click', dismiss);
        setTimeout(dismiss, 5000);
    }


    /* ================================================
       MEDIA GALLERY
       ================================================ */

    async function buildGallery(container, photos) {
        container.innerHTML = '';
        if (!photos || !photos.length) { container.classList.add('hidden'); return []; }
        const count = Math.min(photos.length, 4);
        container.classList.remove('hidden');
        container.className = container.className.replace(/\bg\d\b/g, '').trim();
        container.classList.add('tc-media-grid', `g${count}`);
        const promises = [];
        for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.className = 'tc-grid-img';
            img.alt = `Photo ${i + 1}`;
            container.appendChild(img);
            promises.push(hydrateImg(img, photos[i].url));
        }
        return Promise.all(promises);
    }


    /* ================================================
       QUOTE TWEET
       ================================================ */

    async function renderQuote(quote) {
        if (!quote) { tcQuote.classList.add('hidden'); tcQuoteMedia.classList.add('hidden'); return; }
        tcQuote.classList.remove('hidden');
        const qa = quote.author || {};
        tcQuoteName.textContent = qa.name || 'Unknown';
        tcQuoteHandle.textContent = qa.screen_name ? `@${qa.screen_name}` : '@unknown';
        tcQuoteBody.replaceChildren(linkifyText(quote.text || ''));
        const avatarP = hydrateImg(tcQuoteAvatar, qa.avatar_url, avatarFallback);
        const mediaP = buildGallery(tcQuoteMedia, quote.media?.photos || []);
        await Promise.all([avatarP, mediaP]);
    }


    /* ================================================
       EXPORT & FORMAT SWITCHING
       ================================================ */

    function getMime() {
        return selectedFormat === 'jpeg' ? 'image/jpeg' : selectedFormat === 'webp' ? 'image/webp' : 'image/png';
    }

    function reExport() {
        if (!lastCanvas) return;
        const quality = selectedFormat === 'png' ? undefined : selectedQuality;
        const url = lastCanvas.toDataURL(getMime(), quality);
        resultImage.src = url;
        downloadBtn.href = url;
        const ext = selectedFormat === 'jpeg' ? 'jpg' : selectedFormat;
        downloadBtn.download = downloadBtn.download.replace(/\.[^.]+$/, `.${ext}`);
        downloadText.textContent = `Download ${selectedFormat.toUpperCase()}`;
    }

    async function exportCard() {
        canvasSource.style.position = 'fixed';
        canvasSource.style.left = '-9999px';
        canvasSource.style.top = '0';
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        try {
            const canvas = await html2canvas(canvasSource, {
                backgroundColor: '#000000',
                scale, useCORS: true, allowTaint: false, logging: false,
            });
            lastCanvas = canvas;
            const quality = selectedFormat === 'png' ? undefined : selectedQuality;
            return canvas.toDataURL(getMime(), quality);
        } finally {
            canvasSource.style.position = 'fixed';
            canvasSource.style.left = '-9999px';
        }
    }


    /* ================================================
       MAIN RENDER
       ================================================ */

    async function renderTweet(tweet) {
        const author = tweet.author || {};
        tcName.textContent = author.name || 'Unknown';
        tcHandle.textContent = author.screen_name ? `@${author.screen_name}` : '@unknown';
        tcBody.replaceChildren(linkifyText(tweet.text || ''));

        const avatarP = hydrateImg(tcAvatar, author.avatar_url, avatarFallback);

        // Media
        const photos = tweet.media?.photos || [];
        let mediaP;
        if (photos.length > 1) {
            tcSingleMedia.style.display = 'none';
            tcSingleMedia.removeAttribute('src');
            mediaP = buildGallery(tcMediaGallery, photos);
        } else if (photos.length === 1) {
            tcMediaGallery.classList.add('hidden');
            tcMediaGallery.innerHTML = '';
            tcSingleMedia.style.display = 'block';
            mediaP = hydrateImg(tcSingleMedia, photos[0].url).then(ok => {
                if (!ok) tcSingleMedia.style.display = 'none';
            });
        } else {
            tcSingleMedia.style.display = 'none';
            tcSingleMedia.removeAttribute('src');
            tcMediaGallery.classList.add('hidden');
            tcMediaGallery.innerHTML = '';
            mediaP = Promise.resolve();
        }

        // Quote
        const quoteP = renderQuote(tweet.quote || null);

        // Timestamp
        if (Number.isFinite(tweet.created_timestamp)) {
            const d = new Date(tweet.created_timestamp * 1000);
            const time = new Intl.DateTimeFormat('en-us', { hour: 'numeric', minute: 'numeric', hour12: true }).format(d);
            const date = new Intl.DateTimeFormat('en-us', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
            tcTimestamp.textContent = `${time} · ${date}`;
        } else {
            tcTimestamp.textContent = '';
        }

        // Stats
        tcReplies.textContent = formatNumber(tweet.replies || 0);
        tcReposts.textContent = formatNumber(tweet.retweets || 0);
        tcLikes.textContent = formatNumber(tweet.likes || 0);

        // Download filename
        const ext = selectedFormat === 'jpeg' ? 'jpg' : selectedFormat;
        downloadBtn.download = `tweetshot-${tweet.id || Date.now()}.${ext}`;
        downloadText.textContent = `Download ${selectedFormat.toUpperCase()}`;

        await Promise.all([avatarP, mediaP, quoteP]);
        await nextPaint();

        try {
            const url = await exportCard();
            resultImage.src = url;
            downloadBtn.href = url;
            skeleton.classList.add('hidden');
            resultDiv.classList.remove('hidden');
            toast('Image generated successfully!', 'success');
        } catch (e) {
            console.error('Export error:', e);
            toast(`Image generation failed: ${e.message || 'unknown error'}`, 'error');
            skeleton.classList.add('hidden');
        } finally {
            setLoading(false);
        }
    }
});
