import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const container = document.getElementById('webPet3d');
const canvas = document.getElementById('webPet3dCanvas');
const closeButton = document.getElementById('webPet3dClose');

if (container && canvas) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.1, 8.2);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const root = new THREE.Group();
    const body = new THREE.Group();
    const headPivot = new THREE.Group();
    const eyes = new THREE.Group();
    root.add(body, headPivot);
    scene.add(root);

    const skin = new THREE.MeshStandardMaterial({ color: 0xf0b38d, roughness: 0.58 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x130f17, roughness: 0.4, metalness: 0.08 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x10152b, roughness: 0.42, metalness: 0.05 });
    const lapel = new THREE.MeshStandardMaterial({ color: 0x05060d, roughness: 0.25, metalness: 0.12 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf5eef0, roughness: 0.7 });
    const purple = new THREE.MeshStandardMaterial({ color: 0x7c5cfc, roughness: 0.35, metalness: 0.12 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x302060, roughness: 0.26, metalness: 0.08 });
    const brow = new THREE.MeshStandardMaterial({ color: 0x251c1a, roughness: 0.7 });

    const addMesh = (geometry, material, position, scale, parent = root) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        if (scale) mesh.scale.copy(scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    };

    // 小礼服身体
    addMesh(new THREE.CapsuleGeometry(0.92, 1.72, 8, 20), suit, new THREE.Vector3(0, -1.15, 0), new THREE.Vector3(1, 1, 0.64), body);
    addMesh(new THREE.BoxGeometry(0.72, 1.15, 0.18), shirt, new THREE.Vector3(0, -0.83, 0.58), null, body);
    const leftLapel = addMesh(new THREE.BoxGeometry(0.34, 1.08, 0.11), lapel, new THREE.Vector3(-0.38, -0.86, 0.7), null, body);
    leftLapel.rotation.z = -0.23;
    const rightLapel = addMesh(new THREE.BoxGeometry(0.34, 1.08, 0.11), lapel, new THREE.Vector3(0.38, -0.86, 0.7), null, body);
    rightLapel.rotation.z = 0.23;

    const bowLeft = addMesh(new THREE.SphereGeometry(0.25, 18, 14), lapel, new THREE.Vector3(-0.2, -0.08, 0.82), new THREE.Vector3(1.25, 0.75, 0.45), body);
    const bowRight = addMesh(new THREE.SphereGeometry(0.25, 18, 14), lapel, new THREE.Vector3(0.2, -0.08, 0.82), new THREE.Vector3(1.25, 0.75, 0.45), body);
    addMesh(new THREE.SphereGeometry(0.1, 14, 12), purple, new THREE.Vector3(0, -0.08, 0.9), null, body);

    // 手臂：一只抬起，营造自然的整理袖口动作
    const makeArm = (side, upperRotation, foreRotation) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.86, -0.72, 0);
        const upper = addMesh(new THREE.CapsuleGeometry(0.22, 0.82, 6, 12), suit, new THREE.Vector3(0, -0.36, 0), null, arm);
        upper.rotation.z = upperRotation;
        const hand = addMesh(new THREE.SphereGeometry(0.23, 16, 14), skin, new THREE.Vector3(side * 0.12, -0.82, 0.25), new THREE.Vector3(0.82, 1, 0.72), arm);
        hand.rotation.z = foreRotation;
        body.add(arm);
        return arm;
    };
    const leftArm = makeArm(-1, -0.25, -0.28);
    const rightArm = makeArm(1, 0.52, 0.45);
    rightArm.position.set(0.72, -0.43, 0.18);
    rightArm.rotation.z = -0.55;

    // 脖子、头部和耳朵
    addMesh(new THREE.CylinderGeometry(0.28, 0.32, 0.42, 18), skin, new THREE.Vector3(0, 0.22, 0), null, headPivot);
    addMesh(new THREE.SphereGeometry(1.18, 36, 28), skin, new THREE.Vector3(0, 1.47, 0.05), new THREE.Vector3(0.95, 1.06, 0.88), headPivot);
    addMesh(new THREE.SphereGeometry(0.23, 18, 14), skin, new THREE.Vector3(-1.08, 1.42, 0.02), new THREE.Vector3(0.65, 1, 0.55), headPivot);
    addMesh(new THREE.SphereGeometry(0.23, 18, 14), skin, new THREE.Vector3(1.08, 1.42, 0.02), new THREE.Vector3(0.65, 1, 0.55), headPivot);

    // 后梳蓬松发型：发顶底座 + 多个发束
    addMesh(new THREE.SphereGeometry(1.18, 32, 24), hair, new THREE.Vector3(0, 1.93, -0.08), new THREE.Vector3(0.99, 0.72, 0.9), headPivot);
    for (let i = 0; i < 9; i++) {
        const angle = -1.05 + i * 0.27;
        const strand = addMesh(new THREE.CapsuleGeometry(0.13, 0.54, 5, 10), hair, new THREE.Vector3(Math.sin(angle) * 0.72, 2.32 + Math.cos(angle) * 0.08, 0.72), null, headPivot);
        strand.rotation.z = angle * 0.6;
        strand.rotation.x = Math.PI / 2.8;
    }

    const makeEye = (x) => {
        const eye = new THREE.Group();
        eye.position.set(x, 1.57, 0.94);
        addMesh(new THREE.SphereGeometry(0.27, 20, 16), white, new THREE.Vector3(), new THREE.Vector3(1.08, 0.75, 0.35), eye);
        const pupil = addMesh(new THREE.SphereGeometry(0.12, 18, 14), iris, new THREE.Vector3(0, 0, 0.22), new THREE.Vector3(1, 1.1, 0.4), eye);
        addMesh(new THREE.SphereGeometry(0.035, 12, 10), white, new THREE.Vector3(-0.035, 0.045, 0.3), null, eye);
        eyes.add(eye);
        return { eye, pupil };
    };
    const leftEye = makeEye(-0.42);
    const rightEye = makeEye(0.42);
    headPivot.add(eyes);

    const leftBrow = addMesh(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), brow, new THREE.Vector3(-0.43, 1.91, 0.93), null, headPivot);
    leftBrow.rotation.z = -1.35;
    const rightBrow = addMesh(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), brow, new THREE.Vector3(0.43, 1.91, 0.93), null, headPivot);
    rightBrow.rotation.z = 1.35;
    addMesh(new THREE.SphereGeometry(0.14, 16, 12), skin, new THREE.Vector3(0, 1.37, 1.02), new THREE.Vector3(0.7, 1.1, 0.55), headPivot);
    addMesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), brow, new THREE.Vector3(0, 0.93, 0.99), new THREE.Vector3(1.4, 0.55, 0.35), headPivot).rotation.z = Math.PI / 2;

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(3, 5, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x8d70ff, 18, 10, 2);
    fillLight.position.set(-3, 2.5, 3);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0x5fd9c5, 9, 8, 2);
    rimLight.position.set(3, 1, -3);
    scene.add(rimLight);
    scene.add(new THREE.HemisphereLight(0xc7b9ff, 0x101329, 1.8));

    const target = new THREE.Vector2();
    const current = new THREE.Vector2();
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const resize = () => {
        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();

    window.addEventListener('pointermove', (event) => {
        if (dragging) return;
        const rect = container.getBoundingClientRect();
        target.x = THREE.MathUtils.clamp((event.clientX - (rect.left + rect.width / 2)) / 260, -1, 1);
        target.y = THREE.MathUtils.clamp((event.clientY - (rect.top + rect.height / 2)) / 220, -1, 1);
    }, { passive: true });

    container.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.web-pet-3d-close')) return;
        const rect = container.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        container.classList.add('dragging');
        container.setPointerCapture(event.pointerId);
    });

    container.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - container.offsetHeight);
        container.style.left = `${THREE.MathUtils.clamp(event.clientX - offsetX, 0, maxLeft)}px`;
        container.style.top = `${THREE.MathUtils.clamp(event.clientY - offsetY, 0, maxTop)}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    });

    const stopDrag = (event) => {
        if (!dragging) return;
        dragging = false;
        container.classList.remove('dragging');
        if (event && container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);
    if (closeButton) {
        closeButton.addEventListener('click', () => { container.style.display = 'none'; });
    }

    const clock = new THREE.Clock();
    const render = () => {
        const elapsed = clock.getElapsedTime();
        current.lerp(target, 0.075);
        headPivot.rotation.y = current.x * 0.42;
        headPivot.rotation.x = -current.y * 0.16;
        eyes.position.x = current.x * 0.05;
        eyes.position.y = -current.y * 0.035;
        leftEye.pupil.position.x = current.x * 0.045;
        rightEye.pupil.position.x = current.x * 0.045;
        root.position.y = Math.sin(elapsed * 1.8) * 0.055;
        body.rotation.z = Math.sin(elapsed * 1.1) * 0.025;
        rightArm.rotation.z = -0.55 + Math.sin(elapsed * 1.6) * 0.06;
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
}
