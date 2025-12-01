import { quantize } from './colorQuantization';

export function extractColorsFromImage(imageDataUrl, count = 10) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const width = 200;
            const height = 200 * (img.height / img.width);
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            try {
                const imageData = ctx.getImageData(0, 0, width, height).data;
                const pixels = [];
                for (let i = 0; i < imageData.length; i += 4) {
                    pixels.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
                }
    
                const colorMap = quantize(pixels, count);
                const palette = colorMap.palette();
    
                const extracted = palette.map((rgb, index) => {
                    const toHex = (c) => ('0' + c.toString(16)).slice(-2);
                    return {
                        id: `synth-${index}`,
                        hex: `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
                    };
                });
                resolve(extracted);
            } catch (error) {
                console.error("Error processing image data:", error);
                reject(new Error("Could not process image. It may be CORS-protected."));
            }
        };
        
        img.onerror = (error) => {
            console.error("Error loading image:", error);
            reject(new Error("Could not load image from the provided URL."));
        };

        img.src = imageDataUrl;
    });
}