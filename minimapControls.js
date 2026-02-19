import * as THREE from 'three';

/**
 * MinimapControls - Manages minimap rendering with 3D character marker
 * Displays a top-down orthographic view in the bottom-left corner
 * Allows drag-and-drop teleportation by moving the character marker
 */
export class MinimapControls {
    constructor(camera, scene, cameraController, lights) {
        this.mainCamera = camera;
        this.mainScene = scene;
        this.cameraController = cameraController;
        this.lights = lights;

        // Minimap rendering
        this.minimapRenderer = null;
        this.minimapCamera = null;
        this.minimapContainer = null;
        this.character = null;
        this.lightMarkers = [];

        // Interaction state
        this.isDragging = false;
        this.dragStartPos = new THREE.Vector2();

        // World bounds (installation is 6000x6000 feet, view 6500x6500)
        this.worldBounds = 3250; // Half width/height of view
        this.groundBounds = 3000; // Hard limit for character position

        // Layer configuration
        // Layer 0: Default (visible to both cameras)
        // Layer 1: Minimap-only (character and light markers)
        this.MINIMAP_LAYER = 1;

        this.setupMinimap();
        this.configureCameraLayers();
        this.createCharacter();
        this.createLightMarkers();
        this.setupInteraction();
    }

    /**
     * Initialize minimap renderer and orthographic camera
     */
    setupMinimap() {
        // Create container element
        this.minimapContainer = document.createElement('div');
        this.minimapContainer.className = 'minimap-container';
        document.body.appendChild(this.minimapContainer);

        // Create minimap renderer (200x200 pixels)
        this.minimapRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.minimapRenderer.setSize(200, 200);
        this.minimapRenderer.setClearColor(0x1a1a2e); // Dark background
        this.minimapContainer.appendChild(this.minimapRenderer.domElement);

        // Create orthographic camera for top-down view
        // View shows 6000x6000 feet centered on origin (matches ground bounds)
        this.minimapCamera = new THREE.OrthographicCamera(
            -this.groundBounds, // left
            this.groundBounds,  // right
            this.groundBounds,  // top
            -this.groundBounds, // bottom
            0.1,                // near
            1000                // far
        );

        // Position camera above looking straight down
        this.minimapCamera.position.set(0, 500, 0);
        this.minimapCamera.lookAt(0, 0, 0);
    }

    /**
     * Configure camera layers to control what each camera sees
     * Main camera: Layer 0 only (default scene objects)
     * Minimap camera: Layers 0 and 1 (scene + minimap-specific objects)
     */
    configureCameraLayers() {
        // Main camera: Only see layer 0 (default layer)
        this.mainCamera.layers.set(0);

        // Minimap camera: See both layer 0 and layer 1
        this.minimapCamera.layers.disableAll();
        this.minimapCamera.layers.enable(0);
        this.minimapCamera.layers.enable(this.MINIMAP_LAYER);
    }

    /**
     * Create simple circle marker for current position
     * Uses minimap-only layer so it's not visible in main camera
     */
    createCharacter() {
        // Create a group to hold both circle and direction indicator
        this.character = new THREE.Group();

        // Create a simple flat circle to show current position
        const circleGeometry = new THREE.CircleGeometry(50, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x4CAF50,
            emissive: 0x4CAF50,
            emissiveIntensity: 0.7,
            side: THREE.DoubleSide
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2; // Lay flat on ground
        circle.layers.set(this.MINIMAP_LAYER); // Set layer on circle mesh
        this.character.add(circle);

        // Create direction indicator triangle showing which way camera is facing
        const triangleGeometry = new THREE.BufferGeometry();
        // Triangle pointing forward (-Z direction), positioned close to circle edge
        const triangleVertices = new Float32Array([
            0, 0.5, -230,      // Tip of triangle (180 units beyond circle radius)
            -120, 0.5, -50,    // Left corner of base (at circle edge)
            120, 0.5, -50      // Right corner of base (at circle edge)
        ]);
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(triangleVertices, 3));
        // Define the face (vertices in counter-clockwise order for upward normal)
        triangleGeometry.setIndex([0, 1, 2]);

        const triangleMaterial = new THREE.MeshBasicMaterial({
            color: 0x4CAF50,  // Green to match position circle
            emissive: 0x4CAF50,
            emissiveIntensity: 0.7,
            side: THREE.DoubleSide
        });
        this.directionIndicator = new THREE.Mesh(triangleGeometry, triangleMaterial);
        this.directionIndicator.layers.set(this.MINIMAP_LAYER); // Set layer on triangle
        this.character.add(this.directionIndicator);

        // Note: Layers must be set on individual meshes/lines, not the group
        this.character.layers.set(this.MINIMAP_LAYER); // Set on group for completeness

        // Add to main scene (will only be visible in minimap camera due to layers)
        this.mainScene.add(this.character);
    }

