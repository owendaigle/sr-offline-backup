#!/bin/bash

### Made with AI
### Owen Daigle

# Define the download directory
DOWNLOAD_DIR="Downloads"

# Function to sanitize filenames (remove problematic characters)
sanitize_filename() {
    local filename="$1"
    # Replace slashes, colons, question marks, etc., with underscores
    filename=$(echo "$filename" | sed -e "s|[/\\?%*:|\"<>']|_|g")
    # Remove leading/trailing underscores and multiple consecutive underscores
    filename=$(echo "$filename" | sed -e 's/__*/_/g' -e 's/_$//')
    echo "$filename"
}

# --- Script Start ---
echo "SR Music Offline Backup"
echo "----------------------"

# Create the download directory if it doesn't exist
mkdir -p "$DOWNLOAD_DIR"

echo "Downloads will be saved in the '$DOWNLOAD_DIR' folder."
echo "Paste the song info string (Link, Artist, Album, Title, CoverURL) and press Enter."
echo "This is meant to work with the userscript called 'script.js'"
echo "Press Ctrl+C to exit."

while true; do
    echo
    read -p "Paste song info string: " input_string

    # Set Internal Field Separator to comma and read into an array
    IFS='|' read -r -a song_info_array <<< "$input_string"

    # Extract fields, trimming whitespace
    song_link=$(echo "${song_info_array[0]}" | xargs)
    artist=$(echo "${song_info_array[1]}" | xargs)
    album=$(echo "${song_info_array[2]}" | xargs)
    song_title=$(echo "${song_info_array[3]}" | xargs)
    cover_art_url=$(echo "${song_info_array[4]}" | xargs)

    if [[ -z "$song_link" ]]; then
        echo "Error: No song link found. Please paste a valid string."
        continue
    fi

    echo "--- Song Details ---"
    echo "Title:  $song_title"
    echo "Artist: $artist"
    echo "Album:  $album"
    echo "--------------------"

    # Sanitize the filename for the audio file
    sanitized_artist=$(sanitize_filename "$artist")
    sanitized_title=$(sanitize_filename "$song_title")
    
    base_audio_filename_no_ext="${sanitized_artist} - ${sanitized_title}"
    
    if [[ -z "$sanitized_artist" && -z "$sanitized_title" ]]; then
        base_audio_filename_no_ext="downloaded_song"
    elif [[ -z "$sanitized_artist" ]]; then
        base_audio_filename_no_ext="${sanitized_title}"
    elif [[ -z "$sanitized_title" ]]; then
        base_audio_filename_no_ext="${sanitized_artist}"
    fi

    # Using .m4a as a common audio-only MP4 container extension
    # If your source is typically MP3, change this to .mp3 and adjust FFmpeg command later
    temp_audio_file="${DOWNLOAD_DIR}/${base_audio_filename_no_ext}_temp.m4a" 
    final_audio_file="${DOWNLOAD_DIR}/${base_audio_filename_no_ext}.m4a"
    
    # Sanitize cover art filename and define temporary path
    temp_cover_file="${DOWNLOAD_DIR}/${base_audio_filename_no_ext}_cover.jpg"


    echo "Downloading song to: $temp_audio_file"

    # Download the audio file silently
    wget -q -O "$temp_audio_file" "$song_link" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo "Error: Song download failed for $song_link"
        echo "You can try running the command manually for more details:"
        echo "wget -O \"$temp_audio_file\" \"$song_link\""
        continue # Skip metadata if download failed
    fi
    echo "Song downloaded: $temp_audio_file"

    # Download cover art if URL is provided
    if [[ -n "$cover_art_url" ]]; then
        echo "Downloading cover art from: $cover_art_url"
        wget -q -O "$temp_cover_file" "$cover_art_url" 2>/dev/null
        if [ $? -ne 0 ]; then
            echo "Warning: Cover art download failed for $cover_art_url. Proceeding without cover art."
            rm -f "$temp_cover_file" # Clean up failed download
        else
            echo "Cover art downloaded: $temp_cover_file"
        fi
    else
        echo "No cover art URL provided."
        rm -f "$temp_cover_file" # Ensure no leftover temp cover file
    fi

    echo "Adding metadata and cover art..."

    # FFmpeg command to add metadata and embed cover art
    # Using -c copy for lossless operation (no re-encoding)
    # -map 0 selects all streams from the first input (the audio file)
    # -map 1 selects all streams from the second input (the cover art)
    # -metadata tags are used for title, artist, album
    # -disposition:v attached_pic marks the image as cover art
    # 2>/dev/null to suppress FFmpeg's verbose output
    
    ffmpeg_cmd="ffmpeg -i \"$temp_audio_file\""
    if [[ -f "$temp_cover_file" ]]; then
        ffmpeg_cmd+=" -i \"$temp_cover_file\" -map 0:a -map 1:v"
    else
        ffmpeg_cmd+=" -map 0:a" # Only map audio if no cover art
    fi

    ffmpeg_cmd+=" -c copy" # Copy streams without re-encoding

    # Add metadata tags, quoting values to handle spaces
    if [[ -n "$song_title" ]]; then ffmpeg_cmd+=" -metadata title=\"$song_title\""; fi
    if [[ -n "$artist" ]]; then ffmpeg_cmd+=" -metadata artist=\"$artist\""; fi
    if [[ -n "$album" ]]; then ffmpeg_cmd+=" -metadata album=\"$album\""; fi

    if [[ -f "$temp_cover_file" ]]; then
        ffmpeg_cmd+=" -disposition:v:0 attached_pic" # For M4A/MP4, map cover to first video stream
    fi
    
    ffmpeg_cmd+=" -y \"$final_audio_file\" 2>/dev/null" # -y to overwrite, final output file, redirect stderr

    # Execute the FFmpeg command
    eval "$ffmpeg_cmd"

    if [ $? -eq 0 ]; then
        echo "Metadata and cover art added successfully."
        echo "Final file: $final_audio_file"
        rm -f "$temp_audio_file" # Clean up temporary audio file
        rm -f "$temp_cover_file" # Clean up temporary cover file
    else
        echo "Error: Failed to add metadata or cover art."
        echo "Temporary audio file retained: $temp_audio_file"
        echo "Temporary cover art file retained: $temp_cover_file"
        echo "You can try debugging with: $ffmpeg_cmd"
    fi
done