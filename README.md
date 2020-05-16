# Streem-js
A server to host live stream feed by using [RTMP](https://wwwimages2.adobe.com/content/dam/acom/en/devnet/rtmp/pdf/rtmp_specification_1.0.pdf) (Real-Time Messaging Protocol). Does byte level parsing (using buffers) of RTMP packets and header, which are decoded and encoded in AMF0 (Action Message Format) format. [This](https://github.com/delian/node-amfutils) was used as a reference for AMF0 decoder and AMF0 encoder.
* It does not **transcode** the video and audio packets. It serves the client with AAC (Advanced Audio Coding) audio and, H.264 or AVC (Advanced Audio Coding) video formats.
* It does not covert stream from RTMP to HLS if you are wondering. I haven't tried to use it with any mobile devices.
* It uses only [AMF0](http://download.macromedia.com/pub/labs/amf/amf0_spec_121207.pdf) format provided by Adobe.

## How to serve? 
 1. Install [**OBS Studio**](https://obsproject.com/download).
 2. Clone the repository.
 3. Create `.env`  file by copying `.env.example`.
 4. Set the `PORT` and `LOG_LEVEL`.
 5. Run `NODE_ENV=development npm run build`
 6. In another terminal, run `npm run start:dev`
 7. In OBS Studio
    * go to Settings -> Stream
    * set 'Service' as `Custom...`
    * set 'Server' as `rtmp://localhost:PORT/live`
    * set a 'Stream Key' without spaces and numbers
    * press Apply -> OK
    * add a video source in Sources
    * press 'Start Streaming' under 'Controls'
8. You are now serving your video.

## How to stream?
There are multiple ways to consume the stream.
1. `ffmpeg`
    * install `ffmpeg`
    * run `ffmpeg -i rtmp://localhost:PORT/live/name_of_stream -c copy dump.flv` 
    * this will create a dump of the stream which can be played later
2. VLC media player
    * install VLC media player
    * under 'Media -> Stream... -> Network'
    * enter `localhost:PORT/live/name_of_stream` as network URL
    * press 'Stream -> Next -> Next -> Next -> Stream'
    * this will play the stream
