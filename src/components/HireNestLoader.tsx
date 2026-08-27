import { motion } from "motion/react";

interface HireNestLoaderProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function HireNestLoader({
  label = "Loading HireNestOS...",
  size = "md",
  className = ""
}: HireNestLoaderProps) {
  const sizeMap = {
    sm: { container: "h-12 w-12", ring1: "h-10 w-10", ring2: "h-6 w-6", text: "text-xs" },
    md: { container: "h-20 w-20", ring1: "h-16 w-16", ring2: "h-10 w-10", text: "text-sm" },
    lg: { container: "h-32 w-32", ring1: "h-28 w-28", ring2: "h-16 w-16", text: "text-base" }
  };

  const selectedSize = sizeMap[size];

  return (
    <div id="hirenest-loader-container" className={`flex flex-col items-center justify-center p-6 space-y-4 text-center ${className}`}>
      <div className={`relative flex items-center justify-center ${selectedSize.container}`}>
        {/* Outer pulsating ring */}
        <motion.div
          id="loader-outer-ring"
          className={`absolute rounded-full border border-blue-500/20 bg-blue-500/5 ${selectedSize.ring1}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.2, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Inner scanning ring */}
        <motion.div
          id="loader-inner-ring"
          className={`absolute rounded-full border-2 border-t-blue-600 border-r-transparent border-b-blue-600 border-l-transparent ${selectedSize.ring2}`}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Core tracking dot */}
        <motion.div
          id="loader-core-dot"
          className="h-2 w-2 rounded-full bg-blue-600"
          animate={{
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {label && (
        <motion.p
          id="loader-label-text"
          className={`font-medium text-slate-600 dark:text-slate-300 tracking-wide ${selectedSize.text}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
