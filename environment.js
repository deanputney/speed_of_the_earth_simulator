import * as THREE from 'three';
import { SF_COAST, MARIN_COAST, PROMENADE, GOLDEN_GATE } from './crissyFieldGeography.js';

/**
 * Site scenery: ground, water, terrain and landmarks.
 *
 * Coordinates are feet relative to the center of the installation,
 * North = -Z, East = +X. Landmark positions are approximate but to scale.
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

/**
 * Flat polygon on the ground. Points are [x, z] pairs in world feet.
 * UVs are in feet, so textures should use repeat = 1 / tileSizeFeet.
 */
function groundPolygon(points, material, y = 0) {
    // ShapeGeometry lies in XY; rotating -90° about X maps shape y to world -z
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * Low-poly hill: a noisy half-ellipsoid.
 */
function hill({ x, z, radiusX, radiusZ, height, material, seed, baseY = 0 }) {
    const random = seededRandom(seed);
    const geometry = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const position = geometry.attributes.position;
    // Jitter vertices (keeping the rim on the ground) for ridges and gullies
    const offsets = new Map();
    for (let i = 0; i < position.count; i++) {
        const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
        if (!offsets.has(key)) offsets.set(key, 0.75 + random() * 0.5);
        const y = position.getY(i);
        if (y > 0.01) position.setY(i, y * offsets.get(key));
    }
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(radiusX, height, radiusZ);
    mesh.position.set(x, baseY, z);
    return mesh;
}

function hillHeightAt(h, x, z) {
    const u = (x - h.x) / h.radiusX;
    const v = (z - h.z) / h.radiusZ;
    const r = 1 - u * u - v * v;
    return r > 0 ? h.height * Math.sqrt(r) : 0;
}

/**
 * Smooth landform with a flat top (plateau = fraction of the radius that is level).
 * Used where the bridge approaches meet the bluffs.
 */
function moundHeightAt(m, x, z) {
    const s = Math.hypot((x - m.x) / m.radiusX, (z - m.z) / m.radiusZ);
    return m.height * (1 - THREE.MathUtils.smoothstep(s, m.plateau, 1));
}

function mound(m) {
    const rings = 24;
    const segments = 48;
    const vertices = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= rings; i++) {
        const r = i / rings;
        for (let j = 0; j < segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            const x = Math.cos(angle) * r * m.radiusX;
            const z = Math.sin(angle) * r * m.radiusZ;
            vertices.push(x, moundHeightAt(m, m.x + x, m.z + z), z);
            // World-space feet, matching groundPolygon so textures line up
            uvs.push(m.x + x, -(m.z + z));
        }
    }
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * segments + j;
            const b = i * segments + (j + 1) % segments;
            const c = a + segments;
            const d = b + segments;
            indices.push(a, b, c, b, d, c);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, m.material);
    mesh.position.set(m.x, 0, m.z);
    mesh.receiveShadow = true;
    return mesh;
}

function pointInPolygon(points, x, z) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, zi] = points[i];
        const [xj, zj] = points[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}

/**
 * Flat strip of constant width following a polyline of [x, z] points.
 */
