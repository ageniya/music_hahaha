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

    const skin = new THREE.MeshStandardMaterial({ color: 0xe5ad89, roughness: 0.62 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x130f17, roughness: 0.4, metalness: 0.08 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x10152b, roughness: 0.42, metalness: 0.05 });
    const lapel = new THREE.MeshStandardMaterial({ color: 0x05060d, roughness: 0.25, metalness: 0.12 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf5eef0, roughness: 0.7 });
    const purple = new THREE.MeshStandardMaterial({ color: 0x7c5cfc, roughness: 0.35, metalness: 0.12 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x302060, roughness: 0.26, metalness: 0.08 });
    const brow = new THREE.MeshStandardMaterial({ color: 0x251c1a, roughness: 0.7 });
    const lip = new THREE.MeshStandardMaterial({ color: 0xa95f61, roughness: 0.58 });
    const earInner = new THREE.MeshStandardMaterial({ color: 0xd98d7d, roughness: 0.7 });

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

    // 衬衫褶、扣子和口袋巾，让礼服不再是一整块纯色。
    for (let i = 0; i < 3; i++) {
        addMesh(new THREE.SphereGeometry(0.045, 12, 10), purple, new THREE.Vector3(0, -0.56 - i * 0.27, 0.71), null, body);
    }
    const pocketSquare = addMesh(new THREE.BoxGeometry(0.22, 0.13, 0.04), purple, new THREE.Vector3(0.56, -0.68, 0.7), null, body);
    pocketSquare.rotation.z = -0.18;

    const bowLeft = addMesh(new THREE.SphereGeometry(0.25, 18, 14), lapel, new THREE.Vector3(-0.2, -0.08, 0.82), new THREE.Vector3(1.25, 0.75, 0.45), body);
    const bowRight = addMesh(new THREE.SphereGeometry(0.25, 18, 14), lapel, new THREE.Vector3(0.2, -0.08, 0.82), new THREE.Vector3(1.25, 0.75, 0.45), body);
    addMesh(new THREE.SphereGeometry(0.1, 14, 12), purple, new THREE.Vector3(0, -0.08, 0.9), null, body);

    // 手臂：一只抬起，营造自然的整理袖口动作
    const makeArm = (side, upperRotation, foreRotation) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.86, -0.72, 0);
        const upper = addMesh(new THREE.CapsuleGeometry(0.22, 0.82, 6, 12), suit, new THREE.Vector3(0, -0.36, 0), null, arm);
        upper.rotation.z = upperRotation;
        addMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 14), shirt, new THREE.Vector3(side * 0.03, -0.67, 0.12), new THREE.Vector3(1, 1, 0.62), arm).rotation.z = Math.PI / 2;
        const hand = addMesh(new THREE.SphereGeometry(0.23, 16, 14), skin, new THREE.Vector3(side * 0.12, -0.82, 0.25), new THREE.Vector3(0.82, 1, 0.72), arm);
        hand.rotation.z = foreRotation;
        for (let i = 0; i < 3; i++) {
            addMesh(new THREE.SphereGeometry(0.055, 10, 8), skin, new THREE.Vector3(side * (0.03 + i * 0.06), -0.9 + i * 0.035, 0.4), new THREE.Vector3(0.7, 1.1, 0.45), arm);
        }
        body.add(arm);
        return arm;
    };
    const leftArm = makeArm(-1, -0.25, -0.28);
    const rightArm = makeArm(1, 0.52, 0.45);
    rightArm.position.set(0.72, -0.43, 0.18);
    rightArm.rotation.z = -0.55;

    // 脖子、头部和耳朵
    addMesh(new THREE.CylinderGeometry(0.28, 0.32, 0.42, 18), skin, new THREE.Vector3(0, 0.22, 0), null, headPivot);
    // 偏窄椭圆脸，避免落入通用圆脸 Q 版造型。
    addMesh(new THREE.SphereGeometry(1.18, 36, 28), skin, new THREE.Vector3(0, 1.47, 0.05), new THREE.Vector3(0.86, 1.04, 0.82), headPivot);
    addMesh(new THREE.SphereGeometry(0.23, 18, 14), skin, new THREE.Vector3(-1.08, 1.42, 0.02), new THREE.Vector3(0.65, 1, 0.55), headPivot);
    addMesh(new THREE.SphereGeometry(0.23, 18, 14), skin, new THREE.Vector3(1.08, 1.42, 0.02), new THREE.Vector3(0.65, 1, 0.55), headPivot);
    addMesh(new THREE.SphereGeometry(0.115, 14, 10), earInner, new THREE.Vector3(-1.1, 1.42, 0.16), new THREE.Vector3(0.5, 0.78, 0.24), headPivot);
    addMesh(new THREE.SphereGeometry(0.115, 14, 10), earInner, new THREE.Vector3(1.1, 1.42, 0.16), new THREE.Vector3(0.5, 0.78, 0.24), headPivot);

    // 后梳蓬松发型：发顶底座 + 多个发束
    addMesh(new THREE.SphereGeometry(1.18, 32, 24), hair, new THREE.Vector3(0, 1.96, -0.08), new THREE.Vector3(0.91, 0.62, 0.84), headPivot);
    for (let i = 0; i < 9; i++) {
        const angle = -1.05 + i * 0.27;
        const strand = addMesh(new THREE.CapsuleGeometry(0.1, 0.47, 5, 10), hair, new THREE.Vector3(Math.sin(angle) * 0.64, 2.28 + Math.cos(angle) * 0.08, 0.69), null, headPivot);
        strand.rotation.z = angle * 0.6;
        strand.rotation.x = Math.PI / 2.8;
    }
    // 两侧鬓角强化后梳发型的轮廓。
    const leftSideburn = addMesh(new THREE.CapsuleGeometry(0.09, 0.38, 5, 10), hair, new THREE.Vector3(-0.76, 1.79, 0.48), null, headPivot);
    leftSideburn.rotation.z = -0.22;
    const rightSideburn = addMesh(new THREE.CapsuleGeometry(0.09, 0.38, 5, 10), hair, new THREE.Vector3(0.76, 1.79, 0.48), null, headPivot);
    rightSideburn.rotation.z = 0.22;

    const makeEye = (x) => {
        const eye = new THREE.Group();
        eye.position.set(x, 1.58, 0.86);
        const eyeball = addMesh(new THREE.SphereGeometry(0.19, 20, 16), white, new THREE.Vector3(), new THREE.Vector3(1.15, 0.64, 0.24), eye);
        const pupil = addMesh(new THREE.SphereGeometry(0.075, 18, 14), iris, new THREE.Vector3(0, 0, 0.13), new THREE.Vector3(1, 1.08, 0.28), eye);
        addMesh(new THREE.SphereGeometry(0.022, 12, 10), white, new THREE.Vector3(-0.02, 0.025, 0.19), null, eye);
        eyes.add(eye);
        return { eye, pupil, eyeball };
    };
    const leftEye = makeEye(-0.36);
    const rightEye = makeEye(0.36);
    headPivot.add(eyes);

    const leftBrow = addMesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), brow, new THREE.Vector3(-0.37, 1.87, 0.88), null, headPivot);
    leftBrow.rotation.z = -1.35;
    const rightBrow = addMesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), brow, new THREE.Vector3(0.37, 1.87, 0.88), null, headPivot);
    rightBrow.rotation.z = 1.35;
    const noseBridge = addMesh(new THREE.CapsuleGeometry(0.07, 0.28, 5, 10), skin, new THREE.Vector3(0, 1.4, 0.98), new THREE.Vector3(0.75, 1, 0.48), headPivot);
    noseBridge.rotation.z = Math.PI;
    addMesh(new THREE.SphereGeometry(0.12, 16, 12), skin, new THREE.Vector3(0, 1.23, 1.04), new THREE.Vector3(0.82, 0.7, 0.48), headPivot);
    const upperLip = addMesh(new THREE.CapsuleGeometry(0.026, 0.2, 4, 8), lip, new THREE.Vector3(0, 0.98, 1.0), new THREE.Vector3(1.1, 0.6, 0.3), headPivot);
    upperLip.rotation.z = Math.PI / 2;
    const lowerLip = addMesh(new THREE.CapsuleGeometry(0.02, 0.16, 4, 8), lip, new THREE.Vector3(0, 0.925, 1.0), new THREE.Vector3(1, 0.45, 0.25), headPivot);
    lowerLip.rotation.z = Math.PI / 2;
    addMesh(new THREE.SphereGeometry(0.16, 14, 12), skin, new THREE.Vector3(-0.5, 1.16, 0.87), new THREE.Vector3(1, 0.55, 0.25), headPivot);
    addMesh(new THREE.SphereGeometry(0.16, 14, 12), skin, new THREE.Vector3(0.5, 1.16, 0.87), new THREE.Vector3(1, 0.55, 0.25), headPivot);

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
        // 屏幕坐标 Y 向下，头部和瞳孔按相同视觉方向移动。
        headPivot.rotation.x = current.y * 0.12;
        eyes.position.set(0, 0, 0);
        leftEye.pupil.position.x = current.x * 0.045;
        leftEye.pupil.position.y = -current.y * 0.04;
        rightEye.pupil.position.x = current.x * 0.045;
        rightEye.pupil.position.y = -current.y * 0.04;
        const blink = Math.pow(Math.max(0, Math.sin(elapsed * 1.12)), 28);
        leftEye.eyeball.scale.y = 0.64 * (1 - blink * 0.76);
        rightEye.eyeball.scale.y = 0.64 * (1 - blink * 0.76);
        leftEye.pupil.scale.y = 1.08 * (1 - blink * 0.7);
        rightEye.pupil.scale.y = 1.08 * (1 - blink * 0.7);
        root.position.y = Math.sin(elapsed * 1.8) * 0.055;
        body.rotation.z = Math.sin(elapsed * 1.1) * 0.025;
        rightArm.rotation.z = -0.55 + Math.sin(elapsed * 1.6) * 0.06;
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
}
