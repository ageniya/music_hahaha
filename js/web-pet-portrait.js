(() => {
    const pet = document.getElementById('webPetPortrait');
    const closeButton = document.getElementById('webPetPortraitClose');
    if (!pet) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const blink = () => {
        pet.classList.add('blinking');
        window.setTimeout(() => pet.classList.remove('blinking'), 170);
        window.setTimeout(blink, 2200 + Math.random() * 2200);
    };

    window.setTimeout(blink, 700 + Math.random() * 800);

    window.addEventListener('pointermove', (event) => {
        if (dragging) return;
        const rect = pet.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / 180));
        const y = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / 160));
        pet.style.setProperty('--look-x', `${x * 1.2}px`);
        pet.style.setProperty('--look-y', `${y * 0.8}px`);
        pet.style.setProperty('--tilt-y', `${x * 1.6}deg`);
        pet.style.setProperty('--tilt-x', `${-y * 1}deg`);
    }, { passive: true });

    pet.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.web-pet-portrait-close')) return;
        event.preventDefault();
        const rect = pet.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        // 先固定当前位置，避免从 right/bottom 定位切换到 left/top 时发生跳动。
        pet.style.left = `${rect.left}px`;
        pet.style.top = `${rect.top}px`;
        pet.style.right = 'auto';
        pet.style.bottom = 'auto';
        pet.classList.add('dragging');
    });

    window.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const maxLeft = Math.max(0, window.innerWidth - pet.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - pet.offsetHeight);
        pet.style.left = `${Math.max(0, Math.min(maxLeft, event.clientX - offsetX))}px`;
        pet.style.top = `${Math.max(0, Math.min(maxTop, event.clientY - offsetY))}px`;
        pet.style.right = 'auto';
        pet.style.bottom = 'auto';
    });

    const endDrag = (event) => {
        if (!dragging) return;
        dragging = false;
        pet.classList.remove('dragging');
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    if (closeButton) closeButton.addEventListener('click', () => { pet.style.display = 'none'; });
})();
