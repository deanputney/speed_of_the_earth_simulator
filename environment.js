import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { CRISSY_FIELD_TERRAIN } from './crissyFieldTerrain.js';
import { PROMENADE, GOLDEN_GATE, PALACE_OF_FINE_ARTS, ALCATRAZ } from './crissyFieldGeography.js';

/**
 * Site scenery: ground, water, terrain and landmarks.
 *
 * Coordinates are feet relative to the center of the installation,
 * North = -Z, East = +X, y = 0 at ground level (desert) or sea level (Crissy Field).
 */

const WORLD_EXTENT = 40000; // half-size of the ground, feet

// Small deterministic PRNG so scenery is the same on every load
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createNoiseTexture({ baseColor, noise, patchColor, patches, seed, repeat }) {
    const random = seededRandom(seed);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const n = (random() - 0.5) * noise;
        data[i] += n;
        data[i + 1] += n;
        data[i + 2] += n;
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.fillStyle = patchColor;
    for (let i = 0; i < patches; i++) {
        ctx.beginPath();
        ctx.arc(random() * 512, random() * 512, random() * 50 + 20, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.repeat.set(repeat, repeat);
    return texture;
}
function mountainRing({ radius, depth, minHeight, maxHeight, color, seed }) {
    const random = seededRandom(seed);
    const segments = 180;
    const heights = [];
    // Sum of random sines gives a ridgeline that wraps seamlessly
    const waves = Array.from({ length: 6 }, (_, k) => ({
        frequency: [2, 3, 5, 7, 11, 17][k],
        phase: random() * Math.PI * 2,
        amplitude: 1 / (k + 1)
    }));
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        let n = 0;
        for (const w of waves) n += w.amplitude * Math.sin(angle * w.frequency + w.phase);
        const t = Math.max(0, Math.min(1, 0.5 + n * 0.4));
        heights.push(minHeight + t * t * (maxHeight - minHeight));
    }

    const vertices = [];
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const near0 = [Math.cos(a0) * radius, Math.sin(a0) * radius];
        const near1 = [Math.cos(a1) * radius, Math.sin(a1) * radius];
        const far0 = [Math.cos(a0) * (radius + depth), Math.sin(a0) * (radius + depth)];
        const far1 = [Math.cos(a1) * (radius + depth), Math.sin(a1) * (radius + depth)];
        // Front slope (ground up to ridge) and back slope (ridge down)
        const ridge0 = [(near0[0] + far0[0]) / 2, heights[i], (near0[1] + far0[1]) / 2];
        const ridge1 = [(near1[0] + far1[0]) / 2, heights[i + 1], (near1[1] + far1[1]) / 2];
        vertices.push(
            near0[0], 0, near0[1], ridge0[0], ridge0[1], ridge0[2], near1[0], 0, near1[1],
            near1[0], 0, near1[1], ridge0[0], ridge0[1], ridge0[2], ridge1[0], ridge1[1], ridge1[2],
            ridge0[0], ridge0[1], ridge0[2], far0[0], 0, far0[1], ridge1[0], ridge1[1], ridge1[2],
            ridge1[0], ridge1[1], ridge1[2], far0[0], 0, far0[1], far1[0], 0, far1[1]
        );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
    return new THREE.Mesh(geometry, material);
}

/**
 * Flat strip of constant width draped along a polyline of [x, z] points.
 */
function ribbon(points, width, material, groundHeight) {
    // Subdivide so the strip follows the terrain between points
    const dense = [];
    points.forEach(([x, z], i) => {
        if (i === 0) {
            dense.push([x, z]);
            return;
        }
        const [px, pz] = points[i - 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 25));
        for (let s = 1; s <= steps; s++) {
            dense.push([px + (x - px) * s / steps, pz + (z - pz) * s / steps]);
        }
    });

    const vertices = [];
    const indices = [];
    dense.forEach(([x, z], i) => {
        const [px, pz] = dense[Math.max(0, i - 1)];
        const [nx, nz] = dense[Math.min(dense.length - 1, i + 1)];
        const length = Math.hypot(nx - px, nz - pz);
        const ox = (-(nz - pz) / length) * width / 2;
        const oz = ((nx - px) / length) * width / 2;
        vertices.push(
            x + ox, groundHeight(x + ox, z + oz) + 0.3, z + oz,
            x - ox, groundHeight(x - ox, z - oz) + 0.3, z - oz
        );
        if (i > 0) {
            const k = i * 2;
            indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

const BRIDGE = {
    HALF_MAIN_SPAN: 2100,   // 4,200 ft main span
    HALF_TOTAL: 3225,       // 1,125 ft side spans
    TOWER_HEIGHT: 746,
    DECK_TOP: 220,          // above the water
    HALF_WIDTH: 45          // 90 ft wide deck
};

function bridgeMaterials() {
    return {
        orange: new THREE.MeshStandardMaterial({
            color: 0xc0362c,
            roughness: 0.6,
            metalness: 0.2,
            // Floodlit at night
            emissive: 0x3a0c06
        }),
        concrete: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 })
    };
}

/**
 * Stylized Golden Gate Bridge between its anchorages, built along local Z
 * (south = +Z) with y = 0 at the water.
 */
function goldenGateBridge({ orange, concrete }) {
    const group = new THREE.Group();
    group.name = 'golden-gate-bridge';

    const { HALF_MAIN_SPAN, HALF_TOTAL, TOWER_HEIGHT, DECK_TOP, HALF_WIDTH } = BRIDGE;
    const SADDLE = TOWER_HEIGHT - 10;
    const CABLE_LOW = DECK_TOP + 15;

    const box = (w, h, d, x, y, z, material = orange) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    };

    // Deck between the anchorages
    box(HALF_WIDTH * 2, 25, HALF_TOTAL * 2, 0, DECK_TOP - 12.5, 0);

    // Towers: two legs joined by portal struts
    for (const z of [-HALF_MAIN_SPAN, HALF_MAIN_SPAN]) {
        for (const x of [-HALF_WIDTH - 5, HALF_WIDTH + 5]) {
            box(30, TOWER_HEIGHT, 33, x, TOWER_HEIGHT / 2, z);
        }
        for (const y of [150, 370, 490, 600, 700, TOWER_HEIGHT - 10]) {
            box(HALF_WIDTH * 2 + 40, 22, 26, 0, y, z);
        }
        // Pier
        box(140, 40, 90, 0, 20, z, concrete);
        // Aviation beacons
        for (const x of [-HALF_WIDTH - 5, HALF_WIDTH + 5]) {
            const beacon = new THREE.Mesh(
                new THREE.SphereGeometry(4, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff2020 })
            );
            beacon.position.set(x, TOWER_HEIGHT + 4, z);
            group.add(beacon);
        }
    }

    // Anchorages (extend below the water/ground line so they sit on the slope)
    for (const z of [-HALF_TOTAL, HALF_TOTAL]) {
        box(140, 300, 250, 0, 110, z, concrete);
    }

    // Main cables: parabola across the main span, sagging chords on the side spans
    const cableHeight = z => {
        const a = Math.abs(z);
        if (a <= HALF_MAIN_SPAN) {
            return CABLE_LOW + (SADDLE - CABLE_LOW) * (a / HALF_MAIN_SPAN) ** 2;
        }
        const t = (a - HALF_MAIN_SPAN) / (HALF_TOTAL - HALF_MAIN_SPAN);
        return SADDLE + (260 - SADDLE) * t - 40 * Math.sin(Math.PI * t);
    };

    const suspenderPoints = [];
    for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
        const points = [];
        for (let z = -HALF_TOTAL; z <= HALF_TOTAL; z += 75) {
            points.push(new THREE.Vector3(x, cableHeight(z), z));
        }
        const cable = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 172, 4, 6),
            orange
        );
        group.add(cable);

        for (let z = -HALF_TOTAL + 50; z < HALF_TOTAL; z += 50) {
            if (Math.abs(Math.abs(z) - HALF_MAIN_SPAN) < 30) continue;
            suspenderPoints.push(x, cableHeight(z), z, x, DECK_TOP, z);
        }
    }
    const suspenderGeometry = new THREE.BufferGeometry();
    suspenderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(suspenderPoints, 3));
    group.add(new THREE.LineSegments(
        suspenderGeometry,
        new THREE.LineBasicMaterial({ color: 0xa83a2e, transparent: true, opacity: 0.7 })
    ));

    return group;
}

