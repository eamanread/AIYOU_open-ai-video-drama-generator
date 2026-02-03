import React, { useEffect, useRef, useState, useCallback } from 'react';

interface GalaxyProps {
  focal?: [number, number];
  rotation?: [number, number];
  starSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  speed?: number;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  saturation?: number;
  mouseRepulsion?: boolean;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  repulsionStrength?: number;
  autoCenterRepulsion?: number;
  transparent?: boolean;
  className?: string;
}

export const Galaxy: React.FC<GalaxyProps> = ({
  focal = [0.5, 0.5],
  rotation = [1.0, 0.0],
  starSpeed = 0.5,
  density = 1,
  hueShift = 140,
  disableAnimation = false,
  speed = 1.0,
  mouseInteraction = true,
  glowIntensity = 0.3,
  saturation = 0.0,
  mouseRepulsion = true,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  repulsionStrength = 2,
  autoCenterRepulsion = 0,
  transparent = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const starsRef = useRef<Array<{
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    size: number;
    hue: number;
    brightness: number;
    twinkle: number;
    angle: number;
    radius: number;
    driftSpeed: number;
    armOffset: number;
  }>>([]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const starCount = Math.floor(300 * density);
    const centerX = width * focal[0];
    const centerY = height * focal[1];

    const stars: Array<{
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      hue: number;
      brightness: number;
      twinkle: number;
      angle: number;
      radius: number;
      driftSpeed: number;
      armOffset: number;
    }> = [];

    const numArms = 3;
    const maxRadius = Math.min(width, height) * 0.55;

    for (let i = 0; i < starCount; i++) {
      const arm = i % numArms;
      const armAngle = (arm / numArms) * Math.PI * 2;
      
      const t = Math.pow(Math.random(), 1.5);
      const radius = t * maxRadius;
      const spiralOffset = radius * 0.8;
      
      const angle = armAngle + spiralOffset + (Math.random() - 0.5) * 0.5;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const sizeRandom = Math.random();
      const size = sizeRandom < 0.7 ? sizeRandom * 1.5 + 0.3 : sizeRandom * 2.5 + 1.5;

      stars.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size,
        hue: hueShift + Math.random() * 25 - 12,
        brightness: Math.random() * 0.4 + 0.6,
        twinkle: Math.random() * Math.PI * 2,
        angle,
        radius,
        driftSpeed: (Math.random() * 0.3 + 0.1) * starSpeed,
        armOffset: Math.random() * 0.3 - 0.15,
      });
    }
    starsRef.current = stars;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    container.innerHTML = '';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    let animationId: number;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (!disableAnimation) {
        time += 0.012 * speed * 60;
      }

      const stars = starsRef.current;

      stars.forEach((star, index) => {
        let currentAngle = star.angle + time * star.driftSpeed * 0.1;
        let currentRadius = star.radius;

        if (!disableAnimation) {
          currentRadius += Math.sin(time * 0.5 + index) * 2;
        }

        let x = centerX + Math.cos(currentAngle) * currentRadius;
        let y = centerY + Math.sin(currentAngle) * currentRadius;

        if (mouseInteraction && isHovered && mouseRepulsion) {
          const dx = x - mousePos.x;
          const dy = y - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 250 && dist > 0) {
            const force = Math.pow((250 - dist) / 250, 1.5) * repulsionStrength;
            if (autoCenterRepulsion > 0) {
              const cdx = centerX - x;
              const cdy = centerY - y;
              const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
              x += (cdx / cdist) * autoCenterRepulsion;
              y += (cdy / cdist) * autoCenterRepulsion;
            } else {
              x += (dx / dist) * force * 40;
              y += (dy / dist) * force * 40;
            }
          }
        }

        const twinkleFactor = 0.5 + Math.sin(time * 1.5 + star.twinkle) * twinkleIntensity;
        const brightness = Math.min(1, star.brightness * twinkleFactor);

        const hue = star.hue;
        const saturationValue = saturation * 60;

        const baseGlow = star.size * (2 + glowIntensity * 6);
        const glowSize = baseGlow;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        gradient.addColorStop(0, `hsla(${hue}, ${saturationValue}%, ${brightness * 95}%, ${brightness})`);
        gradient.addColorStop(0.3, `hsla(${hue}, ${saturationValue}%, ${brightness * 70}%, ${brightness * 0.5})`);
        gradient.addColorStop(0.7, `hsla(${hue}, ${saturationValue}%, ${brightness * 50}%, ${brightness * 0.2})`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturationValue}%, ${brightness * 30}%, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (star.size > 1.2) {
          ctx.beginPath();
          ctx.arc(x, y, star.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, ${saturationValue}%, ${Math.min(100, brightness * 100)}%, ${brightness * 0.9})`;
          ctx.fill();
        }
      });

      if (!disableAnimation) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = container.offsetWidth;
      const newHeight = container.offsetHeight;
      canvas.width = newWidth;
      canvas.height = newHeight;
      render();
    });

    resizeObserver.observe(container);

    if (mouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseenter', () => setIsHovered(true));
      container.addEventListener('mouseleave', () => setIsHovered(false));
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      resizeObserver.disconnect();
      if (mouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseenter', () => setIsHovered(true));
        container.removeEventListener('mouseleave', () => setIsHovered(false));
      }
    };
  }, [
    focal, rotation, starSpeed, density, hueShift, disableAnimation, speed,
    mouseInteraction, glowIntensity, saturation, mouseRepulsion, twinkleIntensity,
    rotationSpeed, repulsionStrength, autoCenterRepulsion, handleMouseMove
  ]);

  return (
    <div
      ref={containerRef}
      className={`galaxy-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: transparent 
          ? 'transparent'
          : '#000000',
      }}
    />
  );
};

export default Galaxy;
