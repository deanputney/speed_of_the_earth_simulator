import * as THREE from 'three';

/**
 * Elevation grid (feet above sea level) on a rectilinear, non-uniform grid.
 * See scripts/build_crissy_terrain.py for how the data is produced.
 */

const OUTSIDE_HEIGHT = -30; // open water beyond the grid

// Drop the seabed below the water plane so the shoreline doesn't flicker
const UNDERWATER_DROP = 6;

function upperIndex(axis, value) {
    let lo = 0;
    let hi = axis.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (axis[mid] <= value) lo = mid;
        else hi = mid;
    }
    return lo;
}

export class Terrain {
    /**
     * @param {object} data - { xs, zs, heights (base64 little-endian Int16, row-major by z) }
     */
    constructor({ xs, zs, heights }) {
        this.xs = xs;
        this.zs = zs;
        const bytes = Uint8Array.from(atob(heights), c => c.charCodeAt(0));
        this.heights = new Int16Array(bytes.buffer);
    }

    heightAtVertex(i, j) {
        return this.heights[j * this.xs.length + i];
    }

    /**
     * Ground elevation in feet above sea level (negative in the water)
     */
    heightAt(x, z) {
        const { xs, zs } = this;
        if (x < xs[0] || x > xs[xs.length - 1] || z < zs[0] || z > zs[zs.length - 1]) {
            return OUTSIDE_HEIGHT;
        }
        const i = upperIndex(xs, x);
        const j = upperIndex(zs, z);
        const fx = (x - xs[i]) / (xs[i + 1] - xs[i]);
        const fz = (z - zs[j]) / (zs[j + 1] - zs[j]);
        const h00 = this.heightAtVertex(i, j);
        const h10 = this.heightAtVertex(i + 1, j);
        const h01 = this.heightAtVertex(i, j + 1);
        const h11 = this.heightAtVertex(i + 1, j + 1);
        return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
    }

    /**
     * Grid steps from each vertex to the nearest water vertex (capped), for coloring shores.
     */
    waterDistance(maxSteps) {
        const nx = this.xs.length;
        const nz = this.zs.length;
        const distance = new Uint8Array(nx * nz).fill(maxSteps + 1);
        let frontier = [];
        for (let k = 0; k < nx * nz; k++) {
            if (this.heights[k] <= 0) {
                distance[k] = 0;
                frontier.push(k);
            }
        }
        for (let step = 1; step <= maxSteps && frontier.length; step++) {
            const next = [];
            for (const k of frontier) {
                const i = k % nx;
                const neighbors = [k - nx, k + nx, i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1];
                for (const n of neighbors) {
                    if (n >= 0 && n < distance.length && distance[n] > step) {
                        distance[n] = step;
                        next.push(n);
                    }
                }
            }
            frontier = next;
        }
        return distance;
    }

    /**
     * @param {THREE.Material} material - should use vertexColors
     * @param {function} colorAt - (x, z, height, slope, stepsToWater, color) => void
     */
    createMesh(material, colorAt) {
        const { xs, zs } = this;
        const nx = xs.length;
        const nz = zs.length;
        const positions = new Float32Array(nx * nz * 3);
        const uvs = new Float32Array(nx * nz * 2);
        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) {
                const k = j * nx + i;
                const h = this.heights[k];
                positions.set([xs[i], h > 0 ? h : h - UNDERWATER_DROP, zs[j]], k * 3);
                // World-space feet, so repeating textures keep a constant scale
                uvs.set([xs[i], -zs[j]], k * 2);
            }
        }

        const indices = [];
        for (let j = 0; j < nz - 1; j++) {
            for (let i = 0; i < nx - 1; i++) {
                const a = j * nx + i;
                const b = a + 1;
                const c = a + nx;
                const d = c + 1;
                // Skip cells entirely under water
                if (Math.max(this.heights[a], this.heights[b], this.heights[c], this.heights[d]) <= 0) continue;
                indices.push(a, c, b, b, c, d);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const normals = geometry.attributes.normal;
        const stepsToWater = this.waterDistance(4);
        const colors = new Float32Array(nx * nz * 3);
        const color = new THREE.Color();
        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) {
                const k = j * nx + i;
                const slope = 1 - normals.getY(k);
                colorAt(xs[i], zs[j], this.heights[k], slope, stepsToWater[k], color);
                colors.set([color.r, color.g, color.b], k * 3);
            }
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        return mesh;
    }
}