/**
 * Approach roadway from an anchorage to where it meets the ground, on piers where
 * it's elevated. Points are world [x, z]; the deck grades evenly from `startTop`
 * to just above the ground at the last point.
 */
function approachRoad(points, startTop, groundHeight, { orange, concrete }) {
    const group = new THREE.Group();
    const THICKNESS = 25;
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
        const [x0, z0] = points[i - 1];
        const [x1, z1] = points[i];
        distances.push(distances[i - 1] + Math.hypot(x1 - x0, z1 - z0));
    }
    const total = distances[distances.length - 1];
    const [endX, endZ] = points[points.length - 1];
    const endTop = groundHeight(endX, endZ) + 2;
    const topAt = d => startTop + (endTop - startTop) * (d / total);

    for (let i = 1; i < points.length; i++) {
        const [x0, z0] = points[i - 1];
        const [x1, z1] = points[i];
        const length = distances[i] - distances[i - 1];
        const top = topAt((distances[i - 1] + distances[i]) / 2);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.HALF_WIDTH * 2, THICKNESS, length + 4), orange);
        deck.position.set((x0 + x1) / 2, top - THICKNESS / 2, (z0 + z1) / 2);
        deck.rotation.y = Math.atan2(x1 - x0, z1 - z0);
        group.add(deck);
    }

    // Piers every ~150 ft where the roadway is well above the ground
    for (let d = 75; d < total; d += 150) {
        const i = distances.findIndex(v => v >= d);
        const t = (d - distances[i - 1]) / (distances[i] - distances[i - 1]);
        const x = points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t;
        const z = points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t;
        const ground = Math.max(0, groundHeight(x, z));
        const height = topAt(d) - THICKNESS - ground;
        if (height < 10) continue;
        const pier = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.HALF_WIDTH * 1.6, height, 16), concrete);
        pier.position.set(x, ground + height / 2, z);
        pier.rotation.y = Math.atan2(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        group.add(pier);
    }
    return group;
}

