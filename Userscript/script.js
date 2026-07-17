// ==UserScript==
// @name         SR Music Song URL & Metadata Finder
// @version      0.3
// @description  SR Music Song URL Finder, Metadata Extractor, and Auto-Downloader
// @author       Owen Daigle with help from AI
// @match        *://webplayer.s*r*.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_URL_PART_NEXT_SONGS = 'vip-api.galaxie.ca/api-jsonp/GetNextSongs';
    const TARGET_URL_PART_TUNE = 'vip-api.galaxie.ca/api-jsonp/TuneStation';

    // --- Function to display a temporary status message ---
    function showNotification(message, isError = false) {
        const confirmationDiv = document.createElement('div');
        confirmationDiv.textContent = message;
        confirmationDiv.style.cssText = `
            position: fixed;
            top: 10%;
            left: 20%;
            background-color: ${isError ? 'rgba(220, 53, 69, 0.9)' : 'rgba(40, 167, 69, 0.9)'};
            color: white;
            padding: 12px;
            font-size: 36px;
            z-index: 99999;
            opacity: 0;
        `;

        document.body.appendChild(confirmationDiv);
        confirmationDiv.style.opacity = '1';

        setTimeout(() => {
            confirmationDiv.style.opacity = '0';
        }, 1500);
    }

    let skipInterval = null;

    // --- 1. Create the UI Control Button ---
    const btn = document.createElement('button');
    btn.id = 'auto-skip-control-btn';
    btn.textContent = 'Start Auto Downloader';

    //create button for setting interval
    let skipIntervalMS = 4000;
    const btnSkipInterval = document.createElement('button');
    btnSkipInterval.textContent = "Set Auto Skip Interval";

    //create button for creating number of attempts
    let numDownloads = 500;
    const btnNumDownloads = document.createElement('button');
    btnNumDownloads.textContent = `Set # of Skips (${numDownloads} left)`

    // Style the button so it floats nicely over the UI
    btn.style.cssText = `
        position: fixed;
        top: 20%;
        left: 20px;
        z-index: 999999;
        padding: 10px;
        font-size: 14px;
        color: white;
        background-color: #28a745;
        border: black 1px solid;
        transition: background-color 0.01s ease, transform 0.01s ease;
    `;
    btnSkipInterval.style.cssText = btn.style.cssText;
    btnSkipInterval.style.top= 'calc(20% + 50px)';
    btnNumDownloads.style.cssText = btn.style.cssText;
    btnNumDownloads.style.top= 'calc(20% + 100px)';

    document.body.appendChild(btn);
    document.body.appendChild(btnSkipInterval);
    document.body.appendChild(btnNumDownloads);

    // --- 2. Auto-Skip Action Logic ---
    function triggerSkip() {
        if (numDownloads === 1) {
          clearInterval(skipInterval);
          skipInterval = null;

          // Revert button styles to 'Start' state
          btn.textContent = 'Start Auto-Downloader';
          btn.style.backgroundColor = '#28a745'; // Green
          console.log("[SR Log] Auto Download Loop stopped since used up all downloads");
        }
        numDownloads = numDownloads -1;
        btnNumDownloads.textContent = `Set # of Skips (${numDownloads} left)`
        const skipButton = document.querySelector('.button.skip');
        if (skipButton) {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                // Use unsafeWindow to pass the real, unproxied Window object
                view: (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window),
                buttons: 1
            });
            skipButton.dispatchEvent(clickEvent);
            console.log(`[SR Log] Clicked skip button. ${numDownloads} skips left.`);
        } else {
            console.warn("[SR Log] Skip button ('.button.skip') not found.");
        }
    }

    // --- 3. Click Event Handler (Toggle State) ---
    btn.addEventListener('click', () => {
        if (skipInterval === null) {
            // START loop (run immediately once, then queue every 2 seconds)
            triggerSkip();
            skipInterval = setInterval(triggerSkip, skipIntervalMS);

            // Update button styles to 'Stop' state
            btn.textContent = 'Stop Auto-Downloader';
            btn.style.backgroundColor = '#dc3545'; // Red
            console.log("[SR Log] Auto Download Loop started.");
        } else {
            // STOP loop
            clearInterval(skipInterval);
            skipInterval = null;

            // Revert button styles to 'Start' state
            btn.textContent = 'Start Auto-Downloader';
            btn.style.backgroundColor = '#28a745'; // Green
            console.log("[SR Log] Auto Download Loop stopped.");
        }
    });

    btnSkipInterval.addEventListener('click', () => {
        if (skipInterval != null) {
            clearInterval(skipInterval);
            showNotification("Stopping auto click");
            skipInterval = null;
            // Revert button styles to 'Start' state
            btn.textContent = 'Start Auto-Downloader';
            btn.style.backgroundColor = '#28a745'; // Green
            console.log("[SR Log] Auto Download Loop stopped.");
        }
        skipIntervalMS = Number(prompt("Please enter new Skip interval as a number. This is how long to wait between song skips.", '4000'));
    });

    btnNumDownloads.addEventListener('click', () => {
          numDownloads = Number(prompt("Please enter new number of downloads. The auto downloader will download this number before stopping.", '500'));
          if (numDownloads < 5) {
            numDownloads = 5;
          }
          btnNumDownloads.textContent = `Set # of Skips (${numDownloads} left)`
      });

    // --- Send data directly to local Flask API ---
    function sendToDownloader(payloadString, songTitle) {
        const formData = new FormData();
        formData.append('raw_input', payloadString);

        GM_xmlhttpRequest({
            method: "POST",
            url: "http://localhost:5005/download",
            data: formData,
            onload: function(response) {
                if (response.status === 200) {
                    console.log("[SR Log] Successfully sent data to API.");
                    showNotification(`Triggered download: ${songTitle}`);
                } else {
                    console.error("[SR Log] API server returned an error status:", response.status);
                    showNotification(`API Error: Status ${response.status}`, true);
                }
            },
            onerror: function(error) {
                console.error("[Downloader] Failed to connect to local Flask server.", error);
                showNotification("Error: Local server not running!", true);
            }
        });
    }

    // --- Intercept Fetch API on the actual page (using unsafeWindow) ---
    const originalFetch = unsafeWindow.fetch || window.fetch;

    // Assign our interceptor directly to the actual page context
    unsafeWindow.fetch = function(input, init) {
        let url;
        if (typeof input === 'string') {
            url = input;
        } else if (input instanceof Request) {
            url = input.url;
        }

        // Check if the URL matches either of our target API parts
        if (url && (url.includes(TARGET_URL_PART_NEXT_SONGS) || url.includes(TARGET_URL_PART_TUNE))) {
            console.log('[SR Log]] Detected URL:', url);

            return originalFetch.apply(this, arguments).then(response => {
                const clonedResponse = response.clone();

                return clonedResponse.text().then(jsonpText => {
                    const jsonMatch = jsonpText.match(/\((.*)\)/s); // Extract JSON string from JSONP

                    if (jsonMatch && jsonMatch[1]) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);

                            const channelName = jsonData.channel.name;

                            if (jsonData && jsonData.playlist && Array.isArray(jsonData.playlist.item) && jsonData.playlist.item.length > 0) {
                                const item = jsonData.playlist.item[0];

                                // Extract individual pieces of information safely
                                const songLink = item.song_link || '';
                                const artist = (item.song && item.song.artist && item.song.artist.length > 0) ? item.song.artist[0].name : '';
                                const album = (item.song && item.song.album) ? item.song.album.title : '';
                                const songTitle = (item.song && item.song.title) ? item.song.title : '';
                                const coverArtUrl = (item.song && item.song.album && Array.isArray(item.song.album.cover) && item.song.album.cover.length > 0) ? item.song.album.cover[0].uri : '';

                                if (songLink) {
                                    const payloadString = `${songLink}|${artist}|${album}|${songTitle}|${coverArtUrl}|${channelName}`;
                                    console.log('[SR Log] Extracted Song Info:', payloadString);

                                    // Send straight to Flask web app
                                    sendToDownloader(payloadString, songTitle);
                                } else {
                                    console.warn('[SR Log] Could not find "song_link" for the "item".');
                                }
                            } else {
                                console.warn('[SR Log] No valid playlist "item" found in JSON.');
                            }

                        } catch (jsonParseError) {
                            console.error('[SR Log] Error parsing extracted JSON from JSONP:', url, jsonParseError);
                        }
                    } else {
                        console.warn('[SR Log] Could not extract JSON from JSONP response:', url);
                    }

                    return response; // Pass the original response back to the page
                }).catch(textReadError => {
                    console.error('[SR Log] Error reading text response from:', url, textReadError);
                    return response;
                });
            }).catch(error => {
                console.error('[SR Log] Fetch error for Galaxie JSONP:', url, error);
                throw error;
            });
        }

        return originalFetch.apply(this, arguments);
    };

    console.log('SR Music URL & Metadata Finder Active');
})();