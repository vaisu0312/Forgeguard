/**
 * js/particles.js
 * Handles the animated canvas-based particle network background.
 */

let canvas, ctx;
let particlesArray = [];
let density = 15000; // Default density value
let animationId = null;

/**
 * Initializes the particle system.
 */
export function initParticles() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
    // Set initial size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Listen for settings updates from settings.js
    window.addEventListener('updateParticles', (e) => {
        density = e.detail.count;
        initParticlesArray();
    });

    // Start loop
    initParticlesArray();
    animate();
}

/**
 * Adjusts canvas to window size.
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticlesArray();
}

/**
 * Particle class definition.
 */
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Wrap around screen boundaries
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Populates the array based on current density setting.
 */
function initParticlesArray() {
    particlesArray = [];
    const numberOfParticles = (canvas.width * canvas.height) / density;
    for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
    }
}

/**
 * Main animation loop.
 */
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();

        // Connect particles with lines
        for (let j = i; j < particlesArray.length; j++) {
            const dx = particlesArray[i].x - particlesArray[j].x;
            const dy = particlesArray[i].y - particlesArray[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(0, 243, 255, ${0.12 - distance / 1000})`;
                ctx.lineWidth = 0.5;
                ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                ctx.stroke();
            }
        }
    }
    animationId = requestAnimationFrame(animate);
}