/**
 * Scatter boxes as one instanced mesh, skipping spots where accept(x, z) is false.
 */
function buildings({ count, area, footprint, height, colors, seed, groundHeight, accept, emissive = 0x000000 }) {
    const random = seededRandom(seed);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    let placed = 0;
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
        const x = area.minX + random() * (area.maxX - area.minX);
        const z = area.minZ + random() * (area.maxZ - area.minZ);
        const w = footprint[0] + random() * (footprint[1] - footprint[0]);
        const d = footprint[0] + random() * (footprint[1] - footprint[0]);
        const h = height(random(), x, z);
        const tint = colors[Math.floor(random() * colors.length)];
        if (!accept(x, z)) continue;
        // Sink the base a little so buildings on slopes don't float
        matrix.makeScale(w, h + 10, d).setPosition(x, groundHeight(x, z) - 10, z);
        mesh.setMatrixAt(placed, matrix);
        mesh.setColorAt(placed, color.setHex(tint));
        placed++;
    }
    mesh.count = placed;
    return mesh;
}

function trees({ count, area, groundHeight, accept, seed }) {
    const random = seededRandom(seed);
    const geometry = new THREE.ConeGeometry(14, 60, 6);
    geometry.translate(0, 30, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0x2f4a2c, flatShading: true });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();

    let placed = 0;
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
        const x = area.minX + random() * (area.maxX - area.minX);
        const z = area.minZ + random() * (area.maxZ - area.minZ);
        const scale = 0.6 + random() * 0.8;
        if (!accept(x, z)) continue;
        matrix.makeScale(scale, scale, scale).setPosition(x, groundHeight(x, z) - 4, z);
        mesh.setMatrixAt(placed, matrix);
        placed++;
    }
    mesh.count = placed;
    return mesh;
}

