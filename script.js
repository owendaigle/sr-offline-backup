// ==UserScript==
// @name         SR Music Song URL & Metadata Finder
// @version      0.2
// @description  SR Music Song URL Finder and Metadata Extractor
// @author       Owen Daigle with help from AI
// @match        *://webplayer.s*r*.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // The specific URL parts we're looking for
    const TARGET_URL_PART_NEXT_SONGS = 'vip-api.galaxie.ca/api-jsonp/GetNextSongs';
    const TARGET_URL_PART_TUNE = 'vip-api.galaxie.ca/api-jsonp/TuneStation';

    // --- Function to display a temporary copy confirmation message ---
    function showCopiedConfirmation() {
        const confirmationDiv = document.createElement('div');
        // Changed message to reflect copying all info
        confirmationDiv.textContent = 'Song Info Copied to clipboard!';
        confirmationDiv.style.cssText = `
            position: fixed;
            top: 10%;
            left: 90%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: red;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: sans-serif;
            font-size: 24px;
            z-index: 99999;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        `;

        document.body.appendChild(confirmationDiv);

        // Fade in
        setTimeout(() => {
            confirmationDiv.style.opacity = '1';
        }, 10);

        // Fade out and remove after a few seconds
        setTimeout(() => {
            confirmationDiv.style.opacity = '0';
            confirmationDiv.addEventListener('transitionend', () => {
                confirmationDiv.remove();
            }, { once: true });
        }, 2000); // Display for 2 seconds
    }

    // --- Custom function to copy text to clipboard (NO GM_setClipboard needed) ---
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                console.log('[Clipboard] Text copied to clipboard successfully via async API!');
            }).catch(function(err) {
                console.error('[Clipboard] Async clipboard copy failed:', err);
                copyToClipboardFallback(text);
            });
        } else {
            console.warn('[Clipboard] navigator.clipboard not available, falling back to document.execCommand.');
            copyToClipboardFallback(text);
        }
    }

    // Fallback function for copying text using a temporary textarea
    function copyToClipboardFallback(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'successful' : 'unsuccessful';
            console.log('[Clipboard] Fallback copy command was ' + msg);
        } catch (err) {
            console.error('[Clipboard] Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
    }

    // --- Intercept Fetch API ---
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        let url;
        if (typeof input === 'string') {
            url = input;
        } else if (input instanceof Request) {
            url = input.url;
        }

        // Check if the URL matches either of our target API parts
        if (url && (url.includes(TARGET_URL_PART_NEXT_SONGS) || url.includes(TARGET_URL_PART_TUNE))) {
            console.log('[Galaxie Log - Fetch] Detected URL:', url);

            return originalFetch.apply(this, arguments).then(response => {
                const clonedResponse = response.clone();

                return clonedResponse.text().then(jsonpText => {
                    const jsonMatch = jsonpText.match(/\((.*)\)/s); // Extract JSON string from JSONP

                    if (jsonMatch && jsonMatch[1]) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            // console.log('[Galaxie Log] Parsed JSON Data (for debugging):', jsonData); // Uncomment to see full JSON

                            let copiedString = ''; // Initialize the string to be copied

                            // Navigate to the current item's song data
                            if (jsonData && jsonData.playlist && Array.isArray(jsonData.playlist.item) && jsonData.playlist.item.length > 0) {
                                const item = jsonData.playlist.item[0]; // Get the first item in the 'item' array

                                // Extract individual pieces of information safely
                                const songLink = item.song_link || ''; // Use empty string if not found
                                const artist = (item.song && item.song.artist && item.song.artist.length > 0) ? item.song.artist[0].name : '';
                                const album = (item.song && item.song.album) ? item.song.album.title : '';
                                const songTitle = (item.song && item.song.title) ? item.song.title : '';
                                const coverArtUrl = (item.song && item.song.album && Array.isArray(item.song.album.cover) && item.song.album.cover.length > 0) ? item.song.album.cover[0].uri : ''; // Gets the URI of the first cover image

                                // Format the string as requested: <link>, <artist>, <album>, <song title>, <cover art url>
                                copiedString = `${songLink}| ${artist}| ${album}| ${songTitle}| ${coverArtUrl}`;

                                if (songLink) { // Still check for songLink as primary indicator of valid data
                                    console.log('*** Extracted Song Info (for current item):', copiedString);
                                    copyToClipboard(copiedString); // Copy the combined string
                                    showCopiedConfirmation(); // Show visual confirmation
                                } else {
                                    console.warn('[Galaxie Log] Could not find "song_link" for the "item". Metadata will not be copied.');
                                }
                            } else {
                                console.warn('[Galaxie Log] No valid playlist "item" found in JSON.');
                            }

                        } catch (jsonParseError) {
                            console.error('[Galaxie Log] Error parsing extracted JSON from JSONP:', url, jsonParseError);
                            console.log('[Galaxie Log] Raw JSONP Text (first 500 chars):', jsonpText.substring(0, Math.min(jsonpText.length, 500)) + (jsonpText.length > 500 ? '...' : ''));
                        }
                    } else {
                        console.warn('[Galaxie Log] Could not extract JSON from JSONP response (no parentheses match):', url);
                        console.log('[Galaxie Log] Raw JSONP Text (no match, first 500 chars):', jsonpText.substring(0, Math.min(jsonpText.length, 500)) + (jsonpText.length > 500 ? '...' : ''));
                    }

                    return response; // Pass the original response back to the page
                }).catch(textReadError => {
                    console.error('[Galaxie Log] Error reading text response from:', url, textReadError);
                    return response;
                });
            }).catch(error => {
                console.error('[Galaxie Log] Fetch error for Galaxie JSONP:', url, error);
                throw error;
            });
        }

        return originalFetch.apply(this, arguments);
    };

    console.log('SR Music URL & Metadata Finder Active');

})();