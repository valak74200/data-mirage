import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  neonBorder?: boolean;
  onClick?: () => void;
}

export default function GlassPanel({ 
  children, 
  className, 
  neonBorder = false,
  onClick 
}: GlassPanelProps) {
  return (
    <motion.div
      className={cn(
        "glass-panel rounded-lg",
        neonBorder && "neon-border",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {children}
    </motion.div>
  );
}
