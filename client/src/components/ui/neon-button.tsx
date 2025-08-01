import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: ReactNode;
  variant?: 'cyan' | 'green' | 'violet';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function NeonButton({
  children,
  variant = 'cyan',
  size = 'md',
  active = false,
  disabled = false,
  className,
  onClick
}: NeonButtonProps) {
  const variantClasses = {
    cyan: active ? 'bg-cyan-400 text-space' : 'bg-gray-700 hover:bg-gray-600',
    green: active ? 'bg-green-400 text-space' : 'bg-gray-700 hover:bg-gray-600',
    violet: active ? 'bg-violet-400 text-space' : 'bg-gray-700 hover:bg-gray-600',
  };

  const sizeClasses = {
    sm: 'py-1 px-2 text-xs',
    md: 'py-2 px-3 text-sm',
    lg: 'py-3 px-4 text-base',
  };

  return (
    <motion.button
      className={cn(
        "font-bold rounded transition-all duration-300",
        variantClasses[variant],
        sizeClasses[size],
        active && `pulse-neon`,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
    >
      {children}
    </motion.button>
  );
}
