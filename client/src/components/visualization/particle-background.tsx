import { useMemo } from "react";
import { motion } from "framer-motion";

export default function ParticleBackground() {
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      animationDelay: Math.random() * 20,
      size: Math.random() * 2 + 1,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="particle absolute opacity-70"
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.animationDelay}s`,
          }}
          initial={{ y: "100vh", opacity: 0 }}
          animate={{
            y: "-100vh",
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
            delay: particle.animationDelay,
          }}
        />
      ))}
    </div>
  );
}