    /**
     * Create white dot markers for each light position
     * Uses minimap-only layer so they're not visible in main camera
     */
    createLightMarkers() {
        this.lightMarkers = [];

        for (let i = 0; i < this.lights.length; i++) {
            const light = this.lights[i];

            // Create white dot at ground level (visible on minimap)
            const markerGeometry = new THREE.SphereGeometry(20, 8, 8);
            const markerMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.8
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);

            // Position at light location (at ground level for minimap)
            marker.position.set(
                light.position.x,
                0.5, // Slightly above ground
                light.position.z
            );

            // Set marker to minimap-only layer (not visible in main camera)
            marker.layers.set(this.MINIMAP_LAYER);

            this.mainScene.add(marker);
            this.lightMarkers.push(marker);
        }
    }

    /**
     * Setup mouse event listeners for click-to-teleport and drag-to-teleport
     */
    setupInteraction() {
        const canvas = this.minimapRenderer.domElement;

        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        canvas.addEventListener('click', (e) => this.onClick(e));
    }

    /**
     * Handle mouse down - start dragging
     */
    onMouseDown(e) {
        this.isDragging = true;
        this.dragStartPos.set(e.offsetX, e.offsetY);
    }

    /**
     * Handle mouse move - update character position during drag
     */
    onMouseMove(e) {
        if (!this.isDragging) return;

        const canvas = this.minimapRenderer.domElement;
        const rect = canvas.getBoundingClientRect();

        // Convert canvas coordinates to NDC (-1 to 1)
        const x = (e.offsetX / rect.width) * 2 - 1;
        const y = -(e.offsetY / rect.height) * 2 + 1; // Flip Y

        // Convert NDC to world coordinates using ground bounds (matches camera bounds)
        const worldX = x * this.groundBounds;
        const worldZ = -y * this.groundBounds; // Negate for Z axis

        // Clamp to ground bounds
        const clampedX = Math.max(-this.groundBounds, Math.min(this.groundBounds, worldX));
        const clampedZ = Math.max(-this.groundBounds, Math.min(this.groundBounds, worldZ));

        // Update character position visually during drag
        this.character.position.x = clampedX;
        this.character.position.z = clampedZ;
    }

    /**
     * Handle mouse up - complete teleportation if dragging
     */
    onMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Teleport camera to character's current position
        this.teleportCamera(this.character.position.x, this.character.position.z);
    }

    /**
     * Handle mouse leave - cancel drag if leaving canvas
     */
    onMouseLeave(e) {
        this.isDragging = false;
    }

    /**
     * Handle click - teleport to clicked position
     */
    onClick(e) {
        const canvas = this.minimapRenderer.domElement;
        const rect = canvas.getBoundingClientRect();

        // Convert canvas coordinates to NDC (-1 to 1)
        const x = (e.offsetX / rect.width) * 2 - 1;
        const y = -(e.offsetY / rect.height) * 2 + 1; // Flip Y

        // Convert NDC to world coordinates using ground bounds (matches camera bounds)
        const worldX = x * this.groundBounds;
        const worldZ = -y * this.groundBounds; // Negate for Z axis

        // Clamp to ground bounds
        const clampedX = Math.max(-this.groundBounds, Math.min(this.groundBounds, worldX));
        const clampedZ = Math.max(-this.groundBounds, Math.min(this.groundBounds, worldZ));

        // Teleport to clicked position
        this.teleportCamera(clampedX, clampedZ);
    }

    /**
     * Teleport camera to specified world coordinates
     * Camera will face the center (0, 0, 0) after teleportation
     */
    teleportCamera(worldX, worldZ) {
        // Create new position at walking height
        const newPosition = new THREE.Vector3(worldX, 6, worldZ);

        // Calculate orientation to face center
        const direction = new THREE.Vector3(0, 0, 0).sub(newPosition);
        direction.y = 0; // Only horizontal direction
        direction.normalize();

        // Calculate yaw angle to face center
        // Camera's forward is -Z, so we need: yaw = atan2(-dx, -dz)
        const yaw = Math.atan2(-direction.x, -direction.z);

        // DEBUG: Log teleport details
        console.log('=== MINIMAP TELEPORT DEBUG ===');
        console.log('Teleport to position:', worldX, worldZ);
        console.log('Direction to center:', direction.x.toFixed(3), direction.z.toFixed(3));
        console.log('Calculated yaw (radians):', yaw.toFixed(3));
        console.log('Calculated yaw (degrees):', (yaw * 180 / Math.PI).toFixed(1));

        // Create euler with calculated yaw, slight downward pitch
        const euler = new THREE.Euler(-0.1, yaw, 0, 'YXZ');
        console.log('Euler angles:', euler.x.toFixed(3), euler.y.toFixed(3), euler.z.toFixed(3));

        // Call camera controller's teleport method
        console.log('Calling cameraController.teleportToPosition...');
        this.cameraController.teleportToPosition(newPosition, euler, 1.0);
    }

    /**
     * Update position marker and direction indicator to match camera
     * Render minimap
     */
    update() {
        if (!this.character || !this.minimapCamera || !this.minimapRenderer) return;

        // Update circle position to match camera (only X and Z, Y stays at ground)
        this.character.position.x = this.mainCamera.position.x;
        this.character.position.z = this.mainCamera.position.z;
        this.character.position.y = 0.5; // Keep at ground level for minimap visibility

        // Update direction indicator rotation to match camera yaw
        // Extract yaw from camera quaternion
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.mainCamera.quaternion);
        this.character.rotation.y = euler.y;

        // Render minimap view
        this.minimapRenderer.render(this.mainScene, this.minimapCamera);
    }

    /**
     * Show minimap
     */
    show() {
        if (this.minimapContainer) {
            this.minimapContainer.style.display = 'block';
        }
        if (this.character) {
            this.character.visible = true;
        }
        // Show light markers
        this.lightMarkers.forEach(marker => marker.visible = true);

        // Re-apply camera layer configuration to ensure main camera doesn't see minimap objects
        this.configureCameraLayers();
    }

    /**
     * Hide minimap
     */
    hide() {
        if (this.minimapContainer) {
            this.minimapContainer.style.display = 'none';
        }
        if (this.character) {
            this.character.visible = false;
        }
        // Hide light markers
        this.lightMarkers.forEach(marker => marker.visible = false);
    }
}