function buildDesert(group) {
    const playa = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_EXTENT * 2, WORLD_EXTENT * 2),
        new THREE.MeshStandardMaterial({
            map: createNoiseTexture({
                baseColor: '#d4b896',
                noise: 30,
                patchColor: 'rgba(180, 150, 120, 0.1)',
                patches: 20,
                seed: 1,
                repeat: (WORLD_EXTENT * 2) / 300
            }),
            roughness: 0.9,
            metalness: 0
        })
    );
    playa.rotation.x = -Math.PI / 2;
    playa.receiveShadow = true;
    group.add(playa);

    // Black Rock, Granite and Selenite ranges ring the playa
    group.add(mountainRing({
        radius: 26000,
        depth: 12000,
        minHeight: 600,
        maxHeight: 3200,
        color: 0x8c7b74,
        seed: 7
    }));
}

let crissyTerrain = null;
function getCrissyTerrain() {
    crissyTerrain ??= new Terrain(CRISSY_FIELD_TERRAIN);
    return crissyTerrain;
}

// Ground cover, by region, for the terrain's vertex colors
const LAND_COLORS = {
    seabed: new THREE.Color(0x6b6450),
    sand: new THREE.Color(0xd8cba8),
    crissy: new THREE.Color(0x86934f),
    presidio: new THREE.Color(0x5a7045),
    city: new THREE.Color(0x9c9b8e),
    marin: new THREE.Color(0x9a9258),
    island: new THREE.Color(0x7b8350),
    cliff: new THREE.Color(0x8a7d66)
};

function landColor(x, z, height, slope, stepsToWater, color) {
    if (height <= 0) {
        color.copy(LAND_COLORS.seabed);
        return;
    }
    // Low ground next to the water is beach, except along the Marina's seawalls
    const seawall = x > 2600 && z > -1500 && z < 6000;
    if (height < 11 && stepsToWater <= 3 && !seawall) {
        color.copy(LAND_COLORS.sand);
        return;
    }
    if (z < -6500) {
        color.copy(x > 5000 ? LAND_COLORS.island : LAND_COLORS.marin);
    } else if (x > 2600) {
        color.copy(LAND_COLORS.city);
    } else if ((x < -1000 && z > 700) || (x < -3000 && z > -1300)) {
        color.copy(LAND_COLORS.presidio);
    } else {
        color.copy(LAND_COLORS.crissy);
    }
    // Steep bluffs and cliffs show bare earth
    color.lerp(LAND_COLORS.cliff, THREE.MathUtils.smoothstep(slope, 0.12, 0.4));
}

