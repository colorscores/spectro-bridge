export const quantize = (pixels, maxcolors) => {
    const sigbits = 5;
    const rshift = 8 - sigbits;
    const vbox = (pixels, lh, rh, v) => {
        if (rh > lh) {
            const npix = rh - lh + 1;
            const histo = {};
            for (let i = lh; i <= rh; i++) {
                const color = (pixels[i][0] << (2 * sigbits)) + (pixels[i][1] << sigbits) + pixels[i][2];
                histo[color] = (histo[color] || 0) + 1;
            }
            return { vbox: v, npix: npix, histo: histo };
        }
    };
    const medianCutApply = (histo, vbox) => {
        const { rmin, rmax, gmin, gmax, bmin, bmax } = vbox;
        const rw = rmax - rmin + 1;
        const gw = gmax - gmin + 1;
        const bw = bmax - bmin + 1;
        const maxw = Math.max(rw, gw, bw);
        if (maxw === rw) {
            return splitBox(histo, vbox, 0, rmin, rmax);
        } else if (maxw === gw) {
            return splitBox(histo, vbox, 1, gmin, gmax);
        } else {
            return splitBox(histo, vbox, 2, bmin, bmax);
        }
    };
    const splitBox = (histo, vbox, axis, min, max) => {
        const partialsum = [];
        let total = 0;
        for (let i = min; i <= max; i++) {
            let sum = 0;
            if (axis === 0) {
                for (let j = vbox.gmin; j <= vbox.gmax; j++) {
                    for (let k = vbox.bmin; k <= vbox.bmax; k++) {
                        const index = (i << (2 * sigbits)) + (j << sigbits) + k;
                        sum += (histo[index] || 0);
                    }
                }
            } else if (axis === 1) {
                for (let j = vbox.rmin; j <= vbox.rmax; j++) {
                    for (let k = vbox.bmin; k <= vbox.bmax; k++) {
                        const index = (j << (2 * sigbits)) + (i << sigbits) + k;
                        sum += (histo[index] || 0);
                    }
                }
            } else {
                for (let j = vbox.rmin; j <= vbox.rmax; j++) {
                    for (let k = vbox.gmin; k <= vbox.gmax; k++) {
                        const index = (j << (2 * sigbits)) + (k << sigbits) + i;
                        sum += (histo[index] || 0);
                    }
                }
            }
            total += sum;
            partialsum[i] = total;
        }
        const lookaheadsum = [];
        for (let i = min; i <= max; i++) {
            lookaheadsum[i] = total - partialsum[i];
        }
        for (let i = min + 1; i <= max; i++) {
            if (partialsum[i] > total / 2) {
                const vbox1 = { ...vbox };
                const vbox2 = { ...vbox };
                const left = i - min;
                const right = max - i;
                let d2;
                if (left <= right) {
                    d2 = Math.min(max - 1, ~~(i + right / 2));
                } else {
                    d2 = Math.max(min, ~~ (i - 1 - left / 2));
                }
                while (!partialsum[d2]) d2++;
                let count2 = lookaheadsum[d2];
                while (!count2 && partialsum[d2 - 1]) count2 = lookaheadsum[--d2];
                if (axis === 0) {
                    vbox1.rmax = d2;
                    vbox2.rmin = d2 + 1;
                } else if (axis === 1) {
                    vbox1.gmax = d2;
                    vbox2.gmin = d2 + 1;
                } else {
                    vbox1.bmax = d2;
                    vbox2.bmin = d2 + 1;
                }
                return [vbox1, vbox2];
            }
        }
    };
    const CMap = function() {
        this.vboxes = [];
        this.palette = () => {
            return this.vboxes.map(vbox => vbox.color);
        };
        this.push = (vbox) => {
            this.vboxes.push({
                vbox: vbox,
                color: avg(vbox)
            });
        };
        const avg = (vbox) => {
            let ntot = 0;
            const mult = 1 << (8 - sigbits);
            let rsum = 0, gsum = 0, bsum = 0;
            for (let i = vbox.rmin; i <= vbox.rmax; i++) {
                for (let j = vbox.gmin; j <= vbox.gmax; j++) {
                    for (let k = vbox.bmin; k <= vbox.bmax; k++) {
                        const histoindex = (i << (2 * sigbits)) + (j << sigbits) + k;
                        const hval = vbox.histo[histoindex] || 0;
                        ntot += hval;
                        rsum += (hval * (i + 0.5) * mult);
                        gsum += (hval * (j + 0.5) * mult);
                        bsum += (hval * (k + 0.5) * mult);
                    }
                }
            }
            if (ntot) {
                return [~~(rsum / ntot), ~~ (gsum / ntot), ~~ (bsum / ntot)];
            } else {
                return [~~(mult * (vbox.rmin + vbox.rmax + 1) / 2), ~~ (mult * (vbox.gmin + vbox.gmax + 1) / 2), ~~ (mult * (vbox.bmin + vbox.bmax + 1) / 2)];
            }
        };
        return this;
    };
    const histo = {};
    let rmin = 1000000, rmax = 0, gmin = 1000000, gmax = 0, bmin = 1000000, bmax = 0;
    pixels.forEach(pixel => {
        const r = pixel[0] >> rshift;
        const g = pixel[1] >> rshift;
        const b = pixel[2] >> rshift;
        if (r < rmin) rmin = r;
        if (r > rmax) rmax = r;
        if (g < gmin) gmin = g;
        if (g > gmax) gmax = g;
        if (b < bmin) bmin = b;
        if (b > bmax) bmax = b;
        const color = (r << (2 * sigbits)) + (g << sigbits) + b;
        histo[color] = (histo[color] || 0) + 1;
    });
    const vbox_ = { rmin, rmax, gmin, gmax, bmin, bmax, histo };
    const pq = [vbox_];
    let iter = 0;
    while (iter < maxcolors) {
        const vbox = pq.shift();
        if (!vbox) break;
        if (Object.keys(vbox.histo).length === 0) {
            pq.push(vbox);
            iter++;
            continue;
        }
        const vboxes = medianCutApply(histo, vbox);
        if (!vboxes) {
            break;
        }
        pq.push(vboxes[0]);
        if (vboxes[1]) {
            pq.push(vboxes[1]);
        }
        iter++;
    }
    const cmap = new CMap();
    pq.forEach(vbox => cmap.push(vbox));
    return cmap;
};