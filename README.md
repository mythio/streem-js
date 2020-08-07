<!-- PROJECT LOGO -->
<br />
<p align="center">
  <!-- <a href="https://github.com/mythio/streem-js">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a> -->

  <h3 align="center">Streem-js</h3>

  <p align="center">
   Create a server to stream video/audio via RTMP (real-time messaging protocol)
    <br />
    <!-- <a href="https://github.com/othneildrew/Best-README-Template"><strong>Explore the docs »</strong></a> -->
    <br />
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template">View Demo</a>
    ·
    <a href="https://github.com/othneildrew/Best-README-Template/issues">Report Bug</a>
    ·
    <a href="https://github.com/othneildrew/Best-README-Template/issues">Request Feature</a>
  </p>
</p>



<!-- TABLE OF CONTENTS -->
## Table of Contents

* [About the Project](#about-the-project)
  * [Built With](#built-with)
* [Getting Started](#getting-started)
  * [Prerequisites](#prerequisites)
  * [Installation](#installation)
* [Usage](#usage)
* [Roadmap](#roadmap)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)
* [Acknowledgements](#acknowledgements)



<!-- ABOUT THE PROJECT -->
## About The Project

[![Product Name Screen Shot][product-screenshot]](https://example.com)

Adobe has bought the RTMP (real-time messaging protocol) from macromedia and since closed its source. Although there are documentation available for its working. So here is my implementation (feel free to play around with the code :wink:) of RTMP.

A list of commonly used resources that I find helpful are listed in the acknowledgements.

### Built With
Built on [Node.js](https://nodejs.org/en/) with [TypeScript](https://www.typescriptlang.org/)
* [WebPack](https://webpack.js.org/) for building
* [Prettier](https://prettier.io) for beautifying and formatting the code
* [ESLint](https://eslint.org) for linting

## Getting Started

To get a local copy up and running follow these simple example steps.

### Prerequisites

* npm
```sh
npm install npm@latest -g
```

### Installation

1. Clone the repo
```bash
git clone https://github.com/mythio/streem-js.git
```
2. Install NPM packages
```bash
cd streem-js
npm install
```

## Usage

To host a stream

 1. Create `.env`  file by copying `.env.example`.
 2. Set the `PORT` and `LOG_LEVEL`.
 3. Run `NODE_ENV=development npm run build`
 4. In another terminal, run `npm run start:dev`
 5. In OBS Studio
    * go to Settings -> Stream
    * set 'Service' as `Custom...`
    * set 'Server' as `rtmp://localhost:PORT/live`
    * set a 'Stream Key' without spaces and numbers
    * press Apply -> OK
    * add a video source in Sources
    * press 'Start Streaming' under 'Controls'
6. You are now serving your video.

To consume the stream

1. `ffmpeg`
    * Install `ffmpeg` from [here](https://ffmpeg.org/download.html).
    * Run `ffmpeg -i rtmp://localhost:PORT/live/name_of_stream -c copy dump.flv` 
    * This will create a dump of the stream which can be played later
    
2. VLC media player
    * Install VLC media player
    * Under 'Media -> Stream... -> Network'
    * Enter `localhost:PORT/live/name_of_stream` as network URL
    * Press 'Stream -> Next -> Next -> Next -> Stream'
    * This will play the stream

## Roadmap

See the [open issues](https://github.com/othneildrew/Best-README-Template/issues) for a list of proposed features (and known issues).

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name - mythio.2909@gmail.com

Project Link: [streem-js](https://github.com/mythio/streem-js)

## Acknowledgements
* [Node-Media-Server](https://github.com/illuspas/Node-Media-Server)