function buildCrissyField(group) {
    const terrain = getCrissyTerrain();
    const groundHeight = (x, z) => Math.max(0, terrain.heightAt(x, z));
    const onLand = (x, z) => terrain.heightAt(x, z) > 3;

    // San Francisco Bay, the Golden Gate and the Pacific at sea level
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_EXTENT * 3, WORLD_EXTENT * 3),
        new THREE.MeshStandardMaterial({ color: 0x3d6f8c, roughness: 0.35, metalness: 0 })
    );
    water.rotation.x = -Math.PI / 2;
    group.add(water);

    // Real terrain: Crissy Field, the Presidio, Marin Headlands, the islands and Mt. Tam
    const ground = terrain.createMesh(
        new THREE.MeshStandardMaterial({
            map: createNoiseTexture({
                baseColor: '#e8e8e8',
                noise: 34,
                patchColor: 'rgba(0, 0, 0, 0.06)',
                patches: 30,
                seed: 2,
                repeat: 1 / 250
            }),
            vertexColors: true,
            roughness: 0.95
        }),
        landColor
    );
    group.add(ground);

    // Golden Gate Promenade (the lights run straight east-west beside it)
    group.add(ribbon(PROMENADE, 16, new THREE.MeshStandardMaterial({
        color: 0xbdb193,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    }), groundHeight));

    // Golden Gate Bridge, positioned from its south tower and deck bearing
    const materials = bridgeMaterials();
    const bridge = goldenGateBridge(materials);
    const turn = THREE.MathUtils.degToRad(360 - GOLDEN_GATE.bearing); // west of north
    const along = [Math.sin(turn), Math.cos(turn)]; // unit vector toward the south end
    const [towerX, towerZ] = GOLDEN_GATE.southTower;
    const center = [towerX - along[0] * BRIDGE.HALF_MAIN_SPAN, towerZ - along[1] * BRIDGE.HALF_MAIN_SPAN];
    bridge.position.set(center[0], 0, center[1]);
    bridge.rotation.y = turn;
    group.add(bridge);

    // US-101 approaches, from each anchorage to the ground
    const anchorage = sign => [
        center[0] + sign * along[0] * BRIDGE.HALF_TOTAL,
        center[1] + sign * along[1] * BRIDGE.HALF_TOTAL
    ];
    group.add(approachRoad([anchorage(1), ...GOLDEN_GATE.southApproach], BRIDGE.DECK_TOP, groundHeight, materials));
    group.add(approachRoad([anchorage(-1), ...GOLDEN_GATE.northApproach], BRIDGE.DECK_TOP, groundHeight, materials));

    // Presidio forest on the hills behind the airfield
    group.add(trees({
        count: 1200,
        area: { minX: -6500, maxX: -500, minZ: -1400, maxZ: 6000 },
        groundHeight,
        accept: (x, z) => terrain.heightAt(x, z) > 40 && !(x > -3600 && z < 700),
        seed: 24
    }));

    // Marina District, Pacific Heights and downtown
    group.add(buildings({
        count: 700,
        area: { minX: 2800, maxX: 14000, minZ: 800, maxZ: 9000 },
        footprint: [40, 90],
        height: r => 25 + r * 25,
        colors: [0xe8e0d0, 0xf0ece4, 0xd9cdb8, 0xe6d5c0, 0xcfd6d9],
        emissive: 0x1a140a,
        groundHeight,
        accept: onLand,
        seed: 25
    }));
    group.add(buildings({
        count: 160,
        area: { minX: 15500, maxX: 21500, minZ: 1500, maxZ: 8000 },
        footprint: [80, 160],
        height: r => 80 + Math.pow(r, 3) * 900,
        colors: [0xb8bcc0, 0xd0d0cc, 0x9aa3ab, 0xc8c0b0],
        emissive: 0x1a1810,
        groundHeight,
        accept: onLand,
        seed: 26
    }));

    // Alcatraz cellhouse
    const [alcatrazX, alcatrazZ] = ALCATRAZ;
    group.add(buildings({
        count: 4,
        area: { minX: alcatrazX - 200, maxX: alcatrazX + 200, minZ: alcatrazZ - 120, maxZ: alcatrazZ + 120 },
        footprint: [60, 250],
        height: () => 50,
        colors: [0xd8d2c4],
        groundHeight,
        accept: (x, z) => terrain.heightAt(x, z) > 40,
        seed: 19
    }));

    // Palace of Fine Arts rotunda
    const [palaceX, palaceZ] = PALACE_OF_FINE_ARTS;
    const palaceY = groundHeight(palaceX, palaceZ);
    const palaceMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a57a, roughness: 0.8 });
    const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(55, 60, 90, 16), palaceMaterial);
    rotunda.position.set(palaceX, palaceY + 45, palaceZ);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), palaceMaterial);
    dome.position.set(palaceX, palaceY + 90, palaceZ);
    group.add(rotunda, dome);

    return groundHeight;
}

export class Environment {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.name = 'environment';
        scene.add(this.group);
        this.groundHeight = () => 0;
    }

    build(environmentId) {
        this.clear();
        if (environmentId === 'crissy-field') {
            this.groundHeight = buildCrissyField(this.group);
        } else {
            buildDesert(this.group);
            this.groundHeight = () => 0;
        }
    }

    /**
     * Height of the ground in feet at a world position
     */
    groundHeightAt(x, z) {
        return this.groundHeight(x, z);
    }

    clear() {
        const disposed = new Set();
        const dispose = resource => {
            if (resource && !disposed.has(resource)) {
                disposed.add(resource);
                resource.dispose();
            }
        };
        this.group.traverse(object => {
            dispose(object.geometry);
            if (object.material) {
                dispose(object.material.map);
                dispose(object.material);
            }
            if (object.isInstancedMesh) object.dispose();
        });
        this.group.clear();
    }
}
