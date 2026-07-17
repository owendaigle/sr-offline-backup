Just a simple lazy way to get songs from SR music for offline backups on Linux.

# Important Note
I do NOT in any way support piracy. This is meant to download music from SR Music for listening offline. Any abuse of this script will result in it being removed. 
I do NOT in any way support piracy. This is meant to download music from SR Music for listening offline. Any abuse of this script will result in it being removed. 

This was also produced with lots of help from AI. I am not hiding from that, it helped me turn my ideas into real things without much effort from me. 

Also, this is far from perfect. It works, but just barely. It does what I need it to do though.

# Instructions - Manual Mode
Install the user script. Upon starting a station, or going to the next song, a string containing `Link, Artist, Album, Title, CoverURL` will be copied to clipboard. 

Then go into the bash script (bash-user.sh), run it, and then paste the link from SR. 

Repeat this for each song that is wanted. 

# Instructions - Auto Mode
Install the user script, then run the API server using flask, or gunicorn, or something else. It is a flask web server. This should be running on the same machine, or the URLs will need to be updated in the userscript. 

Then go to SR music and start a station, and then click the green `Start Auto Downloader` button. Once that is clicked, it will automatically go from song to song every 4000ms to download them all one at a time for 500 times. This can be increased by pressing on the `Set # of skips` button to something like 1000 or more. The skip interval can be changed from 4000ms by pressing the `Set Auto Skip Interval` button.

It will download the song to the corresponding folder (named same as station) in the folder of the API server. 

# Reqs
- ffmpeg to add everything into one file
- wget to dl the file
- anything else? let me know.

# Bugs
- When going to next song without clicking the next button, does not copy to clipboard.
- Any significant changes from SR will kill this.
- You tell me!!

# How it works
Basically I came up with the plan for how it works, and guided the AI in a way to generate the code for me that works. 

It starts with the userscript. This has access to the web UI. SR gives a URL at the end of their pipeline which is unencrypted audio. This audio file is gotten through a fetch command. So the userscript overrides the fetch command, and intercepts it. Then it checks if it is the correct fetch command, and regardless it will then forward it to the original fetch command (we cant be breaking the website). Then if we have gotten the correct song request, that will then be a jsonp file that can be parsed. It includes the raw audio URL, title, artist, album, and cover art URL. This is then parsed and copied to the clipboard. 

Now the problem is it is kind of annoying to get this out of the browser environment to be processed. I could have created a web server that can get into the browser, and then the userscript could have interfaced with that. But I did not want to do the work. So I just copied to the clipboard, and then I created a bash script that will parse that string with all the information, then download the audio stream and cover art, and then use ffmpeg to add to a single m4a file.