import * as THREE from 'three';

/**
 * The row of strobe fixtures.
 *
 * Fixtures are laid out along a straight line through `center`. Positions along
 * the line are expressed as "along" distances in feet: light 0 sits at -length/2 and
 * the wave travels toward +length/2 (the travel bearing).
 */

const CORONA_RADIUS = 50; // feet, the 100-foot pool of light around each strobe
const PEAK_POOL_OPACITY = 0.95;
// Over-bright so the center saturates like a strobe-lit surface
const POOL_COLOR = new THREE.Color(0xfff6e8).multiplyScalar(1.6);
const PEAK_GLOW_OPACITY = 0.8;
const IDLE_BULB_EMISSIVE = 0.3;
const PEAK_BULB_EMISSIVE = 4;

/**
 * Pool of light on the ground: bright, even center with a soft edge.
 * (Additive decals instead of SpotLights, so 100+ fixtures stay fast.)
 */
function createPoolTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.8, 'rgba(255,250,240,0.55)');
    gradient.addColorStop(0.92, 'rgba(255,245,230,0.15)');
    gradient.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function createGlowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,245,230,0.25)');
    gradient.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export class Installation {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'installation';
        scene.add(this.group);

        this.fixtures = [];
        this.numLights = 0;
        this.spacing = 0;
        this.headHeight = 0;
        this.scaleCirclesVisible = false;

        // Flash brightness relative to standard (1 = 200,000) and pool size relative to 100 ft
        this.brightness = 1;
        this.spread = 1;

        // Unit vector the wave travels along, and the horizontal vector to its left
        this.direction = new THREE.Vector3(0, 0, 1);
        this.side = new THREE.Vector3(1, 0, 0);
        this.groundHeight = () => 0;
        this.center = new THREE.Vector3();

        // Resources shared by every fixture
        this.glowTexture = createGlowTexture();
        this.poolTexture = createPoolTexture();
        // Slightly larger than the corona so the soft edge falls at ~50 ft
        this.poolGeometry = new THREE.PlaneGeometry(CORONA_RADIUS * 2.2, CORONA_RADIUS * 2.2, 16, 16)
            .rotateX(-Math.PI / 2);
        this.poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.7,
            metalness: 0.3,
            emissive: 0x222222,
            emissiveIntensity: 0.2
        });
        this.bulbGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        this.circleGeometry = new THREE.RingGeometry(CORONA_RADIUS - 0.5, CORONA_RADIUS + 0.5, 64)
            .rotateX(-Math.PI / 2);
        this.circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });

        // Per-build resources, disposed on rebuild
        this.buildResources = [];
    }

    get length() {
        return (this.numLights - 1) * this.spacing;
    }

    /**
     * World position of a point `along` feet from the center of the row,
     * `side` feet to the left of the line and `height` feet above the ground.
     */
    pointAt(along, height = 0, side = 0, target = new THREE.Vector3()) {
        target.copy(this.direction).multiplyScalar(along).addScaledVector(this.side, side).add(this.center);
        return target.setY(this.groundHeight(target.x, target.z) + height);
    }

    /**
     * Copy of a flat ground-level geometry, scaled and draped over the terrain around `base`
     */
    drape(geometry, base, lift, scale = 1) {
        const draped = geometry.clone();
        const position = draped.attributes.position;
        for (let k = 0; k < position.count; k++) {
            const x = position.getX(k) * scale;
            const z = position.getZ(k) * scale;
            position.setXYZ(k, x, this.groundHeight(base.x + x, base.z + z) - base.y + lift, z);
        }
        return draped;
    }

    // Brightness reads roughly logarithmically, so scale the pools by its square root
    get perceivedBrightness() {
        return Math.sqrt(this.brightness);
    }

    alongForIndex(index) {
        return -this.length / 2 + index * this.spacing;
    }

    /**
     * @param {object} layout - { numLights, spacing, headHeight, travelBearing, center: [x, z] }
     * @param {function} groundHeight - (x, z) => ground elevation in feet
     */
    build({ numLights, spacing, headHeight, travelBearing, center = [0, 0] }, groundHeight = () => 0) {
        this.clear();

        this.numLights = numLights;
        this.spacing = spacing;
        this.headHeight = headHeight;
        this.groundHeight = groundHeight;
        this.center.set(center[0], 0, center[1]);

        // Bearing: 0 = North (-Z), 90 = East (+X)
        const bearing = travelBearing * Math.PI / 180;
        this.direction.set(Math.sin(bearing), 0, -Math.cos(bearing));
        this.side.crossVectors(new THREE.Vector3(0, 1, 0), this.direction);

        const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, headHeight, 8);
        this.buildResources.push(poleGeometry);

        for (let i = 0; i < numLights; i++) {
            const base = this.pointAt(this.alongForIndex(i));
            const head = base.clone().setY(base.y + headHeight);

            const pole = new THREE.Mesh(poleGeometry, this.poleMaterial);
            pole.position.copy(base).setY(base.y + headHeight / 2);
            pole.castShadow = true;
            pole.receiveShadow = true;
            this.group.add(pole);

            const poolMaterial = new THREE.MeshBasicMaterial({
                map: this.poolTexture,
                color: POOL_COLOR.clone().multiplyScalar(this.perceivedBrightness),
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                polygonOffsetUnits: -4
            });
            const pool = new THREE.Mesh(this.drape(this.poolGeometry, base, 0.3, this.spread), poolMaterial);
            pool.position.copy(base);
            this.group.add(pool);
            this.buildResources.push(poolMaterial);

            const bulbMaterial = new THREE.MeshStandardMaterial({
                color: 0xffddaa,
                emissive: 0xffaa44,
                emissiveIntensity: IDLE_BULB_EMISSIVE,
                roughness: 0.3,
                metalness: 0.1
            });
            const bulb = new THREE.Mesh(this.bulbGeometry, bulbMaterial);
            bulb.position.copy(head);
            this.group.add(bulb);
            this.buildResources.push(bulbMaterial);

            // Halo around the flash head, sized in world units
            const glowMaterial = new THREE.SpriteMaterial({
                map: this.glowTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const glow = new THREE.Sprite(glowMaterial);
            glow.scale.setScalar(24);
            glow.position.copy(head);
            this.group.add(glow);
            this.buildResources.push(glowMaterial);

            // Fixed screen-size point so distant strobes stay visible down a mile-long row
            const starMaterial = new THREE.SpriteMaterial({
                map: this.glowTexture,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                sizeAttenuation: false
            });
            const star = new THREE.Sprite(starMaterial);
            star.scale.setScalar(0.03);
            star.position.copy(head);
            this.group.add(star);
            this.buildResources.push(starMaterial);

            const circleGeometry = this.drape(this.circleGeometry, base, 0.4);
            this.buildResources.push(circleGeometry);
            const scaleCircle = new THREE.Mesh(circleGeometry, this.circleMaterial);
            scaleCircle.position.copy(base);
            scaleCircle.visible = this.scaleCirclesVisible;
            this.group.add(scaleCircle);

            this.fixtures.push({ base, pool, glow, star, bulb, scaleCircle });
        }
    }

    clear() {
        for (const fixture of this.fixtures) fixture.pool.geometry.dispose();
        this.group.clear();
        this.buildResources.forEach(resource => resource.dispose());
        this.buildResources = [];
        this.fixtures = [];
    }

    /**
     * Set the flash level of one fixture.
     * @param {number} level - 0 (off) to 1 (peak of flash)
     */
    setLevel(index, level) {
        const fixture = this.fixtures[index];
        if (!fixture) return;
        const glowLevel = level * Math.min(1, this.perceivedBrightness);
        fixture.pool.material.opacity = level * PEAK_POOL_OPACITY;
        fixture.glow.material.opacity = glowLevel * PEAK_GLOW_OPACITY;
        fixture.star.material.opacity = glowLevel;
        fixture.bulb.material.emissiveIntensity =
            IDLE_BULB_EMISSIVE + level * (PEAK_BULB_EMISSIVE - IDLE_BULB_EMISSIVE);
    }

    setAllLevels(level) {
        for (let i = 0; i < this.fixtures.length; i++) this.setLevel(i, level);
    }

    /**
     * @param {number} brightness - relative to the standard flash (1 = 200,000)
     */
    setBrightness(brightness) {
        this.brightness = Math.max(0, brightness);
        for (const fixture of this.fixtures) {
            fixture.pool.material.color.copy(POOL_COLOR).multiplyScalar(this.perceivedBrightness);
        }
    }

    /**
     * @param {number} spread - pool of light size relative to the 100 ft corona
     */
    setSpread(spread) {
        this.spread = Math.max(0.1, spread);
        for (const fixture of this.fixtures) {
            fixture.pool.geometry.dispose();
            fixture.pool.geometry = this.drape(this.poolGeometry, fixture.base, 0.3, this.spread);
        }
    }

    setScaleCirclesVisible(visible) {
        this.scaleCirclesVisible = visible;
        for (const fixture of this.fixtures) fixture.scaleCircle.visible = visible;
    }
}