function ribbon(points, width, material, y = 0) {
    const vertices = [];
    const indices = [];
    points.forEach(([x, z], i) => {
        const [px, pz] = points[Math.max(0, i - 1)];
        const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
        const length = Math.hypot(nx - px, nz - pz);
        const ox = (-(nz - pz) / length) * width / 2;
        const oz = ((nx - px) / length) * width / 2;
        vertices.push(x + ox, y, z + oz, x - ox, y, z - oz);
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

/**
 * Ring of distant mountains on the horizon.
 */
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
 * Stylized Golden Gate Bridge, built along local Z (south = +Z) with y = 0 at the water.
 */
function goldenGateBridge() {
    const group = new THREE.Group();
    group.name = 'golden-gate-bridge';

    const orange = new THREE.MeshStandardMaterial({
        color: 0xc0362c,
        roughness: 0.6,
        metalness: 0.2,
        // Floodlit at night
        emissive: 0x3a0c06
    });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 });

    const HALF_MAIN_SPAN = 2100;   // 4,200 ft main span
    const HALF_TOTAL = 3225;       // 1,125 ft side spans
    const TOWER_HEIGHT = 746;
    const DECK_TOP = 220;
    const HALF_WIDTH = 45;         // 90 ft wide deck
    const SADDLE = TOWER_HEIGHT - 10;
    const CABLE_LOW = DECK_TOP + 15;

    const box = (w, h, d, x, y, z, material = orange) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    };

    // Deck, including short approaches onto land
    box(HALF_WIDTH * 2, 25, (HALF_TOTAL + 1000) * 2, 0, DECK_TOP - 12.5, 0);

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

    // Anchorages
    for (const z of [-HALF_TOTAL, HALF_TOTAL]) {
        box(140, 260, 250, 0, 130, z, concrete);
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
 * Scatter boxes as one instanced mesh, skipping spots where accept(x, z) is false.
 */
function buildings({ count, area, footprint, height, colors, seed, emissive = 0x000000, accept = () => true }) {
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
        const h = height(random());
        const tint = colors[Math.floor(random() * colors.length)];
        if (!accept(x, z)) continue;
        matrix.makeScale(w, h, d).setPosition(x, 0, z);
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

function buildCrissyField(group) {
    const WATER_Y = -6;

    // San Francisco Bay and the Golden Gate
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_EXTENT * 3, WORLD_EXTENT * 3),
        new THREE.MeshStandardMaterial({ color: 0x3d6f8c, roughness: 0.35, metalness: 0 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    group.add(water);

    const grass = new THREE.MeshStandardMaterial({
        map: createNoiseTexture({
            baseColor: '#7d8a4e',
            noise: 40,
            patchColor: 'rgba(150, 140, 80, 0.25)',
            patches: 30,
            seed: 2,
            repeat: 1 / 250
        }),
        roughness: 0.95
    });
    const marinGrass = new THREE.MeshStandardMaterial({ color: 0x75794a, roughness: 0.95 });

    // San Francisco (land south of the shore) and the Marin Headlands
    const [sfWest] = SF_COAST;
    const sfEast = SF_COAST[SF_COAST.length - 1];
    const sfLand = [...SF_COAST, [sfEast[0] + 2000, WORLD_EXTENT], [sfWest[0] - 1000, WORLD_EXTENT]];
    group.add(groundPolygon(sfLand, grass));

    const marinNorth = MARIN_COAST[MARIN_COAST.length - 1];
    const marinLand = [
        ...MARIN_COAST,
        [marinNorth[0], -WORLD_EXTENT], [-WORLD_EXTENT, -WORLD_EXTENT],
        [-WORLD_EXTENT, -26000], [-32300, -20400] // Pacific coast toward Muir Beach
    ];
    group.add(groundPolygon(marinLand, marinGrass));

    // Crissy Field beach: from the waterline to just north of the promenade
    const sand = new THREE.MeshStandardMaterial({
        map: createNoiseTexture({
            baseColor: '#dccfb0',
            noise: 25,
            patchColor: 'rgba(190, 170, 130, 0.15)',
            patches: 20,
            seed: 3,
            repeat: 1 / 150
        }),
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });
    const promenadeZ = x => {
        for (let i = 1; i < PROMENADE.length; i++) {
            const [x1, z1] = PROMENADE[i - 1];
            const [x2, z2] = PROMENADE[i];
            if (x >= x1 && x <= x2) return z1 + (z2 - z1) * (x - x1) / (x2 - x1);
        }
        return null;
    };
    const beachShore = SF_COAST.filter(([x, z]) => x >= -3430 && x <= 2020 && z < 0);
    const beachInner = beachShore.map(([x, z]) => {
        const pathZ = promenadeZ(x);
        const inner = pathZ === null ? z + 120 : pathZ - 14;
        return [x, Math.min(z + 260, Math.max(z + 40, inner))];
    }).reverse();
    group.add(groundPolygon([...beachShore, ...beachInner], sand));

    // Golden Gate Promenade (the lights run straight east-west beside it)
    group.add(ribbon(PROMENADE, 16, new THREE.MeshStandardMaterial({
        color: 0xbdb193,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    })));

    // Golden Gate Bridge, positioned from its south tower and deck bearing
    const bridge = goldenGateBridge();
    const deckTurn = THREE.MathUtils.degToRad(360 - GOLDEN_GATE.bearing); // west of north
    const [towerX, towerZ] = GOLDEN_GATE.southTower;
    bridge.position.set(towerX - Math.sin(deckTurn) * 2100, WATER_Y, towerZ - Math.cos(deckTurn) * 2100);
    bridge.rotation.y = deckTurn;
    group.add(bridge);

    // Bluffs where the approaches meet land: the toll plaza above Fort Point,
    // and the Marin hillside the roadway cuts into
    const bluffs = [
        { x: -3950, z: -1100, radiusX: 700, radiusZ: 1000, height: 212, plateau: 0.4, material: grass },
        { x: -5500, z: -10000, radiusX: 1500, radiusZ: 1400, height: 800, plateau: 0.1, material: marinGrass }
    ];
    bluffs.forEach(m => group.add(mound(m)));

    const presidio = new THREE.MeshLambertMaterial({ color: 0x4a6440, flatShading: true });
    const marin = new THREE.MeshLambertMaterial({ color: 0x75794a, flatShading: true });

    // Marin Headlands, Wolfback Ridge and Mt. Tamalpais
    [
        { x: -10000, z: -9800, radiusX: 3200, radiusZ: 2400, height: 920, seed: 12 },
        { x: -16500, z: -9500, radiusX: 5000, radiusZ: 3500, height: 800, seed: 13 },
        { x: -6000, z: -15000, radiusX: 2000, radiusZ: 3500, height: 900, seed: 14 },
        { x: -30000, z: -38000, radiusX: 14000, radiusZ: 8000, height: 2571, seed: 17 }
    ].forEach(h => group.add(hill({ ...h, material: marin })));

    // Islands and the Tiburon peninsula
    const island = new THREE.MeshLambertMaterial({ color: 0x5d6b45, flatShading: true });
    [
        { x: 2500, z: -21500, radiusX: 4500, radiusZ: 3000, height: 600, seed: 15 },
        { x: 8700, z: -20460, radiusX: 3500, radiusZ: 3000, height: 788, seed: 16 },
        { x: 11460, z: -8000, radiusX: 900, radiusZ: 400, height: 110, seed: 18 }
    ].forEach(h => group.add(hill({ ...h, material: island, baseY: WATER_Y })));

    const alcatraz = buildings({
        count: 4,
        area: { minX: 11300, maxX: 11600, minZ: -8100, maxZ: -7900 },
        footprint: [60, 250],
        height: () => 60,
        colors: [0xd8d2c4],
        seed: 19
    });
    alcatraz.position.y = WATER_Y + 90;
    group.add(alcatraz);

    // Presidio hills, Lincoln Park and Pacific Heights to the south
    const heights = new THREE.MeshLambertMaterial({ color: 0x8a8f80, flatShading: true });
    const southHills = [
        { x: -2800, z: 3800, radiusX: 2500, radiusZ: 2200, height: 330, material: presidio, seed: 21 },
        { x: -200, z: 5200, radiusX: 2800, radiusZ: 2200, height: 280, material: presidio, seed: 22 },
        { x: -10000, z: 8000, radiusX: 3000, radiusZ: 1800, height: 250, material: presidio, seed: 27 },
        { x: 6500, z: 6200, radiusX: 5000, radiusZ: 2600, height: 370, material: heights, seed: 23 }
    ];
    southHills.forEach(h => group.add(hill(h)));

    const onSFLand = (x, z) => pointInPolygon(sfLand, x, z);
    const groundHeight = (x, z) => Math.max(
        0,
        ...southHills.map(h => hillHeightAt(h, x, z)),
        ...bluffs.map(m => moundHeightAt(m, x, z))
    );

    // Presidio forest, leaving the old airfield open
    group.add(trees({
        count: 900,
        area: { minX: -5500, maxX: 1500, minZ: 600, maxZ: 6000 },
        groundHeight,
        accept: (x, z) => onSFLand(x, z) && !(x > -3000 && z < 800),
        seed: 24
    }));

    // Marina District
    group.add(buildings({
        count: 350,
        area: { minX: 2800, maxX: 9500, minZ: 800, maxZ: 3200 },
        footprint: [40, 90],
        height: r => 25 + r * 25,
        colors: [0xe8e0d0, 0xf0ece4, 0xd9cdb8, 0xe6d5c0, 0xcfd6d9],
        emissive: 0x1a140a,
        accept: onSFLand,
        seed: 25
    }));

    // Downtown skyline beyond Russian Hill
    group.add(buildings({
        count: 140,
        area: { minX: 15500, maxX: 21000, minZ: 2000, maxZ: 7500 },
        footprint: [80, 160],
        height: r => 80 + Math.pow(r, 3) * 900,
        colors: [0xb8bcc0, 0xd0d0cc, 0x9aa3ab, 0xc8c0b0],
        emissive: 0x1a1810,
        accept: onSFLand,
        seed: 26
    }));

    // Palace of Fine Arts rotunda
    const palaceMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a57a, roughness: 0.8 });
    const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(55, 60, 90, 16), palaceMaterial);
    rotunda.position.set(4150, 45, 700);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), palaceMaterial);
    dome.position.set(4150, 90, 700);
    group.add(rotunda, dome);
}

export class Environment {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.name = 'environment';
        scene.add(this.group);
    }

    build(environmentId) {
        this.clear();
        if (environmentId === 'crissy-field') {
            buildCrissyField(this.group);
        } else {
            buildDesert(this.group);
        }
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
