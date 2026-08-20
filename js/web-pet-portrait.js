(() => {
    const pet = document.getElementById('webPetPortrait');
    const closeButton = document.getElementById('webPetPortraitClose');
    if (!pet) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    window.addEventListener('pointermove', (event) => {
        if (dragging) return;
        const rect = pet.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / 180));
        const y = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / 160));
        pet.style.setProperty('--look-x', `${x * 5}px`);
        pet.style.setProperty('--look-y', `${y * 4}px`);
        pet.style.setProperty('--tilt-y', `${x * 5}deg`);
        pet.style.setProperty('--tilt-x', `${-y * 3}deg`);
    }, { passive: true });

    pet.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.web-pet-portrait-close')) return;
        const rect = pet.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        pet.classList.add('dragging');
        pet.setPointerCapture(event.pointerId);
    });

    pet.addEventListener('pointermove', (event) => {
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
        if (event && pet.hasPointerCapture(event.pointerId)) pet.releasePointerCapture(event.pointerId);
    };
    pet.addEventListener('pointerup', endDrag);
    pet.addEventListener('pointercancel', endDrag);

    if (closeButton) closeButton.addEventListener('click', () => { pet.style.display = 'none'; });
})();
