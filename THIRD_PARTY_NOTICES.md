# Third-party notices

## Optional person segmentation (downloaded at runtime)

Images, videos and generated masks are processed locally. These models and inference runtimes are fetched only when the user generates a mask; the weights are not bundled in this repository.

- **Robust Video Matting / MobileNetV3**, by Shanchuan Lin, Linjie Yang, Imran Saleemi and Soumyadip Sengupta. [Official repository](https://github.com/PeterL1n/RobustVideoMatting). Its repository license is **GPL-3.0**; the README records the code's re-release under GPL-3.0. A separate license solely for pretrained weights is not stated. The TFJS int8 model is retrieved from the official `gh-pages` commit `72ed518756950796f10eea6eb6b301df97cef277`, under `model/`. [Full license](assets/licenses/RobustVideoMatting-GPL-3.0.txt).
- **SkyTNT Anime Segmentation / ISNet**, by SkyTNT. [Official repository](https://github.com/SkyTNT/anime-segmentation), **Apache-2.0**. The model card also declares Apache-2.0. `isnetis.onnx` is retrieved from [skytnt/anime-seg](https://huggingface.co/skytnt/anime-seg), revision `a0a563c41338cbe0d23dfb4bfc3e243c518e5768`. [Full license](assets/licenses/AnimeSegmentation-Apache-2.0.txt).
- **TensorFlow.js 4.22.0**, by the TensorFlow authors, **Apache-2.0**. [Source](https://github.com/tensorflow/tfjs/tree/tfjs-v4.22.0), loaded from jsDelivr. [Full license](assets/licenses/TensorFlowJS-Apache-2.0.txt).
- **ONNX Runtime Web 1.22.0**, copyright Microsoft Corporation, **MIT**. [Source](https://github.com/microsoft/onnxruntime/tree/v1.22.0), JavaScript and WASM loaded from jsDelivr. [Full license](assets/licenses/ONNXRuntime-MIT.txt).

The original JIZURA MIT notices remain applicable to its original code. Do not describe a distribution integrating RVM as solely MIT licensed; assess and comply with the GPL requirements for the distributed combination, including applicable corresponding-source obligations. This notice does not grant a different license for upstream components. See also [person cutout implementation notes](docs/person-cutout.md).

## mp4-muxer 5.2.2 (bundled)

`vendor/mp4-muxer.min.js` is embedded in `index.html` and is used to write MP4 files.
Source: https://github.com/Vanilagy/mp4-muxer — licensed under the MIT License:

```
MIT License

Copyright (c) 2023 Vanilagy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts (not bundled)

The web app loads the following typefaces at runtime from Google Fonts (https://fonts.google.com/); they are not
included in this repository. They are distributed by their authors under the SIL Open Font License 1.1:
Noto Sans JP, Noto Serif JP, Dela Gothic One, Zen Kaku Gothic New, Zen Old Mincho, Kaisei Tokumin,
M PLUS Rounded 1c, Mochiy Pop One, DotGothic16, Yuji Syuku, IBM Plex Mono, IBM Plex Sans JP.
